import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyProviderError,
  generateStructuredWithFallback,
  getConfiguredProviders,
  parseProviderOrder,
  readAiProviderConfigFromEnv,
  type AiProviderId,
} from '@/lib/aiProviderRouter';

test('parseProviderOrder parses custom priority, deduplicates, and ignores unknown providers', () => {
  assert.deepEqual(parseProviderOrder(undefined), ['gemini', 'openai', 'anthropic', 'openrouter']);
  assert.deepEqual(parseProviderOrder('openrouter, openai, gemini, bogus, openai'), [
    'openrouter',
    'openai',
    'gemini',
  ]);
  assert.deepEqual(parseProviderOrder('unknown_only'), [
    'gemini',
    'openai',
    'anthropic',
    'openrouter',
  ]);
});

test('readAiProviderConfigFromEnv ignores empty and MY_* placeholder keys', () => {
  const cfg = readAiProviderConfigFromEnv({
    GEMINI_API_KEY: 'MY_GEMINI_API_KEY',
    OPENAI_API_KEY: '  sk-test-real-key  ',
    ANTHROPIC_API_KEY: '',
    OPENROUTER_API_KEY: 'sk-or-test-key',
  });
  assert.deepEqual(getConfiguredProviders(cfg), ['openai', 'openrouter']);
});

test('classifyProviderError distinguishes quota/billing, auth, and upstream errors', () => {
  assert.equal(classifyProviderError(new Error('429 RESOURCE_EXHAUSTED')).category, 'quota');
  assert.equal(classifyProviderError(new Error('402 Your credit balance is too low')).category, 'quota');
  assert.equal(classifyProviderError(new Error('insufficient_quota')).category, 'quota');
  assert.equal(classifyProviderError(new Error('401 invalid_api_key')).category, 'auth');
  assert.equal(classifyProviderError(new Error('503 Service Unavailable')).category, 'upstream');
});

test('generateStructuredWithFallback automatically fails over from Gemini quota exhaustion to OpenAI and caches cooldown', async () => {
  const cooldownMap = new Map<AiProviderId, number>();
  const config = readAiProviderConfigFromEnv({
    GEMINI_API_KEY: 'gm-live',
    OPENAI_API_KEY: 'oa-live',
    OPENROUTER_API_KEY: 'or-live',
  });

  const called: AiProviderId[] = [];
  const invoker = async (provider: AiProviderId) => {
    called.push(provider);
    if (provider === 'gemini') {
      throw new Error('429 RESOURCE_EXHAUSTED: quota exceeded');
    }
    return JSON.stringify({ ok: true, from: provider });
  };

  const t0 = 1_700_000_000_000;
  const first = await generateStructuredWithFallback(
    {
      systemInstruction: 'sys',
      jsonContractHint: '{ ok: boolean }',
      messages: [{ role: 'user', content: 'hi' }],
      geminiResponseSchema: {},
      normalize: (txt) => (txt ? (JSON.parse(txt) as { ok: boolean; from: string }) : null),
    },
    { config, invoker, cooldownMap, nowMs: t0 }
  );

  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.provider, 'openai');
    assert.equal(first.fallbackUsed, true);
    assert.equal(first.attempts, 2);
  }
  assert.deepEqual(called, ['gemini', 'openai']);
  assert.ok((cooldownMap.get('gemini') ?? 0) > t0);

  // Second call 10s later should skip Gemini immediately (cooldown active) and hit OpenAI first
  called.length = 0;
  const second = await generateStructuredWithFallback(
    {
      systemInstruction: 'sys',
      jsonContractHint: '{ ok: boolean }',
      messages: [{ role: 'user', content: 'hi again' }],
      geminiResponseSchema: {},
      normalize: (txt) => (txt ? (JSON.parse(txt) as { ok: boolean; from: string }) : null),
    },
    { config, invoker, cooldownMap, nowMs: t0 + 10_000 }
  );

  assert.equal(second.ok, true);
  if (second.ok) {
    assert.equal(second.provider, 'openai');
    assert.equal(second.attempts, 1);
  }
  assert.deepEqual(called, ['openai']);
});

test('generateStructuredWithFallback chains across Gemini -> OpenAI -> Anthropic -> OpenRouter on malformed JSON & billing errors', async () => {
  const cooldownMap = new Map<AiProviderId, number>();
  const config = readAiProviderConfigFromEnv({
    GEMINI_API_KEY: 'gm-live',
    OPENAI_API_KEY: 'oa-live',
    ANTHROPIC_API_KEY: 'an-live',
    OPENROUTER_API_KEY: 'or-live',
  });

  const called: AiProviderId[] = [];
  const invoker = async (provider: AiProviderId) => {
    called.push(provider);
    if (provider === 'gemini') throw new Error('429 quota exceeded');
    if (provider === 'openai') throw new Error('402 insufficient_quota');
    if (provider === 'anthropic') return 'not-valid-json';
    return JSON.stringify({ result: 'saved-by-openrouter' });
  };

  const res = await generateStructuredWithFallback(
    {
      systemInstruction: 'sys',
      jsonContractHint: '{ result: string }',
      messages: [{ role: 'user', content: 'test' }],
      geminiResponseSchema: {},
      normalize: (txt) => {
        if (!txt) return null;
        try {
          return JSON.parse(txt) as { result: string };
        } catch {
          return null;
        }
      },
    },
    { config, invoker, cooldownMap, nowMs: 1_700_000_000_000 }
  );

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.provider, 'openrouter');
    assert.equal(res.data.result, 'saved-by-openrouter');
  }
  assert.deepEqual(called, ['gemini', 'openai', 'anthropic', 'openrouter']);
});

test('generateStructuredWithFallback returns clean no_providers / all_quota errors without faking output', async () => {
  const emptyCfg = readAiProviderConfigFromEnv({});
  const noProv = await generateStructuredWithFallback(
    {
      systemInstruction: 'sys',
      jsonContractHint: '{}',
      messages: [{ role: 'user', content: 'hi' }],
      geminiResponseSchema: {},
      normalize: () => ({ ok: true }),
    },
    { config: emptyCfg, cooldownMap: new Map() }
  );
  assert.equal(noProv.ok, false);
  if (!noProv.ok) {
    assert.equal(noProv.code, 'no_providers');
    assert.equal(noProv.status, 503);
  }

  const dualCfg = readAiProviderConfigFromEnv({
    GEMINI_API_KEY: 'gm-live',
    OPENAI_API_KEY: 'oa-live',
  });
  const allQuota = await generateStructuredWithFallback(
    {
      systemInstruction: 'sys',
      jsonContractHint: '{}',
      messages: [{ role: 'user', content: 'hi' }],
      geminiResponseSchema: {},
      normalize: () => ({ ok: true }),
    },
    {
      config: dualCfg,
      cooldownMap: new Map(),
      invoker: async () => {
        throw new Error('429 RESOURCE_EXHAUSTED');
      },
    }
  );
  assert.equal(allQuota.ok, false);
  if (!allQuota.ok) {
    assert.equal(allQuota.code, 'all_quota');
    assert.equal(allQuota.status, 429);
    assert.equal(allQuota.errors.length, 2);
  }
});

test('mergeAiProviderConfig applies Firestore provider order, disabledProviders, and safe model overrides without exposing keys', async () => {
  const {
    mergeAiProviderConfig,
    parseFirestorePortfolioSettingsDoc,
    clearAllProviderCooldowns,
  } = await import('@/lib/aiProviderRouter');
  const { sanitizeAiRoutingSettings } = await import('@/lib/caseStudioTypes');

  const envCfg = readAiProviderConfigFromEnv({
    GEMINI_API_KEY: 'gm-live',
    OPENAI_API_KEY: 'oa-live',
    ANTHROPIC_API_KEY: 'an-live',
    OPENROUTER_API_KEY: 'or-live',
  });

  const parsedDoc = parseFirestorePortfolioSettingsDoc({
    fields: {
      aiProviderOrder: {
        arrayValue: {
          values: [{ stringValue: 'anthropic' }, { stringValue: 'openrouter' }, { stringValue: 'gemini' }],
        },
      },
      aiDisabledProviders: {
        arrayValue: {
          values: [{ stringValue: 'openai' }],
        },
      },
      aiOpenaiModel: { stringValue: 'gpt-4.1-mini' },
      aiAnthropicModel: { stringValue: 'claude-3-7-sonnet-latest' },
      aiOpenrouterModel: { stringValue: 'anthropic/claude-3.5-sonnet' },
    },
  });

  assert.ok(parsedDoc);
  const merged = mergeAiProviderConfig(envCfg, parsedDoc);

  assert.deepEqual(merged.providerOrder, ['anthropic', 'openrouter', 'gemini', 'openai']);
  assert.deepEqual(getConfiguredProviders(merged), ['anthropic', 'openrouter', 'gemini']);
  assert.equal(merged.openaiModel, 'gpt-4.1-mini');
  assert.equal(merged.anthropicModel, 'claude-3-7-sonnet-latest');
  assert.equal(merged.openrouterModel, 'anthropic/claude-3.5-sonnet');
  assert.equal(merged.geminiModel, 'gemini-4-hydrogen');

  // Unsafe model strings (e.g., whitespace/control chars) fall back to env defaults
  const rejected = mergeAiProviderConfig(envCfg, {
    openaiModel: 'gpt-4o; rm -rf /',
    openrouterModel: 'bad model with spaces',
  });
  assert.equal(rejected.openaiModel, 'gpt-4o-mini');
  assert.equal(rejected.openrouterModel, 'google/gemini-2.5-flash');

  // Cooldown reset clears stale cooldowns
  const cd = new Map<AiProviderId, number>([['gemini', Date.now() + 60_000]]);
  clearAllProviderCooldowns(cd);
  assert.equal(cd.size, 0);

  // sanitizeAiRoutingSettings completes missing providers and strips invalid IDs
  const sanitized = sanitizeAiRoutingSettings({
    aiProviderOrder: ['openrouter', 'gemini'],
    aiDisabledProviders: ['openai'],
    aiOpenaiModel: '  gpt-4o  ',
    aiAnthropicModel: 'invalid model!',
    aiOpenrouterModel: 'deepseek/deepseek-chat-v3-0324',
  });
  assert.deepEqual(sanitized.aiProviderOrder, ['openrouter', 'gemini', 'openai', 'anthropic']);
  assert.deepEqual(sanitized.aiDisabledProviders, ['openai']);
  assert.equal(sanitized.aiOpenaiModel, 'gpt-4o');
  assert.equal(sanitized.aiAnthropicModel, '');
  assert.equal(sanitized.aiOpenrouterModel, 'deepseek/deepseek-chat-v3-0324');
});

