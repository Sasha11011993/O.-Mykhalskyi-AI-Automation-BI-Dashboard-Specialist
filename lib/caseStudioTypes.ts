import type { CaseStudyItem, LocalizedText } from './portfolioData';
import type { CaseCategory, Locale, ServiceId } from './portfolioLogic';
import {
  parseAndLayoutN8nWorkflow,
  type N8nConnectionsMap,
  type N8nRawNode,
  type N8nRawWorkflow,
} from './n8nWorkflowEngine';

export type CaseVisibility = 'draft' | 'published' | 'unlisted';

export type CaseSceneKind = 'n8n-json' | 'ui-telegram' | 'ui-web' | 'ui-n8n-image';

export interface SceneHotspot {
  id: string;
  /** X coordinate percentage (3..97) relative to screenshot width */
  xPct: number;
  /** Y coordinate percentage (3..97) relative to screenshot height */
  yPct: number;
  titleUk: string;
  titleEn: string;
  noteUk: string;
  noteEn: string;
}

export interface CaseSceneDescriptor {
  id: string;
  kind: CaseSceneKind;
  titleUk: string;
  titleEn: string;
  captionUk: string;
  captionEn: string;
  mediaId: string;
  n8nWorkflowId: string;
  hotspots: SceneHotspot[];
}

export interface CaseMetricRecord {
  value: string;
  labelUk: string;
  labelEn: string;
}

export interface CaseTestimonialRecord {
  quoteUk: string;
  quoteEn: string;
  authorUk: string;
  authorEn: string;
  roleUk: string;
  roleEn: string;
  company: string;
}

export interface PortfolioCaseRecord {
  id: string;
  ownerId: string;
  status: CaseVisibility;
  sortOrder: number;
  featuredInHero: boolean;
  category: Exclude<CaseCategory, 'all'>;
  relatedServiceId: ServiceId;
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
  coverMediaId: string;
  scenes: CaseSceneDescriptor[];
}

export interface CaseMediaRecord {
  id: string;
  caseId: string;
  ownerId: string;
  visibility: CaseVisibility;
  mimeType: 'image/webp' | 'image/png' | 'image/jpeg';
  dataUrl: string;
  width: number;
  height: number;
}

export interface StoredN8nNodeMap {
  id: string;
  name: string;
  type: string;
  posX: number;
  posY: number;
  notes: string;
  httpMethod: string;
  urlPreview: string;
  model: string;
  resource: string;
  operation: string;
  credType: string;
}

export interface StoredN8nLinkMap {
  fromName: string;
  toName: string;
  connectionType: string;
  branchIndex: number;
}

export interface CaseWorkflowRecord {
  id: string;
  caseId: string;
  ownerId: string;
  visibility: CaseVisibility;
  workflowName: string;
  nodes: StoredN8nNodeMap[];
  links: StoredN8nLinkMap[];
}

export type AiRoutingProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

export const AI_ROUTING_PROVIDER_IDS: readonly AiRoutingProviderId[] = [
  'gemini',
  'openai',
  'anthropic',
  'openrouter',
] as const;

export const AI_MODEL_ID_PATTERN = /^[a-zA-Z0-9._:/-]*$/;

export const AI_MODEL_PRESETS: Record<
  Exclude<AiRoutingProviderId, 'gemini'>,
  readonly { id: string; label: string }[]
> = {
  openai: [
    { id: 'gpt-4o-mini', label: 'GPT-4o mini (швидка й економна)' },
    { id: 'gpt-4o', label: 'GPT-4o (універсальна + Vision)' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (швидка)' },
    { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet (максимум якості)' },
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  ],
  openrouter: [
    { id: 'google/gemini-2.5-flash', label: 'Google Gemini 2.5 Flash (OpenRouter)' },
    { id: 'openai/gpt-4o-mini', label: 'OpenAI GPT-4o mini (OpenRouter)' },
    { id: 'anthropic/claude-3.5-sonnet', label: 'Anthropic Claude 3.5 Sonnet (OpenRouter)' },
    { id: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3 (OpenRouter)' },
  ],
};

export interface AiRoutingSettings {
  aiProviderOrder: AiRoutingProviderId[];
  aiDisabledProviders: AiRoutingProviderId[];
  aiOpenaiModel: string;
  aiAnthropicModel: string;
  aiOpenrouterModel: string;
}

export interface PortfolioSettingsRecord {
  ownerId: string;
  heroCaseId: string;
  hiddenStaticCaseIds: string[];
  aiProviderOrder?: AiRoutingProviderId[];
  aiDisabledProviders?: AiRoutingProviderId[];
  aiOpenaiModel?: string;
  aiAnthropicModel?: string;
  aiOpenrouterModel?: string;
}

const VALID_AI_PROVIDER_SET = new Set<string>(AI_ROUTING_PROVIDER_IDS);

function sanitizeModelIdString(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw.trim().slice(0, maxLen);
  return AI_MODEL_ID_PATTERN.test(cleaned) ? cleaned : '';
}

export function sanitizeAiRoutingSettings(
  input: Partial<AiRoutingSettings> | null | undefined
): AiRoutingSettings {
  const orderSet = new Set<AiRoutingProviderId>();
  const order: AiRoutingProviderId[] = [];
  for (const item of input?.aiProviderOrder ?? []) {
    if (typeof item === 'string' && VALID_AI_PROVIDER_SET.has(item) && !orderSet.has(item as AiRoutingProviderId)) {
      orderSet.add(item as AiRoutingProviderId);
      order.push(item as AiRoutingProviderId);
    }
  }
  for (const fallbackId of AI_ROUTING_PROVIDER_IDS) {
    if (!orderSet.has(fallbackId)) {
      order.push(fallbackId);
    }
  }

  const disabledSet = new Set<AiRoutingProviderId>();
  for (const item of input?.aiDisabledProviders ?? []) {
    if (typeof item === 'string' && VALID_AI_PROVIDER_SET.has(item)) {
      disabledSet.add(item as AiRoutingProviderId);
    }
  }

  return {
    aiProviderOrder: order.slice(0, 4),
    aiDisabledProviders: Array.from(disabledSet).slice(0, 4),
    aiOpenaiModel: sanitizeModelIdString(input?.aiOpenaiModel, 80),
    aiAnthropicModel: sanitizeModelIdString(input?.aiAnthropicModel, 80),
    aiOpenrouterModel: sanitizeModelIdString(input?.aiOpenrouterModel, 120),
  };
}

export interface UnifiedCaseStudy extends CaseStudyItem {
  source: 'static' | 'firestore';
  status: CaseVisibility;
  sortOrder: number;
  featuredInHero?: boolean;
  coverMediaId?: string;
  scenes?: CaseSceneDescriptor[];
}

// Blueprint constants synchronized verbatim with firebase-blueprint.json and firestore.rules
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  YEAR_PATTERN: /^[0-9]{4}$/,
  DATA_URL_PATTERN: /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/,
  MAX_ID_LEN: 80,
  MAX_MEDIA_ID_LEN: 128,
  MAX_TITLE_LEN: 160,
  MAX_INDUSTRY_LEN: 120,
  MAX_DURATION_LEN: 60,
  MAX_HEADLINE_METRIC_LEN: 100,
  MAX_SUMMARY_LEN: 600,
  MAX_CHALLENGE_LEN: 1200,
  MAX_SOLUTION_LEN: 1600,
  MAX_STACK_ITEMS: 15,
  MAX_STACK_ITEM_LEN: 80,
  MAX_METRICS: 6,
  MAX_SCENES: 10,
  MAX_HOTSPOTS_PER_SCENE: 8,
  MAX_WORKFLOW_NODES: 40,
  MAX_WORKFLOW_LINKS: 80,
  MAX_MEDIA_DATA_URL_LEN: 650000,
  MAX_HIDDEN_STATIC_IDS: 10,
} as const;

const UK_TRANSLIT_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye',
  ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '',
  ю: 'yu', я: 'ya', ы: 'y', э: 'e', ё: 'yo', ъ: '',
};

export function slugifyCaseId(input: string, fallbackPrefix = 'case'): string {
  const lower = input.trim().toLowerCase();
  let transliterated = '';
  for (const ch of lower) {
    transliterated += ch in UK_TRANSLIT_MAP ? UK_TRANSLIT_MAP[ch] : ch;
  }
  const cleaned = transliterated
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 64);

  if (cleaned.length >= 2) {
    return cleaned;
  }
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${fallbackPrefix}-${suffix}`;
}

export function generateSafeAssetId(prefix: 'media' | 'wf' | 'scene' | 'hs'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

export function clampHotspotCoord(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.round(Math.min(97, Math.max(3, value)) * 10) / 10;
}

function trunc(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function serializeN8nWorkflowForFirestore(
  input: string | N8nRawWorkflow
):
  | {
      ok: true;
      workflowName: string;
      nodes: StoredN8nNodeMap[];
      links: StoredN8nLinkMap[];
      uniqueTechStack: string[];
      nodeCount: number;
    }
  | { ok: false; errorUk: string; errorEn: string } {
  const parsed = parseAndLayoutN8nWorkflow(input, 'compact');
  if (!parsed.ok) {
    return parsed;
  }

  const rawObj: N8nRawWorkflow =
    typeof input === 'string' ? (JSON.parse(input) as N8nRawWorkflow) : input;

  const rawNodes = Array.isArray(rawObj.nodes) ? rawObj.nodes : [];
  const keptRawNodes = rawNodes
    .filter((n) => n && typeof n === 'object' && typeof n.name === 'string' && !String(n.type ?? '').toLowerCase().includes('stickynote'))
    .slice(0, BLUEPRINT_LIMITS.MAX_WORKFLOW_NODES);

  const nodes: StoredN8nNodeMap[] = keptRawNodes.map((node, idx) => {
    const params = (node.parameters ?? {}) as Record<string, unknown>;
    const pos = Array.isArray(node.position) && node.position.length >= 2 ? node.position : [idx * 240, 0];
    const nestedModel =
      params.model && typeof params.model === 'object' && 'value' in (params.model as Record<string, unknown>)
        ? String((params.model as Record<string, unknown>).value ?? '')
        : typeof params.model === 'string'
          ? params.model
          : '';

    return {
      id: trunc(node.id || `node-${idx}`, 80) || `node-${idx}`,
      name: trunc(node.name, 120) || `Node ${idx + 1}`,
      type: trunc(node.type || 'n8n-nodes-base.noOp', 120) || 'n8n-nodes-base.noOp',
      posX: Number.isFinite(Number(pos[0])) ? Math.round(Number(pos[0])) : idx * 240,
      posY: Number.isFinite(Number(pos[1])) ? Math.round(Number(pos[1])) : 0,
      notes: trunc(node.notes ?? '', 360),
      httpMethod: trunc(String(params.httpMethod ?? params.method ?? ''), 16),
      urlPreview: trunc(typeof params.url === 'string' ? params.url : '', 140),
      model: trunc(nestedModel, 60),
      resource: trunc(typeof params.resource === 'string' ? params.resource : '', 40),
      operation: trunc(typeof params.operation === 'string' ? params.operation : '', 40),
      credType: trunc(typeof params.nodeCredentialType === 'string' ? params.nodeCredentialType : '', 60),
    };
  });

  const validNames = new Set(nodes.map((n) => n.name));
  const links: StoredN8nLinkMap[] = [];
  const rawConns = rawObj.connections ?? {};

  for (const [fromName, connByType] of Object.entries(rawConns)) {
    if (!validNames.has(fromName) || !connByType || typeof connByType !== 'object') continue;
    for (const [connectionType, branchGroups] of Object.entries(connByType)) {
      if (!Array.isArray(branchGroups)) continue;
      branchGroups.forEach((group, branchIndex) => {
        if (!Array.isArray(group)) return;
        for (const target of group) {
          if (!target || typeof target.node !== 'string' || !validNames.has(target.node)) continue;
          if (links.length >= BLUEPRINT_LIMITS.MAX_WORKFLOW_LINKS) break;
          links.push({
            fromName: trunc(fromName, 120),
            toName: trunc(target.node, 120),
            connectionType: trunc(target.type || connectionType || 'main', 40) || 'main',
            branchIndex,
          });
        }
      });
    }
  }

  return {
    ok: true,
    workflowName: trunc(rawObj.name || parsed.graph.workflowName || 'n8n Workflow', 160) || 'n8n Workflow',
    nodes,
    links,
    uniqueTechStack: parsed.graph.uniqueTechStack,
    nodeCount: nodes.length,
  };
}

export function reconstructN8nWorkflowFromFirestore(
  record: Pick<CaseWorkflowRecord, 'workflowName' | 'nodes' | 'links'>
): N8nRawWorkflow {
  const nodes: N8nRawNode[] = record.nodes.map((n) => {
    const parameters: Record<string, unknown> = {};
    if (n.httpMethod) parameters.method = n.httpMethod;
    if (n.urlPreview) parameters.url = n.urlPreview;
    if (n.model) parameters.model = n.model;
    if (n.resource) parameters.resource = n.resource;
    if (n.operation) parameters.operation = n.operation;
    if (n.credType) parameters.nodeCredentialType = n.credType;

    return {
      id: n.id,
      name: n.name,
      type: n.type,
      position: [n.posX, n.posY],
      notes: n.notes || undefined,
      parameters,
    };
  });

  const connections: N8nConnectionsMap = {};
  for (const link of record.links) {
    const connType = link.connectionType || 'main';
    if (!connections[link.fromName]) {
      connections[link.fromName] = {};
    }
    if (!connections[link.fromName][connType]) {
      connections[link.fromName][connType] = [];
    }
    const groups = connections[link.fromName][connType];
    const idx = Math.max(0, Math.floor(link.branchIndex || 0));
    while (groups.length <= idx) {
      groups.push([]);
    }
    const bucket = groups[idx] ?? [];
    bucket.push({ node: link.toName, type: connType, index: 0 });
    groups[idx] = bucket;
  }

  return {
    name: record.workflowName,
    active: true,
    nodes,
    connections,
  };
}

export function createBlankCaseDraft(sortOrder: number, ownerId = ''): PortfolioCaseRecord {
  const id = slugifyCaseId(`project-${Date.now().toString(36)}`);
  return {
    id,
    ownerId,
    status: 'draft',
    sortOrder: Math.max(0, Math.min(9999, Math.round(sortOrder))),
    featuredInHero: false,
    category: 'ai',
    relatedServiceId: 'ai-agents',
    year: String(new Date().getFullYear()),
    titleUk: '',
    titleEn: '',
    industryUk: '',
    industryEn: '',
    durationUk: '2 тижні',
    durationEn: '2 weeks',
    headlineMetricUk: '',
    headlineMetricEn: '',
    summaryUk: '',
    summaryEn: '',
    challengeUk: '',
    challengeEn: '',
    solutionUk: '',
    solutionEn: '',
    stack: ['n8n'],
    metrics: [
      { value: '', labelUk: '', labelEn: '' },
      { value: '', labelUk: '', labelEn: '' },
      { value: '', labelUk: '', labelEn: '' },
    ],
    testimonial: {
      quoteUk: '',
      quoteEn: '',
      authorUk: '',
      authorEn: '',
      roleUk: '',
      roleEn: '',
      company: '',
    },
    coverMediaId: '',
    scenes: [],
  };
}

export interface CaseValidationErrors {
  titleUk?: string;
  id?: string;
  year?: string;
}

export function validateCaseDraftForSave(
  draft: PortfolioCaseRecord,
  locale: Locale = 'uk'
): { valid: boolean; errors: CaseValidationErrors } {
  const errors: CaseValidationErrors = {};

  if (!draft.titleUk || draft.titleUk.trim().length < 2) {
    errors.titleUk =
      locale === 'uk'
        ? 'Вкажіть назву кейсу українською (мінімум 2 символи).'
        : 'Enter a Ukrainian case title (at least 2 characters).';
  }

  const trimmedId = draft.id.trim();
  if (!trimmedId || trimmedId.length < 2 || trimmedId.length > BLUEPRINT_LIMITS.MAX_ID_LEN || !BLUEPRINT_LIMITS.ID_PATTERN.test(trimmedId)) {
    errors.id =
      locale === 'uk'
        ? 'Slug кейсу має містити лише латиницю, цифри, дефіс або підкреслення (2–80 символів).'
        : 'Case slug must use only Latin letters, digits, hyphens, or underscores (2–80 chars).';
  }

  if (!BLUEPRINT_LIMITS.YEAR_PATTERN.test(draft.year.trim())) {
    errors.year =
      locale === 'uk'
        ? 'Рік має складатися з 4 цифр (наприклад, 2026).'
        : 'Year must be a 4-digit number (e.g., 2026).';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function sanitizeCasePayloadForFirestore(
  draft: PortfolioCaseRecord,
  ownerId: string
): PortfolioCaseRecord {
  const cleanStack = Array.from(
    new Set(
      draft.stack
        .map((s) => trunc(s, BLUEPRINT_LIMITS.MAX_STACK_ITEM_LEN))
        .filter((s) => s.length > 0)
    )
  ).slice(0, BLUEPRINT_LIMITS.MAX_STACK_ITEMS);

  const cleanMetrics: CaseMetricRecord[] = draft.metrics
    .map((m) => ({
      value: trunc(m.value, 40),
      labelUk: trunc(m.labelUk, 120),
      labelEn: trunc(m.labelEn, 120),
    }))
    .filter((m) => m.value.length > 0 || m.labelUk.length > 0)
    .slice(0, BLUEPRINT_LIMITS.MAX_METRICS);

  const cleanScenes: CaseSceneDescriptor[] = draft.scenes
    .slice(0, BLUEPRINT_LIMITS.MAX_SCENES)
    .map((scene, idx) => ({
      id: BLUEPRINT_LIMITS.ID_PATTERN.test(scene.id) ? scene.id.slice(0, 80) : `scene-${idx + 1}`,
      kind: scene.kind,
      titleUk: trunc(scene.titleUk, 100),
      titleEn: trunc(scene.titleEn, 100),
      captionUk: trunc(scene.captionUk, 280),
      captionEn: trunc(scene.captionEn, 280),
      mediaId: trunc(scene.mediaId, BLUEPRINT_LIMITS.MAX_MEDIA_ID_LEN),
      n8nWorkflowId: trunc(scene.n8nWorkflowId, BLUEPRINT_LIMITS.MAX_MEDIA_ID_LEN),
      hotspots: (scene.hotspots ?? [])
        .slice(0, BLUEPRINT_LIMITS.MAX_HOTSPOTS_PER_SCENE)
        .map((hs, hIdx) => ({
          id: BLUEPRINT_LIMITS.ID_PATTERN.test(hs.id) ? hs.id.slice(0, 60) : `hs-${hIdx + 1}`,
          xPct: clampHotspotCoord(hs.xPct),
          yPct: clampHotspotCoord(hs.yPct),
          titleUk: trunc(hs.titleUk, 100),
          titleEn: trunc(hs.titleEn, 100),
          noteUk: trunc(hs.noteUk, 360),
          noteEn: trunc(hs.noteEn, 360),
        })),
    }));

  const firstMediaId = cleanScenes.find((s) => s.mediaId)?.mediaId ?? '';
  const coverMediaId = trunc(draft.coverMediaId || firstMediaId, BLUEPRINT_LIMITS.MAX_MEDIA_ID_LEN);

  return {
    id: trunc(draft.id, BLUEPRINT_LIMITS.MAX_ID_LEN),
    ownerId: trunc(ownerId, 128),
    status: draft.status === 'published' || draft.status === 'unlisted' ? draft.status : 'draft',
    sortOrder: Math.max(0, Math.min(9999, Math.round(Number(draft.sortOrder) || 0))),
    featuredInHero: Boolean(draft.featuredInHero),
    category: draft.category === 'bi' || draft.category === 'etl' ? draft.category : 'ai',
    relatedServiceId:
      draft.relatedServiceId === 'bi-dashboards' ||
      draft.relatedServiceId === 'etl-pipelines' ||
      draft.relatedServiceId === 'audit-architecture'
        ? draft.relatedServiceId
        : 'ai-agents',
    year: BLUEPRINT_LIMITS.YEAR_PATTERN.test(draft.year.trim())
      ? draft.year.trim()
      : String(new Date().getFullYear()),
    titleUk: trunc(draft.titleUk, BLUEPRINT_LIMITS.MAX_TITLE_LEN),
    titleEn: trunc(draft.titleEn, BLUEPRINT_LIMITS.MAX_TITLE_LEN),
    industryUk: trunc(draft.industryUk, BLUEPRINT_LIMITS.MAX_INDUSTRY_LEN),
    industryEn: trunc(draft.industryEn, BLUEPRINT_LIMITS.MAX_INDUSTRY_LEN),
    durationUk: trunc(draft.durationUk, BLUEPRINT_LIMITS.MAX_DURATION_LEN),
    durationEn: trunc(draft.durationEn, BLUEPRINT_LIMITS.MAX_DURATION_LEN),
    headlineMetricUk: trunc(draft.headlineMetricUk, BLUEPRINT_LIMITS.MAX_HEADLINE_METRIC_LEN),
    headlineMetricEn: trunc(draft.headlineMetricEn, BLUEPRINT_LIMITS.MAX_HEADLINE_METRIC_LEN),
    summaryUk: trunc(draft.summaryUk, BLUEPRINT_LIMITS.MAX_SUMMARY_LEN),
    summaryEn: trunc(draft.summaryEn, BLUEPRINT_LIMITS.MAX_SUMMARY_LEN),
    challengeUk: trunc(draft.challengeUk, BLUEPRINT_LIMITS.MAX_CHALLENGE_LEN),
    challengeEn: trunc(draft.challengeEn, BLUEPRINT_LIMITS.MAX_CHALLENGE_LEN),
    solutionUk: trunc(draft.solutionUk, BLUEPRINT_LIMITS.MAX_SOLUTION_LEN),
    solutionEn: trunc(draft.solutionEn, BLUEPRINT_LIMITS.MAX_SOLUTION_LEN),
    stack: cleanStack,
    metrics: cleanMetrics,
    testimonial: {
      quoteUk: trunc(draft.testimonial?.quoteUk, 500),
      quoteEn: trunc(draft.testimonial?.quoteEn, 500),
      authorUk: trunc(draft.testimonial?.authorUk, 100),
      authorEn: trunc(draft.testimonial?.authorEn, 100),
      roleUk: trunc(draft.testimonial?.roleUk, 100),
      roleEn: trunc(draft.testimonial?.roleEn, 100),
      company: trunc(draft.testimonial?.company, 120),
    },
    coverMediaId,
    scenes: cleanScenes,
  };
}

const CATEGORY_LABELS_MAP: Record<Exclude<CaseCategory, 'all'>, LocalizedText> = {
  ai: { uk: 'AI-автоматизація', en: 'AI Automation' },
  bi: { uk: 'BI-дашборди', en: 'BI Dashboards' },
  etl: { uk: 'Дані та ETL', en: 'Data & ETL' },
};

const FALLBACK_IMAGE_BY_CATEGORY: Record<
  Exclude<CaseCategory, 'all'>,
  CaseStudyItem['imageKey']
> = {
  ai: 'case_b2b_pipeline',
  bi: 'case_retail_bi',
  etl: 'case_logistics_tower',
};

function loc(uk: string, en: string): LocalizedText {
  const safeUk = uk.trim();
  const safeEn = en.trim();
  return {
    uk: safeUk || safeEn,
    en: safeEn || safeUk,
  };
}

export function firestoreRecordToUnifiedCase(record: PortfolioCaseRecord): UnifiedCaseStudy {
  return {
    id: record.id,
    source: 'firestore',
    status: record.status,
    sortOrder: record.sortOrder,
    featuredInHero: record.featuredInHero,
    coverMediaId: record.coverMediaId || undefined,
    scenes: record.scenes,
    imageKey: FALLBACK_IMAGE_BY_CATEGORY[record.category] ?? 'case_b2b_pipeline',
    category: record.category,
    categoryLabel: CATEGORY_LABELS_MAP[record.category],
    industry: loc(record.industryUk || 'Автоматизація', record.industryEn || 'Automation'),
    year: record.year || '2026',
    duration: loc(record.durationUk || '2 тижні', record.durationEn || '2 weeks'),
    title: loc(record.titleUk, record.titleEn),
    headlineMetric: loc(
      record.headlineMetricUk || `${record.scenes.length} артефактів`,
      record.headlineMetricEn || `${record.scenes.length} artifacts`
    ),
    summary: loc(record.summaryUk, record.summaryEn),
    challenge: loc(record.challengeUk, record.challengeEn),
    solution: loc(record.solutionUk, record.solutionEn),
    stack: record.stack.length > 0 ? record.stack : ['n8n'],
    metrics: record.metrics.map((m) => ({
      value: m.value,
      label: loc(m.labelUk, m.labelEn),
    })),
    testimonial: {
      quote: loc(record.testimonial.quoteUk, record.testimonial.quoteEn),
      author: loc(record.testimonial.authorUk, record.testimonial.authorEn),
      role: loc(record.testimonial.roleUk, record.testimonial.roleEn),
      company: record.testimonial.company,
    },
    relatedServiceId: record.relatedServiceId,
  };
}

export function mergePublicCases(
  staticCases: readonly CaseStudyItem[],
  firestoreCases: readonly PortfolioCaseRecord[],
  settings?: Pick<PortfolioSettingsRecord, 'hiddenStaticCaseIds' | 'heroCaseId'> | null
): UnifiedCaseStudy[] {
  const hiddenSet = new Set(settings?.hiddenStaticCaseIds ?? []);
  const publishedRemote = firestoreCases
    .filter((c) => c.status === 'published')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(firestoreRecordToUnifiedCase);

  const remoteIdSet = new Set(publishedRemote.map((c) => c.id));

  const visibleStatic: UnifiedCaseStudy[] = staticCases
    .filter((item) => !hiddenSet.has(item.id) && !remoteIdSet.has(item.id))
    .map((item, idx) => ({
      ...item,
      source: 'static',
      status: 'published',
      sortOrder: 1000 + idx,
      featuredInHero: settings?.heroCaseId
        ? settings.heroCaseId === item.id
        : item.id === 'debt-control-1c-n8n',
    }));

  return [...publishedRemote, ...visibleStatic].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function formatScenesBadgeSummary(
  scenes: readonly CaseSceneDescriptor[] | undefined,
  locale: Locale
): string {
  if (!scenes || scenes.length === 0) return '';
  let n8nCount = 0;
  let tgCount = 0;
  let webCount = 0;
  for (const s of scenes) {
    if (s.kind === 'n8n-json' || s.kind === 'ui-n8n-image') n8nCount += 1;
    else if (s.kind === 'ui-telegram') tgCount += 1;
    else if (s.kind === 'ui-web') webCount += 1;
  }
  const parts: string[] = [];
  if (n8nCount > 0) {
    parts.push(locale === 'uk' ? `${n8nCount} n8n` : `${n8nCount} n8n`);
  }
  if (tgCount > 0) {
    parts.push('Telegram');
  }
  if (webCount > 0) {
    parts.push('Web / BI');
  }
  return parts.join(' · ');
}
