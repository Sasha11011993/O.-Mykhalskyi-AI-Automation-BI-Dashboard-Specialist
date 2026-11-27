import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCaseAgentPatch,
  buildWorkflowSummaryForAgent,
  extractBase64ImageFromDataUrl,
  normalizeCaseAgentResponse,
  popUndoSnapshot,
  pushUndoSnapshot,
  validateCaseAgentRequest,
  type CaseAgentDraftSnapshot,
} from '@/lib/caseAgentLogic';
import { createBlankCaseDraft } from '@/lib/caseStudioTypes';
import { PRODUCTION_DEBT_CONTROL_WORKFLOW } from '@/lib/n8nWorkflowEngine';
import { parseJwtParts, validateFirebaseTokenClaims } from '@/lib/firebaseServerAuth';

const SAMPLE_DRAFT_SNAPSHOT: CaseAgentDraftSnapshot = {
  id: 'case-123',
  status: 'draft',
  category: 'ai',
  year: '2026',
  titleUk: '',
  titleEn: '',
  industryUk: '',
  industryEn: '',
  durationUk: '',
  durationEn: '',
  headlineMetricUk: '',
  headlineMetricEn: '',
  summaryUk: '',
  summaryEn: '',
  challengeUk: '',
  challengeEn: '',
  solutionUk: '',
  solutionEn: '',
  stack: [],
  metrics: [],
  testimonial: {
    quoteUk: '',
    quoteEn: '',
    authorUk: '',
    authorEn: '',
    roleUk: '',
    roleEn: '',
    company: '',
  },
  scenes: [
    {
      id: 'scene-n8n',
      kind: 'n8n-json',
      titleUk: 'Воркфлоу',
      titleEn: 'Workflow',
      captionUk: '',
      captionEn: '',
      hotspotCount: 0,
    },
    {
      id: 'scene-tg',
      kind: 'ui-telegram',
      titleUk: 'Telegram-бот',
      titleEn: 'Telegram Bot',
      captionUk: '',
      captionEn: '',
      hotspotCount: 0,
    },
  ],
};

test('buildWorkflowSummaryForAgent extracts real node names, stack, and counts from production n8n workflow', () => {
  const summary = buildWorkflowSummaryForAgent('scene-n8n', PRODUCTION_DEBT_CONTROL_WORKFLOW);
  assert.equal(summary.sceneId, 'scene-n8n');
  assert.equal(summary.nodeCount, 15);
  assert.ok(summary.edgeCount >= 14);
  assert.ok(summary.stack.length >= 2);
  assert.equal(summary.nodes.length, 15);
});

test('extractBase64ImageFromDataUrl validates safe raster data URLs and blocks SVG/XSS payloads', () => {
  const valid = extractBase64ImageFromDataUrl(
    'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA='
  );
  assert.ok(valid);
  assert.equal(valid.mimeType, 'image/webp');

  assert.equal(extractBase64ImageFromDataUrl('data:image/svg+xml;base64,PHN2Zz4='), null);
  assert.equal(extractBase64ImageFromDataUrl('javascript:alert(1)'), null);
  assert.equal(extractBase64ImageFromDataUrl('data:image/png;base64,short'), null);
});

test('validateCaseAgentRequest enforces message bounds, max 3 images, and valid MIME types', () => {
  const validBase64 = 'UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
  const ok = validateCaseAgentRequest({
    messages: [{ role: 'user', content: 'Збери кейс із мого воркфлоу' }],
    draftSnapshot: SAMPLE_DRAFT_SNAPSHOT,
    workflowSummaries: [],
    sceneImages: [
      {
        sceneId: 'scene-tg',
        sceneTitle: 'Telegram',
        sceneKind: 'ui-telegram',
        mimeType: 'image/webp',
        base64Data: validBase64,
      },
    ],
  });
  assert.equal(ok.ok, true);

  // Reject > 3 images
  const tooMany = validateCaseAgentRequest({
    messages: [{ role: 'user', content: 'Мітки' }],
    draftSnapshot: SAMPLE_DRAFT_SNAPSHOT,
    sceneImages: Array.from({ length: 4 }, () => ({
      sceneId: 'scene-tg',
      sceneTitle: 'TG',
      sceneKind: 'ui-telegram',
      mimeType: 'image/webp',
      base64Data: validBase64,
    })),
  });
  assert.equal(tooMany.ok, false);

  // Reject SVG MIME
  const badMime = validateCaseAgentRequest({
    messages: [{ role: 'user', content: 'Мітки' }],
    draftSnapshot: SAMPLE_DRAFT_SNAPSHOT,
    sceneImages: [
      {
        sceneId: 'scene-tg',
        sceneTitle: 'TG',
        sceneKind: 'ui-telegram',
        mimeType: 'image/svg+xml',
        base64Data: validBase64,
      },
    ],
  });
  assert.equal(badMime.ok, false);
});

test('normalizeCaseAgentResponse clamps hotspot coordinates, strips unknown sceneIds, and parses markdown fences', () => {
  const raw = [
    '```json',
    JSON.stringify({
      reply: 'Готово, додав опис і мітки.',
      changeSummary: ['Заголовок', 'Мітки Telegram'],
      casePatch: {
        titleUk: 'Автоматизація заявок у Telegram',
        category: 'bi',
        suggestedStatus: 'unlisted',
        suggestedSlug: 'Автоматизація Заявок!',
      },
      scenePatches: [
        {
          sceneId: 'scene-tg',
          titleUk: 'Спостереження в Telegram',
          hotspots: [
            {
              xPct: -12,
              yPct: 140,
              titleUk: 'Кнопка підтвердження',
              titleEn: 'Approve button',
              noteUk: 'Надсилає webhook у n8n',
              noteEn: 'Sends webhook to n8n',
            },
          ],
        },
        {
          sceneId: 'non-existent-scene',
          titleUk: 'Should be ignored',
        },
      ],
      quickReplies: ['Перекласти EN'],
    }),
    '```',
  ].join('\n');

  const normalized = normalizeCaseAgentResponse(raw, ['scene-n8n', 'scene-tg']);
  assert.ok(normalized);
  assert.equal(normalized.casePatch?.category, 'bi');
  assert.equal(normalized.casePatch?.suggestedStatus, 'unlisted');
  assert.match(normalized.casePatch?.suggestedSlug ?? '', /^[a-z0-9-]+$/);
  assert.equal(normalized.scenePatches?.length, 1);
  assert.equal(normalized.scenePatches?.[0].sceneId, 'scene-tg');
  assert.equal(normalized.scenePatches?.[0].hotspots?.[0].xPct, 3);
  assert.equal(normalized.scenePatches?.[0].hotspots?.[0].yPct, 97);
});

test('applyCaseAgentPatch merges only provided fields, preserves untouched scenes, and respects isCreatingNew slug rule', () => {
  const base = createBlankCaseDraft(0, 'owner-uid');
  base.id = 'existing-slug';
  base.titleUk = 'Стара назва';
  base.challengeUk = 'Ручний виклик клієнта';
  base.scenes = [
    {
      id: 'scene-n8n',
      kind: 'n8n-json',
      titleUk: 'Схема n8n',
      titleEn: 'n8n Graph',
      captionUk: 'Не чіпати',
      captionEn: 'Keep intact',
      mediaId: '',
      n8nWorkflowId: 'wf-1',
      hotspots: [],
    },
    {
      id: 'scene-tg',
      kind: 'ui-telegram',
      titleUk: 'Бот',
      titleEn: 'Bot',
      captionUk: '',
      captionEn: '',
      mediaId: 'med-1',
      n8nWorkflowId: '',
      hotspots: [],
    },
  ];

  const patch = normalizeCaseAgentResponse(
    JSON.stringify({
      reply: 'Оновив заголовок, категорію та мітку.',
      changeSummary: ['Заголовок', 'Мітка'],
      casePatch: {
        titleUk: 'Нова назва кейсу',
        suggestedSlug: 'should-not-overwrite-existing',
        category: 'etl',
        stack: ['n8n', 'PostgreSQL', 'Telegram'],
        metrics: [{ value: '15 вузлів', labelUk: 'Автоматизація', labelEn: 'Automation' }],
      },
      scenePatches: [
        {
          sceneId: 'scene-tg',
          hotspots: [
            {
              xPct: 42,
              yPct: 68,
              titleUk: 'Звіт у чаті',
              titleEn: 'Chat report',
              noteUk: 'Автоматичне повідомлення щоранку',
              noteEn: 'Automated morning alert',
            },
          ],
        },
      ],
      quickReplies: ['Ок'],
    }),
    ['scene-n8n', 'scene-tg']
  );

  assert.ok(patch);
  const existingMerge = applyCaseAgentPatch(base, 'n8n', patch, { isCreatingNew: false });
  assert.equal(existingMerge.nextDraft.id, 'existing-slug');
  assert.equal(existingMerge.nextDraft.titleUk, 'Нова назва кейсу');
  assert.equal(existingMerge.nextDraft.challengeUk, 'Ручний виклик клієнта');
  assert.equal(existingMerge.nextDraft.relatedServiceId, 'etl-pipelines');
  assert.equal(existingMerge.nextStackInput, 'n8n, PostgreSQL, Telegram');
  assert.equal(existingMerge.nextDraft.metrics.length, 3);
  assert.equal(existingMerge.nextDraft.scenes[0].captionUk, 'Не чіпати');
  assert.equal(existingMerge.nextDraft.scenes[1].hotspots.length, 1);
  assert.equal(existingMerge.nextDraft.scenes[1].hotspots[0].xPct, 42);

  // For newly created draft, suggestedSlug IS applied
  const newMerge = applyCaseAgentPatch(base, 'n8n', patch, { isCreatingNew: true });
  assert.equal(newMerge.nextDraft.id, 'should-not-overwrite-existing');
});

test('pushUndoSnapshot and popUndoSnapshot maintain bounded LIFO history', () => {
  const base = createBlankCaseDraft(0, 'uid');
  let stack = pushUndoSnapshot([], { draft: { ...base, titleUk: 'v0' }, stackInput: 'a' }, 2);
  stack = pushUndoSnapshot(stack, { draft: { ...base, titleUk: 'v1' }, stackInput: 'b' }, 2);
  stack = pushUndoSnapshot(stack, { draft: { ...base, titleUk: 'v2' }, stackInput: 'c' }, 2);
  assert.equal(stack.length, 2);
  assert.equal(stack[0].draft.titleUk, 'v1');

  const popped = popUndoSnapshot(stack);
  assert.equal(popped.restored?.draft.titleUk, 'v2');
  assert.equal(popped.remaining.length, 1);
});

test('validateFirebaseTokenClaims strictly enforces project, issuer, expiry, email_verified, and owner email', () => {
  const now = 1_700_000_000;
  const projectId = 'gen-lang-client-0523433096';
  const ownerEmail = 'mihal4ik11@gmail.com';

  const valid = validateFirebaseTokenClaims(
    {
      aud: projectId,
      iss: `https://securetoken.google.com/${projectId}`,
      sub: 'owner-uid-123',
      exp: now + 3600,
      iat: now - 10,
      email: ownerEmail,
      email_verified: true,
    },
    projectId,
    ownerEmail,
    now
  );
  assert.equal(valid.ok, true);

  // Wrong email -> 403
  const intruder = validateFirebaseTokenClaims(
    {
      aud: projectId,
      iss: `https://securetoken.google.com/${projectId}`,
      sub: 'other-uid',
      exp: now + 3600,
      iat: now - 10,
      email: 'attacker@example.com',
      email_verified: true,
    },
    projectId,
    ownerEmail,
    now
  );
  assert.equal(intruder.ok, false);
  if (!intruder.ok) assert.equal(intruder.status, 403);

  // Unverified email -> 403
  const unverified = validateFirebaseTokenClaims(
    {
      aud: projectId,
      iss: `https://securetoken.google.com/${projectId}`,
      sub: 'owner-uid',
      exp: now + 3600,
      iat: now - 10,
      email: ownerEmail,
      email_verified: false,
    },
    projectId,
    ownerEmail,
    now
  );
  assert.equal(unverified.ok, false);
  if (!unverified.ok) assert.equal(unverified.status, 403);

  // Expired token -> 401
  const expired = validateFirebaseTokenClaims(
    {
      aud: projectId,
      iss: `https://securetoken.google.com/${projectId}`,
      sub: 'owner-uid',
      exp: now - 5,
      iat: now - 3600,
      email: ownerEmail,
      email_verified: true,
    },
    projectId,
    ownerEmail,
    now
  );
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.status, 401);

  // Malformed JWT
  assert.equal(parseJwtParts('not-a-jwt'), null);
});
