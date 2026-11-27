import crypto from 'crypto';
import firebaseConfig from '@/firebase-applet-config.json';

export const SERVER_OWNER_ADMIN_EMAIL = 'mihal4ik11@gmail.com';
const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface JwkKey {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n: string;
  e: string;
}

interface CachedJwks {
  keys: Map<string, crypto.KeyObject>;
  expiresAtMs: number;
}

let jwksCache: CachedJwks | null = null;

export interface ParsedJwt {
  header: { alg?: string; kid?: string; typ?: string };
  payload: Record<string, unknown>;
  signingInput: string;
  signature: Buffer;
}

export interface VerifiedOwnerUser {
  uid: string;
  email: string;
}

export type TokenClaimValidationResult =
  | { ok: true; user: VerifiedOwnerUser }
  | { ok: false; status: 401 | 403; error: string };

function decodeBase64UrlToBuffer(segment: string): Buffer {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

export function parseJwtParts(token: string): ParsedJwt | null {
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return null;
  const [headerSeg, payloadSeg, sigSeg] = parts;
  if (!headerSeg || !payloadSeg || !sigSeg) return null;

  try {
    const headerJson = decodeBase64UrlToBuffer(headerSeg).toString('utf8');
    const payloadJson = decodeBase64UrlToBuffer(payloadSeg).toString('utf8');
    const header = JSON.parse(headerJson) as ParsedJwt['header'];
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;
    const signature = decodeBase64UrlToBuffer(sigSeg);

    if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') {
      return null;
    }

    return {
      header,
      payload,
      signingInput: `${headerSeg}.${payloadSeg}`,
      signature,
    };
  } catch {
    return null;
  }
}

export function validateFirebaseTokenClaims(
  payload: Record<string, unknown>,
  expectedProjectId: string,
  expectedOwnerEmail: string,
  nowSec: number = Math.floor(Date.now() / 1000)
): TokenClaimValidationResult {
  const expectedIssuer = `https://securetoken.google.com/${expectedProjectId}`;
  const aud = typeof payload.aud === 'string' ? payload.aud : '';
  const iss = typeof payload.iss === 'string' ? payload.iss : '';
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const exp = typeof payload.exp === 'number' ? payload.exp : 0;
  const iat = typeof payload.iat === 'number' ? payload.iat : 0;
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const emailVerified = payload.email_verified === true;

  if (aud !== expectedProjectId || iss !== expectedIssuer || !sub) {
    return {
      ok: false,
      status: 401,
      error: 'Невалідний токен авторизації Firebase.',
    };
  }

  // Allow 60 seconds of clock skew on iat
  if (exp <= nowSec || iat > nowSec + 60) {
    return {
      ok: false,
      status: 401,
      error: 'Сесія авторизації завершилася. Оновіть сторінку або увійдіть повторно.',
    };
  }

  if (!emailVerified || email.toLowerCase() !== expectedOwnerEmail.toLowerCase()) {
    return {
      ok: false,
      status: 403,
      error: 'Доступ до AI-агента кабінету дозволено лише верифікованому власнику.',
    };
  }

  return {
    ok: true,
    user: { uid: sub, email },
  };
}

function parseMaxAgeMs(cacheControl: string | null): number {
  if (!cacheControl) return 300_000;
  const match = /max-age=(\d+)/i.exec(cacheControl);
  if (!match) return 300_000;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 60) return 300_000;
  return Math.min(seconds * 1000, 6 * 3600 * 1000);
}

async function getFirebasePublicKey(kid: string): Promise<crypto.KeyObject | null> {
  const now = Date.now();
  if (jwksCache && jwksCache.expiresAtMs > now) {
    const cached = jwksCache.keys.get(kid);
    if (cached) return cached;
  }

  const res = await fetch(FIREBASE_JWKS_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase JWKS (${res.status})`);
  }

  const data = (await res.json()) as { keys?: JwkKey[] };
  const keysMap = new Map<string, crypto.KeyObject>();
  if (Array.isArray(data.keys)) {
    for (const jwk of data.keys) {
      if (jwk.kid && jwk.kty === 'RSA' && jwk.n && jwk.e) {
        const keyObj = crypto.createPublicKey({
          key: {
            kty: 'RSA',
            n: jwk.n,
            e: jwk.e,
          },
          format: 'jwk',
        });
        keysMap.set(jwk.kid, keyObj);
      }
    }
  }

  jwksCache = {
    keys: keysMap,
    expiresAtMs: now + parseMaxAgeMs(res.headers.get('cache-control')),
  };

  return keysMap.get(kid) ?? null;
}

export async function verifyOwnerFirebaseToken(
  authorizationHeader: string | null
): Promise<TokenClaimValidationResult> {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      error: 'Потрібна авторизація власника для використання AI-агента.',
    };
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token || token.length > 10_000) {
    return {
      ok: false,
      status: 401,
      error: 'Некоректний заголовок авторизації.',
    };
  }

  const parsed = parseJwtParts(token);
  if (!parsed || parsed.header.alg !== 'RS256' || !parsed.header.kid) {
    return {
      ok: false,
      status: 401,
      error: 'Непідтримуваний формат токена авторизації.',
    };
  }

  try {
    const publicKey = await getFirebasePublicKey(parsed.header.kid);
    if (!publicKey) {
      return {
        ok: false,
        status: 401,
        error: 'Ключ підпису Firebase не знайдено. Спробуйте увійти повторно.',
      };
    }

    const isSignatureValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(parsed.signingInput, 'utf8'),
      publicKey,
      parsed.signature
    );

    if (!isSignatureValid) {
      return {
        ok: false,
        status: 401,
        error: 'Невалідний підпис токена авторизації.',
      };
    }
  } catch (err) {
    console.error('[firebaseServerAuth] JWKS verification error:', err);
    return {
      ok: false,
      status: 401,
      error: 'Не вдалося перевірити токен авторизації. Спробуйте ще раз.',
    };
  }

  return validateFirebaseTokenClaims(
    parsed.payload,
    firebaseConfig.projectId,
    SERVER_OWNER_ADMIN_EMAIL
  );
}
