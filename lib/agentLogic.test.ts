import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_MAX_HISTORY_MESSAGES,
  AGENT_MAX_MESSAGE_CHARS,
  buildAgentSystemInstruction,
  checkRateLimit,
  normalizeAgentResponse,
  normalizeRoiEstimate,
  normalizeServiceId,
  validateAgentRequest,
} from './agentLogic';
import { DEFAULT_ROI_INPUT } from './portfolioLogic';

test('validateAgentRequest accepts valid payload and clamps currentRoi', () => {
  const result = validateAgentRequest({
    locale: 'uk',
    currentRoi: { teamSize: 99, weeklyManualHoursPerPerson: 50, hourlyRateUsd: 500 },
    messages: [{ role: 'user', content: '  Хочу автоматизувати CRM  ' }],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.locale, 'uk');
    assert.equal(result.data.messages.length, 1);
    assert.equal(result.data.messages[0].content, 'Хочу автоматизувати CRM');
    assert.deepEqual(result.data.currentRoi, {
      teamSize: 30,
      weeklyManualHoursPerPerson: 20,
      hourlyRateUsd: 200,
    });
  }
});

test('validateAgentRequest rejects empty messages, oversized input, and non-user trailing turn', () => {
  const empty = validateAgentRequest({ locale: 'uk', messages: [] });
  assert.equal(empty.ok, false);

  const tooLong = validateAgentRequest({
    locale: 'en',
    messages: [{ role: 'user', content: 'a'.repeat(AGENT_MAX_MESSAGE_CHARS + 1) }],
  });
  assert.equal(tooLong.ok, false);

  const assistantLast = validateAgentRequest({
    locale: 'uk',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ],
  });
  assert.equal(assistantLast.ok, false);
});

test('validateAgentRequest truncates long history to latest AGENT_MAX_HISTORY_MESSAGES', () => {
  const messages = Array.from({ length: 17 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `Turn ${i + 1}`,
  }));
  const result = validateAgentRequest({ locale: 'en', messages });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.messages.length, AGENT_MAX_HISTORY_MESSAGES);
    assert.equal(result.data.messages[result.data.messages.length - 1].content, 'Turn 17');
  }
});

test('normalizeServiceId maps canonical IDs and common aliases', () => {
  assert.equal(normalizeServiceId('ai-agents'), 'ai-agents');
  assert.equal(normalizeServiceId('audit'), 'audit-architecture');
  assert.equal(normalizeServiceId('bi-dashboard'), 'bi-dashboards');
  assert.equal(normalizeServiceId('end-to-end'), 'etl-pipelines');
  assert.equal(normalizeServiceId('unknown-track'), null);
});

test('normalizeRoiEstimate clamps valid bounds and rejects invalid values', () => {
  assert.deepEqual(
    normalizeRoiEstimate({ teamSize: 0.4, weeklyManualHoursPerPerson: 12.4, hourlyRateUsd: 3 }),
    { teamSize: 1, weeklyManualHoursPerPerson: 12, hourlyRateUsd: 5 }
  );
  assert.equal(normalizeRoiEstimate({ teamSize: 0, weeklyManualHoursPerPerson: 5, hourlyRateUsd: 20 }), undefined);
  assert.equal(normalizeRoiEstimate({ teamSize: 'abc', weeklyManualHoursPerPerson: 5, hourlyRateUsd: 20 }), undefined);
  assert.equal(normalizeRoiEstimate(null), undefined);
});

test('normalizeAgentResponse parses fenced JSON, clamps ROI, dedupes stack, and caps quickReplies', () => {
  const raw = [
    '```json',
    JSON.stringify({
      reply: 'Для вашої команди підійде AI-оркестрація CRM на n8n.',
      recommendation: {
        serviceId: 'ai-automation',
        estimatedTimeline: '2–3 тижні',
        estimatedBudgetRange: '$2,200 – $3,200',
        suggestedStack: ['n8n', 'Python', 'n8n', 'PostgreSQL', 'HubSpot', 'Extra'],
        briefSummary: 'AI-автоматизація CRM (6 менеджерів)',
        briefDraft: 'Потрібно автоматизувати ручне перенесення заявок із CRM у таблиці для 6 менеджерів.',
        roiEstimate: {
          teamSize: 6,
          weeklyManualHoursPerPerson: 8,
          hourlyRateUsd: 18,
        },
      },
      quickReplies: ['Уточнити інтеграції', 'Показати кейси', 'Питання по NDA', 'Зайвий 4-й варіант'],
    }),
    '```',
  ].join('\n');

  const normalized = normalizeAgentResponse(raw, 'uk');
  assert.ok(normalized);
  assert.equal(normalized.recommendation?.serviceId, 'ai-agents');
  assert.deepEqual(normalized.recommendation?.suggestedStack, ['n8n', 'Python', 'PostgreSQL', 'HubSpot']);
  assert.deepEqual(normalized.recommendation?.roiEstimate, {
    teamSize: 6,
    weeklyManualHoursPerPerson: 8,
    hourlyRateUsd: 18,
  });
  assert.equal(normalized.quickReplies.length, 3);
});

test('normalizeAgentResponse builds fallback briefSummary and briefDraft if omitted', () => {
  const normalized = normalizeAgentResponse(
    {
      reply: 'Почніть із 5-денного аудиту за $850.',
      recommendation: {
        serviceId: 'audit-architecture',
        estimatedTimeline: '',
        estimatedBudgetRange: '',
        suggestedStack: [],
      },
      quickReplies: [],
    },
    'uk'
  );

  assert.ok(normalized);
  assert.ok(normalized.recommendation);
  assert.equal(normalized.recommendation.serviceId, 'audit-architecture');
  assert.ok(normalized.recommendation.briefSummary.includes('AI-агент'));
  assert.ok(normalized.recommendation.briefDraft.length >= 20);
  assert.ok(normalized.recommendation.suggestedStack.length > 0);
});

test('checkRateLimit enforces sliding window and recovers after expiry', () => {
  const store = new Map<string, number[]>();
  assert.equal(checkRateLimit(store, 'ip-1', 1000, 2, 10_000).allowed, true);
  assert.equal(checkRateLimit(store, 'ip-1', 2000, 2, 10_000).allowed, true);
  const blocked = checkRateLimit(store, 'ip-1', 3000, 2, 10_000);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 8);

  const recovered = checkRateLimit(store, 'ip-1', 12_000, 2, 10_000);
  assert.equal(recovered.allowed, true);
});

test('buildAgentSystemInstruction grounds model in Oleksandr Mykhalskyi services and pricing', () => {
  const prompt = buildAgentSystemInstruction('uk', DEFAULT_ROI_INPUT);
  assert.ok(prompt.includes('Олександр Михальський'));
  assert.ok(prompt.includes('audit-architecture'));
  assert.ok(prompt.includes('$850'));
  assert.ok(prompt.includes(`teamSize=${DEFAULT_ROI_INPUT.teamSize}`));
});
