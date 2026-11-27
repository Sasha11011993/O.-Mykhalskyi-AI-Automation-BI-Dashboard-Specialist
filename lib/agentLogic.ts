import {
  DEFAULT_ROI_INPUT,
  ROI_HOURLY_RATE_MAX,
  ROI_HOURLY_RATE_MIN,
  calculateAutomationRoi,
  clampNumber,
  formatCurrencyUsd,
  formatInteger,
  type Locale,
  type RoiInput,
  type ServiceId,
} from './portfolioLogic';
import { CASE_STUDIES_DATA, FAQ_ITEMS, SERVICES_DATA, type LocalizedText } from './portfolioData';

export type AgentMessageRole = 'user' | 'assistant';

export interface AgentHistoryMessage {
  role: AgentMessageRole;
  content: string;
}

export interface AgentRoiEstimate {
  teamSize: number;
  weeklyManualHoursPerPerson: number;
  hourlyRateUsd: number;
}

export interface AgentRecommendation {
  serviceId: ServiceId;
  estimatedTimeline: string;
  estimatedBudgetRange: string;
  suggestedStack: string[];
  briefSummary: string;
  briefDraft: string;
  roiEstimate?: AgentRoiEstimate;
}

export interface AgentResponsePayload {
  reply: string;
  recommendation?: AgentRecommendation;
  quickReplies: string[];
}

export interface AgentRequestPayload {
  messages: AgentHistoryMessage[];
  locale: Locale;
  currentRoi: RoiInput;
}

export interface AgentUiMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  recommendation?: AgentRecommendation;
  quickReplies?: string[];
}

export interface AgentStarterPrompt {
  id: string;
  label: LocalizedText;
  prompt: LocalizedText;
}

export const AGENT_MAX_HISTORY_MESSAGES = 12;
export const AGENT_MAX_MESSAGE_CHARS = 1200;

export const AGENT_ROI_BOUNDS = {
  teamMin: 1,
  teamMax: 30,
  hoursMin: 1,
  hoursMax: 20,
  rateMin: ROI_HOURLY_RATE_MIN,
  rateMax: ROI_HOURLY_RATE_MAX,
} as const;

export const VALID_SERVICE_IDS: readonly ServiceId[] = [
  'ai-agents',
  'bi-dashboards',
  'etl-pipelines',
  'audit-architecture',
] as const;

export const AGENT_STARTER_PROMPTS: readonly AgentStarterPrompt[] = [
  {
    id: 'crm-routine',
    label: {
      uk: 'CRM і ручні таблиці',
      en: 'CRM & manual spreadsheets',
    },
    prompt: {
      uk: 'Менеджери вручну зводять заявки з CRM і таблиці (команда 6 людей, десь 7 год/тиждень на кожного, ставка $18/год) — скільки коштує це автоматизувати?',
      en: 'Our team of 6 spends ~7 hrs/week each copying CRM requests into spreadsheets ($18/hr) — what would automation look like and cost?',
    },
  },
  {
    id: 'pnl-bi',
    label: {
      uk: 'P&L та маркетинг BI',
      en: 'P&L & marketing BI',
    },
    prompt: {
      uk: 'Потрібен єдиний P&L та маркетинговий дашборд без ручного Excel — дані зараз у CRM, рекламних кабінетах і 1С/ERP.',
      en: 'We need a unified P&L and marketing dashboard without manual Excel — data is currently split across CRM, ad accounts, and ERP.',
    },
  },
  {
    id: 'audit-850',
    label: {
      uk: 'Старт з аудиту за $850',
      en: 'Start with $850 Audit',
    },
    prompt: {
      uk: 'Процеси зараз хаотичні й немає готового ТЗ. Хочу почати з діагностики за $850 — чи підійде нам аудит і що ми отримаємо?',
      en: 'Our workflows are messy and we have no spec yet. Would the $850 diagnostic audit make sense and what do we get?',
    },
  },
] as const;

export const AGENT_UI_COPY = {
  headerButtonDesktop: { uk: 'AI-агент', en: 'AI Agent' },
  headerButtonMobile: { uk: 'AI', en: 'AI' },
  drawerTitle: { uk: 'AI-асистент Олександра', en: 'Oleksandr’s AI Assistant' },
  drawerSubtitle: {
    uk: 'Оцінка задачі · ROI · Підготовка брифу',
    en: 'Task Scoping · ROI · Brief Prep',
  },
  newSession: { uk: 'Новий розбір', en: 'New session' },
  closeDrawer: { uk: 'Закрити панель AI-агента', en: 'Close AI assistant drawer' },
  openDrawerAria: {
    uk: 'Відкрити AI-агента для розбору задачі та розрахунку ROI',
    en: 'Open AI assistant to scope your task and estimate ROI',
  },
  emptyHeading: {
    uk: 'Опишіть ваш процес — підберу рішення, ROI та чернетку брифу',
    en: 'Describe your workflow — get architecture scope, ROI & brief draft',
  },
  emptyLead: {
    uk: 'Розкажіть, на що команда витрачає ручний час або яких звітів бракує. Я оціню формат співпраці, бюджет і перенесу параметри в калькулятор чи бриф в 1 клік.',
    en: 'Share where your team loses manual hours or lacks reporting visibility. I will recommend a track, estimate ROI, and prefill the calculator or brief in 1 click.',
  },
  startersHeading: { uk: 'Типові запити для швидкого старту', en: 'Quick-start business scenarios' },
  inputPlaceholder: {
    uk: 'Напр.: 5 менеджерів витрачають по 6 год/тиждень на обробку заявок...',
    en: 'E.g., 5 managers spend 6 hrs/week manually triaging leads...',
  },
  sendAria: { uk: 'Надіслати повідомлення агенту', en: 'Send message to AI assistant' },
  loadingText: {
    uk: 'Аналізую процес і рахую оцінку…',
    en: 'Analyzing workflow and estimating scope…',
  },
  recommendationLabel: { uk: 'Рекомендоване рішення', en: 'Recommended Scope' },
  timelineLabel: { uk: 'Термін', en: 'Timeline' },
  budgetLabel: { uk: 'Орієнтир', en: 'Budget' },
  stackLabel: { uk: 'Стек', en: 'Stack' },
  roiPreviewLabel: { uk: 'Оцінка ROI для калькулятора', en: 'Estimated ROI for Calculator' },
  applyRoiBtn: { uk: 'Оновити ROI і відкрити графік', en: 'Update ROI & open chart' },
  appliedRoiBtn: { uk: 'ROI оновлено', en: 'ROI updated' },
  transferBriefBtn: { uk: 'Перенести у бриф', en: 'Transfer to brief' },
  retryBtn: { uk: 'Спробувати ще раз', en: 'Try again' },
  directContactBtn: { uk: 'Перейти до брифу', en: 'Open contact brief' },
  footerHint: {
    uk: 'Enter — надіслати · Shift+Enter — новий рядок · Esc — закрити',
    en: 'Enter to send · Shift+Enter for new line · Esc to close',
  },
} as const;

export function normalizeServiceId(raw: unknown): ServiceId | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase();
  if ((VALID_SERVICE_IDS as readonly string[]).includes(cleaned)) {
    return cleaned as ServiceId;
  }
  if (cleaned === 'audit' || cleaned.includes('audit') || cleaned.includes('blueprint')) {
    return 'audit-architecture';
  }
  if (cleaned === 'ai-automation' || cleaned === 'ai' || cleaned.includes('agent')) {
    return 'ai-agents';
  }
  if (cleaned === 'bi-dashboard' || cleaned === 'bi' || cleaned.includes('dashboard')) {
    return 'bi-dashboards';
  }
  if (cleaned === 'end-to-end' || cleaned === 'etl' || cleaned.includes('pipeline') || cleaned.includes('warehouse')) {
    return 'etl-pipelines';
  }
  return null;
}

export function normalizeRoiEstimate(raw: unknown): AgentRoiEstimate | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const candidate = raw as Record<string, unknown>;
  const team = Number(candidate.teamSize);
  const hours = Number(candidate.weeklyManualHoursPerPerson);
  const rate = Number(candidate.hourlyRateUsd);

  if (!Number.isFinite(team) || !Number.isFinite(hours) || !Number.isFinite(rate)) {
    return undefined;
  }
  if (team <= 0 || hours <= 0 || rate <= 0) {
    return undefined;
  }

  return {
    teamSize: Math.round(clampNumber(team, AGENT_ROI_BOUNDS.teamMin, AGENT_ROI_BOUNDS.teamMax)),
    weeklyManualHoursPerPerson: Math.round(
      clampNumber(hours, AGENT_ROI_BOUNDS.hoursMin, AGENT_ROI_BOUNDS.hoursMax)
    ),
    hourlyRateUsd: Math.round(
      clampNumber(rate, AGENT_ROI_BOUNDS.rateMin, AGENT_ROI_BOUNDS.rateMax)
    ),
  };
}

export function validateAgentRequest(
  rawBody: unknown
): { ok: true; data: AgentRequestPayload } | { ok: false; error: string; status: number } {
  if (!rawBody || typeof rawBody !== 'object') {
    return { ok: false, error: 'Invalid request payload.', status: 400 };
  }

  const body = rawBody as Record<string, unknown>;
  const locale: Locale = body.locale === 'en' ? 'en' : 'uk';

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return {
      ok: false,
      error: locale === 'uk' ? 'Повідомлення не може бути порожнім.' : 'Messages array cannot be empty.',
      status: 400,
    };
  }

  const sanitizedMessages: AgentHistoryMessage[] = [];
  for (const item of body.messages) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Malformed message entry.', status: 400 };
    }
    const entry = item as Record<string, unknown>;
    const role = entry.role;
    const rawContent = entry.content;
    if ((role !== 'user' && role !== 'assistant') || typeof rawContent !== 'string') {
      return { ok: false, error: 'Invalid message role or content.', status: 400 };
    }
    const content = rawContent.trim();
    if (!content) continue;
    if (content.length > AGENT_MAX_MESSAGE_CHARS) {
      return {
        ok: false,
        error:
          locale === 'uk'
            ? `Повідомлення занадто довге (максимум ${AGENT_MAX_MESSAGE_CHARS} символів).`
            : `Message is too long (maximum ${AGENT_MAX_MESSAGE_CHARS} characters).`,
        status: 400,
      };
    }
    sanitizedMessages.push({ role, content });
  }

  if (sanitizedMessages.length === 0) {
    return {
      ok: false,
      error: locale === 'uk' ? 'Введіть текст запиту.' : 'Please enter a message.',
      status: 400,
    };
  }

  const trimmedHistory = sanitizedMessages.slice(-AGENT_MAX_HISTORY_MESSAGES);
  if (trimmedHistory[trimmedHistory.length - 1]?.role !== 'user') {
    return {
      ok: false,
      error: 'The latest message must be sent by the user.',
      status: 400,
    };
  }

  const normalizedRoi = normalizeRoiEstimate(body.currentRoi) ?? DEFAULT_ROI_INPUT;

  return {
    ok: true,
    data: {
      messages: trimmedHistory,
      locale,
      currentRoi: normalizedRoi,
    },
  };
}

export function buildAgentPrefillSummary(
  serviceId: ServiceId,
  estimatedBudgetRange: string,
  locale: Locale
): string {
  const service = SERVICES_DATA.find((item) => item.id === serviceId);
  const serviceName = service ? service.shortTitle[locale] : serviceId;
  const cleanBudget = estimatedBudgetRange.trim();
  if (locale === 'uk') {
    return cleanBudget
      ? `AI-агент підготував бриф: ${serviceName} (${cleanBudget})`
      : `AI-агент підготував бриф: ${serviceName}`;
  }
  return cleanBudget
    ? `AI Assistant prepared brief: ${serviceName} (${cleanBudget})`
    : `AI Assistant prepared brief: ${serviceName}`;
}

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
  }
  return trimmed;
}

export function normalizeAgentResponse(
  rawInput: unknown,
  locale: Locale
): AgentResponsePayload | null {
  let parsed: unknown = rawInput;
  if (typeof rawInput === 'string') {
    const cleaned = stripMarkdownFences(rawInput);
    if (!cleaned) return null;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const reply = typeof obj.reply === 'string' ? obj.reply.trim() : '';
  if (!reply) return null;

  let recommendation: AgentRecommendation | undefined;
  if (obj.recommendation && typeof obj.recommendation === 'object') {
    const rec = obj.recommendation as Record<string, unknown>;
    const serviceId = normalizeServiceId(rec.serviceId);
    if (serviceId) {
      const matchedService = SERVICES_DATA.find((item) => item.id === serviceId);
      const estimatedTimeline =
        typeof rec.estimatedTimeline === 'string' && rec.estimatedTimeline.trim()
          ? rec.estimatedTimeline.trim().slice(0, 60)
          : matchedService?.timeline[locale] ?? (locale === 'uk' ? '2–4 тижні' : '2–4 weeks');

      const estimatedBudgetRange =
        typeof rec.estimatedBudgetRange === 'string' && rec.estimatedBudgetRange.trim()
          ? rec.estimatedBudgetRange.trim().slice(0, 60)
          : matchedService?.investment[locale] ?? '$1,800+';

      const rawStack = Array.isArray(rec.suggestedStack) ? rec.suggestedStack : [];
      const dedupedStack: string[] = [];
      for (const tool of rawStack) {
        if (typeof tool !== 'string') continue;
        const cleanTool = tool.trim().slice(0, 32);
        if (cleanTool && !dedupedStack.includes(cleanTool)) {
          dedupedStack.push(cleanTool);
        }
        if (dedupedStack.length >= 4) break;
      }
      const suggestedStack =
        dedupedStack.length > 0
          ? dedupedStack
          : (matchedService?.stack.slice(0, 4) ?? ['n8n', 'Python', 'PostgreSQL']);

      const roiEstimate = normalizeRoiEstimate(rec.roiEstimate);

      const briefSummary =
        typeof rec.briefSummary === 'string' && rec.briefSummary.trim()
          ? rec.briefSummary.trim().slice(0, 120)
          : buildAgentPrefillSummary(serviceId, estimatedBudgetRange, locale);

      let briefDraft =
        typeof rec.briefDraft === 'string' && rec.briefDraft.trim().length >= 12
          ? rec.briefDraft.trim().slice(0, 900)
          : '';

      if (!briefDraft) {
        const roiLine = roiEstimate
          ? (() => {
              const calc = calculateAutomationRoi(roiEstimate);
              return locale === 'uk'
                ? ` Оцінка ROI: ${roiEstimate.teamSize} ос., ${roiEstimate.weeklyManualHoursPerPerson} год/тиж ($${roiEstimate.hourlyRateUsd}/год) → ~${formatCurrencyUsd(calc.annualSavingsUsd)}/рік (${formatInteger(calc.monthlySavedHours)} год/міс).`
                : ` ROI estimate: ${roiEstimate.teamSize} people, ${roiEstimate.weeklyManualHoursPerPerson} hrs/wk ($${roiEstimate.hourlyRateUsd}/hr) → ~${formatCurrencyUsd(calc.annualSavingsUsd)}/yr (${formatInteger(calc.monthlySavedHours)} hrs/mo).`;
            })()
          : '';
        const svcTitle = matchedService?.title[locale] ?? serviceId;
        briefDraft =
          locale === 'uk'
            ? `Запит за підсумками AI-розбору: ${svcTitle}. Стек: ${suggestedStack.join(', ')}. Орієнтир: ${estimatedTimeline}, ${estimatedBudgetRange}.${roiLine}`
            : `Scoped via AI Assistant: ${svcTitle}. Stack: ${suggestedStack.join(', ')}. Estimate: ${estimatedTimeline}, ${estimatedBudgetRange}.${roiLine}`;
      }

      recommendation = {
        serviceId,
        estimatedTimeline,
        estimatedBudgetRange,
        suggestedStack,
        briefSummary,
        briefDraft,
        ...(roiEstimate ? { roiEstimate } : {}),
      };
    }
  }

  const rawQuickReplies = Array.isArray(obj.quickReplies) ? obj.quickReplies : [];
  const quickReplies: string[] = [];
  for (const item of rawQuickReplies) {
    if (typeof item !== 'string') continue;
    const cleaned = item.trim().slice(0, 80);
    if (cleaned && !quickReplies.includes(cleaned)) {
      quickReplies.push(cleaned);
    }
    if (quickReplies.length >= 3) break;
  }

  return {
    reply,
    ...(recommendation ? { recommendation } : {}),
    quickReplies,
  };
}

export function buildAgentSystemInstruction(locale: Locale, currentRoi: RoiInput): string {
  const servicesSummary = SERVICES_DATA.map(
    (s) =>
      `- id="${s.id}" | ${s.title.uk} (${s.title.en}) | timeline: ${s.timeline.uk} | budget: ${s.investment.uk} | stack: ${s.stack.join(', ')} | outcome: ${s.outcome.uk}`
  ).join('\n');

  const casesSummary = CASE_STUDIES_DATA.map(
    (c) =>
      `- ${c.title.uk} (${c.industry.uk}): ${c.headlineMetric.uk}; stack: ${c.stack.join(', ')}`
  ).join('\n');

  const faqSummary = FAQ_ITEMS.map(
    (f) => `- Q: ${f.question.uk} A: ${f.meta.uk} — ${f.answer.uk}`
  ).join('\n');

  return [
    'You are the technical pre-sales & solution scoping AI assistant embedded inside the portfolio of Oleksandr Mykhalskyi (Олександр Михальський), an Independent AI & BI Engineer (Kyiv / Remote).',
    '',
    'GOAL:',
    '1. Help prospective business clients quickly diagnose their operational bottleneck, select the right engineering track, estimate realistic automation ROI, and generate a ready-to-send project brief.',
    '2. Keep replies crisp, engineering-focused, and practical (2–4 concise sentences, zero fluff, zero sales hype, no markdown bold/bullets inside plain text unless minimal line breaks).',
    `3. Default UI language is "${locale}" (${locale === 'uk' ? 'Ukrainian' : 'English'}). Reply in the language the user writes in; if ambiguous, use "${locale}".`,
    '4. Stay strictly grounded in the real services, pricing, cases, and FAQ below. Never invent fake prices, guarantees, or case studies.',
    '',
    'REAL SERVICES CATALOG (use ONLY these exact serviceId values):',
    servicesSummary,
    '',
    'VERIFIED CASE STUDIES:',
    casesSummary,
    '',
    'PROCESS & SECURITY FAQ:',
    faqSummary,
    '',
    `CURRENT USER ROI CALCULATOR STATE: teamSize=${currentRoi.teamSize} people, weeklyManualHoursPerPerson=${currentRoi.weeklyManualHoursPerPerson} hrs/week, hourlyRateUsd=$${currentRoi.hourlyRateUsd}/hr.`,
    'ROI MODEL FORMULA ON THIS SITE: monthlySavedHours = round(teamSize * weeklyManualHoursPerPerson * 4.33 * 0.72), annualSavingsUsd = monthlySavedHours * hourlyRateUsd * 12.',
    '',
    'STRUCTURED JSON OUTPUT RULES:',
    '- Always return valid JSON matching the configured schema.',
    '- Include "recommendation" whenever the user describes a business workflow problem, asks about cost/timeline/ROI, or asks about one of the services (including the $850 Audit).',
    '- For "recommendation.serviceId", use ONLY one of: "ai-agents", "bi-dashboards", "etl-pipelines", "audit-architecture".',
    '- For "recommendation.roiEstimate": if the user mentions team size, manual hours, or hourly rate, extract them accurately (clamped to teamSize 1–30, weeklyManualHoursPerPerson 1–20, hourlyRateUsd 5–200). If they describe manual team work without exact numbers, provide a realistic conservative baseline estimate and mention briefly that they can adjust it in the ROI calculator.',
    '- Write "recommendation.briefDraft" as a clean, structured 2–4 sentence project brief ready to paste into the Contact form (mentioning their pain point, target systems, recommended track, and ROI parameters if known).',
    '- Write "recommendation.briefSummary" as a short 1-line confirmation banner label (under 75 chars).',
    '- Provide 2–3 short actionable "quickReplies" (under 55 chars each) to guide the next step (e.g. sharing team size, asking about security/NDA, or scoping the $850 audit).',
  ].join('\n');
}

export function checkRateLimit(
  store: Map<string, number[]>,
  clientKey: string,
  nowMs: number,
  maxRequests = 18,
  windowMs = 60_000
): { allowed: boolean; retryAfterSec: number } {
  const existing = store.get(clientKey) ?? [];
  const active = existing.filter((ts) => nowMs - ts < windowMs);

  if (active.length >= maxRequests) {
    const oldestActive = active[0] ?? nowMs;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (nowMs - oldestActive)) / 1000));
    store.set(clientKey, active);
    return { allowed: false, retryAfterSec };
  }

  active.push(nowMs);
  store.set(clientKey, active);
  return { allowed: true, retryAfterSec: 0 };
}
