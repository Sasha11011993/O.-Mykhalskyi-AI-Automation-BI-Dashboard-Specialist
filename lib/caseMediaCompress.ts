'use client';

import { BLUEPRINT_LIMITS } from './caseStudioTypes';

export interface CompressedImageResult {
  dataUrl: string;
  mimeType: 'image/webp' | 'image/png' | 'image/jpeg';
  width: number;
  height: number;
  approxBytes: number;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не вдалося декодувати зображення.'));
    };
    img.src = objectUrl;
  });
}

/**
 * Compresses an uploaded screenshot (Telegram / Web / BI / n8n) in the browser
 * into a crisp WebP (or JPEG fallback) data URL strictly under Firestore blueprint limits.
 */
export async function compressScreenshotFile(
  file: File,
  maxDimension = 1440
): Promise<CompressedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Оберіть файл зображення (PNG, JPG або WebP).');
  }

  const img = await loadImageFromFile(file);
  const srcW = Math.max(1, img.naturalWidth || img.width);
  const srcH = Math.max(1, img.naturalHeight || img.height);

  let scale = Math.min(1, maxDimension / Math.max(srcW, srcH));
  let targetW = Math.max(1, Math.round(srcW * scale));
  let targetH = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Браузер не підтримує Canvas для стиснення зображень.');
  }

  const encode = (w: number, h: number, mime: 'image/webp' | 'image/jpeg', quality: number) => {
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL(mime, quality);
  };

  // Detect browser WebP encoding support
  const probe = encode(2, 2, 'image/webp', 0.8);
  const preferredMime: 'image/webp' | 'image/jpeg' = probe.startsWith('data:image/webp;base64,')
    ? 'image/webp'
    : 'image/jpeg';

  const qualitySteps = [0.86, 0.78, 0.68, 0.56];
  const maxAllowedChars = BLUEPRINT_LIMITS.MAX_MEDIA_DATA_URL_LEN - 20000;

  let bestDataUrl = '';
  for (let pass = 0; pass < 3; pass++) {
    for (const q of qualitySteps) {
      const candidate = encode(targetW, targetH, preferredMime, q);
      bestDataUrl = candidate;
      if (candidate.length <= maxAllowedChars) {
        return {
          dataUrl: candidate,
          mimeType: preferredMime,
          width: targetW,
          height: targetH,
          approxBytes: Math.round((candidate.length * 3) / 4),
        };
      }
    }
    // Still too large: step down resolution by 22%
    scale *= 0.78;
    targetW = Math.max(320, Math.round(srcW * scale));
    targetH = Math.max(200, Math.round(srcH * scale));
  }

  if (bestDataUrl.length > BLUEPRINT_LIMITS.MAX_MEDIA_DATA_URL_LEN) {
    throw new Error('Зображення занадто велике навіть після стиснення. Спробуйте обрізати скріншот.');
  }

  return {
    dataUrl: bestDataUrl,
    mimeType: preferredMime,
    width: targetW,
    height: targetH,
    approxBytes: Math.round((bestDataUrl.length * 3) / 4),
  };
}
