import { NextResponse } from 'next/server';

interface ContactPayload {
  name?: string;
  email?: string;
  serviceId?: string;
  budget?: string;
  details?: string;
  locale?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ContactPayload;
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim();
    const serviceId = String(body.serviceId ?? 'ai-agents').trim();
    const budget = String(body.budget ?? 'starter').trim();
    const details = String(body.details ?? '').trim();
    const locale = body.locale === 'en' ? 'en' : 'uk';

    if (name.length < 2 || !EMAIL_RE.test(email) || details.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'Invalid inquiry fields' },
        { status: 400 }
      );
    }

    const referenceId = `OM-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const record = {
      referenceId,
      name,
      email,
      serviceId,
      budget,
      details,
      locale,
      source: 'portfolio-web',
      submittedAt: new Date().toISOString(),
    };

    const webhookUrl = process.env.N8N_CONTACT_WEBHOOK_URL?.trim();
    const tgToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const tgChatId = process.env.TELEGRAM_CHAT_ID?.trim();

    let delivery: 'n8n-webhook' | 'telegram' | 'server-log' = 'server-log';

    if (webhookUrl) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
          signal: controller.signal,
        });
        if (res.ok) delivery = 'n8n-webhook';
      } finally {
        clearTimeout(timer);
      }
    } else if (tgToken && tgChatId) {
      const text = [
        `📩 New Portfolio Inquiry (${referenceId})`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Service: ${serviceId} | Budget: ${budget}`,
        `Brief: ${details}`,
      ].join('\n');
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChatId, text }),
      });
      if (res.ok) delivery = 'telegram';
    }

    if (delivery === 'server-log') {
      console.info('[portfolio-contact]', JSON.stringify(record));
    }

    return NextResponse.json({ ok: true, referenceId, delivery });
  } catch (error) {
    console.error('[portfolio-contact-error]', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to process inquiry' },
      { status: 500 }
    );
  }
}
