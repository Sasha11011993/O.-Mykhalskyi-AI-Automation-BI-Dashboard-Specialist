import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerFirebaseToken } from '@/lib/firebaseServerAuth';
import {
  clearAllProviderCooldowns,
  invalidateAiRoutingCache,
  readAiProviderConfigFromEnv,
} from '@/lib/aiProviderRouter';

export const runtime = 'nodejs';

/**
 * Owner-only read-only status endpoint reporting ONLY booleans indicating which
 * server-side provider API keys are configured in environment secrets, plus non-secret
 * default model IDs. Never accepts, stores, or returns API key values.
 */
export async function GET(req: NextRequest) {
  const authResult = await verifyOwnerFirebaseToken(req.headers.get('authorization'));
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const envConfig = readAiProviderConfigFromEnv();
  return NextResponse.json({
    configured: {
      gemini: Boolean(envConfig.geminiApiKey),
      openai: Boolean(envConfig.openaiApiKey),
      anthropic: Boolean(envConfig.anthropicApiKey),
      openrouter: Boolean(envConfig.openrouterApiKey),
    },
    envDefaults: {
      geminiModel: envConfig.geminiModel,
      openaiModel: envConfig.openaiModel,
      anthropicModel: envConfig.anthropicModel,
      openrouterModel: envConfig.openrouterModel,
      providerOrder: envConfig.providerOrder,
    },
  });
}

/**
 * Owner-only cache refresh endpoint called right after saving AI routing settings
 * in /admin so model/priority changes apply immediately without restarting the server.
 */
export async function POST(req: NextRequest) {
  const authResult = await verifyOwnerFirebaseToken(req.headers.get('authorization'));
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  invalidateAiRoutingCache();
  clearAllProviderCooldowns();

  return NextResponse.json({ refreshed: true });
}
