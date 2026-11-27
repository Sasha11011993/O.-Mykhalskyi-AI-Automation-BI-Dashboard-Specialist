import {
  BLUEPRINT_LIMITS,
  clampHotspotCoord,
  slugifyCaseId,
  type CaseMetricRecord,
  type CaseSceneDescriptor,
  type CaseSceneKind,
  type CaseTestimonialRecord,
  type CaseVisibility,
  type PortfolioCaseRecord,
  type SceneHotspot,
} from '@/lib/caseStudioTypes';
import {
  parseAndLayoutN8nWorkflow,
  type N8nRawWorkflow,
} from '@/lib/n8nWorkflowEngine';
import type { CaseCategory, ServiceId } from '@/lib/portfolioLogic';

export interface CaseAgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CaseAgentWorkflowSummary {
  sceneId: string;
  workflowName: string;
  nodeCount: number;
  edgeCount: number;
  stack: string[];
  nodes: Array<{
    name: string;
    shortType: string;
    notes: string;
  }>;
}

export interface CaseAgentSceneImage {
  sceneId: string;
  sceneTitle: string;
  sceneKind: CaseSceneKind;
  mimeType: 'image/webp' | 'image/png' | 'image/jpeg';
  base64Data: string;
}

export interface CaseAgentDraftSnapshot {
  id: string;
  status: CaseVisibility;
  category: Exclude<CaseCategory, 'all'>;
  year: string;
  titleUk: string;
  titleEn: string;
  industryUk: string;
  industryEn: string;
  durationUk: string;
  durationEn: string;
  headlineMetricUk: string;
  headlineMetricEn: string;
  summaryUk: string;
  summaryEn: string;
  challengeUk: string;
  challengeEn: string;
  solutionUk: string;
  solutionEn: string;
  stack: string[];
  metrics: CaseMetricRecord[];
  testimonial: CaseTestimonialRecord;
  scenes: Array<{
    id: string;
    kind: CaseSceneKind;
    titleUk: string;
    titleEn: string;
    captionUk: string;
    captionEn: string;
    hotspotCount: number;
  }>;
}

export interface CaseAgentHotspotPatch {
  xPct: number;
  yPct: number;
  titleUk: string;
  titleEn: string;
  noteUk: string;
  noteEn: string;
}

export interface CaseAgentScenePatch {
  sceneId: string;
  titleUk?: string;
  titleEn?: string;
  captionUk?: string;
  captionEn?: string;
  hotspots?: CaseAgentHotspotPatch[];
}

export interface CaseAgentCasePatch {
  titleUk?: string;
  titleEn?: string;
  suggestedSlug?: string;
  suggestedStatus?: CaseVisibility;
  category?: Exclude<CaseCategory, 'all'>;
  year?: string;
  industryUk?: string;
  industryEn?: string;
  durationUk?: string;
  durationEn?: string;
  headlineMetricUk?: string;
  headlineMetricEn?: string;
  summaryUk?: string;
  summaryEn?: string;
  challengeUk?: string;
  challengeEn?: string;
  solutionUk?: string;
  solutionEn?: string;
  stack?: string[];
  metrics?: CaseMetricRecord[];
  testimonial?: Partial<CaseTestimonialRecord>;
}

export interface CaseAgentResponse {
  reply: string;
  changeSummary: string[];
  casePatch?: CaseAgentCasePatch;
  scenePatches?: CaseAgentScenePatch[];
  quickReplies: string[];
}

export interface ValidatedCaseAgentRequest {
  messages: CaseAgentMessage[];
  draftSnapshot: CaseAgentDraftSnapshot;
  workflowSummaries: CaseAgentWorkflowSummary[];
  sceneImages: CaseAgentSceneImage[];
}

export type CaseAgentRequestValidationResult =
  | { ok: true; data: ValidatedCaseAgentRequest }
  | { ok: false; status: number; error: string };

export interface AdminAgentPreset {
  id: string;
  label: string;
  prompt: string;
}

export const ADMIN_AGENT_PRESETS: readonly AdminAgentPreset[] = [
  {
    id: 'assemble',
    label: 'Зібрати кейс із файлів',
    prompt:
      'Проаналізуй завантажений n8n воркфлоу, скріншоти сцен і поточну чернетку. Заповни весь паспорт кейсу українською та англійською (заголовок, індустрія, тривалість, категорія, резюме, виклик, архітектурне рішення, стек, чесні метрики без вигадування фінансових цифр), підпиши всі сцени та запропонуй 2–3 точні мітки на скріншотах.',
  },
  {
    id: 'translate',
    label: 'Перекласти UA → EN',
    prompt:
      'Переклади й синхронізуй усі заповнені українські поля кейсу, назви/підписи сцен і метрики природною технічною англійською мовою, не змінюючи український текст.',
  },
  {
    id: 'nda',
    label: 'Знеособити під NDA',
    prompt:
      'Вичисти з усіх текстових полів і підписів сцен будь-які згадки конкретних компаній, імен клієнтів, доменів чи чутливих деталей під NDA. Заміни їх на нейтральні інженерні формулювання та запропонуй статус "unlisted".',
  },
  {
    id: 'hotspots',
    label: 'Мітки на скріншотах',
    prompt:
      'Уважно розглянь передані скріншоти інтерфейсів і розстав по 2–3 точні пронумеровані інженерні мітки (hotspots із координатами xPct, yPct від 0 до 100) на ключових елементах кожної візуальної сцени двома мовами (UA і EN).',
  },
] as const;

const ALLOWED_IMAGE_MIMES = new Set(['image/webp', 'image/png', 'image/jpeg']);
const ALLOWED_CATEGORIES = new Set<Exclude<CaseCategory, 'all'>>(['ai', 'bi', 'etl']);
const ALLOWED_VISIBILITIES = new Set<CaseVisibility>(['draft', 'published', 'unlisted']);
const ALLOWED_SCENE_KINDS = new Set<CaseSceneKind>([
  'n8n-json',
  'ui-telegram',
  'ui-web',
  'ui-n8n-image',
]);

const CATEGORY_TO_SERVICE: Record<Exclude<CaseCategory, 'all'>, ServiceId> = {
  ai: 'ai-agents',
  bi: 'bi-dashboards',
  etl: 'etl-pipelines',
};

function clampStr(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function optionalClampedStr(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

/**
 * Extracts raw base64 data & MIME type from a verified image data URL.
 * Rejects non-image, SVG, or script schemes strictly.
 */
export function extractBase64ImageFromDataUrl(
  dataUrl: string
): { mimeType: 'image/webp' | 'image/png' | 'image/jpeg'; base64Data: string } | null {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = match[1] as 'image/webp' | 'image/png' | 'image/jpeg';
  const base64Data = match[2];
  if (base64Data.length < 16 || base64Data.length > 650_000) return null;
  return { mimeType, base64Data };
}

/**
 * Produces a token-efficient architectural summary of a parsed n8n workflow
 * so the AI agent grounds Challenge, Solution, Stack, and Metrics in real nodes.
 */
export function buildWorkflowSummaryForAgent(
  sceneId: string,
  workflow: N8nRawWorkflow
): CaseAgentWorkflowSummary {
  const parsed = parseAndLayoutN8nWorkflow(workflow, 'compact');
  if (parsed.ok) {
    return {
      sceneId,
      workflowName: clampStr(parsed.graph.workflowName || workflow.name || 'n8n Workflow', 120),
      nodeCount: parsed.graph.nodes.length,
      edgeCount: parsed.graph.edges.length,
      stack: parsed.graph.uniqueTechStack.slice(0, 12),
      nodes: parsed.graph.nodes.slice(0, 35).map((n) => ({
        name: clampStr(n.name, 80),
        shortType: clampStr(n.shortType, 60),
        notes: clampStr(n.explanation.uk || '', 160),
      })),
    };
  }

  const rawNodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  return {
    sceneId,
    workflowName: clampStr(workflow.name || 'n8n Workflow', 120),
    nodeCount: rawNodes.length,
    edgeCount: 0,
    stack: ['n8n'],
    nodes: rawNodes.slice(0, 35).map((n) => ({
      name: clampStr(n.name, 80),
      shortType: clampStr(n.type, 60),
      notes: clampStr(n.notes ?? '', 160),
    })),
  };
}

export function buildDraftSnapshotForAgent(
  draft: PortfolioCaseRecord,
  stackInput: string
): CaseAgentDraftSnapshot {
  const parsedStack = stackInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, BLUEPRINT_LIMITS.MAX_STACK_ITEMS);

  return {
    id: draft.id,
    status: draft.status,
    category: draft.category,
    year: draft.year,
    titleUk: draft.titleUk,
    titleEn: draft.titleEn,
    industryUk: draft.industryUk,
    industryEn: draft.industryEn,
    durationUk: draft.durationUk,
    durationEn: draft.durationEn,
    headlineMetricUk: draft.headlineMetricUk,
    headlineMetricEn: draft.headlineMetricEn,
    summaryUk: draft.summaryUk,
    summaryEn: draft.summaryEn,
    challengeUk: draft.challengeUk,
    challengeEn: draft.challengeEn,
    solutionUk: draft.solutionUk,
    solutionEn: draft.solutionEn,
    stack: parsedStack,
    metrics: draft.metrics.filter((m) => m.value.trim() || m.labelUk.trim()),
    testimonial: draft.testimonial,
    scenes: draft.scenes.map((s) => ({
      id: s.id,
      kind: s.kind,
      titleUk: s.titleUk,
      titleEn: s.titleEn,
      captionUk: s.captionUk,
      captionEn: s.captionEn,
      hotspotCount: s.hotspots.length,
    })),
  };
}

export function validateCaseAgentRequest(rawBody: unknown): CaseAgentRequestValidationResult {
  if (!rawBody || typeof rawBody !== 'object') {
    return { ok: false, status: 400, error: 'Некоректне тіло запиту.' };
  }

  const body = rawBody as Record<string, unknown>;
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return { ok: false, status: 400, error: 'Потрібне щонайменше одне повідомлення.' };
  }

  const messages: CaseAgentMessage[] = [];
  for (const item of body.messages.slice(-10)) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    const role = m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : null;
    const content = typeof m.content === 'string' ? m.content.trim() : '';
    if (!role || !content) continue;
    if (content.length > 3000) {
      return { ok: false, status: 400, error: 'Повідомлення занадто довге (максимум 3000 символів).' };
    }
    messages.push({ role, content });
  }

  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return { ok: false, status: 400, error: 'Останнє повідомлення має бути від користувача.' };
  }

  if (!body.draftSnapshot || typeof body.draftSnapshot !== 'object') {
    return { ok: false, status: 400, error: 'Відсутній знімок поточної чернетки кейсу.' };
  }

  const rawDraft = body.draftSnapshot as Record<string, unknown>;
  const rawScenes = Array.isArray(rawDraft.scenes) ? rawDraft.scenes : [];
  const scenes = rawScenes.slice(0, BLUEPRINT_LIMITS.MAX_SCENES).map((s, idx) => {
    const sc = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const kind = ALLOWED_SCENE_KINDS.has(sc.kind as CaseSceneKind)
      ? (sc.kind as CaseSceneKind)
      : 'ui-web';
    return {
      id: clampStr(sc.id, 64) || `scene-${idx + 1}`,
      kind,
      titleUk: clampStr(sc.titleUk, 120),
      titleEn: clampStr(sc.titleEn, 120),
      captionUk: clampStr(sc.captionUk, 320),
      captionEn: clampStr(sc.captionEn, 320),
      hotspotCount: typeof sc.hotspotCount === 'number' ? Math.max(0, Math.min(8, sc.hotspotCount)) : 0,
    };
  });

  const draftSnapshot: CaseAgentDraftSnapshot = {
    id: clampStr(rawDraft.id, BLUEPRINT_LIMITS.MAX_ID_LEN),
    status: ALLOWED_VISIBILITIES.has(rawDraft.status as CaseVisibility)
      ? (rawDraft.status as CaseVisibility)
      : 'draft',
    category: ALLOWED_CATEGORIES.has(rawDraft.category as Exclude<CaseCategory, 'all'>)
      ? (rawDraft.category as Exclude<CaseCategory, 'all'>)
      : 'ai',
    year: clampStr(rawDraft.year, 4) || String(new Date().getFullYear()),
    titleUk: clampStr(rawDraft.titleUk, BLUEPRINT_LIMITS.MAX_TITLE_LEN),
    titleEn: clampStr(rawDraft.titleEn, BLUEPRINT_LIMITS.MAX_TITLE_LEN),
    industryUk: clampStr(rawDraft.industryUk, BLUEPRINT_LIMITS.MAX_INDUSTRY_LEN),
    industryEn: clampStr(rawDraft.industryEn, BLUEPRINT_LIMITS.MAX_INDUSTRY_LEN),
    durationUk: clampStr(rawDraft.durationUk, BLUEPRINT_LIMITS.MAX_DURATION_LEN),
    durationEn: clampStr(rawDraft.durationEn, BLUEPRINT_LIMITS.MAX_DURATION_LEN),
    headlineMetricUk: clampStr(rawDraft.headlineMetricUk, BLUEPRINT_LIMITS.MAX_HEADLINE_METRIC_LEN),
    headlineMetricEn: clampStr(rawDraft.headlineMetricEn, BLUEPRINT_LIMITS.MAX_HEADLINE_METRIC_LEN),
    summaryUk: clampStr(rawDraft.summaryUk, BLUEPRINT_LIMITS.MAX_SUMMARY_LEN),
    summaryEn: clampStr(rawDraft.summaryEn, BLUEPRINT_LIMITS.MAX_SUMMARY_LEN),
    challengeUk: clampStr(rawDraft.challengeUk, BLUEPRINT_LIMITS.MAX_CHALLENGE_LEN),
    challengeEn: clampStr(rawDraft.challengeEn, BLUEPRINT_LIMITS.MAX_CHALLENGE_LEN),
    solutionUk: clampStr(rawDraft.solutionUk, BLUEPRINT_LIMITS.MAX_SOLUTION_LEN),
    solutionEn: clampStr(rawDraft.solutionEn, BLUEPRINT_LIMITS.MAX_SOLUTION_LEN),
    stack: Array.isArray(rawDraft.stack)
      ? rawDraft.stack
          .map((t) => clampStr(t, 40))
          .filter(Boolean)
          .slice(0, BLUEPRINT_LIMITS.MAX_STACK_ITEMS)
      : [],
    metrics: Array.isArray(rawDraft.metrics)
      ? rawDraft.metrics.slice(0, BLUEPRINT_LIMITS.MAX_METRICS).map((m) => {
          const mr = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
          return {
            value: clampStr(mr.value, 40),
            labelUk: clampStr(mr.labelUk, 100),
            labelEn: clampStr(mr.labelEn, 100),
          };
        })
      : [],
    testimonial: (() => {
      const tr = (
        rawDraft.testimonial && typeof rawDraft.testimonial === 'object' ? rawDraft.testimonial : {}
      ) as Record<string, unknown>;
      return {
        quoteUk: clampStr(tr.quoteUk, 600),
        quoteEn: clampStr(tr.quoteEn, 600),
        authorUk: clampStr(tr.authorUk, 100),
        authorEn: clampStr(tr.authorEn, 100),
        roleUk: clampStr(tr.roleUk, 100),
        roleEn: clampStr(tr.roleEn, 100),
        company: clampStr(tr.company, 100),
      };
    })(),
    scenes,
  };

  const workflowSummaries: CaseAgentWorkflowSummary[] = [];
  if (Array.isArray(body.workflowSummaries)) {
    for (const rawWf of body.workflowSummaries.slice(0, 4)) {
      if (!rawWf || typeof rawWf !== 'object') continue;
      const wf = rawWf as Record<string, unknown>;
      workflowSummaries.push({
        sceneId: clampStr(wf.sceneId, 64),
        workflowName: clampStr(wf.workflowName, 120),
        nodeCount: typeof wf.nodeCount === 'number' ? Math.max(0, Math.min(200, wf.nodeCount)) : 0,
        edgeCount: typeof wf.edgeCount === 'number' ? Math.max(0, Math.min(400, wf.edgeCount)) : 0,
        stack: Array.isArray(wf.stack)
          ? wf.stack.map((t) => clampStr(t, 40)).filter(Boolean).slice(0, 12)
          : [],
        nodes: Array.isArray(wf.nodes)
          ? wf.nodes.slice(0, 35).map((n) => {
              const nr = (n && typeof n === 'object' ? n : {}) as Record<string, unknown>;
              return {
                name: clampStr(nr.name, 80),
                shortType: clampStr(nr.shortType, 60),
                notes: clampStr(nr.notes, 160),
              };
            })
          : [],
      });
    }
  }

  const sceneImages: CaseAgentSceneImage[] = [];
  if (Array.isArray(body.sceneImages)) {
    if (body.sceneImages.length > 3) {
      return {
        ok: false,
        status: 400,
        error: 'За один запит можна передати максимум 3 скріншоти для Vision-аналізу.',
      };
    }

    for (const rawImg of body.sceneImages) {
      if (!rawImg || typeof rawImg !== 'object') continue;
      const img = rawImg as Record<string, unknown>;
      const mimeType = typeof img.mimeType === 'string' ? img.mimeType : '';
      const base64Data = typeof img.base64Data === 'string' ? img.base64Data.trim() : '';
      if (!ALLOWED_IMAGE_MIMES.has(mimeType)) {
        return { ok: false, status: 400, error: 'Непідтримуваний формат зображення.' };
      }
      if (!base64Data || base64Data.length > 650_000 || !/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
        return { ok: false, status: 400, error: 'Некоректні або завеликі дані скріншоту.' };
      }
      sceneImages.push({
        sceneId: clampStr(img.sceneId, 64),
        sceneTitle: clampStr(img.sceneTitle, 120),
        sceneKind: ALLOWED_SCENE_KINDS.has(img.sceneKind as CaseSceneKind)
          ? (img.sceneKind as CaseSceneKind)
          : 'ui-web',
        mimeType: mimeType as 'image/webp' | 'image/png' | 'image/jpeg',
        base64Data,
      });
    }
  }

  return {
    ok: true,
    data: {
      messages,
      draftSnapshot,
      workflowSummaries,
      sceneImages,
    },
  };
}

export function buildCaseAgentSystemInstruction(
  draftSnapshot: CaseAgentDraftSnapshot,
  workflowSummaries: CaseAgentWorkflowSummary[]
): string {
  const wfBlock =
    workflowSummaries.length > 0
      ? JSON.stringify(workflowSummaries)
      : 'No n8n JSON workflow attached yet.';

  return [
    'You are the Case Producer AI Agent inside the private owner studio of Oleksandr Mykhalskyi (Independent AI Automation & BI Engineer, Kyiv / Remote).',
    'Your job is to help the owner turn raw notes, uploaded n8n JSON workflows, and Telegram/Web UI screenshots into sharp, credible, engineering-grade bilingual (Ukrainian + English) portfolio case studies.',
    '',
    'STRICT GROUNDING & HONESTY RULES:',
    '1. ZERO HALLUCINATED METRICS: Never invent financial savings, percentages, or ROI numbers that the owner did not state. If no business metrics were provided, use verifiable technical facts from the n8n workflow or UI (e.g., "15 вузлів n8n", "0 ручної звірки", "24/7 автозапуск") and briefly tell the owner in `reply` which business numbers they can optionally refine.',
    '2. PARTIAL PATCH DISCIPLINE: Only include fields in `casePatch` and `scenePatches` that actually need to be created or modified based on the owner’s latest request. Do NOT repeat or overwrite unrelated fields that are already filled unless asked to rewrite or translate them.',
    '3. REAL ENGINEERING TONE: Avoid marketing fluff ("революційний", "інноваційний", "підвищує ефективність на 1000%"). Write concise, architectural, Swiss-editorial prose describing real triggers, data flows, guardrails, and user-facing outcomes.',
    '4. NDA SANITIZATION: If asked to anonymize or protect NDA, strip company names, personal names, real URLs/domains, and client identifiers across all fields, and set `casePatch.suggestedStatus` to `"unlisted"`.',
    '5. VISION HOTSPOTS: When images are attached, inspect each screenshot carefully. Each image is labeled with its exact `sceneId`. If asked to annotate screenshots or build the full case, output 2 to 4 crisp hotspots per visual scene with accurate normalized coordinates `xPct` (0..100 from left edge) and `yPct` (0..100 from top edge) pointing directly onto key UI elements (buttons, charts, Telegram bot cards, alerts, filters).',
    '6. STRICT LIMITS: Respect exact character limits: title <= 140, headlineMetric <= 90, summary <= 500, challenge <= 1000, solution <= 1400, stack <= 12 concise tags, metrics <= 3 items, hotspots <= 5 per scene.',
    '7. LANGUAGE: Write `reply` and `changeSummary` in Ukrainian (concise, 2-4 sentences). Populate both `Uk` and `En` fields when drafting or translating.',
    '',
    `CURRENT DRAFT SNAPSHOT JSON: ${JSON.stringify(draftSnapshot)}`,
    `ATTACHED N8N WORKFLOW SUMMARIES JSON: ${wfBlock}`,
  ].join('\n');
}

export function normalizeCaseAgentResponse(
  rawText: string | undefined,
  validSceneIds: readonly string[]
): CaseAgentResponse | null {
  if (!rawText) return null;
  let parsed: unknown;
  try {
    const cleaned = rawText
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const reply = clampStr(obj.reply, 1200);
  if (!reply) return null;

  const validSceneSet = new Set(validSceneIds);
  const rawCasePatch =
    obj.casePatch && typeof obj.casePatch === 'object'
      ? (obj.casePatch as Record<string, unknown>)
      : null;

  let casePatch: CaseAgentCasePatch | undefined;
  if (rawCasePatch) {
    const next: CaseAgentCasePatch = {};
    const assignStr = (key: keyof CaseAgentCasePatch, maxLen: number) => {
      const val = optionalClampedStr(rawCasePatch[key], maxLen);
      if (val !== undefined) {
        (next as Record<string, unknown>)[key] = val;
      }
    };

    assignStr('titleUk', BLUEPRINT_LIMITS.MAX_TITLE_LEN);
    assignStr('titleEn', BLUEPRINT_LIMITS.MAX_TITLE_LEN);
    assignStr('industryUk', BLUEPRINT_LIMITS.MAX_INDUSTRY_LEN);
    assignStr('industryEn', BLUEPRINT_LIMITS.MAX_INDUSTRY_LEN);
    assignStr('durationUk', BLUEPRINT_LIMITS.MAX_DURATION_LEN);
    assignStr('durationEn', BLUEPRINT_LIMITS.MAX_DURATION_LEN);
    assignStr('headlineMetricUk', BLUEPRINT_LIMITS.MAX_HEADLINE_METRIC_LEN);
    assignStr('headlineMetricEn', BLUEPRINT_LIMITS.MAX_HEADLINE_METRIC_LEN);
    assignStr('summaryUk', BLUEPRINT_LIMITS.MAX_SUMMARY_LEN);
    assignStr('summaryEn', BLUEPRINT_LIMITS.MAX_SUMMARY_LEN);
    assignStr('challengeUk', BLUEPRINT_LIMITS.MAX_CHALLENGE_LEN);
    assignStr('challengeEn', BLUEPRINT_LIMITS.MAX_CHALLENGE_LEN);
    assignStr('solutionUk', BLUEPRINT_LIMITS.MAX_SOLUTION_LEN);
    assignStr('solutionEn', BLUEPRINT_LIMITS.MAX_SOLUTION_LEN);

    const rawSlug = optionalClampedStr(rawCasePatch.suggestedSlug, BLUEPRINT_LIMITS.MAX_ID_LEN);
    if (rawSlug) {
      next.suggestedSlug = slugifyCaseId(rawSlug);
    }

    if (ALLOWED_VISIBILITIES.has(rawCasePatch.suggestedStatus as CaseVisibility)) {
      next.suggestedStatus = rawCasePatch.suggestedStatus as CaseVisibility;
    }

    if (ALLOWED_CATEGORIES.has(rawCasePatch.category as Exclude<CaseCategory, 'all'>)) {
      next.category = rawCasePatch.category as Exclude<CaseCategory, 'all'>;
    }

    if (typeof rawCasePatch.year === 'string' && BLUEPRINT_LIMITS.YEAR_PATTERN.test(rawCasePatch.year.trim())) {
      next.year = rawCasePatch.year.trim();
    }

    if (Array.isArray(rawCasePatch.stack)) {
      const stack = Array.from(
        new Set(rawCasePatch.stack.map((t) => clampStr(t, 40)).filter(Boolean))
      ).slice(0, BLUEPRINT_LIMITS.MAX_STACK_ITEMS);
      if (stack.length > 0) next.stack = stack;
    }

    if (Array.isArray(rawCasePatch.metrics)) {
      const metrics = rawCasePatch.metrics
        .slice(0, BLUEPRINT_LIMITS.MAX_METRICS)
        .map((m) => {
          const mr = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
          return {
            value: clampStr(mr.value, 40),
            labelUk: clampStr(mr.labelUk, 100),
            labelEn: clampStr(mr.labelEn, 100),
          };
        })
        .filter((m) => m.value.length > 0);
      if (metrics.length > 0) next.metrics = metrics;
    }

    if (rawCasePatch.testimonial && typeof rawCasePatch.testimonial === 'object') {
      const tr = rawCasePatch.testimonial as Record<string, unknown>;
      const tPatch: Partial<CaseTestimonialRecord> = {};
      const qUk = optionalClampedStr(tr.quoteUk, 600);
      const qEn = optionalClampedStr(tr.quoteEn, 600);
      const aUk = optionalClampedStr(tr.authorUk, 100);
      const aEn = optionalClampedStr(tr.authorEn, 100);
      const rUk = optionalClampedStr(tr.roleUk, 100);
      const rEn = optionalClampedStr(tr.roleEn, 100);
      const comp = optionalClampedStr(tr.company, 100);
      if (qUk !== undefined) tPatch.quoteUk = qUk;
      if (qEn !== undefined) tPatch.quoteEn = qEn;
      if (aUk !== undefined) tPatch.authorUk = aUk;
      if (aEn !== undefined) tPatch.authorEn = aEn;
      if (rUk !== undefined) tPatch.roleUk = rUk;
      if (rEn !== undefined) tPatch.roleEn = rEn;
      if (comp !== undefined) tPatch.company = comp;
      if (Object.keys(tPatch).length > 0) next.testimonial = tPatch;
    }

    if (Object.keys(next).length > 0) {
      casePatch = next;
    }
  }

  let scenePatches: CaseAgentScenePatch[] | undefined;
  if (Array.isArray(obj.scenePatches)) {
    const normalizedScenes: CaseAgentScenePatch[] = [];
    for (const item of obj.scenePatches) {
      if (!item || typeof item !== 'object') continue;
      const sp = item as Record<string, unknown>;
      const sceneId = clampStr(sp.sceneId, 64);
      if (!sceneId || !validSceneSet.has(sceneId)) continue;

      const patch: CaseAgentScenePatch = { sceneId };
      const titleUk = optionalClampedStr(sp.titleUk, 120);
      const titleEn = optionalClampedStr(sp.titleEn, 120);
      const captionUk = optionalClampedStr(sp.captionUk, 320);
      const captionEn = optionalClampedStr(sp.captionEn, 320);
      if (titleUk !== undefined) patch.titleUk = titleUk;
      if (titleEn !== undefined) patch.titleEn = titleEn;
      if (captionUk !== undefined) patch.captionUk = captionUk;
      if (captionEn !== undefined) patch.captionEn = captionEn;

      if (Array.isArray(sp.hotspots)) {
        const hotspots: CaseAgentHotspotPatch[] = sp.hotspots
          .slice(0, BLUEPRINT_LIMITS.MAX_HOTSPOTS_PER_SCENE)
          .map((h) => {
            const hr = (h && typeof h === 'object' ? h : {}) as Record<string, unknown>;
            return {
              xPct: clampHotspotCoord(typeof hr.xPct === 'number' ? hr.xPct : 50),
              yPct: clampHotspotCoord(typeof hr.yPct === 'number' ? hr.yPct : 50),
              titleUk: clampStr(hr.titleUk, 100),
              titleEn: clampStr(hr.titleEn, 100),
              noteUk: clampStr(hr.noteUk, 320),
              noteEn: clampStr(hr.noteEn, 320),
            };
          })
          .filter((h) => h.titleUk.length > 0 || h.titleEn.length > 0);
        if (hotspots.length > 0) {
          patch.hotspots = hotspots;
        }
      }

      if (Object.keys(patch).length > 1) {
        normalizedScenes.push(patch);
      }
    }

    if (normalizedScenes.length > 0) {
      scenePatches = normalizedScenes;
    }
  }

  const rawSummary = Array.isArray(obj.changeSummary)
    ? obj.changeSummary.map((s) => clampStr(s, 90)).filter(Boolean).slice(0, 8)
    : [];

  const fallbackSummary: string[] = [];
  if (rawSummary.length === 0) {
    if (casePatch?.titleUk || casePatch?.titleEn) fallbackSummary.push('Заголовок кейсу');
    if (casePatch?.challengeUk || casePatch?.solutionUk) fallbackSummary.push('Виклик і рішення');
    if (casePatch?.stack) fallbackSummary.push(`Стек (${casePatch.stack.length})`);
    if (casePatch?.metrics) fallbackSummary.push(`Метрики (${casePatch.metrics.length})`);
    if (scenePatches && scenePatches.length > 0) {
      fallbackSummary.push(`Сцени та мітки (${scenePatches.length})`);
    }
  }

  const quickReplies = Array.isArray(obj.quickReplies)
    ? obj.quickReplies.map((q) => clampStr(q, 60)).filter(Boolean).slice(0, 3)
    : [];

  return {
    reply,
    changeSummary: rawSummary.length > 0 ? rawSummary : fallbackSummary,
    casePatch,
    scenePatches,
    quickReplies:
      quickReplies.length > 0
        ? quickReplies
        : ['Знеособити під NDA', 'Скоротити резюме', 'Перекласти UA → EN'],
  };
}

/**
 * Pure, immutable merge of a normalized AI patch into the active admin draft.
 * Preserves all untouched fields, scenes, and hotspots.
 */
export function applyCaseAgentPatch(
  currentDraft: PortfolioCaseRecord,
  currentStackInput: string,
  response: CaseAgentResponse,
  options: { isCreatingNew: boolean }
): {
  nextDraft: PortfolioCaseRecord;
  nextStackInput: string;
  appliedFieldsCount: number;
} {
  let appliedFieldsCount = 0;
  let nextDraft: PortfolioCaseRecord = { ...currentDraft };
  let nextStackInput = currentStackInput;

  const cp = response.casePatch;
  if (cp) {
    const simpleKeys: Array<keyof PortfolioCaseRecord & keyof CaseAgentCasePatch> = [
      'titleUk',
      'titleEn',
      'industryUk',
      'industryEn',
      'durationUk',
      'durationEn',
      'headlineMetricUk',
      'headlineMetricEn',
      'summaryUk',
      'summaryEn',
      'challengeUk',
      'challengeEn',
      'solutionUk',
      'solutionEn',
      'year',
    ];

    for (const key of simpleKeys) {
      const val = cp[key];
      if (typeof val === 'string' && val.length > 0) {
        (nextDraft as unknown as Record<string, unknown>)[key] = val;
        appliedFieldsCount += 1;
      }
    }

    if (cp.category && ALLOWED_CATEGORIES.has(cp.category)) {
      nextDraft.category = cp.category;
      nextDraft.relatedServiceId = CATEGORY_TO_SERVICE[cp.category];
      appliedFieldsCount += 1;
    }

    if (cp.suggestedStatus && ALLOWED_VISIBILITIES.has(cp.suggestedStatus)) {
      nextDraft.status = cp.suggestedStatus;
      appliedFieldsCount += 1;
    }

    if (options.isCreatingNew && cp.suggestedSlug) {
      nextDraft.id = slugifyCaseId(cp.suggestedSlug);
      appliedFieldsCount += 1;
    } else if (options.isCreatingNew && cp.titleUk && currentDraft.id.startsWith('case-')) {
      nextDraft.id = slugifyCaseId(cp.titleUk);
    }

    if (cp.stack && cp.stack.length > 0) {
      nextDraft.stack = cp.stack;
      nextStackInput = cp.stack.join(', ');
      appliedFieldsCount += 1;
    }

    if (cp.metrics && cp.metrics.length > 0) {
      const padded: CaseMetricRecord[] = [
        ...cp.metrics.slice(0, 3),
        ...Array.from({ length: Math.max(0, 3 - cp.metrics.length) }, () => ({
          value: '',
          labelUk: '',
          labelEn: '',
        })),
      ];
      nextDraft.metrics = padded;
      appliedFieldsCount += 1;
    }

    if (cp.testimonial) {
      nextDraft.testimonial = {
        ...currentDraft.testimonial,
        ...cp.testimonial,
      };
      appliedFieldsCount += 1;
    }
  }

  if (response.scenePatches && response.scenePatches.length > 0) {
    const patchMap = new Map(response.scenePatches.map((sp) => [sp.sceneId, sp]));
    const updatedScenes: CaseSceneDescriptor[] = currentDraft.scenes.map((scene) => {
      const sp = patchMap.get(scene.id);
      if (!sp) return scene;

      appliedFieldsCount += 1;
      const nextHotspots: SceneHotspot[] =
        sp.hotspots && sp.hotspots.length > 0
          ? sp.hotspots.map((h, hIdx) => ({
              id: `hs-ai-${scene.id}-${hIdx + 1}`,
              xPct: clampHotspotCoord(h.xPct),
              yPct: clampHotspotCoord(h.yPct),
              titleUk: h.titleUk || h.titleEn,
              titleEn: h.titleEn || h.titleUk,
              noteUk: h.noteUk || h.noteEn,
              noteEn: h.noteEn || h.noteUk,
            }))
          : scene.hotspots;

      return {
        ...scene,
        titleUk: sp.titleUk ?? scene.titleUk,
        titleEn: sp.titleEn ?? scene.titleEn,
        captionUk: sp.captionUk ?? scene.captionUk,
        captionEn: sp.captionEn ?? scene.captionEn,
        hotspots: nextHotspots,
      };
    });
    nextDraft = { ...nextDraft, scenes: updatedScenes };
  }

  return {
    nextDraft,
    nextStackInput,
    appliedFieldsCount,
  };
}

export interface DraftUndoSnapshot {
  draft: PortfolioCaseRecord;
  stackInput: string;
}

export function pushUndoSnapshot(
  stack: readonly DraftUndoSnapshot[],
  snapshot: DraftUndoSnapshot,
  maxDepth = 10
): DraftUndoSnapshot[] {
  const next = [...stack, snapshot];
  return next.length > maxDepth ? next.slice(next.length - maxDepth) : next;
}

export function popUndoSnapshot(stack: readonly DraftUndoSnapshot[]): {
  restored: DraftUndoSnapshot | null;
  remaining: DraftUndoSnapshot[];
} {
  if (stack.length === 0) {
    return { restored: null, remaining: [] };
  }
  return {
    restored: stack[stack.length - 1],
    remaining: stack.slice(0, -1),
  };
}
