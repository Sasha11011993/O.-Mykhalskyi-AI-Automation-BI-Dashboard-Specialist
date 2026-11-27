import { NextRequest, NextResponse } from 'next/server';
import { ThinkingLevel, Type } from '@google/genai';
import { checkRateLimit } from '@/lib/agentLogic';
import { generateStructuredWithFallback } from '@/lib/aiProviderRouter';
import {
  buildCaseAgentSystemInstruction,
  normalizeCaseAgentResponse,
  validateCaseAgentRequest,
} from '@/lib/caseAgentLogic';
import { verifyOwnerFirebaseToken } from '@/lib/firebaseServerAuth';

export const runtime = 'nodejs';

const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const ownerRateLimitStore = new Map<string, number[]>();

const CASE_AGENT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description:
        'Concise 2-4 sentence response in Ukrainian summarizing what was drafted or patched, plus any honest note if business metrics should be refined manually.',
    },
    changeSummary: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Short Ukrainian bullet labels listing what changed (e.g., "Заголовок UA/EN", "Виклик і рішення", "3 мітки на сцені Telegram").',
    },
    casePatch: {
      type: Type.OBJECT,
      description:
        'Partial patch of portfolio case passport fields. Include ONLY fields that should be created or updated.',
      properties: {
        titleUk: { type: Type.STRING },
        titleEn: { type: Type.STRING },
        suggestedSlug: { type: Type.STRING },
        suggestedStatus: {
          type: Type.STRING,
          description: 'Optional status recommendation: "draft", "published", or "unlisted".',
        },
        category: {
          type: Type.STRING,
          description: 'One of "ai", "bi", or "etl".',
        },
        year: { type: Type.STRING, description: '4-digit year, e.g. "2026".' },
        industryUk: { type: Type.STRING },
        industryEn: { type: Type.STRING },
        durationUk: { type: Type.STRING },
        durationEn: { type: Type.STRING },
        headlineMetricUk: { type: Type.STRING },
        headlineMetricEn: { type: Type.STRING },
        summaryUk: { type: Type.STRING },
        summaryEn: { type: Type.STRING },
        challengeUk: { type: Type.STRING },
        challengeEn: { type: Type.STRING },
        solutionUk: { type: Type.STRING },
        solutionEn: { type: Type.STRING },
        stack: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        metrics: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.STRING },
              labelUk: { type: Type.STRING },
              labelEn: { type: Type.STRING },
            },
            required: ['value', 'labelUk', 'labelEn'],
          },
        },
        testimonial: {
          type: Type.OBJECT,
          properties: {
            quoteUk: { type: Type.STRING },
            quoteEn: { type: Type.STRING },
            authorUk: { type: Type.STRING },
            authorEn: { type: Type.STRING },
            roleUk: { type: Type.STRING },
            roleEn: { type: Type.STRING },
            company: { type: Type.STRING },
          },
        },
      },
    },
    scenePatches: {
      type: Type.ARRAY,
      description:
        'Optional array of targeted scene updates referencing exact existing sceneId values.',
      items: {
        type: Type.OBJECT,
        properties: {
          sceneId: { type: Type.STRING },
          titleUk: { type: Type.STRING },
          titleEn: { type: Type.STRING },
          captionUk: { type: Type.STRING },
          captionEn: { type: Type.STRING },
          hotspots: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                xPct: {
                  type: Type.NUMBER,
                  description: 'Horizontal coordinate in percent (5..95) from image left edge.',
                },
                yPct: {
                  type: Type.NUMBER,
                  description: 'Vertical coordinate in percent (5..95) from image top edge.',
                },
                titleUk: { type: Type.STRING },
                titleEn: { type: Type.STRING },
                noteUk: { type: Type.STRING },
                noteEn: { type: Type.STRING },
              },
              required: ['xPct', 'yPct', 'titleUk', 'titleEn', 'noteUk', 'noteEn'],
            },
          },
        },
        required: ['sceneId'],
      },
    },
    quickReplies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2 to 3 short Ukrainian next-step prompt chips (under 50 chars each).',
    },
  },
  required: ['reply', 'changeSummary', 'quickReplies'],
};

const CASE_AGENT_JSON_CONTRACT_HINT = `{
  "reply": "string (2-4 sentences in Ukrainian)",
  "changeSummary": ["string (short Ukrainian labels of updated fields)"],
  "casePatch": {
    "titleUk?": "string", "titleEn?": "string", "suggestedSlug?": "string",
    "suggestedStatus?": "draft | published | unlisted",
    "category?": "ai | bi | etl", "year?": "YYYY",
    "industryUk?": "string", "industryEn?": "string",
    "durationUk?": "string", "durationEn?": "string",
    "headlineMetricUk?": "string", "headlineMetricEn?": "string",
    "summaryUk?": "string", "summaryEn?": "string",
    "challengeUk?": "string", "challengeEn?": "string",
    "solutionUk?": "string", "solutionEn?": "string",
    "stack?": ["string"],
    "metrics?": [{ "value": "string", "labelUk": "string", "labelEn": "string" }],
    "testimonial?": { "quoteUk?": "string", "quoteEn?": "string", "authorUk?": "string", "authorEn?": "string", "roleUk?": "string", "roleEn?": "string", "company?": "string" }
  },
  "scenePatches": [{
    "sceneId": "exact existing sceneId",
    "titleUk?": "string", "titleEn?": "string",
    "captionUk?": "string", "captionEn?": "string",
    "hotspots?": [{ "xPct": 50, "yPct": 50, "titleUk": "string", "titleEn": "string", "noteUk": "string", "noteEn": "string" }]
  }],
  "quickReplies": ["string (2-3 short Ukrainian follow-ups)"]
}`;

export async function POST(req: NextRequest) {
  // 1. Cryptographically verify owner Firebase ID Token on server
  const authCheck = await verifyOwnerFirebaseToken(req.headers.get('authorization'));
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }

  // 2. Per-owner sliding-window rate limit
  const rate = checkRateLimit(
    ownerRateLimitStore,
    authCheck.user.uid,
    Date.now(),
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_WINDOW_MS
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Забагато запитів поспіль. Спробуйте ще раз через ${rate.retryAfterSec} с.` },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
    );
  }

  // 3. Parse and strictly validate JSON payload (size cap ~3.5MB for up to 3 WebP images)
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 3_600_000) {
    return NextResponse.json(
      { error: 'Запит завеликий. Залиште до 3 скріншотів у контексті агента.' },
      { status: 413 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Некоректний JSON у запиті.' }, { status: 400 });
  }

  const validation = validateCaseAgentRequest(rawBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const { messages, draftSnapshot, workflowSummaries, sceneImages } = validation.data;
  const validSceneIds = draftSnapshot.scenes.map((s) => s.id);

  const result = await generateStructuredWithFallback({
    systemInstruction: buildCaseAgentSystemInstruction(draftSnapshot, workflowSummaries),
    jsonContractHint: CASE_AGENT_JSON_CONTRACT_HINT,
    messages,
    images: sceneImages.map((img) => ({
      label: `Attached screenshot for sceneId="${img.sceneId}" (kind="${img.sceneKind}", title="${img.sceneTitle || img.sceneId}"):`,
      mimeType: img.mimeType,
      base64Data: img.base64Data,
    })),
    geminiResponseSchema: CASE_AGENT_RESPONSE_SCHEMA,
    geminiThinkingLevel: ThinkingLevel.MEDIUM,
    normalize: (rawText) => normalizeCaseAgentResponse(rawText, validSceneIds),
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
          'На сервері не налаштовано жодного AI-провайдера (додайте GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY або OPENROUTER_API_KEY у Secrets / Environment Variables).',
      },
      { status: 503 }
    );
  }

  if (result.code === 'all_quota') {
    return NextResponse.json(
      {
        error:
          'Вичерпано ліміт або баланс усіх налаштованих AI-провайдерів. Поповніть баланс або додайте резервний ключ у налаштуваннях сервера.',
      },
      { status: 429 }
    );
  }

  if (result.code === 'all_auth') {
    return NextResponse.json(
      {
        error:
          'Помилка доступу до налаштованих AI-провайдерів. Перевірте API-ключі у Settings > Secrets або Environment Variables.',
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { error: 'Не вдалося отримати відповідь від жодного AI-провайдера. Спробуйте ще раз.' },
    { status: 502 }
  );
}
