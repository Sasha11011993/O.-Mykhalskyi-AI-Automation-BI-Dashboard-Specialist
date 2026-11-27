import type { Locale, PipelineStageRole } from './portfolioLogic';

export interface N8nRawNode {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  position?: [number, number] | number[];
  parameters?: Record<string, unknown>;
  notes?: string;
  disabled?: boolean;
}

export interface N8nConnectionTarget {
  node: string;
  type?: string;
  index?: number;
}

export type N8nConnectionsMap = Record<
  string,
  Record<string, Array<Array<N8nConnectionTarget> | null>>
>;

export interface N8nRawWorkflow {
  name?: string;
  nodes: N8nRawNode[];
  connections?: N8nConnectionsMap;
  active?: boolean;
  meta?: Record<string, unknown>;
}

export type N8nNodeCategory = 'trigger' | 'ai' | 'logic' | 'action';
export type N8nLayoutMode = 'compact' | 'panorama';

export interface LayoutN8nNode {
  id: string;
  name: string;
  type: string;
  shortType: string;
  category: N8nNodeCategory;
  role: PipelineStageRole;
  x: number;
  y: number;
  width: number;
  height: number;
  wave: number;
  durationMs: number;
  disabled: boolean;
  protocol: { uk: string; en: string };
  explanation: { uk: string; en: string };
  parameterPreview: string[];
  edgeIds: string[];
}

export interface LayoutN8nEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  connectionType: string;
  isAiSubLink: boolean;
  isLoopBack: boolean;
  branchIndex: number;
  branchLabel?: string;
  labelX: number;
  labelY: number;
  wave: number;
  pathD: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface ParsedN8nGraph {
  workflowName: string;
  nodes: LayoutN8nNode[];
  edges: LayoutN8nEdge[];
  totalWaves: number;
  ignoredStickyNotes: number;
  uniqueTechStack: string[];
  viewBoxWidth: number;
  viewBoxHeight: number;
  layoutMode: 'native' | N8nLayoutMode;
  supportsPanorama: boolean;
}

export type ParseN8nResult =
  | { ok: true; graph: ParsedN8nGraph }
  | { ok: false; errorUk: string; errorEn: string };

export const N8N_VIEWBOX_W = 700;
export const N8N_VIEWBOX_H = 316;
export const N8N_COMPACT_VIEWBOX_W = 760;
export const N8N_COMPACT_VIEWBOX_H = 356;

// 100% valid, importable-into-n8n production workflow JSON (AI Lead Intake & CRM Qualification)
export const DEFAULT_N8N_WORKFLOW: N8nRawWorkflow = {
  name: 'AI Lead Qualification & HubSpot Routing',
  active: true,
  nodes: [
    {
      id: 'n8n-webhook-lead',
      name: 'Webhook: Заявка',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [120, 120],
      parameters: {
        httpMethod: 'POST',
        path: 'lead-intake',
        responseMode: 'onReceived',
      },
      notes: 'Приймає нові заявки з лендингу або форми сайту через HTTPS POST Webhook із валідацією payload.',
    },
    {
      id: 'n8n-tg-trigger',
      name: 'Telegram Bot',
      type: 'n8n-nodes-base.telegramTrigger',
      typeVersion: 1.1,
      position: [120, 320],
      parameters: {
        updates: ['message'],
      },
      notes: 'Слухає вхідні повідомлення клієнтів у Telegram-боті в реальному часі без затримок polling.',
    },
    {
      id: 'n8n-ai-agent',
      name: 'AI Agent: Скоринг',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      position: [430, 180],
      parameters: {
        promptType: 'define',
        text: 'Classify intent, estimate budget & draft Ukrainian reply.',
      },
      notes: 'Витягує бюджет, терміновість та намір клієнта у структурований JSON і готує персональну відповідь.',
    },
    {
      id: 'n8n-openai-lm',
      name: 'OpenAI Chat Model',
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      typeVersion: 1.2,
      position: [430, 380],
      parameters: {
        model: 'gpt-4o-mini',
        options: { temperature: 0.2 },
      },
      notes: 'Підключена як ai_languageModel суб-нода агента: забезпечує швидку класифікацію з низькою температурою 0.2.',
    },
    {
      id: 'n8n-if-qualified',
      name: 'IF: Бюджет ≥ $1.5k',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [720, 180],
      parameters: {
        conditions: {
          combinator: 'and',
          conditions: [{ leftValue: '={{ $json.budget }}', operator: 'gte', rightValue: 1500 }],
        },
      },
      notes: 'Розгалужує потік на пріоритетні угоди для CRM (True) та миттєву авто-відповідь для типових запитів (False).',
    },
    {
      id: 'n8n-hubspot-deal',
      name: 'HubSpot: Угода',
      type: 'n8n-nodes-base.hubspot',
      typeVersion: 2.1,
      position: [1010, 100],
      parameters: {
        resource: 'deal',
        operation: 'create',
        stage: 'appointmentscheduled',
      },
      notes: 'Автоматично створює збагачену картку угоди в HubSpot CRM зі скорингом ліда та підсумком діалогу.',
    },
    {
      id: 'n8n-tg-reply',
      name: 'Telegram: Чат',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [1010, 300],
      parameters: {
        resource: 'message',
        operation: 'sendMessage',
      },
      notes: 'Надсилає клієнту релевантну відповідь за ~18 сек. або сповіщає менеджера про гарячий лід.',
    },
  ],
  connections: {
    'Webhook: Заявка': {
      main: [[{ node: 'AI Agent: Скоринг', type: 'main', index: 0 }]],
    },
    'Telegram Bot': {
      main: [[{ node: 'AI Agent: Скоринг', type: 'main', index: 0 }]],
    },
    'OpenAI Chat Model': {
      ai_languageModel: [[{ node: 'AI Agent: Скоринг', type: 'ai_languageModel', index: 0 }]],
    },
    'AI Agent: Скоринг': {
      main: [[{ node: 'IF: Бюджет ≥ $1.5k', type: 'main', index: 0 }]],
    },
    'IF: Бюджет ≥ $1.5k': {
      main: [
        [{ node: 'HubSpot: Угода', type: 'main', index: 0 }],
        [{ node: 'Telegram: Чат', type: 'main', index: 0 }],
      ],
    },
  },
};

export const DEFAULT_N8N_WORKFLOW_EN: N8nRawWorkflow = {
  name: 'AI Lead Qualification & HubSpot Routing',
  active: true,
  nodes: [
    {
      id: 'n8n-webhook-lead',
      name: 'Webhook: Lead',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [120, 120],
      parameters: {
        httpMethod: 'POST',
        path: 'lead-intake',
        responseMode: 'onReceived',
      },
      notes: 'Receives inbound website or landing page leads via HTTPS POST webhook with payload schema validation.',
    },
    {
      id: 'n8n-tg-trigger',
      name: 'Telegram Bot',
      type: 'n8n-nodes-base.telegramTrigger',
      typeVersion: 1.1,
      position: [120, 320],
      parameters: {
        updates: ['message'],
      },
      notes: 'Listens to real-time inbound client messages in Telegram without polling latency.',
    },
    {
      id: 'n8n-ai-agent',
      name: 'AI Agent: Scoring',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      position: [430, 180],
      parameters: {
        promptType: 'define',
        text: 'Classify intent, estimate budget & draft personalized reply.',
      },
      notes: 'Extracts budget, urgency, and intent into strict JSON while drafting a tailored response.',
    },
    {
      id: 'n8n-openai-lm',
      name: 'OpenAI Chat Model',
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      typeVersion: 1.2,
      position: [430, 380],
      parameters: {
        model: 'gpt-4o-mini',
        options: { temperature: 0.2 },
      },
      notes: 'Attached as an ai_languageModel sub-node for low-latency deterministic scoring at temperature 0.2.',
    },
    {
      id: 'n8n-if-qualified',
      name: 'IF: Budget ≥ $1.5k',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [720, 180],
      parameters: {
        conditions: {
          combinator: 'and',
          conditions: [{ leftValue: '={{ $json.budget }}', operator: 'gte', rightValue: 1500 }],
        },
      },
      notes: 'Routes high-value qualified deals straight to HubSpot CRM (True) and standard inquiries to instant reply (False).',
    },
    {
      id: 'n8n-hubspot-deal',
      name: 'HubSpot: Deal',
      type: 'n8n-nodes-base.hubspot',
      typeVersion: 2.1,
      position: [1010, 100],
      parameters: {
        resource: 'deal',
        operation: 'create',
        stage: 'appointmentscheduled',
      },
      notes: 'Creates an enriched HubSpot CRM deal card with lead score, summary, and next action.',
    },
    {
      id: 'n8n-tg-reply',
      name: 'Telegram: Reply',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [1010, 300],
      parameters: {
        resource: 'message',
        operation: 'sendMessage',
      },
      notes: 'Sends a verified reply to the prospect within ~18 seconds or notifies the account owner.',
    },
  ],
  connections: {
    'Webhook: Lead': {
      main: [[{ node: 'AI Agent: Scoring', type: 'main', index: 0 }]],
    },
    'Telegram Bot': {
      main: [[{ node: 'AI Agent: Scoring', type: 'main', index: 0 }]],
    },
    'OpenAI Chat Model': {
      ai_languageModel: [[{ node: 'AI Agent: Scoring', type: 'ai_languageModel', index: 0 }]],
    },
    'AI Agent: Scoring': {
      main: [[{ node: 'IF: Budget ≥ $1.5k', type: 'main', index: 0 }]],
    },
    'IF: Budget ≥ $1.5k': {
      main: [
        [{ node: 'HubSpot: Deal', type: 'main', index: 0 }],
        [{ node: 'Telegram: Reply', type: 'main', index: 0 }],
      ],
    },
  },
};

// Sanitized 15-node production workflow showcase (1C .xls -> Google Sheets -> OpenAI Anomaly Watchdog -> Telegram)
export const PRODUCTION_DEBT_CONTROL_WORKFLOW: N8nRawWorkflow = {
  name: 'Дебет Контроль (1С → Google Sheets → AI → Telegram)',
  active: true,
  nodes: [
    {
      id: 'dc-push-trigger',
      name: 'Запуск від Google Drive Push',
      type: 'n8n-nodes-base.executeWorkflowTrigger',
      typeVersion: 1.1,
      position: [0, 0],
      notes: 'Миттєво запускається суб-воркфлоу при появі нового .xls звіту з 1С у Google Drive.',
    },
    {
      id: 'dc-manual-trigger',
      name: 'Ручний запуск',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, 224],
      notes: 'Дозволяє менеджеру форсовано перерахувати таблицю боргів у будь-який момент.',
    },
    {
      id: 'dc-drive-search',
      name: 'Пошук .xls у папці Drive',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [288, 96],
      parameters: {
        url: 'https://www.googleapis.com/drive/v3/files',
        nodeCredentialType: 'googleDriveOAuth2Api',
      },
      notes: 'Отримує список файлів із папки Google Drive (retry 3×) для вибору найсвіжішого .xls.',
    },
    {
      id: 'dc-pick-latest',
      name: 'Вибрати найновіший .xls',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [544, 96],
      notes: 'Фільтрує lock-файли, перевіряє md5Checksum у staticData та пропускає вже оброблені звіти.',
    },
    {
      id: 'dc-drive-download',
      name: 'Завантажити .xls з Drive',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [800, 96],
      parameters: {
        url: 'https://www.googleapis.com/drive/v3/files/{id}?alt=media',
        nodeCredentialType: 'googleDriveOAuth2Api',
      },
      notes: 'Завантажує бінарний BIFF8 .xls файл звіту 1С із Google Drive.',
    },
    {
      id: 'dc-extract-b64',
      name: 'Конвертувати .xls у Base64',
      type: 'n8n-nodes-base.extractFromFile',
      typeVersion: 1.1,
      position: [1056, 96],
      parameters: { operation: 'binaryToProperty' },
      notes: 'Переводить бінарний потік .xls у Base64 для швидкого парсингу в чистому JavaScript.',
    },
    {
      id: 'dc-read-sheets',
      name: 'Прочитати Google Таблицю та коментарі',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [1328, 96],
      parameters: {
        url: 'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}',
        nodeCredentialType: 'googleSheetsOAuth2Api',
      },
      notes: 'Зчитує наявні коментарі менеджерів, знімок попередніх боргів і вкладку «Маршрути».',
    },
    {
      id: 'dc-calc-debts',
      name: 'Розрахувати борги та підготувати Sheets',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1584, 96],
      notes: 'Парсить BIFF8 .xls, рахує FIFO-борги, світлофор прострочки, дельту «було vs стало», аномалії та чанки batchUpdate.',
    },
    {
      id: 'dc-batch-loop',
      name: 'Пакетне оновлення (по черзі)',
      type: 'n8n-nodes-base.splitInBatches',
      typeVersion: 3,
      position: [1840, 96],
      notes: 'main[0] = Done (після всіх пакетів), main[1] = Loop (по одному пакету в Google Sheets без лімітів API).',
    },
    {
      id: 'dc-write-sheets',
      name: 'Записати в Google Sheets',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [2096, 240],
      parameters: {
        method: 'POST',
        url: 'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}:batchUpdate',
        nodeCredentialType: 'googleSheetsOAuth2Api',
      },
      notes: 'Пакетно оновлює вкладки Накладні, Зведення, Всі клієнти та неруйнівно додає нові точки у Маршрути.',
    },
    {
      id: 'dc-mark-done',
      name: 'Зафіксувати оброблений файл',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2096, 0],
      notes: 'Зберігає fileKey та timestamp у staticData після успішного запису всіх пакетів.',
    },
    {
      id: 'dc-if-anomalies',
      name: 'Є аномалії для ШІ?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.4,
      position: [2336, 0],
      notes: 'True → викликає OpenAI Сторож аномалій. False → надсилає звіт у Telegram напряму (0 витрат на LLM).',
    },
    {
      id: 'dc-openai-guard',
      name: 'ШІ Сторож аномалій (OpenAI)',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [2608, -96],
      parameters: {
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        nodeCredentialType: 'openAiApi',
        model: 'gpt-4o-mini',
      },
      notes: 'Працює тільки при виявленні розбіжностей із 1С, майже округлених оплат чи великих повернень (з fallback).',
    },
    {
      id: 'dc-merge-ai',
      name: 'Додати висновок ШІ до звіту',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2864, -96],
      notes: 'Вбудовує стислий розбір від OpenAI у Telegram-повідомлення або підставляє резервний автоаудит.',
    },
    {
      id: 'dc-telegram-send',
      name: 'Звіт у Telegram',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [3120, 48],
      parameters: {
        resource: 'message',
        operation: 'sendMessage',
      },
      notes: 'Надсилає керівнику зведення прострочки, топ-5 боржників, дельту змін, нові маршрути та висновок ШІ.',
    },
  ],
  connections: {
    'Запуск від Google Drive Push': {
      main: [[{ node: 'Пошук .xls у папці Drive', type: 'main', index: 0 }]],
    },
    'Ручний запуск': {
      main: [[{ node: 'Пошук .xls у папці Drive', type: 'main', index: 0 }]],
    },
    'Пошук .xls у папці Drive': {
      main: [[{ node: 'Вибрати найновіший .xls', type: 'main', index: 0 }]],
    },
    'Вибрати найновіший .xls': {
      main: [[{ node: 'Завантажити .xls з Drive', type: 'main', index: 0 }]],
    },
    'Завантажити .xls з Drive': {
      main: [[{ node: 'Конвертувати .xls у Base64', type: 'main', index: 0 }]],
    },
    'Конвертувати .xls у Base64': {
      main: [[{ node: 'Прочитати Google Таблицю та коментарі', type: 'main', index: 0 }]],
    },
    'Прочитати Google Таблицю та коментарі': {
      main: [[{ node: 'Розрахувати борги та підготувати Sheets', type: 'main', index: 0 }]],
    },
    'Розрахувати борги та підготувати Sheets': {
      main: [[{ node: 'Пакетне оновлення (по черзі)', type: 'main', index: 0 }]],
    },
    'Пакетне оновлення (по черзі)': {
      main: [
        [{ node: 'Зафіксувати оброблений файл', type: 'main', index: 0 }],
        [{ node: 'Записати в Google Sheets', type: 'main', index: 0 }],
      ],
    },
    'Записати в Google Sheets': {
      main: [[{ node: 'Пакетне оновлення (по черзі)', type: 'main', index: 0 }]],
    },
    'Зафіксувати оброблений файл': {
      main: [[{ node: 'Є аномалії для ШІ?', type: 'main', index: 0 }]],
    },
    'Є аномалії для ШІ?': {
      main: [
        [{ node: 'ШІ Сторож аномалій (OpenAI)', type: 'main', index: 0 }],
        [{ node: 'Звіт у Telegram', type: 'main', index: 0 }],
      ],
    },
    'ШІ Сторож аномалій (OpenAI)': {
      main: [[{ node: 'Додати висновок ШІ до звіту', type: 'main', index: 0 }]],
    },
    'Додати висновок ШІ до звіту': {
      main: [[{ node: 'Звіт у Telegram', type: 'main', index: 0 }]],
    },
  },
};

export function getDefaultN8nWorkflow(locale: Locale): N8nRawWorkflow {
  return locale === 'en' ? DEFAULT_N8N_WORKFLOW_EN : DEFAULT_N8N_WORKFLOW;
}

export function isStickyNoteNode(type: string): boolean {
  return type.toLowerCase().includes('stickynote');
}

export function classifyN8nNodeType(
  rawType: string,
  rawNode?: Pick<N8nRawNode, 'name' | 'parameters'>
): {
  category: N8nNodeCategory;
  role: PipelineStageRole;
  shortType: string;
} {
  const lower = rawType.toLowerCase();
  const tail = rawType.split('.').pop() ?? rawType;
  const params = rawNode?.parameters ?? {};
  const paramUrl = typeof params.url === 'string' ? params.url.toLowerCase() : '';
  const credType =
    typeof params.nodeCredentialType === 'string' ? params.nodeCredentialType.toLowerCase() : '';
  const httpMethod = String(params.method ?? params.httpMethod ?? 'GET').toUpperCase();
  const nodeNameLower = (rawNode?.name ?? '').toLowerCase();

  // Smart detection for real HTTP Request nodes targeting OpenAI, Claude, Gemini, Sheets, Drive
  if (lower.endsWith('.httprequest')) {
    if (
      paramUrl.includes('openai.com') ||
      credType.includes('openai') ||
      nodeNameLower.includes('openai')
    ) {
      return { category: 'ai', role: 'transform', shortType: 'OpenAI API' };
    }
    if (paramUrl.includes('anthropic.com') || credType.includes('anthropic')) {
      return { category: 'ai', role: 'transform', shortType: 'Claude API' };
    }
    if (paramUrl.includes('generativelanguage.googleapis.com') || credType.includes('gemini')) {
      return { category: 'ai', role: 'transform', shortType: 'Gemini API' };
    }
    if (paramUrl.includes('sheets.googleapis.com') || credType.includes('googlesheets')) {
      const isWrite = httpMethod === 'POST' || httpMethod === 'PUT' || httpMethod === 'PATCH';
      return {
        category: isWrite ? 'action' : 'logic',
        role: isWrite ? 'load' : 'extract',
        shortType: 'Google Sheets',
      };
    }
    if (paramUrl.includes('googleapis.com/drive') || credType.includes('googledrive')) {
      return { category: 'logic', role: 'extract', shortType: 'Google Drive' };
    }
  }

  const CLEAN_SHORT_LABELS: Record<string, string> = {
    webhook: 'Webhook',
    telegramtrigger: 'TG Trigger',
    scheduletrigger: 'Schedule',
    manualtrigger: 'Manual',
    executeworkflowtrigger: 'Sub-Trigger',
    agent: 'AI Agent',
    lmchatopenai: 'OpenAI LLM',
    lmchatanthropic: 'Claude LLM',
    lmchatgooglegemini: 'Gemini LLM',
    if: 'IF Router',
    switch: 'Switch',
    code: 'JS Code',
    function: 'JS Function',
    extractfromfile: 'Extract File',
    splitinbatches: 'Batch Loop',
    hubspot: 'HubSpot',
    telegram: 'Telegram',
    postgres: 'PostgreSQL',
    httprequest: 'HTTP API',
    googlesheets: 'Google Sheets',
    googledrive: 'Google Drive',
  };

  const humanized =
    CLEAN_SHORT_LABELS[tail.toLowerCase()] ??
    tail
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^lm Chat /i, '')
      .replace(/^tool /i, 'Tool: ')
      .replace(/^memory /i, 'Memory: ')
      .replace(/^vector Store /i, 'Vector: ')
      .trim();

  const shortType = humanized.length > 15 ? `${humanized.slice(0, 14)}…` : humanized;

  if (
    lower.includes('trigger') ||
    lower.includes('webhook') ||
    lower.includes('cron') ||
    lower.includes('schedule') ||
    lower.includes('emailreadimap') ||
    lower.includes('form')
  ) {
    return { category: 'trigger', role: 'extract', shortType: shortType || 'Trigger' };
  }

  if (
    lower.includes('langchain') ||
    lower.includes('openai') ||
    lower.includes('anthropic') ||
    lower.includes('claude') ||
    lower.includes('gemini') ||
    lower.includes('agent') ||
    lower.includes('llm') ||
    lower.includes('vectorstore') ||
    lower.includes('embedding') ||
    lower.includes('memory')
  ) {
    return { category: 'ai', role: 'transform', shortType: shortType || 'AI Node' };
  }

  if (
    lower.endsWith('.if') ||
    lower.endsWith('.switch') ||
    lower.endsWith('.code') ||
    lower.endsWith('.function') ||
    lower.endsWith('.set') ||
    lower.endsWith('.merge') ||
    lower.endsWith('.splitinbatches') ||
    lower.endsWith('.splitout') ||
    lower.endsWith('.aggregate') ||
    lower.endsWith('.filter') ||
    lower.endsWith('.extractfromfile') ||
    lower.endsWith('.httprequest') ||
    lower.endsWith('.wait') ||
    lower.endsWith('.executeworkflow')
  ) {
    return { category: 'logic', role: 'transform', shortType: shortType || 'Logic' };
  }

  return { category: 'action', role: 'load', shortType: shortType || 'Action' };
}

function sanitizeUrlPreview(rawUrl: string): string {
  const cleaned = rawUrl.replace(/^=/, '').trim();
  try {
    const parsed = new URL(cleaned.replace(/\{\{.*?\}\}/g, 'param'));
    const pathParts = parsed.pathname.split('/').filter(Boolean).slice(0, 2);
    return `${parsed.hostname}/${pathParts.join('/')}`.slice(0, 32);
  } catch {
    return cleaned.slice(0, 28);
  }
}

function stringifyParamValue(val: unknown, key?: string): string | null {
  if (typeof val === 'string' && val.trim().length > 0) {
    if (key === 'url') return sanitizeUrlPreview(val);
    return val.trim().slice(0, 32);
  }
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
    return val.slice(0, 2).join(', ');
  }
  return null;
}

export function extractNodeMetadata(
  node: N8nRawNode,
  category: N8nNodeCategory,
  shortType: string,
  incomingCount: number,
  outgoingCount: number
): {
  protocol: { uk: string; en: string };
  explanation: { uk: string; en: string };
  parameterPreview: string[];
} {
  const params = node.parameters ?? {};
  const preview: string[] = [];

  const interestingKeys = [
    'httpMethod',
    'method',
    'path',
    'url',
    'model',
    'modelId',
    'resource',
    'operation',
    'table',
    'sheetName',
    'stage',
    'updates',
  ];

  for (const key of interestingKeys) {
    if (key in params) {
      const formatted = stringifyParamValue(params[key], key);
      if (formatted) {
        preview.push(`${key}: ${formatted}`);
      }
    }
  }

  // Handle nested model object in newer n8n OpenAI/Anthropic nodes: { model: { value: "gpt-4o" } }
  if (
    params.model &&
    typeof params.model === 'object' &&
    'value' in (params.model as Record<string, unknown>)
  ) {
    const nestedModel = stringifyParamValue((params.model as Record<string, unknown>).value);
    if (nestedModel) preview.unshift(`model: ${nestedModel}`);
  }

  const method = stringifyParamValue(params.httpMethod ?? params.method);
  const path = stringifyParamValue(params.path);
  const model =
    stringifyParamValue(params.model) ??
    (params.model && typeof params.model === 'object'
      ? stringifyParamValue((params.model as Record<string, unknown>).value)
      : null);
  const resource = stringifyParamValue(params.resource);
  const operation = stringifyParamValue(params.operation);

  let protoStr = `${shortType} · ${node.type.replace(/^n8n-nodes-base\./, '').replace(/^@n8n\/n8n-nodes-/, '')}`;
  if (method && path) {
    protoStr = `${method.toUpperCase()} /${path.replace(/^\//, '')}`;
  } else if (model) {
    protoStr = `${shortType} · ${model}`;
  } else if (resource && operation) {
    protoStr = `${shortType} · ${resource}.${operation}`;
  } else if (operation) {
    protoStr = `${shortType} · ${operation}`;
  } else if (method && params.url) {
    protoStr = `${shortType} · ${method.toUpperCase()}`;
  }

  const trimmedNotes = typeof node.notes === 'string' ? node.notes.trim() : '';

  const fallbackUkByCat: Record<N8nNodeCategory, string> = {
    trigger: `Вхідний тригер n8n (${shortType}): запускає воркфлоу при настанні події та передає дані далі (${outgoingCount} вихідн.).`,
    ai: `AI-вузол (${shortType}): аналізує дані через LLM для класифікації, пошуку аномалій або генерації відповіді.`,
    logic: `Вузол обробки та маршрутизації (${shortType}): виконує код, перевірку умов, пакетні цикли або API-запити (${incomingCount} → ${outgoingCount}).`,
    action: `Фінальна дія (${shortType}): записує результат у зовнішню CRM, Google Sheets або надсилає сповіщення команді.`,
  };

  const fallbackEnByCat: Record<N8nNodeCategory, string> = {
    trigger: `n8n trigger node (${shortType}): initiates workflow execution on incoming events and forwards payload (${outgoingCount} out).`,
    ai: `AI node (${shortType}): analyzes context via LLM for classification, anomaly inspection, or structured replies.`,
    logic: `Routing & processing node (${shortType}): executes code, branching conditions, batch loops, or API requests (${incomingCount} → ${outgoingCount}).`,
    action: `Output action (${shortType}): commits enriched records to CRM, Google Sheets, or messaging channels automatically.`,
  };

  return {
    protocol: { uk: protoStr, en: protoStr },
    explanation: {
      uk: trimmedNotes || fallbackUkByCat[category],
      en:
        trimmedNotes && /^[A-Za-z0-9\s.,:;!?()\-/$%]+$/.test(trimmedNotes)
          ? trimmedNotes
          : fallbackEnByCat[category],
    },
    parameterPreview: preview.slice(0, 3),
  };
}

interface PositionedItem {
  rawNode: N8nRawNode;
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  colIdx: number;
  bandIdx: number;
  rx: number;
  ry: number;
}

function hasAnyOverlap(items: readonly { x: number; y: number; width: number; height: number }[]): boolean {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      const overlapX = a.x < b.x + b.width + 8 && a.x + a.width + 8 > b.x;
      const overlapY = a.y < b.y + b.height + 6 && a.y + a.height + 6 > b.y;
      if (overlapX && overlapY) return true;
    }
  }
  return false;
}

function groupIntoColumns(
  nodes: readonly { rawNode: N8nRawNode; id: string; rx: number; ry: number }[]
): Array<Array<{ rawNode: N8nRawNode; id: string; rx: number; ry: number }>> {
  const sorted = [...nodes].sort((a, b) => a.rx - b.rx || a.ry - b.ry);
  const columns: Array<Array<{ rawNode: N8nRawNode; id: string; rx: number; ry: number }>> = [];

  for (const item of sorted) {
    const lastCol = columns[columns.length - 1];
    if (!lastCol) {
      columns.push([item]);
      continue;
    }
    const colAnchorX = lastCol[0].rx;
    if (Math.abs(item.rx - colAnchorX) <= 105) {
      lastCol.push(item);
    } else {
      columns.push([item]);
    }
  }

  for (const col of columns) {
    col.sort((a, b) => a.ry - b.ry);
  }
  return columns;
}

function buildEdgePath(
  src: PositionedItem,
  dst: PositionedItem,
  isAiSubLink: boolean,
  isLoopBack: boolean,
  bandBounds: readonly { top: number; bottom: number }[]
): {
  pathD: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  labelX: number;
  labelY: number;
} {
  if (isAiSubLink) {
    const srcCenterX = src.x + src.width / 2;
    const dstCenterX = dst.x + dst.width / 2;
    const isBelow = src.y >= dst.y;
    const startX = srcCenterX;
    const startY = isBelow ? src.y : src.y + src.height;
    const endX = dstCenterX;
    const endY = isBelow ? dst.y + dst.height : dst.y;
    const midY = (startY + endY) / 2;
    return {
      startX,
      startY,
      endX,
      endY,
      labelX: (startX + endX) / 2,
      labelY: midY - 4,
      pathD: `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${startX.toFixed(1)} ${midY.toFixed(1)}, ${endX.toFixed(1)} ${midY.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`,
    };
  }

  const startX = src.x + src.width;
  const startY = src.y + src.height / 2;
  const endX = dst.x;
  const endY = dst.y + dst.height / 2;

  // Cross-band transition in compact serpentine layout: route cleanly through the inter-band channel
  if (src.bandIdx !== dst.bandIdx && bandBounds.length > 1) {
    const upperBand = Math.min(src.bandIdx, dst.bandIdx);
    const lowerBand = Math.max(src.bandIdx, dst.bandIdx);
    const channelY =
      (bandBounds[upperBand].bottom + bandBounds[lowerBand].top) / 2;
    const outX = startX + 10;
    const inX = Math.max(6, endX - 10);
    const r = 6;
    const goDown = channelY >= startY;
    const endDown = endY >= channelY;

    const pathD = [
      `M ${startX.toFixed(1)} ${startY.toFixed(1)}`,
      `L ${(outX - r).toFixed(1)} ${startY.toFixed(1)}`,
      `Q ${outX.toFixed(1)} ${startY.toFixed(1)} ${outX.toFixed(1)} ${(startY + (goDown ? r : -r)).toFixed(1)}`,
      `L ${outX.toFixed(1)} ${(channelY + (goDown ? -r : r)).toFixed(1)}`,
      `Q ${outX.toFixed(1)} ${channelY.toFixed(1)} ${(outX - r).toFixed(1)} ${channelY.toFixed(1)}`,
      `L ${(inX + r).toFixed(1)} ${channelY.toFixed(1)}`,
      `Q ${inX.toFixed(1)} ${channelY.toFixed(1)} ${inX.toFixed(1)} ${(channelY + (endDown ? r : -r)).toFixed(1)}`,
      `L ${inX.toFixed(1)} ${(endY + (endDown ? -r : r)).toFixed(1)}`,
      `Q ${inX.toFixed(1)} ${endY.toFixed(1)} ${(inX + r).toFixed(1)} ${endY.toFixed(1)}`,
      `L ${endX.toFixed(1)} ${endY.toFixed(1)}`,
    ].join(' ');

    return {
      startX,
      startY,
      endX,
      endY,
      labelX: (outX + inX) / 2,
      labelY: channelY - 4,
      pathD,
    };
  }

  // Loop-back or backward connection (e.g., SplitInBatches loop return)
  if (isLoopBack || endX < startX - 8) {
    const bandBottom = bandBounds[src.bandIdx]?.bottom ?? Math.max(src.y + src.height, dst.y + dst.height);
    const archY = Math.min(bandBottom + 16, Math.max(src.y + src.height, dst.y + dst.height) + 18);
    const ctrlRight = startX + 18;
    const ctrlLeft = Math.max(6, endX - 18);
    return {
      startX,
      startY,
      endX,
      endY,
      labelX: (startX + endX) / 2,
      labelY: archY - 3,
      pathD: `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${ctrlRight.toFixed(1)} ${archY.toFixed(1)}, ${ctrlLeft.toFixed(1)} ${archY.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`,
    };
  }

  // Skip-column edge inside the same horizontal band (e.g., IF false branch skipping over AI nodes):
  // Route smoothly below the intermediate nodes so the line never cuts through cards!
  if (dst.colIdx - src.colIdx > 1 && Math.abs(startY - endY) < src.height * 0.8) {
    const bypassY = Math.max(src.y + src.height, dst.y + dst.height) + 22;
    return {
      startX,
      startY,
      endX,
      endY,
      labelX: (startX + endX) / 2,
      labelY: bypassY - 4,
      pathD: `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${(startX + 26).toFixed(1)} ${bypassY.toFixed(1)}, ${(endX - 26).toFixed(1)} ${bypassY.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`,
    };
  }

  // Standard forward cubic Bezier
  const dx = Math.max(18, (endX - startX) * 0.5);
  return {
    startX,
    startY,
    endX,
    endY,
    labelX: (startX + endX) / 2,
    labelY: (startY + endY) / 2 - 5,
    pathD: `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${(startX + dx).toFixed(1)} ${startY.toFixed(1)}, ${(endX - dx).toFixed(1)} ${endY.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`,
  };
}

export function parseAndLayoutN8nWorkflow(
  input: string | N8nRawWorkflow,
  preferredWideMode: N8nLayoutMode = 'compact'
): ParseN8nResult {
  let raw: unknown;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return {
        ok: false,
        errorUk: 'Вставте JSON-код воркфлоу з n8n (Workflow → Download або Ctrl+C).',
        errorEn: 'Paste an n8n workflow JSON export (Workflow → Download or Ctrl+C).',
      };
    }
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return {
        ok: false,
        errorUk: 'Некоректний JSON-синтаксис. Перевірте, чи скопійовано повний файл експорту n8n.',
        errorEn: 'Invalid JSON syntax. Please check that the full n8n workflow export was pasted.',
      };
    }
  } else {
    raw = input;
  }

  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as N8nRawWorkflow).nodes)) {
    return {
      ok: false,
      errorUk: 'У JSON відсутній масив "nodes" — це не схоже на експорт n8n воркфлоу.',
      errorEn: 'Missing "nodes" array in JSON — this does not match the n8n workflow schema.',
    };
  }

  const workflow = raw as N8nRawWorkflow;
  let ignoredStickyNotes = 0;
  const runnableRawNodes: N8nRawNode[] = [];

  for (const node of workflow.nodes) {
    if (!node || typeof node !== 'object' || typeof node.name !== 'string') continue;
    const typeStr = typeof node.type === 'string' ? node.type : 'n8n-nodes-base.noOp';
    if (isStickyNoteNode(typeStr)) {
      ignoredStickyNotes += 1;
      continue;
    }
    runnableRawNodes.push({ ...node, type: typeStr });
  }

  if (runnableRawNodes.length === 0) {
    return {
      ok: false,
      errorUk: 'У воркфлоу не знайдено жодного активного вузла (окрім нотаток).',
      errorEn: 'No executable workflow nodes were found (excluding sticky notes).',
    };
  }

  // Cap display gracefully for extreme 60-node dumps while keeping layout crisp
  const cappedNodes = runnableRawNodes.slice(0, 28);
  const count = cappedNodes.length;

  // Extract raw n8n coordinates (fallback to horizontal grid if missing)
  const rawItems = cappedNodes.map((rawNode, idx) => {
    const pos = Array.isArray(rawNode.position) && rawNode.position.length >= 2 ? rawNode.position : null;
    const rx = pos && Number.isFinite(Number(pos[0])) ? Number(pos[0]) : idx * 240;
    const ry = pos && Number.isFinite(Number(pos[1])) ? Number(pos[1]) : (idx % 2) * 140;
    const id = (rawNode.id && String(rawNode.id).trim()) || `n8n-node-${idx}`;
    return { rawNode, id, rx, ry };
  });

  // Step 1: Try native 700x316 normalization first (ideal for compact 3-8 node workflows)
  const nativeNodeW = count <= 8 ? 148 : 128;
  const nativeNodeH = count <= 8 ? 54 : 46;
  const minX = Math.min(...rawItems.map((c) => c.rx));
  const maxX = Math.max(...rawItems.map((c) => c.rx));
  const minY = Math.min(...rawItems.map((c) => c.ry));
  const maxY = Math.max(...rawItems.map((c) => c.ry));
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  const nativePadX = 16;
  const nativePadTop = 26;
  const nativePadBottom = 16;
  const nativeAvailW = Math.max(40, N8N_VIEWBOX_W - nativePadX * 2 - nativeNodeW);
  const nativeAvailH = Math.max(40, N8N_VIEWBOX_H - nativePadTop - nativePadBottom - nativeNodeH);

  const columns = groupIntoColumns(rawItems);
  const colIndexById = new Map<string, number>();
  columns.forEach((col, cIdx) => {
    col.forEach((item) => colIndexById.set(item.id, cIdx));
  });

  const nativeCandidates: PositionedItem[] = rawItems.map((item) => {
    const normX = spanX > 1 ? (item.rx - minX) / spanX : 0.5;
    const normY = spanY > 1 ? (item.ry - minY) / spanY : 0.5;
    return {
      ...item,
      x: Math.round((nativePadX + normX * nativeAvailW) * 10) / 10,
      y: Math.round((nativePadTop + normY * nativeAvailH) * 10) / 10,
      width: nativeNodeW,
      height: nativeNodeH,
      colIdx: colIndexById.get(item.id) ?? 0,
      bandIdx: 0,
    };
  });

  const needsWideLayout = columns.length > 5 || hasAnyOverlap(nativeCandidates);

  let positioned: PositionedItem[];
  let viewBoxWidth = N8N_VIEWBOX_W;
  let viewBoxHeight = N8N_VIEWBOX_H;
  let layoutMode: 'native' | N8nLayoutMode = 'native';
  let bandBounds: Array<{ top: number; bottom: number }> = [
    { top: nativePadTop, bottom: N8N_VIEWBOX_H - nativePadBottom },
  ];

  if (!needsWideLayout) {
    positioned = nativeCandidates;
  } else if (preferredWideMode === 'panorama') {
    // Authentic 1:1 linear n8n horizontal canvas with guaranteed zero overlap
    layoutMode = 'panorama';
    const panNodeW = 148;
    const panNodeH = 52;
    const panPadX = 20;
    const panPadY = 24;
    const colPitch = 192; // 44px clean gap between adjacent cards
    const maxStackInCol = Math.max(1, ...columns.map((c) => c.length));
    const minRowPitch = panNodeH + 22;
    const neededH = panPadY * 2 + maxStackInCol * panNodeH + Math.max(0, maxStackInCol - 1) * 22;
    viewBoxHeight = Math.max(N8N_VIEWBOX_H, neededH);
    viewBoxWidth = Math.max(N8N_VIEWBOX_W, panPadX * 2 + Math.max(0, columns.length - 1) * colPitch + panNodeW);
    bandBounds = [{ top: panPadY, bottom: viewBoxHeight - panPadY }];

    const availPanH = Math.max(40, viewBoxHeight - panPadY * 2 - panNodeH);
    positioned = [];

    columns.forEach((col, cIdx) => {
      const x = panPadX + cIdx * colPitch;
      if (col.length === 1) {
        const item = col[0];
        const normY = spanY > 1 ? (item.ry - minY) / spanY : 0.5;
        const y = Math.round((panPadY + normY * availPanH) * 10) / 10;
        positioned.push({
          ...item,
          x,
          y,
          width: panNodeW,
          height: panNodeH,
          colIdx: cIdx,
          bandIdx: 0,
        });
      } else {
        const stackTotalH = col.length * panNodeH + (col.length - 1) * (minRowPitch - panNodeH);
        const startY = Math.max(panPadY, (viewBoxHeight - stackTotalH) / 2);
        col.forEach((item, rIdx) => {
          positioned.push({
            ...item,
            x,
            y: Math.round((startY + rIdx * minRowPitch) * 10) / 10,
            width: panNodeW,
            height: panNodeH,
            colIdx: cIdx,
            bandIdx: 0,
          });
        });
      }
    });
  } else {
    // Smart Multi-Row Band Fold ('compact'): fits ALL nodes cleanly into 760x356 with ZERO overlap
    layoutMode = 'compact';
    viewBoxWidth = N8N_COMPACT_VIEWBOX_W;
    viewBoxHeight = N8N_COMPACT_VIEWBOX_H;

    const totalCols = columns.length;
    const bandCount = totalCols <= 10 ? 2 : 3;
    const baseColsPerBand = Math.floor(totalCols / bandCount);
    const extraCols = totalCols % bandCount;

    const bands: Array<typeof columns> = [];
    let cursor = 0;
    for (let b = 0; b < bandCount; b++) {
      const take = baseColsPerBand + (b < extraCols ? 1 : 0);
      bands.push(columns.slice(cursor, cursor + take));
      cursor += take;
    }

    const maxColsInBand = Math.max(...bands.map((b) => b.length));
    const padX = 18;
    const padTop = 14;
    const padBottom = 24;
    const compactNodeW = maxColsInBand >= 5 ? 124 : 142;
    const compactNodeH = bandCount >= 3 ? 38 : 46;
    const stackGap = 8;

    const bandHeights = bands.map((band) => {
      const maxStack = Math.max(1, ...band.map((col) => col.length));
      return maxStack * compactNodeH + (maxStack - 1) * stackGap;
    });

    const totalContentH = bandHeights.reduce((sum, h) => sum + h, 0);
    const remainingH = Math.max(bandCount * 22, viewBoxHeight - padTop - padBottom - totalContentH);
    const bandGap = Math.max(24, Math.floor(remainingH / Math.max(1, bandCount - 1)));
    const actualUsedH = totalContentH + bandGap * Math.max(0, bandCount - 1);
    const startTop = Math.max(padTop, Math.round((viewBoxHeight - padBottom - actualUsedH) / 2));

    bandBounds = [];
    positioned = [];
    let currentY = startTop;
    let globalColCursor = 0;

    const availCompactW = viewBoxWidth - padX * 2 - compactNodeW;
    const colStep =
      maxColsInBand > 1 ? Math.round((availCompactW / (maxColsInBand - 1)) * 10) / 10 : 0;

    bands.forEach((band, bIdx) => {
      const bandH = bandHeights[bIdx];
      bandBounds.push({ top: currentY, bottom: currentY + bandH });

      // Center bands that have fewer columns slightly or align cleanly to the left grid rail
      const bandSpanCols = band.length;
      const bandColStep =
        bandSpanCols > 1
          ? Math.min(colStep * 1.18, Math.round((availCompactW / (bandSpanCols - 1)) * 10) / 10)
          : 0;

      band.forEach((col, localColIdx) => {
        const x = Math.round((padX + localColIdx * bandColStep) * 10) / 10;
        const colStackH = col.length * compactNodeH + (col.length - 1) * stackGap;
        const colTop = currentY + (bandH - colStackH) / 2;

        col.forEach((item, rIdx) => {
          positioned.push({
            ...item,
            x,
            y: Math.round((colTop + rIdx * (compactNodeH + stackGap)) * 10) / 10,
            width: compactNodeW,
            height: compactNodeH,
            colIdx: globalColCursor,
            bandIdx: bIdx,
          });
        });

        globalColCursor += 1;
      });

      currentY += bandH + bandGap;
    });
  }

  const byName = new Map<string, PositionedItem>();
  for (const item of positioned) {
    byName.set(item.rawNode.name, item);
  }

  // Parse connections (supports main + ai_languageModel / ai_tool / ai_memory / ai_vectorStore)
  const rawConnections = workflow.connections ?? {};
  const tempEdges: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    connectionType: string;
    isAiSubLink: boolean;
    isLoopBack: boolean;
    branchIndex: number;
  }> = [];

  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const forwardAdj = new Map<string, string[]>();
  const aiParentOf = new Map<string, string>();

  for (const item of positioned) {
    inDegree.set(item.id, 0);
    outDegree.set(item.id, 0);
    forwardAdj.set(item.id, []);
  }

  let edgeSeq = 0;
  for (const [sourceName, connTypes] of Object.entries(rawConnections)) {
    const src = byName.get(sourceName);
    if (!src || !connTypes || typeof connTypes !== 'object') continue;

    for (const [connType, outputGroups] of Object.entries(connTypes)) {
      if (!Array.isArray(outputGroups)) continue;
      const isAiSubLink = connType.startsWith('ai_');

      outputGroups.forEach((branchTargets, branchIdx) => {
        if (!Array.isArray(branchTargets)) return;
        for (const target of branchTargets) {
          if (!target || typeof target.node !== 'string') continue;
          const dst = byName.get(target.node);
          if (!dst || dst.id === src.id) continue;

          // Identify cycle / loop-back edges cleanly (e.g., SplitInBatches return edge)
          const isLoopBack = !isAiSubLink && dst.colIdx < src.colIdx;

          edgeSeq += 1;
          tempEdges.push({
            id: `e-${edgeSeq}`,
            fromNodeId: src.id,
            toNodeId: dst.id,
            connectionType: connType,
            isAiSubLink,
            isLoopBack,
            branchIndex: branchIdx,
          });

          outDegree.set(src.id, (outDegree.get(src.id) ?? 0) + 1);
          inDegree.set(dst.id, (inDegree.get(dst.id) ?? 0) + 1);

          if (isAiSubLink) {
            aiParentOf.set(src.id, dst.id);
          } else if (!isLoopBack) {
            forwardAdj.get(src.id)?.push(dst.id);
          }
        }
      });
    }
  }

  // Compute cycle-safe topological execution waves over forward DAG edges only
  const waveById = new Map<string, number>();
  const queue: string[] = [];

  for (const item of positioned) {
    if (aiParentOf.has(item.id)) continue;
    const { category } = classifyN8nNodeType(item.rawNode.type, item.rawNode);
    const hasForwardIncoming = tempEdges.some(
      (e) => !e.isAiSubLink && !e.isLoopBack && e.toNodeId === item.id
    );
    if (!hasForwardIncoming || category === 'trigger') {
      waveById.set(item.id, 0);
      queue.push(item.id);
    }
  }

  if (queue.length === 0 && positioned.length > 0) {
    waveById.set(positioned[0].id, 0);
    queue.push(positioned[0].id);
  }

  let safety = 0;
  while (queue.length > 0 && safety < 300) {
    safety += 1;
    const curr = queue.shift()!;
    const currWave = waveById.get(curr) ?? 0;
    for (const nextId of forwardAdj.get(curr) ?? []) {
      const candidateWave = currWave + 1;
      const existingWave = waveById.get(nextId);
      if (existingWave === undefined || (candidateWave > existingWave && candidateWave <= count)) {
        waveById.set(nextId, candidateWave);
        queue.push(nextId);
      }
    }
  }

  // Assign AI sub-nodes the same wave as their parent AI Agent
  for (const [subId, parentId] of aiParentOf.entries()) {
    waveById.set(subId, waveById.get(parentId) ?? 1);
  }

  // Fallback wave for any disconnected nodes
  for (const item of positioned) {
    if (!waveById.has(item.id)) {
      waveById.set(item.id, 0);
    }
  }

  const byId = new Map(positioned.map((p) => [p.id, p]));
  const nodeEdgeMap = new Map<string, string[]>();
  for (const item of positioned) {
    nodeEdgeMap.set(item.id, []);
  }

  const layoutEdges: LayoutN8nEdge[] = tempEdges.map((edge) => {
    const src = byId.get(edge.fromNodeId)!;
    const dst = byId.get(edge.toNodeId)!;
    const geom = buildEdgePath(src, dst, edge.isAiSubLink, edge.isLoopBack, bandBounds);

    nodeEdgeMap.get(edge.fromNodeId)?.push(edge.id);
    nodeEdgeMap.get(edge.toNodeId)?.push(edge.id);

    const srcTypeLower = src.rawNode.type.toLowerCase();
    const isConditionalSource = srcTypeLower.endsWith('.if');
    const isBatchSource = srcTypeLower.endsWith('.splitinbatches');

    let branchLabel: string | undefined;
    if (edge.isLoopBack) {
      branchLabel = '↺ loop';
    } else if (isConditionalSource) {
      branchLabel = edge.branchIndex === 0 ? 'true' : 'false';
    } else if (isBatchSource) {
      branchLabel = edge.branchIndex === 0 ? 'done' : 'batch';
    } else if (edge.isAiSubLink) {
      branchLabel = edge.connectionType.replace(/^ai_/, '');
    }

    return {
      ...edge,
      branchLabel,
      wave: waveById.get(edge.fromNodeId) ?? 0,
      ...geom,
    };
  });

  const techSet = new Set<string>(['n8n']);
  const layoutNodes: LayoutN8nNode[] = positioned.map((item, idx) => {
    const { category, role, shortType } = classifyN8nNodeType(item.rawNode.type, item.rawNode);
    techSet.add(shortType);
    const meta = extractNodeMetadata(
      item.rawNode,
      category,
      shortType,
      inDegree.get(item.id) ?? 0,
      outDegree.get(item.id) ?? 0
    );

    const baseMs =
      category === 'trigger'
        ? 18
        : category === 'ai'
          ? 640
          : category === 'logic'
            ? 42
            : 185;

    return {
      id: item.id,
      name: item.rawNode.name,
      type: item.rawNode.type,
      shortType,
      category,
      role,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      wave: waveById.get(item.id) ?? 0,
      durationMs: baseMs + ((idx * 37) % 110),
      disabled: Boolean(item.rawNode.disabled),
      protocol: meta.protocol,
      explanation: meta.explanation,
      parameterPreview: meta.parameterPreview,
      edgeIds: nodeEdgeMap.get(item.id) ?? [],
    };
  });

  const maxWave = Math.max(0, ...layoutNodes.map((n) => n.wave));

  const prioritizedTech = new Set<string>(['n8n']);
  const categoryOrder: N8nNodeCategory[] = ['ai', 'action', 'logic', 'trigger'];
  for (const cat of categoryOrder) {
    for (const node of layoutNodes) {
      if (node.category === cat) {
        prioritizedTech.add(node.shortType);
      }
    }
  }
  for (const item of techSet) {
    prioritizedTech.add(item);
  }

  return {
    ok: true,
    graph: {
      workflowName: workflow.name?.trim() || 'n8n Production Workflow',
      nodes: layoutNodes,
      edges: layoutEdges,
      totalWaves: maxWave + 1,
      ignoredStickyNotes,
      uniqueTechStack: Array.from(prioritizedTech).slice(0, 6),
      viewBoxWidth,
      viewBoxHeight,
      layoutMode,
      supportsPanorama: needsWideLayout,
    },
  };
}

export function formatWorkflowSummary(graph: ParsedN8nGraph, locale: Locale): string {
  const n = graph.nodes.length;
  const e = graph.edges.length;
  if (locale === 'uk') {
    return `${n} вузлів · ${e} зв’язків`;
  }
  return `${n} nodes · ${e} links`;
}
