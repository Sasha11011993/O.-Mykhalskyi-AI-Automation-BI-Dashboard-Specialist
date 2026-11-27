import type { Locale } from './portfolioLogic';

export type OverlayBranch = 'anomaly' | 'normal';

export type OverlayWireKind =
  | 'trigger'
  | 'main'
  | 'return-rail'
  | 'loop-out'
  | 'loop-back'
  | 'done-out'
  | 'branch-true'
  | 'branch-false';

export interface ScreenshotNodeBox {
  nodeId: string;
  /** Pixel coordinates inside the 1191x547 n8n screenshot */
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  /** Slightly expanded interactive hit target including node label below */
  hitX: number;
  hitY: number;
  hitW: number;
  hitH: number;
  isTrigger?: boolean;
  isAi?: boolean;
  isLoop?: boolean;
  isIf?: boolean;
}

export interface ScreenshotWirePath {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  kind: OverlayWireKind;
  /** Exact SVG path in 1191x547 pixel space matching the real n8n gray wire */
  d: string;
}

export interface ScreenshotOverlaySpec {
  width: number;
  height: number;
  nodes: ScreenshotNodeBox[];
  wires: ScreenshotWirePath[];
}

export interface ExecutionStep {
  stepIndex: number;
  totalSteps: number;
  nodeId: string;
  wireId: string | null;
  kind: 'trigger' | OverlayWireKind | 'terminal';
  loopIteration?: 1 | 2;
  wireDurationSec: number;
  nodeDwellSec: number;
  captionUk: string;
  captionEn: string;
}

export interface ScreenshotExecutionPlan {
  branch: OverlayBranch;
  steps: ExecutionStep[];
  executedNodeIds: string[];
  skippedNodeIds: string[];
  activeWireIds: string[];
  inactiveWireIds: string[];
  llmCostLabelUk: string;
  llmCostLabelEn: string;
}

/**
 * Pixel-calibrated coordinate map for `public/assets/aistudio/image_4c39709d.png` (1191 x 547).
 * Every node rectangle and wire spline was measured directly from the PNG pixel buffer.
 */
export const DEBT_CONTROL_SCREENSHOT_SPEC: ScreenshotOverlaySpec = {
  width: 1191,
  height: 547,
  nodes: [
    {
      nodeId: 'dc-push-trigger',
      x: 89,
      y: 16,
      w: 56,
      h: 55,
      rx: 14,
      hitX: 54,
      hitY: 10,
      hitW: 126,
      hitH: 96,
      isTrigger: true,
    },
    {
      nodeId: 'dc-manual-trigger',
      x: 89,
      y: 150,
      w: 56,
      h: 55,
      rx: 14,
      hitX: 62,
      hitY: 144,
      hitW: 110,
      hitH: 86,
      isTrigger: true,
    },
    {
      nodeId: 'dc-drive-search',
      x: 262,
      y: 73,
      w: 55,
      h: 56,
      rx: 8,
      hitX: 224,
      hitY: 66,
      hitW: 132,
      hitH: 100,
    },
    {
      nodeId: 'dc-pick-latest',
      x: 415,
      y: 73,
      w: 55,
      h: 56,
      rx: 8,
      hitX: 378,
      hitY: 66,
      hitW: 130,
      hitH: 94,
    },
    {
      nodeId: 'dc-drive-download',
      x: 568,
      y: 73,
      w: 55,
      h: 56,
      rx: 8,
      hitX: 530,
      hitY: 66,
      hitW: 132,
      hitH: 94,
    },
    {
      nodeId: 'dc-extract-b64',
      x: 721,
      y: 73,
      w: 55,
      h: 56,
      rx: 8,
      hitX: 682,
      hitY: 66,
      hitW: 136,
      hitH: 106,
    },
    {
      nodeId: 'dc-read-sheets',
      x: 884,
      y: 73,
      w: 55,
      h: 56,
      rx: 8,
      hitX: 844,
      hitY: 66,
      hitW: 136,
      hitH: 106,
    },
    {
      nodeId: 'dc-calc-debts',
      x: 1037,
      y: 73,
      w: 55,
      h: 56,
      rx: 8,
      hitX: 1000,
      hitY: 66,
      hitW: 132,
      hitH: 98,
    },
    {
      nodeId: 'dc-batch-loop',
      x: 214,
      y: 332,
      w: 55,
      h: 55,
      rx: 8,
      hitX: 184,
      hitY: 326,
      hitW: 118,
      hitH: 98,
      isLoop: true,
    },
    {
      nodeId: 'dc-write-sheets',
      x: 367,
      y: 418,
      w: 55,
      h: 55,
      rx: 8,
      hitX: 330,
      hitY: 412,
      hitW: 130,
      hitH: 106,
    },
    {
      nodeId: 'dc-mark-done',
      x: 367,
      y: 274,
      w: 55,
      h: 56,
      rx: 8,
      hitX: 336,
      hitY: 268,
      hitW: 118,
      hitH: 96,
    },
    {
      nodeId: 'dc-if-anomalies',
      x: 510,
      y: 274,
      w: 56,
      h: 56,
      rx: 8,
      hitX: 482,
      hitY: 268,
      hitW: 114,
      hitH: 90,
      isIf: true,
    },
    {
      nodeId: 'dc-openai-guard',
      x: 673,
      y: 217,
      w: 56,
      h: 55,
      rx: 8,
      hitX: 636,
      hitY: 210,
      hitW: 130,
      hitH: 104,
      isAi: true,
    },
    {
      nodeId: 'dc-merge-ai',
      x: 826,
      y: 217,
      w: 56,
      h: 55,
      rx: 8,
      hitX: 790,
      hitY: 210,
      hitW: 128,
      hitH: 96,
      isAi: true,
    },
    {
      nodeId: 'dc-telegram-send',
      x: 980,
      y: 303,
      w: 55,
      h: 56,
      rx: 8,
      hitX: 948,
      hitY: 296,
      hitW: 124,
      hitH: 102,
    },
  ],
  wires: [
    {
      id: 'w-push-search',
      fromNodeId: 'dc-push-trigger',
      toNodeId: 'dc-drive-search',
      kind: 'trigger',
      d: 'M 148 43.5 C 202 43.5, 206 101, 259 101',
    },
    {
      id: 'w-manual-search',
      fromNodeId: 'dc-manual-trigger',
      toNodeId: 'dc-drive-search',
      kind: 'trigger',
      d: 'M 148 177.5 C 202 177.5, 206 101, 259 101',
    },
    {
      id: 'w-search-pick',
      fromNodeId: 'dc-drive-search',
      toNodeId: 'dc-pick-latest',
      kind: 'main',
      d: 'M 320 101 L 412 101',
    },
    {
      id: 'w-pick-download',
      fromNodeId: 'dc-pick-latest',
      toNodeId: 'dc-drive-download',
      kind: 'main',
      d: 'M 473 101 L 565 101',
    },
    {
      id: 'w-download-b64',
      fromNodeId: 'dc-drive-download',
      toNodeId: 'dc-extract-b64',
      kind: 'main',
      d: 'M 626 101 L 718 101',
    },
    {
      id: 'w-b64-read',
      fromNodeId: 'dc-extract-b64',
      toNodeId: 'dc-read-sheets',
      kind: 'main',
      d: 'M 779 101 L 881 101',
    },
    {
      id: 'w-read-calc',
      fromNodeId: 'dc-read-sheets',
      toNodeId: 'dc-calc-debts',
      kind: 'main',
      d: 'M 942 101 L 1034 101',
    },
    {
      id: 'w-calc-batch',
      fromNodeId: 'dc-calc-debts',
      toNodeId: 'dc-batch-loop',
      kind: 'return-rail',
      d: 'M 1095 101 L 1112 101 Q 1122 101 1122 111 L 1122 168 Q 1122 178 1112 178 L 193 178 Q 183 178 183 188 L 183 349.5 Q 183 359.5 193 359.5 L 211 359.5',
    },
    {
      id: 'w-batch-write',
      fromNodeId: 'dc-batch-loop',
      toNodeId: 'dc-write-sheets',
      kind: 'loop-out',
      d: 'M 272 369 C 316 369, 320 445.5, 364 445.5',
    },
    {
      id: 'w-write-batch',
      fromNodeId: 'dc-write-sheets',
      toNodeId: 'dc-batch-loop',
      kind: 'loop-back',
      d: 'M 425 445.5 L 441.5 445.5 Q 451.5 445.5 451.5 455.5 L 451.5 513 Q 451.5 523 441.5 523 L 193 523 Q 183 523 183 513 L 183 369.5 Q 183 359.5 193 359.5 L 211 359.5',
    },
    {
      id: 'w-batch-done',
      fromNodeId: 'dc-batch-loop',
      toNodeId: 'dc-mark-done',
      kind: 'done-out',
      d: 'M 272 349 C 316 349, 320 302, 364 302',
    },
    {
      id: 'w-done-if',
      fromNodeId: 'dc-mark-done',
      toNodeId: 'dc-if-anomalies',
      kind: 'main',
      d: 'M 425 302 L 507 302',
    },
    {
      id: 'w-if-openai',
      fromNodeId: 'dc-if-anomalies',
      toNodeId: 'dc-openai-guard',
      kind: 'branch-true',
      d: 'M 569 292 C 618 292, 622 244.5, 670 244.5',
    },
    {
      id: 'w-openai-merge',
      fromNodeId: 'dc-openai-guard',
      toNodeId: 'dc-merge-ai',
      kind: 'branch-true',
      d: 'M 732 244.5 L 823 244.5',
    },
    {
      id: 'w-merge-telegram',
      fromNodeId: 'dc-merge-ai',
      toNodeId: 'dc-telegram-send',
      kind: 'branch-true',
      d: 'M 885 244.5 C 932 244.5, 932 331, 977 331',
    },
    {
      id: 'w-if-telegram',
      fromNodeId: 'dc-if-anomalies',
      toNodeId: 'dc-telegram-send',
      kind: 'branch-false',
      d: 'M 569 311 C 760 311, 790 331, 977 331',
    },
  ],
};

interface RawStepDef {
  nodeId: string;
  wireId: string | null;
  kind: ExecutionStep['kind'];
  loopIteration?: 1 | 2;
  wireDurationSec: number;
  nodeDwellSec: number;
  captionUk: string;
  captionEn: string;
}

const SHARED_PREFIX_STEPS: RawStepDef[] = [
  {
    nodeId: 'dc-push-trigger',
    wireId: null,
    kind: 'trigger',
    wireDurationSec: 0,
    nodeDwellSec: 0.24,
    captionUk: 'Google Drive Push зафіксував новий .xls із 1С',
    captionEn: 'Google Drive Push detected a new 1C .xls export',
  },
  {
    nodeId: 'dc-drive-search',
    wireId: 'w-push-search',
    kind: 'trigger',
    wireDurationSec: 0.28,
    nodeDwellSec: 0.18,
    captionUk: 'Пошук актуальних .xls файлів у папці Drive',
    captionEn: 'Listing latest .xls files in Google Drive folder',
  },
  {
    nodeId: 'dc-pick-latest',
    wireId: 'w-search-pick',
    kind: 'main',
    wireDurationSec: 0.2,
    nodeDwellSec: 0.16,
    captionUk: 'Перевірка md5Checksum у staticData (захист від дублів)',
    captionEn: 'Verifying md5Checksum against staticData (dedup)',
  },
  {
    nodeId: 'dc-drive-download',
    wireId: 'w-pick-download',
    kind: 'main',
    wireDurationSec: 0.2,
    nodeDwellSec: 0.16,
    captionUk: 'Завантаження бінарного BIFF8 .xls звіту',
    captionEn: 'Downloading binary BIFF8 .xls file',
  },
  {
    nodeId: 'dc-extract-b64',
    wireId: 'w-download-b64',
    kind: 'main',
    wireDurationSec: 0.2,
    nodeDwellSec: 0.16,
    captionUk: 'Конвертація бінарного потоку в Base64',
    captionEn: 'Converting binary payload to Base64 string',
  },
  {
    nodeId: 'dc-read-sheets',
    wireId: 'w-b64-read',
    kind: 'main',
    wireDurationSec: 0.22,
    nodeDwellSec: 0.18,
    captionUk: 'Читання коментарів менеджерів і вкладки «Маршрути»',
    captionEn: 'Reading manager comments & Routes tab from Sheets',
  },
  {
    nodeId: 'dc-calc-debts',
    wireId: 'w-read-calc',
    kind: 'main',
    wireDurationSec: 0.2,
    nodeDwellSec: 0.24,
    captionUk: 'FIFO-розрахунок прострочки, дельт і чанків batchUpdate',
    captionEn: 'Computing FIFO overdue tiers, deltas & batch chunks',
  },
  {
    nodeId: 'dc-batch-loop',
    wireId: 'w-calc-batch',
    kind: 'return-rail',
    wireDurationSec: 0.56,
    nodeDwellSec: 0.18,
    captionUk: 'Вхід у SplitInBatches для запису без API rate-limits',
    captionEn: 'Entering SplitInBatches to avoid Sheets API limits',
  },
  // Iteration 1 of SplitInBatches loop
  {
    nodeId: 'dc-write-sheets',
    wireId: 'w-batch-write',
    kind: 'loop-out',
    loopIteration: 1,
    wireDurationSec: 0.24,
    nodeDwellSec: 0.18,
    captionUk: 'Цикл 1/2: batchUpdate вкладок «Накладні» та «Зведення»',
    captionEn: 'Loop 1/2: batchUpdate Invoices & Summary tabs',
  },
  {
    nodeId: 'dc-batch-loop',
    wireId: 'w-write-batch',
    kind: 'loop-back',
    loopIteration: 1,
    wireDurationSec: 0.36,
    nodeDwellSec: 0.14,
    captionUk: 'Повернення петлі loop за наступним пакетом',
    captionEn: 'Returning along loop-back rail for next chunk',
  },
  // Iteration 2 of SplitInBatches loop
  {
    nodeId: 'dc-write-sheets',
    wireId: 'w-batch-write',
    kind: 'loop-out',
    loopIteration: 2,
    wireDurationSec: 0.22,
    nodeDwellSec: 0.18,
    captionUk: 'Цикл 2/2: оновлення «Всі клієнти» та нових маршрутів',
    captionEn: 'Loop 2/2: updating All Clients & appending new routes',
  },
  {
    nodeId: 'dc-batch-loop',
    wireId: 'w-write-batch',
    kind: 'loop-back',
    loopIteration: 2,
    wireDurationSec: 0.34,
    nodeDwellSec: 0.14,
    captionUk: 'Усі пакети записано — вихід через порт done',
    captionEn: 'All chunks written — exiting via done output',
  },
  {
    nodeId: 'dc-mark-done',
    wireId: 'w-batch-done',
    kind: 'done-out',
    wireDurationSec: 0.24,
    nodeDwellSec: 0.18,
    captionUk: 'Фіксація fileKey і timestamp у staticData',
    captionEn: 'Saving processed fileKey & timestamp to staticData',
  },
  {
    nodeId: 'dc-if-anomalies',
    wireId: 'w-done-if',
    kind: 'main',
    wireDurationSec: 0.22,
    nodeDwellSec: 0.26,
    captionUk: 'Перевірка IF: чи виявлено фінансові аномалії?',
    captionEn: 'IF gate: were any financial anomalies detected?',
  },
];

const ANOMALY_SUFFIX_STEPS: RawStepDef[] = [
  {
    nodeId: 'dc-openai-guard',
    wireId: 'w-if-openai',
    kind: 'branch-true',
    wireDurationSec: 0.3,
    nodeDwellSec: 0.28,
    captionUk: 'IF = true → OpenAI Сторож розбирає розбіжності 1С',
    captionEn: 'IF = true → OpenAI Watchdog audits 1C discrepancies',
  },
  {
    nodeId: 'dc-merge-ai',
    wireId: 'w-openai-merge',
    kind: 'branch-true',
    wireDurationSec: 0.24,
    nodeDwellSec: 0.2,
    captionUk: 'Вбудовування висновку ШІ у шаблон звіту',
    captionEn: 'Merging AI anomaly summary into report payload',
  },
  {
    nodeId: 'dc-telegram-send',
    wireId: 'w-merge-telegram',
    kind: 'terminal',
    wireDurationSec: 0.3,
    nodeDwellSec: 0.4,
    captionUk: 'Звіт із ШІ-аудитом доставлено керівнику в Telegram',
    captionEn: 'Report with AI audit delivered to manager in Telegram',
  },
];

const NORMAL_SUFFIX_STEPS: RawStepDef[] = [
  {
    nodeId: 'dc-telegram-send',
    wireId: 'w-if-telegram',
    kind: 'branch-false',
    wireDurationSec: 0.52,
    nodeDwellSec: 0.4,
    captionUk: 'IF = false → пряма доставка в Telegram ($0 витрат на LLM)',
    captionEn: 'IF = false → direct Telegram delivery ($0 LLM spend)',
  },
];

export function buildScreenshotExecutionPlan(branch: OverlayBranch): ScreenshotExecutionPlan {
  const rawSteps =
    branch === 'anomaly'
      ? [...SHARED_PREFIX_STEPS, ...ANOMALY_SUFFIX_STEPS]
      : [...SHARED_PREFIX_STEPS, ...NORMAL_SUFFIX_STEPS];

  const totalSteps = rawSteps.length;
  const steps: ExecutionStep[] = rawSteps.map((s, idx) => ({
    ...s,
    stepIndex: idx + 1,
    totalSteps,
  }));

  const executedSet = new Set<string>(steps.map((s) => s.nodeId));
  const activeWireSet = new Set<string>(
    steps.map((s) => s.wireId).filter((w): w is string => Boolean(w))
  );

  // Manual trigger is an alternate entry point (not triggered in Push run); AI nodes are skipped in normal branch
  const skippedNodeIds =
    branch === 'normal'
      ? ['dc-openai-guard', 'dc-merge-ai']
      : [];

  const inactiveWireIds = DEBT_CONTROL_SCREENSHOT_SPEC.wires
    .map((w) => w.id)
    .filter((id) => !activeWireSet.has(id));

  return {
    branch,
    steps,
    executedNodeIds: Array.from(executedSet),
    skippedNodeIds,
    activeWireIds: Array.from(activeWireSet),
    inactiveWireIds,
    llmCostLabelUk: branch === 'anomaly' ? 'IF: true · OpenAI активний' : 'IF: false · $0 витрат LLM',
    llmCostLabelEn: branch === 'anomaly' ? 'IF: true · OpenAI active' : 'IF: false · $0 LLM cost',
  };
}

export function getOverlayStepCaption(step: ExecutionStep | null, locale: Locale): string {
  if (!step) {
    return locale === 'uk'
      ? 'Клікніть або наведіть на будь-який вузол прямо на скріншоті, щоб прочитати технічні нотатки.'
      : 'Hover or click any node directly on the screenshot to read its engineering notes.';
  }
  return locale === 'uk' ? step.captionUk : step.captionEn;
}
