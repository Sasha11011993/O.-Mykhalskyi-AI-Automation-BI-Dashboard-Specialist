import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from '@google/genai';
import {
  buildAgentSystemInstruction,
  checkRateLimit,
  normalizeAgentResponse,
  validateAgentRequest,
} from '@/lib/agentLogic';
import { generateStructuredWithFallback } from '@/lib/aiProviderRouter';

export const runtime = 'nodejs';

const RATE_LIMIT_MAX_REQUESTS = 18;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitStore = new Map<string, number[]>();

const AGENT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'Concise 2-4 sentence engineering response in the user language.',
    },
    recommendation: {
      type: Type.OBJECT,
      description:
        'Optional structured project recommendation populated once the user shares a workflow need, asks about services, or asks about ROI.',
      properties: {
        serviceId: {
          type: Type.STRING,
          description:
            'Exact canonical serviceId: one of "ai-agents", "bi-dashboards", "etl-pipelines", or "audit-architecture".',
        },
        estimatedTimeline: {
          type: Type.STRING,
          description: 'Short timeline estimate grounded in the portfolio catalog (e.g. "2–4 тижні").',
        },
        estimatedBudgetRange: {
          type: Type.STRING,
          description: 'Short budget range grounded in the portfolio catalog (e.g. "від $1,800" or "$850 фіксовано").',
        },
        suggestedStack: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: '2 to 4 concrete tools from the stack (e.g. ["n8n", "Python", "PostgreSQL"]).',
        },
        briefSummary: {
          type: Type.STRING,
          description: 'Short 1-line confirmation label for the Contact tab banner (under 75 chars).',
        },
        briefDraft: {
          type: Type.STRING,
          description: 'Ready-to-send 2-4 sentence project brief summarizing scope, tools, and expected ROI.',
        },
        roiEstimate: {
          type: Type.OBJECT,
          description:
            'Optional ROI calculator parameters extracted from the user message or realistically estimated for their workflow.',
          properties: {
            teamSize: {
              type: Type.NUMBER,
              description: 'Number of people involved in the manual process (1-30).',
            },
            weeklyManualHoursPerPerson: {
              type: Type.NUMBER,
              description: 'Manual routine hours per person per week (1-20).',
            },
            hourlyRateUsd: {
              type: Type.NUMBER,
              description: 'Blended hourly cost in USD (5-200).',
            },
          },
          required: ['teamSize', 'weeklyManualHoursPerPerson', 'hourlyRateUsd'],
        },
      },
      required: [
        'serviceId',
        'estimatedTimeline',
        'estimatedBudgetRange',
        'suggestedStack',
        'briefSummary',
        'briefDraft',
      ],
    },
    quickReplies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 to 3 short follow-up prompt options for the client (under 55 chars each).',
    },
  },
  required: ['reply', 'quickReplies'],
};

const AGENT_JSON_CONTRACT_HINT = `{
  "reply": "string (2-4 concise engineering sentences in user language)",
  "recommendation": {
    "serviceId": "ai-agents | bi-dashboards | etl-pipelines | audit-architecture",
    "estimatedTimeline": "string",
    "estimatedBudgetRange": "string",
    "suggestedStack": ["string"],
    "briefSummary": "string (<75 chars)",
    "briefDraft": "string (2-4 sentences)",
    "roiEstimate": { "teamSize": 5, "weeklyManualHoursPerPerson": 6, "hourlyRateUsd": 15 }
  },
  "quickReplies": ["string (2-3 short follow-ups <55 chars)"]
}`;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'local-client';
}

export async function POST(req: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 });
  }

  const validation = validateAgentRequest(rawBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const { messages, locale, currentRoi } = validation.data;

  const clientIp = getClientIp(req);
  const rate = checkRateLimit(
    rateLimitStore,
    clientIp,
    Date.now(),
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error:
          locale === 'uk'
            ? `Забагато запитів поспіль. Спробуйте ще раз через ${rate.retryAfterSec} с.`
            : `Too many requests. Please try again in ${rate.retryAfterSec}s.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSec) },
      }
    );
  }

  const result = await generateStructuredWithFallback({
    systemInstruction: buildAgentSystemInstruction(locale, currentRoi),
    jsonContractHint: AGENT_JSON_CONTRACT_HINT,
    messages,
    geminiResponseSchema: AGENT_RESPONSE_SCHEMA,
    geminiThinkingLevel: ThinkingLevel.LOW,
    normalize: (rawText) => normalizeAgentResponse(rawText, locale),
  });

  if (result.ok) {
    return NextResponse.json(result.data, {
      status: 200,
      headers: { 'X-AI-Provider': result.provider },
    });
  }

  if (result.code === 'no_providers') {
    return NextResponse.json(
      {
        error:
          locale === 'uk'
            ? 'AI-сервіс тимчасово не налаштований на сервері (відсутній ключ жодного провайдера). Ви можете одразу заповнити бриф на вкладці контактів.'
            : 'AI service is not configured on the server (no provider API key configured). You can use the Contact tab directly.',
      },
      { status: 503 }
    );
  }

  if (result.code === 'all_quota') {
    return NextResponse.json(
      {
        error:
          locale === 'uk'
            ? 'Вичерпано ліміт запитів усіх підключених AI-провайдерів. Спробуйте за хвилину або перейдіть до форми брифу.'
            : 'All configured AI providers hit quota/rate limits. Please try again in a minute or open the contact brief.',
      },
      { status: 429 }
    );
  }

  if (result.code === 'all_auth') {
    return NextResponse.json(
      {
        error:
          locale === 'uk'
            ? 'Помилка авторизації AI-провайдерів на сервері. Перевірте ключі API у налаштуваннях Secrets / Environment Variables.'
            : 'AI provider authentication error on server. Please verify API keys in Secrets / Environment Variables.',
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      error:
        locale === 'uk'
          ? 'Не вдалося отримати відповідь від AI-агента. Спробуйте ще раз або відкрийте бриф.'
          : 'Could not reach the AI assistant right now. Please try again or open the contact brief.',
    },
    { status: 502 }
  );
}
