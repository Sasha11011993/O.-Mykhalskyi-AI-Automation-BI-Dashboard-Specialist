import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import firebaseConfig from '../firebase-applet-config.json';

export type AiProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export const DEFAULT_PROVIDER_ORDER: readonly AiProviderId[] = [
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
] as const;

export interface AiRouterMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiRouterImageAttachment {
  label: string;
  mimeType: 'image/webp' | 'image/png' | 'image/jpeg';
  base64Data: string;
}

export interface AiProviderConfig {
  geminiApiKey?: string;
  geminiModel: string;
  openaiApiKey?: string;
  openaiModel: string;
  anthropicApiKey?: string;
  anthropicModel: string;
  openrouterApiKey?: string;
  openrouterModel: string;
  appUrl?: string;
  providerOrder: AiProviderId[];
  disabledProviders?: AiProviderId[];
}

export interface AiRoutingOverride {
  providerOrder?: AiProviderId[];
  disabledProviders?: AiProviderId[];
  openaiModel?: string;
  anthropicModel?: string;
  openrouterModel?: string;
}

export interface AiRouterCallParams<TNormalized> {
  systemInstruction: string;
  jsonContractHint: string;
  messages: AiRouterMessage[];
  images?: AiRouterImageAttachment[];
  geminiResponseSchema: Record<string, unknown>;
  geminiThinkingLevel?: ThinkingLevel;
  normalize: (rawText: string | undefined) => TNormalized | null;
}

export interface AiProviderAttemptError {
  provider: AiProviderId;
  status: number;
  category: 'quota' | 'auth' | 'upstream' | 'parse';
  message: string;
}

export type AiRouterResult<TNormalized> =
  | {
      ok: true;
      data: TNormalized;
      provider: AiProviderId;
      fallbackUsed: boolean;
      attempts: number;
    }
  | {
      ok: false;
      status: number;
      code: 'no_providers' | 'all_quota' | 'all_auth' | 'all_failed';
      errors: AiProviderAttemptError[];
    };

export type ProviderInvoker = (
  provider: AiProviderId,
  config: AiProviderConfig,
  params: AiRouterCallParams<unknown>
) => Promise<string | undefined>;

const QUOTA_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const AUTH_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const UPSTREAM_TIMEOUT_MS = 35_000;
const FIRESTORE_ROUTING_TTL_MS = 20_000; // 20s cache for non-secret routing doc
const MODEL_ID_SAFE_PATTERN = /^[a-zA-Z0-9._:/-]+$/;

const VALID_PROVIDER_SET = new Set<AiProviderId>(DEFAULT_PROVIDER_ORDER);

// In-memory cooldown map keyed by providerId -> epoch ms until cooldown expires
const defaultCooldownMap = new Map<AiProviderId, number>();

// In-memory TTL cache for non-secret Firestore routing overrides
let routingCache: { expiresAt: number; value: AiRoutingOverride | null } | null = null;

export function invalidateAiRoutingCache(): void {
  routingCache = null;
}

export function clearAllProviderCooldowns(
  cooldownMap: Map<AiProviderId, number> = defaultCooldownMap
): void {
  cooldownMap.clear();
}

function cleanEnvKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  // Ignore template placeholders copied verbatim from .env.example
  if (/^MY_[A-Z0-9_]+$/i.test(trimmed)) return undefined;
  return trimmed;
}

function sanitizeSafeModelId(raw: string | undefined, maxLen: number): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().slice(0, maxLen);
  if (!trimmed || !MODEL_ID_SAFE_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Parses comma-separated AI_PROVIDER_ORDER into a deduplicated priority list.
 * Unknown entries are ignored; defaults to gemini -> openai -> anthropic -> openrouter.
 */
export function parseProviderOrder(rawOrder: string | undefined): AiProviderId[] {
  if (!rawOrder || !rawOrder.trim()) {
    return [...DEFAULT_PROVIDER_ORDER];
  }
  const seen = new Set<AiProviderId>();
  const ordered: AiProviderId[] = [];
  for (const token of rawOrder.split(',')) {
    const id = token.trim().toLowerCase() as AiProviderId;
    if (VALID_PROVIDER_SET.has(id) && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered.length > 0 ? ordered : [...DEFAULT_PROVIDER_ORDER];
}

export function readAiProviderConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): AiProviderConfig {
  return {
    geminiApiKey: cleanEnvKey(env.GEMINI_API_KEY),
    geminiModel: 'gemini-4-hydrogen',
    openaiApiKey: cleanEnvKey(env.OPENAI_API_KEY),
    openaiModel: sanitizeSafeModelId(env.OPENAI_MODEL, 80) || 'gpt-4o-mini',
    anthropicApiKey: cleanEnvKey(env.ANTHROPIC_API_KEY),
    anthropicModel: sanitizeSafeModelId(env.ANTHROPIC_MODEL, 80) || 'claude-3-5-haiku-latest',
    openrouterApiKey: cleanEnvKey(env.OPENROUTER_API_KEY),
    openrouterModel: sanitizeSafeModelId(env.OPENROUTER_MODEL, 120) || 'google/gemini-2.5-flash',
    appUrl: env.APP_URL?.trim() || undefined,
    providerOrder: parseProviderOrder(env.AI_PROVIDER_ORDER),
    disabledProviders: [],
  };
}

/**
 * Pure merge of environment-backed secrets/defaults with non-secret Firestore routing overrides.
 * API keys always come exclusively from envConfig; Gemini stays pinned to the platform model.
 */
export function mergeAiProviderConfig(
  envConfig: AiProviderConfig,
  override: AiRoutingOverride | null | undefined
): AiProviderConfig {
  if (!override) return envConfig;

  const nextOrder: AiProviderId[] = [];
  const seen = new Set<AiProviderId>();
  for (const id of override.providerOrder ?? []) {
    if (VALID_PROVIDER_SET.has(id) && !seen.has(id)) {
      seen.add(id);
      nextOrder.push(id);
    }
  }
  for (const fallbackId of envConfig.providerOrder) {
    if (VALID_PROVIDER_SET.has(fallbackId) && !seen.has(fallbackId)) {
      seen.add(fallbackId);
      nextOrder.push(fallbackId);
    }
  }

  const disabled = Array.from(
    new Set((override.disabledProviders ?? []).filter((id) => VALID_PROVIDER_SET.has(id)))
  );

  return {
    ...envConfig,
    providerOrder: nextOrder.length > 0 ? nextOrder : envConfig.providerOrder,
    disabledProviders: disabled,
    openaiModel: sanitizeSafeModelId(override.openaiModel, 80) || envConfig.openaiModel,
    anthropicModel: sanitizeSafeModelId(override.anthropicModel, 80) || envConfig.anthropicModel,
    openrouterModel: sanitizeSafeModelId(override.openrouterModel, 120) || envConfig.openrouterModel,
  };
}

interface FirestoreRestValue {
  stringValue?: string;
  arrayValue?: {
    values?: Array<{ stringValue?: string }>;
  };
}

interface FirestoreRestDocument {
  fields?: Record<string, FirestoreRestValue>;
}

/**
 * Pure parser converting a Firestore REST API document for `portfolio_settings/main`
 * into a sanitized non-secret AiRoutingOverride object.
 */
export function parseFirestorePortfolioSettingsDoc(rawDoc: unknown): AiRoutingOverride | null {
  if (!rawDoc || typeof rawDoc !== 'object') return null;
  const fields = (rawDoc as FirestoreRestDocument).fields;
  if (!fields || typeof fields !== 'object') return null;

  const extractProviderArray = (fieldName: string): AiProviderId[] | undefined => {
    const field = fields[fieldName];
    if (!field?.arrayValue) return undefined;
    const values = field.arrayValue.values ?? [];
    const result: AiProviderId[] = [];
    for (const v of values) {
      const id = v?.stringValue?.trim().toLowerCase() as AiProviderId | undefined;
      if (id && VALID_PROVIDER_SET.has(id) && !result.includes(id)) {
        result.push(id);
      }
    }
    return result;
  };

  const providerOrder = extractProviderArray('aiProviderOrder');
  const disabledProviders = extractProviderArray('aiDisabledProviders');
  const openaiModel = sanitizeSafeModelId(fields.aiOpenaiModel?.stringValue, 80);
  const anthropicModel = sanitizeSafeModelId(fields.aiAnthropicModel?.stringValue, 80);
  const openrouterModel = sanitizeSafeModelId(fields.aiOpenrouterModel?.stringValue, 120);

  if (
    !providerOrder &&
    !disabledProviders &&
    !openaiModel &&
    !anthropicModel &&
    !openrouterModel
  ) {
    return null;
  }

  return {
    ...(providerOrder && providerOrder.length > 0 ? { providerOrder } : {}),
    ...(disabledProviders ? { disabledProviders } : {}),
    ...(openaiModel ? { openaiModel } : {}),
    ...(anthropicModel ? { anthropicModel } : {}),
    ...(openrouterModel ? { openrouterModel } : {}),
  };
}

/**
 * Fetches non-secret AI routing overrides from `portfolio_settings/main` via Firestore REST API
 * using a short TTL cache. Gracefully returns null on any network/404 error so env defaults apply.
 */
export async function fetchAiRoutingSettingsFromFirestore(
  nowMs: number = Date.now()
): Promise<AiRoutingOverride | null> {
  if (routingCache && routingCache.expiresAt > nowMs) {
    return routingCache.value;
  }

  const projectId = firebaseConfig.projectId;
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  if (!projectId) return null;

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/portfolio_settings/main`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      routingCache = { expiresAt: nowMs + FIRESTORE_ROUTING_TTL_MS, value: null };
      return null;
    }
    const json = (await res.json()) as unknown;
    const parsed = parseFirestorePortfolioSettingsDoc(json);
    routingCache = { expiresAt: nowMs + FIRESTORE_ROUTING_TTL_MS, value: parsed };
    return parsed;
  } catch {
    // Do not poison cache on transient timeout; retry on next call
    return routingCache?.value ?? null;
  }
}

export function getConfiguredProviders(config: AiProviderConfig): AiProviderId[] {
  const keyMap: Record<AiProviderId, string | undefined> = {
    gemini: config.geminiApiKey,
    openai: config.openaiApiKey,
    anthropic: config.anthropicApiKey,
    openrouter: config.openrouterApiKey,
  };
  const disabledSet = new Set<AiProviderId>(config.disabledProviders ?? []);
  return config.providerOrder.filter((id) => Boolean(keyMap[id]) && !disabledSet.has(id));
}

/**
 * Classifies an upstream provider error so quota/billing exhaustion triggers
 * immediate failover + cooldown without leaking secrets.
 */
export function classifyProviderError(
  err: unknown
): { status: number; category: 'quota' | 'auth' | 'upstream'; safeMessage: string } {
  const statusFromErr =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
      ? (err as { status: number }).status
      : 0;

  const rawMsg = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const lower = rawMsg.toLowerCase();

  if (
    statusFromErr === 402 ||
    statusFromErr === 429 ||
    lower.includes('429') ||
    lower.includes('402') ||
    lower.includes('resource_exhausted') ||
    lower.includes('insufficient_quota') ||
    lower.includes('quota') ||
    lower.includes('credit balance') ||
    lower.includes('billing') ||
    lower.includes('rate_limit') ||
    lower.includes('rate limit')
  ) {
    return {
      status: statusFromErr === 402 ? 402 : 429,
      category: 'quota',
      safeMessage: 'Quota or balance exhausted',
    };
  }

  if (
    statusFromErr === 401 ||
    statusFromErr === 403 ||
    lower.includes('api_key_invalid') ||
    lower.includes('invalid_api_key') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthorized') ||
    lower.includes('authentication_error') ||
    lower.includes('401') ||
    lower.includes('403')
  ) {
    return {
      status: statusFromErr || 401,
      category: 'auth',
      safeMessage: 'Provider authentication failed',
    };
  }

  return {
    status: statusFromErr >= 400 ? statusFromErr : 502,
    category: 'upstream',
    safeMessage: 'Upstream provider unavailable',
  };
}

class HttpStatusError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function callGeminiProvider(
  config: AiProviderConfig,
  params: AiRouterCallParams<unknown>
): Promise<string | undefined> {
  const ai = new GoogleGenAI({
    apiKey: config.geminiApiKey!,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const images = params.images ?? [];
  const contents = params.messages.map((msg, idx) => {
    const isLastUser = idx === params.messages.length - 1 && msg.role === 'user';
    if (!isLastUser || images.length === 0) {
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      };
    }

    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [{ text: msg.content }];
    for (const img of images) {
      parts.push({ text: img.label });
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64Data,
        },
      });
    }
    return { role: 'user', parts };
  });

  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents,
    config: {
      systemInstruction: params.systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: params.geminiResponseSchema,
      thinkingConfig: {
        thinkingLevel: params.geminiThinkingLevel ?? ThinkingLevel.LOW,
      },
    },
  });

  return response.text;
}

async function callOpenAiCompatibleProvider(
  endpoint: string,
  apiKey: string,
  model: string,
  extraHeaders: Record<string, string>,
  params: AiRouterCallParams<unknown>
): Promise<string | undefined> {
  const images = params.images ?? [];
  const systemText = `${params.systemInstruction}\n\nSTRICT OUTPUT FORMAT: Return ONLY a valid JSON object matching this schema (no markdown fences, no commentary outside JSON):\n${params.jsonContractHint}`;

  const apiMessages: Array<{
    role: 'system' | 'user' | 'assistant';
    content:
      | string
      | Array<
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string; detail?: string } }
        >;
  }> = [{ role: 'system', content: systemText }];

  params.messages.forEach((msg, idx) => {
    const isLastUser = idx === params.messages.length - 1 && msg.role === 'user';
    if (!isLastUser || images.length === 0) {
      apiMessages.push({ role: msg.role, content: msg.content });
      return;
    }

    const parts: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: string } }
    > = [{ type: 'text', text: msg.content }];

    for (const img of images) {
      parts.push({ type: 'text', text: img.label });
      parts.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType};base64,${img.base64Data}`,
          detail: 'high',
        },
      });
    }

    apiMessages.push({ role: 'user', content: parts });
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: apiMessages,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new HttpStatusError(res.status, `${res.status} ${errText.slice(0, 240)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return data.choices?.[0]?.message?.content ?? undefined;
}

async function callAnthropicProvider(
  config: AiProviderConfig,
  params: AiRouterCallParams<unknown>
): Promise<string | undefined> {
  const images = params.images ?? [];
  const systemText = `${params.systemInstruction}\n\nSTRICT OUTPUT FORMAT: Return ONLY a raw JSON object (no markdown code fences, no text before or after JSON) matching:\n${params.jsonContractHint}`;

  const apiMessages = params.messages.map((msg, idx) => {
    const isLastUser = idx === params.messages.length - 1 && msg.role === 'user';
    if (!isLastUser || images.length === 0) {
      return { role: msg.role, content: msg.content };
    }

    const blocks: Array<
      | { type: 'text'; text: string }
      | {
          type: 'image';
          source: { type: 'base64'; media_type: string; data: string };
        }
    > = [{ type: 'text', text: msg.content }];

    for (const img of images) {
      blocks.push({ type: 'text', text: img.label });
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mimeType,
          data: img.base64Data,
        },
      });
    }

    return { role: 'user' as const, content: blocks };
  });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 4096,
      system: systemText,
      messages: apiMessages,
    }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new HttpStatusError(res.status, `${res.status} ${errText.slice(0, 240)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const textBlocks = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string);
  return textBlocks.join('\n') || undefined;
}

export const defaultProviderInvoker: ProviderInvoker = async (provider, config, params) => {
  switch (provider) {
    case 'gemini':
      return callGeminiProvider(config, params);
    case 'openai':
      return callOpenAiCompatibleProvider(
        'https://api.openai.com/v1/chat/completions',
        config.openaiApiKey!,
        config.openaiModel,
        {},
        params
      );
    case 'anthropic':
      return callAnthropicProvider(config, params);
    case 'openrouter':
      return callOpenAiCompatibleProvider(
        'https://openrouter.ai/api/v1/chat/completions',
        config.openrouterApiKey!,
        config.openrouterModel,
        {
          ...(config.appUrl ? { 'HTTP-Referer': config.appUrl } : {}),
          'X-Title': 'O. Mykhalskyi Portfolio AI',
        },
        params
      );
  }
};

/**
 * Executes a structured JSON AI call with automatic multi-provider failover.
 * Primary provider is Gemini; on quota/billing/rate-limit/auth/upstream failure,
 * automatically falls back through configured providers (OpenAI, Anthropic, OpenRouter).
 */
export async function generateStructuredWithFallback<TNormalized>(
  params: AiRouterCallParams<TNormalized>,
  options?: {
    config?: AiProviderConfig;
    invoker?: ProviderInvoker;
    cooldownMap?: Map<AiProviderId, number>;
    nowMs?: number;
  }
): Promise<AiRouterResult<TNormalized>> {
  const nowMs = options?.nowMs ?? Date.now();
  const config =
    options?.config ??
    mergeAiProviderConfig(
      readAiProviderConfigFromEnv(),
      await fetchAiRoutingSettingsFromFirestore(nowMs)
    );
  const invoker = options?.invoker ?? defaultProviderInvoker;
  const cooldownMap = options?.cooldownMap ?? defaultCooldownMap;

  const configured = getConfiguredProviders(config);
  if (configured.length === 0) {
    return {
      ok: false,
      status: 503,
      code: 'no_providers',
      errors: [],
    };
  }

  // Prefer providers not currently in cooldown; if all are in cooldown, try all in priority order
  const ready = configured.filter((p) => (cooldownMap.get(p) ?? 0) <= nowMs);
  const candidates = ready.length > 0 ? ready : configured;
  const primaryProvider = configured[0];

  const errors: AiProviderAttemptError[] = [];

  for (let i = 0; i < candidates.length; i += 1) {
    const provider = candidates[i];
    try {
      const rawText = await invoker(provider, config, params as AiRouterCallParams<unknown>);
      const normalized = params.normalize(rawText);
      if (!normalized) {
        errors.push({
          provider,
          status: 502,
          category: 'parse',
          message: 'Model returned malformed structured output',
        });
        console.warn(`[aiProviderRouter] Provider "${provider}" returned unparseable JSON; trying next.`);
        continue;
      }

      // Clear any stale cooldown on success
      cooldownMap.delete(provider);
      return {
        ok: true,
        data: normalized,
        provider,
        fallbackUsed: provider !== primaryProvider,
        attempts: i + 1,
      };
    } catch (err) {
      const classified = classifyProviderError(err);
      errors.push({
        provider,
        status: classified.status,
        category: classified.category,
        message: classified.safeMessage,
      });

      if (classified.category === 'quota') {
        cooldownMap.set(provider, nowMs + QUOTA_COOLDOWN_MS);
      } else if (classified.category === 'auth') {
        cooldownMap.set(provider, nowMs + AUTH_COOLDOWN_MS);
      }

      console.warn(
        `[aiProviderRouter] Provider "${provider}" failed (${classified.category}, HTTP ${classified.status}); failing over.`
      );
    }
  }

  const allQuota = errors.length > 0 && errors.every((e) => e.category === 'quota');
  const allAuth = errors.length > 0 && errors.every((e) => e.category === 'auth');

  return {
    ok: false,
    status: allQuota ? 429 : 502,
    code: allQuota ? 'all_quota' : allAuth ? 'all_auth' : 'all_failed',
    errors,
  };
}
