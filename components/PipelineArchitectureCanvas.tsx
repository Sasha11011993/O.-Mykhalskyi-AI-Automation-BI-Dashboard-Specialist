'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowRight, ArrowUpRight, FileJson, LayoutGrid, MoveHorizontal, Play, X } from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import { usePortfolioCases } from '@/components/PortfolioCasesProvider';
import LiveN8nScreenshotOverlay from '@/components/LiveN8nScreenshotOverlay';
import LiveN8nJsonGraphViewer from '@/components/LiveN8nJsonGraphViewer';
import N8nImportModal from '@/components/N8nImportModal';
import {
  getCaseN8nWorkflowByPreset,
  type CaseN8nPresetId,
} from '@/components/CaseN8nWorkflowViewer';
import {
  PIPELINE_BLUEPRINTS,
  SERVICES_DATA,
  t,
  type PipelineNodeSpec,
} from '@/lib/portfolioData';
import {
  computeNextBatchRecords,
  formatInteger,
  resolveActivePipelineNode,
  togglePinnedNode,
  type PipelineStageRole,
  type ServiceId,
} from '@/lib/portfolioLogic';
import {
  N8N_VIEWBOX_H,
  N8N_VIEWBOX_W,
  PRODUCTION_DEBT_CONTROL_WORKFLOW,
  formatWorkflowSummary,
  parseAndLayoutN8nWorkflow,
  type LayoutN8nNode,
  type N8nLayoutMode,
  type N8nNodeCategory,
  type ParsedN8nGraph,
} from '@/lib/n8nWorkflowEngine';
import {
  getOverlayStepCaption,
  type ExecutionStep,
} from '@/lib/n8nScreenshotOverlay';
import { SERVICE_ACCENTS } from '@/lib/serviceThemes';

interface PipelineArchitectureCanvasProps {
  activeServiceId: ServiceId;
  onSelectService: (serviceId: ServiceId) => void;
  onInspectService: (serviceId: ServiceId) => void;
  onOpenCaseStudy?: (caseId: string) => void;
  externalN8nPreset?: { preset: CaseN8nPresetId; version: number } | null;
}

const VB_W = N8N_VIEWBOX_W;
const VB_H = N8N_VIEWBOX_H;

// 6 directed cubic Bezier conduits for ETL / BI / PLAN architectural blueprints
const CONDUIT_PATHS: readonly string[] = [
  'M 188 72 C 228 72, 224 108, 260 108',
  'M 188 160 C 224 160, 226 116, 260 116',
  'M 188 160 C 224 160, 226 208, 260 208',
  'M 188 248 C 228 248, 224 216, 260 216',
  'M 442 112 C 478 112, 478 106, 514 106',
  'M 442 212 C 478 212, 478 224, 514 224',
] as const;

const TRANSFORM_BRIDGE_PATH = 'M 351 148 L 351 178';

const STAGE_BADGE_LABELS: Record<PipelineStageRole, { uk: string; en: string }> = {
  extract: { uk: 'Extract · Тригер', en: 'Extract · Trigger' },
  transform: { uk: 'Transform · Обробка', en: 'Transform · Engine' },
  load: { uk: 'Load · Результат', en: 'Load · Output' },
};

const STAGE_BADGE_COLORS: Record<PipelineStageRole, string> = {
  extract: 'text-[#B45309] dark:text-[#FBBF24]',
  transform: 'text-[#C84317] dark:text-[#FB8356]',
  load: 'text-[#0F766E] dark:text-[#2DD4BF]',
};

// Semantic SVG styling for real n8n node categories (n8n editor feel + Swiss architectural restraint)
const N8N_CATEGORY_STYLES: Record<
  N8nNodeCategory,
  {
    fill: string;
    fillActive: string;
    stripFill: string;
    portStroke: string;
    portActiveFill: string;
  }
> = {
  trigger: {
    fill: 'fill-[#FFFDF8] dark:fill-[#1F1C15] stroke-[#E6D5B8] dark:stroke-[#4A3B20]',
    fillActive: 'fill-[#FEF7E6] dark:fill-[#2B2416] stroke-[#D97706] dark:stroke-[#FBBF24]',
    stripFill: 'fill-[#D97706] dark:fill-[#FBBF24]',
    portStroke: 'stroke-[#D97706] dark:stroke-[#FBBF24]',
    portActiveFill: 'fill-[#D97706] dark:fill-[#FBBF24]',
  },
  ai: {
    fill: 'fill-[#FFF5F0] dark:fill-[#261812] stroke-[#F5BFA8] dark:stroke-[#6D331B]',
    fillActive: 'fill-[#FFECE2] dark:fill-[#331E15] stroke-[#CC4518] dark:stroke-[#FB8356]',
    stripFill: 'fill-[#CC4518] dark:fill-[#FB8356]',
    portStroke: 'stroke-[#CC4518] dark:stroke-[#FB8356]',
    portActiveFill: 'fill-[#CC4518] dark:fill-[#FB8356]',
  },
  logic: {
    fill: 'fill-[#F6F7FF] dark:fill-[#191B2B] stroke-[#CED3F5] dark:stroke-[#323866]',
    fillActive: 'fill-[#ECEEFF] dark:fill-[#212540] stroke-[#4338CA] dark:stroke-[#818CF8]',
    stripFill: 'fill-[#4338CA] dark:fill-[#818CF8]',
    portStroke: 'stroke-[#4338CA] dark:stroke-[#818CF8]',
    portActiveFill: 'fill-[#4338CA] dark:fill-[#818CF8]',
  },
  action: {
    fill: 'fill-[#F3FBF8] dark:fill-[#12221E] stroke-[#B7E4D8] dark:stroke-[#1E4F49]',
    fillActive: 'fill-[#E5F7F1] dark:fill-[#172E28] stroke-[#0F766E] dark:stroke-[#2DD4BF]',
    stripFill: 'fill-[#0F766E] dark:fill-[#2DD4BF]',
    portStroke: 'stroke-[#0F766E] dark:stroke-[#2DD4BF]',
    portActiveFill: 'fill-[#0F766E] dark:fill-[#2DD4BF]',
  },
};

const EMPTY_N8N_GRAPH: ParsedN8nGraph = {
  workflowName: 'n8n Workflow',
  nodes: [],
  edges: [],
  totalWaves: 1,
  ignoredStickyNotes: 0,
  uniqueTechStack: ['n8n'],
  viewBoxWidth: VB_W,
  viewBoxHeight: VB_H,
  layoutMode: 'native',
  supportsPanorama: false,
};

const HERO_PRODUCTION_SCREENSHOT_SRC = '/assets/aistudio/image_4c39709d.png';
const HERO_FEATURED_CASE_ID = 'debt-control-1c-n8n';

const DEFAULT_PRODUCTION_N8N = {
  rawJson: JSON.stringify(PRODUCTION_DEBT_CONTROL_WORKFLOW, null, 2),
  graph: (() => {
    const parsed = parseAndLayoutN8nWorkflow(PRODUCTION_DEBT_CONTROL_WORKFLOW, 'compact');
    return parsed.ok ? parsed.graph : EMPTY_N8N_GRAPH;
  })(),
} as const;

function truncateSvgText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(4, maxChars - 1)).trimEnd()}…`;
}

export default function PipelineArchitectureCanvas({
  activeServiceId,
  onSelectService,
  onInspectService,
  onOpenCaseStudy,
  externalN8nPreset,
}: PipelineArchitectureCanvasProps) {
  const { locale } = useThemeLocale();
  const { heroCase, workflows: remoteWorkflows, ensureWorkflowLoaded } = usePortfolioCases();
  const svgRef = useRef<SVGSVGElement>(null);

  const heroFirestoreN8nScene = useMemo(() => {
    if (!heroCase || heroCase.source !== 'firestore' || !heroCase.scenes) return null;
    return heroCase.scenes.find((s) => s.kind === 'n8n-json' && s.n8nWorkflowId) ?? null;
  }, [heroCase]);

  useEffect(() => {
    if (heroFirestoreN8nScene?.n8nWorkflowId) {
      ensureWorkflowLoaded(heroFirestoreN8nScene.n8nWorkflowId);
    }
  }, [heroFirestoreN8nScene?.n8nWorkflowId, ensureWorkflowLoaded]);

  const heroFirestoreWorkflow = heroFirestoreN8nScene?.n8nWorkflowId
    ? remoteWorkflows[heroFirestoreN8nScene.n8nWorkflowId] ?? null
    : null;

  const [pulseCounts, setPulseCounts] = useState<Record<ServiceId, number>>({
    'etl-pipelines': PIPELINE_BLUEPRINTS['etl-pipelines'].initialRecords,
    'ai-agents': PIPELINE_BLUEPRINTS['ai-agents'].initialRecords,
    'bi-dashboards': PIPELINE_BLUEPRINTS['bi-dashboards'].initialRecords,
    'audit-architecture': PIPELINE_BLUEPRINTS['audit-architecture'].initialRecords,
  });
  const [pulseTrigger, setPulseTrigger] = useState<number>(0);
  const [screenshotReplayNonce, setScreenshotReplayNonce] = useState<number>(0);
  const [liveScreenshotStep, setLiveScreenshotStep] = useState<ExecutionStep | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pinnedState, setPinnedState] = useState<{ serviceId: ServiceId; nodeId: string } | null>(
    null
  );

  // Real production n8n workflow showcase by default + optional custom user JSON upload/paste
  const [customN8nState, setCustomN8nState] = useState<{
    graph: ParsedN8nGraph;
    rawJson: string;
  } | null>(() => {
    if (!externalN8nPreset || externalN8nPreset.preset === 'debt-control-15') return null;
    const wf = getCaseN8nWorkflowByPreset(externalN8nPreset.preset);
    const parsed = parseAndLayoutN8nWorkflow(wf, 'compact');
    return parsed.ok ? { graph: parsed.graph, rawJson: JSON.stringify(wf, null, 2) } : null;
  });
  const [n8nLayoutMode, setN8nLayoutMode] = useState<N8nLayoutMode>('compact');
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [modalKey, setModalKey] = useState<number>(0);

  // Horizontal drag-to-pan state for 1:1 Panorama view on wide production n8n workflows
  const panScrollRef = useRef<HTMLDivElement>(null);
  const dragPanRef = useRef<{
    active: boolean;
    startX: number;
    scrollLeft: number;
    moved: boolean;
  }>({ active: false, startX: 0, scrollLeft: 0, moved: false });

  const isCustomN8n = customN8nState !== null;
  const n8nGraph = useMemo<ParsedN8nGraph>(() => {
    if (!customN8nState) {
      return DEFAULT_PRODUCTION_N8N.graph;
    }
    if (!customN8nState.graph.supportsPanorama) {
      return customN8nState.graph;
    }
    const reparsed = parseAndLayoutN8nWorkflow(customN8nState.rawJson, n8nLayoutMode);
    return reparsed.ok ? reparsed.graph : customN8nState.graph;
  }, [customN8nState, n8nLayoutMode]);
  const n8nRawJson = customN8nState ? customN8nState.rawJson : DEFAULT_PRODUCTION_N8N.rawJson;

  const isN8nMode = activeServiceId === 'ai-agents';
  const isFirestoreHeroShowcase =
    isN8nMode && !isCustomN8n && heroCase?.source === 'firestore' && heroFirestoreWorkflow !== null;
  const isLiveProductionShowcase = isN8nMode && !isCustomN8n && !isFirestoreHeroShowcase;
  const blueprint = PIPELINE_BLUEPRINTS[activeServiceId];
  const serviceAccent = SERVICE_ACCENTS[activeServiceId];
  const activeServiceMeta =
    SERVICES_DATA.find((s) => s.id === activeServiceId) ?? SERVICES_DATA[0];
  const currentRecords = pulseCounts[activeServiceId];

  const pinnedNodeId =
    pinnedState && pinnedState.serviceId === activeServiceId ? pinnedState.nodeId : null;

  const allBlueprintNodes = useMemo<PipelineNodeSpec[]>(
    () => [...blueprint.sources, ...blueprint.transforms, ...blueprint.outputs],
    [blueprint]
  );

  const activeNodeId = resolveActivePipelineNode(hoveredNodeId, pinnedNodeId);

  const activeBlueprintNode = useMemo(
    () => (!isN8nMode ? allBlueprintNodes.find((n) => n.id === activeNodeId) ?? null : null),
    [isN8nMode, allBlueprintNodes, activeNodeId]
  );

  const activeN8nNode = useMemo<LayoutN8nNode | null>(
    () => (isN8nMode ? n8nGraph.nodes.find((n) => n.id === activeNodeId) ?? null : null),
    [isN8nMode, n8nGraph.nodes, activeNodeId]
  );

  const highlightedConduits = useMemo(
    () => new Set<number>(activeBlueprintNode ? activeBlueprintNode.conduitIndices : []),
    [activeBlueprintNode]
  );

  const highlightedN8nEdges = useMemo(
    () => new Set<string>(activeN8nNode ? activeN8nNode.edgeIds : []),
    [activeN8nNode]
  );

  const n8nNodeCategoryById = useMemo(
    () => new Map(n8nGraph.nodes.map((n) => [n.id, n.category])),
    [n8nGraph.nodes]
  );

  // GSAP continuous conduit flow + topological sequential execution animation for real n8n workflows
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const pipeNodes = svg.querySelectorAll('.js-pipe-node');
      if (pipeNodes.length > 0) {
        gsap.fromTo(
          pipeNodes,
          { opacity: 0, y: 5 },
          {
            opacity: 1,
            y: 0,
            duration: 0.3,
            stagger: 0.028,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
          }
        );
      }

      const pipeBars = svg.querySelectorAll('.js-pipe-bar');
      if (pipeBars.length > 0) {
        gsap.fromTo(
          pipeBars,
          { scaleY: 0.12, transformOrigin: 'bottom center' },
          {
            scaleY: 1,
            duration: 0.45,
            stagger: 0.045,
            ease: 'power3.out',
          }
        );
      }

      const conduitDashes = svg.querySelectorAll('.js-conduit-dash');
      if (conduitDashes.length > 0) {
        gsap.to(conduitDashes, {
          strokeDashoffset: -32,
          duration: 1.5,
          repeat: -1,
          ease: 'none',
        });
      }

      const paths = svg.querySelectorAll<SVGPathElement>('.js-conduit-path');
      const packets = svg.querySelectorAll<SVGCircleElement>('.js-data-packet');

      paths.forEach((pathEl, idx) => {
        const packetEl = packets[idx];
        if (!packetEl) return;
        const totalLength = pathEl.getTotalLength();
        if (!Number.isFinite(totalLength) || totalLength <= 0) return;

        const waveAttr = Number(pathEl.dataset.wave ?? '0');
        const tracker = { progress: 0 };

        gsap.to(tracker, {
          progress: 1,
          duration: isN8nMode ? 1.55 + (idx % 3) * 0.2 : 1.85 + (idx % 3) * 0.25,
          delay: isN8nMode ? waveAttr * 0.38 + (idx % 2) * 0.12 : idx * 0.22,
          repeat: -1,
          ease: 'power1.inOut',
          onUpdate: () => {
            const pt = pathEl.getPointAtLength(tracker.progress * totalLength);
            packetEl.setAttribute('cx', pt.x.toFixed(1));
            packetEl.setAttribute('cy', pt.y.toFixed(1));
            const edgeFade = Math.sin(tracker.progress * Math.PI);
            packetEl.setAttribute('opacity', Math.max(0.15, edgeFade).toFixed(2));
          },
        });
      });

      // Real n8n sequential wave execution pulse + emerald completion badges
      if (isN8nMode) {
        const execBadges = svg.querySelectorAll<SVGGElement>('.js-n8n-exec-badge');
        const execRings = svg.querySelectorAll<SVGRectElement>('.js-n8n-exec-ring');

        execBadges.forEach((badge) => {
          const wave = Number(badge.dataset.wave ?? '0');
          gsap.fromTo(
            badge,
            { opacity: 0 },
            {
              opacity: 1,
              duration: 0.26,
              delay: 0.25 + wave * 0.42,
              ease: 'power2.out',
            }
          );
        });

        execRings.forEach((ring) => {
          const wave = Number(ring.dataset.wave ?? '0');
          gsap.fromTo(
            ring,
            { opacity: 0 },
            {
              opacity: 0.9,
              duration: 0.22,
              delay: 0.12 + wave * 0.42,
              yoyo: true,
              repeat: 1,
              ease: 'power2.inOut',
            }
          );
        });
      }
    }, svg);

    return () => ctx.revert();
  }, [activeServiceId, pulseTrigger, n8nGraph, isN8nMode]);

  const handleRunBatch = useCallback(() => {
    if (isLiveProductionShowcase) {
      setScreenshotReplayNonce((n) => n + 1);
      return;
    }
    setPulseCounts((prev) => ({
      ...prev,
      [activeServiceId]: computeNextBatchRecords(prev[activeServiceId], blueprint.batchDelta),
    }));
    setPulseTrigger((n) => n + 1);
  }, [activeServiceId, blueprint.batchDelta, isLiveProductionShowcase]);

  const handleTogglePin = useCallback(
    (nodeId: string) => {
      const next = togglePinnedNode(pinnedNodeId, nodeId);
      setPinnedState(next ? { serviceId: activeServiceId, nodeId: next } : null);
    },
    [activeServiceId, pinnedNodeId]
  );

  const handleNodeKeyDown = (event: React.KeyboardEvent, nodeId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTogglePin(nodeId);
    } else if (event.key === 'Escape') {
      setPinnedState(null);
      setHoveredNodeId(null);
    }
  };

  const handleOpenImport = () => {
    setModalKey((k) => k + 1);
    setIsImportOpen(true);
  };

  const handleApplyN8nWorkflow = (
    graph: ParsedN8nGraph,
    rawJson: string,
    isCustom: boolean
  ) => {
    setCustomN8nState(isCustom ? { graph, rawJson } : null);
    setN8nLayoutMode('compact');
    setHoveredNodeId(null);
    setPinnedState(null);
    if (activeServiceId !== 'ai-agents') {
      onSelectService('ai-agents');
    }
    setPulseTrigger((n) => n + 1);
  };

  const handlePanPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = panScrollRef.current;
    if (!el || n8nGraph.layoutMode !== 'panorama') return;
    dragPanRef.current = {
      active: true,
      startX: event.clientX,
      scrollLeft: el.scrollLeft,
      moved: false,
    };
  };

  const handlePanPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = panScrollRef.current;
    if (!el || !dragPanRef.current.active) return;
    const dx = event.clientX - dragPanRef.current.startX;
    if (Math.abs(dx) > 4) {
      dragPanRef.current.moved = true;
      el.scrollLeft = dragPanRef.current.scrollLeft - dx;
    }
  };

  const handlePanPointerEnd = () => {
    dragPanRef.current.active = false;
  };

  const sourceY = [42, 130, 218];
  const transformY = [76, 178];

  const getBlueprintNodeA11yProps = (node: PipelineNodeSpec) => {
    const isPinned = pinnedNodeId === node.id;
    return {
      role: 'button' as const,
      tabIndex: 0,
      'aria-pressed': isPinned,
      'aria-label': `${t(node.label, locale)} — ${t(node.sublabel, locale)}`,
      onMouseEnter: () => setHoveredNodeId(node.id),
      onMouseLeave: () => setHoveredNodeId((prev) => (prev === node.id ? null : prev)),
      onFocus: () => setHoveredNodeId(node.id),
      onBlur: () => setHoveredNodeId((prev) => (prev === node.id ? null : prev)),
      onClick: () => handleTogglePin(node.id),
      onKeyDown: (e: React.KeyboardEvent) => handleNodeKeyDown(e, node.id),
      className: 'js-pipe-node cursor-pointer outline-none',
    };
  };

  const getN8nNodeA11yProps = (node: LayoutN8nNode) => {
    const isPinned = pinnedNodeId === node.id;
    return {
      role: 'button' as const,
      tabIndex: 0,
      'aria-pressed': isPinned,
      'aria-label': `${node.name} — ${node.shortType}`,
      onMouseEnter: () => setHoveredNodeId(node.id),
      onMouseLeave: () => setHoveredNodeId((prev) => (prev === node.id ? null : prev)),
      onFocus: () => setHoveredNodeId(node.id),
      onBlur: () => setHoveredNodeId((prev) => (prev === node.id ? null : prev)),
      onClick: () => {
        if (dragPanRef.current.moved) {
          dragPanRef.current.moved = false;
          return;
        }
        handleTogglePin(node.id);
      },
      onKeyDown: (e: React.KeyboardEvent) => handleNodeKeyDown(e, node.id),
      className: 'js-pipe-node cursor-pointer outline-none',
    };
  };

  // Unified inspector metadata (strictly invariant height across n8n and ETL/BI/PLAN modes)
  const inspectorActive = useMemo(() => {
    if (isN8nMode && activeN8nNode) {
      return {
        id: activeN8nNode.id,
        label: activeN8nNode.name,
        role: activeN8nNode.role,
        protocol: t(activeN8nNode.protocol, locale),
        explanation: t(activeN8nNode.explanation, locale),
      };
    }
    if (!isN8nMode && activeBlueprintNode) {
      return {
        id: activeBlueprintNode.id,
        label: t(activeBlueprintNode.label, locale),
        role: activeBlueprintNode.role,
        protocol: t(activeBlueprintNode.protocol, locale),
        explanation: t(activeBlueprintNode.explanation, locale),
      };
    }
    return null;
  }, [isN8nMode, activeN8nNode, activeBlueprintNode, locale]);

  const isPanorama = isN8nMode && n8nGraph.layoutMode === 'panorama';
  const panoramaSvgWidth = Math.round(
    (n8nGraph.viewBoxWidth / Math.max(1, n8nGraph.viewBoxHeight)) * 316
  );

  return (
    <>
      <div
        data-testid="pipeline-canvas"
        className="h-full w-full rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] flex flex-col justify-between overflow-hidden"
      >
        {/* Top Blueprint Bar: Active Track Indicator (synced with Left Directory) + n8n JSON + Run */}
        <div className="shrink-0 px-4 sm:px-5 py-2.5 border-b border-[#E5E0D6] dark:border-[#2A2825] flex flex-wrap items-center justify-between gap-2 bg-[#FAF8F4] dark:bg-[#141311]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full shrink-0 ${serviceAccent.barBg}`}
            />
            <span
              className={`font-mono text-[11px] font-semibold uppercase tracking-[0.04em] whitespace-nowrap ${serviceAccent.tabActiveText}`}
            >
              {activeServiceMeta.index} {isN8nMode ? 'n8n · AI' : blueprint.code}
            </span>
            <span aria-hidden="true" className="text-[#C6BEB2] dark:text-[#44403A]">
              ·
            </span>
            <span
              data-testid="pipeline-batch-counter"
              className="font-mono tabular-nums text-[11px] font-medium text-[#6E6960] dark:text-[#A8A298] truncate"
            >
              {isN8nMode
                ? formatWorkflowSummary(n8nGraph, locale)
                : `${formatInteger(currentRecords)} ${t(blueprint.recordsUnit, locale)}`}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="open-n8n-import-btn"
              onClick={handleOpenImport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-md border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#161513] dark:text-[#F5F3EE] hover:border-[#CC4518] dark:hover:border-[#FB8356] transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518]"
            >
              <FileJson className="w-3 h-3 text-[#C84317] dark:text-[#FB8356]" aria-hidden="true" />
              <span>n8n JSON</span>
            </button>

            <button
              type="button"
              onClick={handleRunBatch}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] ${serviceAccent.runBtn}`}
            >
              <Play className="w-3 h-3" aria-hidden="true" />
              <span>{locale === 'uk' ? 'Запустити' : 'Run'}</span>
            </button>
          </div>
        </div>

        {/* Center Live Interactive SVG Architecture Stage with Subtle Semantic Atmosphere */}
        <div
          className="flex-1 min-h-[230px] lg:min-h-0 relative px-3 sm:px-4 py-2.5 flex flex-col justify-center"
          style={{
            backgroundImage: `radial-gradient(ellipse 64% 58% at 52% 48%, ${serviceAccent.stageGlowCss}, transparent 72%), radial-gradient(circle, rgba(120,113,108,0.17) 1px, transparent 1px)`,
            backgroundSize: '100% 100%, 18px 18px',
          }}
        >
          {/* Active Pipeline Caption + Direct Case Link or Wide Workflow Fit/Panorama Switch */}
          <div className="px-1.5 mb-1.5 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
            <h2 className="text-xs sm:text-[13px] font-semibold text-[#161513] dark:text-[#F5F3EE] truncate min-w-0">
              {isFirestoreHeroShowcase && heroCase
                ? t(heroCase.title, locale)
                : isLiveProductionShowcase
                  ? locale === 'uk'
                    ? 'Дебет-контроль: 1С → Google Sheets → AI-сторож → Telegram'
                    : 'AR Control: 1C → Google Sheets → AI Watchdog → Telegram'
                  : isN8nMode
                    ? `n8n: ${n8nGraph.workflowName}`
                    : t(blueprint.title, locale)}
            </h2>

            {isLiveProductionShowcase || (isFirestoreHeroShowcase && heroCase) ? (
              onOpenCaseStudy ? (
                <button
                  type="button"
                  data-testid="hero-open-featured-case"
                  onClick={() =>
                    onOpenCaseStudy(
                      isFirestoreHeroShowcase && heroCase ? heroCase.id : HERO_FEATURED_CASE_ID
                    )
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C84317] dark:text-[#FB8356] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] rounded"
                >
                  <span>{locale === 'uk' ? 'Кейс повністю' : 'Full case'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              ) : (
                <span className="font-mono tabular-nums text-[10px] sm:text-[11px] font-medium text-[#0F766E] dark:text-[#2DD4BF] whitespace-nowrap shrink-0">
                  {locale === 'uk' ? 'Продакшн-кейс · 2026' : 'Production case · 2026'}
                </span>
              )
            ) : isN8nMode && n8nGraph.supportsPanorama ? (
              <div
                role="group"
                aria-label={locale === 'uk' ? 'Режим масштабування схеми' : 'Workflow view mode'}
                className="inline-flex items-center gap-1 shrink-0"
              >
                <button
                  type="button"
                  data-testid="n8n-mode-compact-btn"
                  aria-pressed={n8nLayoutMode === 'compact'}
                  onClick={() => setN8nLayoutMode('compact')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-mono font-medium rounded border transition-colors cursor-pointer ${
                    n8nLayoutMode === 'compact'
                      ? 'border-[#CC4518] dark:border-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356]'
                      : 'border-[#DDD6C9] dark:border-[#33302B] bg-white/80 dark:bg-[#1B1A18] text-[#6E6960] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" aria-hidden="true" />
                  <span>{locale === 'uk' ? 'Огляд' : 'Fit'}</span>
                </button>
                <button
                  type="button"
                  data-testid="n8n-mode-panorama-btn"
                  aria-pressed={n8nLayoutMode === 'panorama'}
                  onClick={() => setN8nLayoutMode('panorama')}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-mono font-medium rounded border transition-colors cursor-pointer ${
                    n8nLayoutMode === 'panorama'
                      ? 'border-[#CC4518] dark:border-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356]'
                      : 'border-[#DDD6C9] dark:border-[#33302B] bg-white/80 dark:bg-[#1B1A18] text-[#6E6960] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  <MoveHorizontal className="w-3 h-3" aria-hidden="true" />
                  <span>{locale === 'uk' ? '1:1 Панорама' : '1:1 Pan'}</span>
                </button>
              </div>
            ) : (
              <span className="font-mono tabular-nums text-[10px] sm:text-[11px] font-medium text-[#0F766E] dark:text-[#2DD4BF] whitespace-nowrap shrink-0">
                {isN8nMode && isCustomN8n
                  ? locale === 'uk'
                    ? 'Користувацький JSON · локально'
                    : 'Custom JSON · local'
                  : t(blueprint.impactSummary, locale)}
              </span>
            )}
          </div>

          {isFirestoreHeroShowcase && heroFirestoreWorkflow && heroCase ? (
            <LiveN8nJsonGraphViewer
              workflow={heroFirestoreWorkflow}
              title={t(heroCase.title, locale)}
              compact
            />
          ) : isLiveProductionShowcase ? (
            /* REAL PRODUCTION 15-NODE LIVE ANIMATED N8N SCREENSHOT SHOWCASE */
            <LiveN8nScreenshotOverlay
              compact
              screenshotSrc={HERO_PRODUCTION_SCREENSHOT_SRC}
              title={
                locale === 'uk'
                  ? 'Дебет-контроль: реальний 15-вузловий воркфлоу n8n'
                  : 'AR Control: real 15-node production n8n workflow'
              }
              graph={n8nGraph}
              selectedNodeId={pinnedNodeId}
              hoveredNodeId={hoveredNodeId}
              onSelectNode={(nodeId) =>
                setPinnedState(nodeId ? { serviceId: 'ai-agents', nodeId } : null)
              }
              onHoverNode={setHoveredNodeId}
              onActiveStepChange={setLiveScreenshotStep}
              externalReplayNonce={screenshotReplayNonce}
            />
          ) : isN8nMode ? (
            /* REAL N8N WORKFLOW GRAPH SVG ENGINE WITH SEMANTIC NODE COLORS + PANORAMA PAN */
            <div
              ref={panScrollRef}
              data-testid="n8n-svg-stage"
              onPointerDown={handlePanPointerDown}
              onPointerMove={handlePanPointerMove}
              onPointerUp={handlePanPointerEnd}
              onPointerCancel={handlePanPointerEnd}
              onPointerLeave={handlePanPointerEnd}
              className={
                isPanorama
                  ? 'w-full overflow-x-auto overflow-y-hidden pb-1 cursor-grab active:cursor-grabbing'
                  : 'w-full'
              }
            >
              <svg
                ref={svgRef}
                data-testid="n8n-workflow-svg"
                data-layout-mode={n8nGraph.layoutMode}
                viewBox={`0 0 ${n8nGraph.viewBoxWidth} ${n8nGraph.viewBoxHeight}`}
                width={isPanorama ? panoramaSvgWidth : undefined}
                height={isPanorama ? 316 : undefined}
                className={
                  isPanorama
                    ? 'block shrink-0 min-w-full select-none'
                    : n8nGraph.layoutMode === 'compact'
                      ? 'w-full h-auto max-h-[358px] select-none'
                      : 'w-full h-auto max-h-[305px] select-none'
                }
                role="group"
                aria-label={`n8n workflow: ${n8nGraph.workflowName}`}
              >
                {/* Real n8n Connections (main + ai_languageModel / ai_tool / ai_memory + loop-backs) */}
                {n8nGraph.edges.map((edge) => {
                  const hasFocus = activeN8nNode !== null;
                  const isLinked = highlightedN8nEdges.has(edge.id);
                  const dimClass = hasFocus && !isLinked ? 'opacity-20' : 'opacity-100';
                  const sourceCategory = n8nNodeCategoryById.get(edge.fromNodeId) ?? 'ai';
                  const edgeDashColor = edge.isLoopBack
                    ? 'stroke-[#4338CA]/75 dark:stroke-[#818CF8]/80'
                    : sourceCategory === 'trigger'
                      ? 'stroke-[#D97706]/65 dark:stroke-[#FBBF24]/70'
                      : sourceCategory === 'logic'
                        ? 'stroke-[#4338CA]/65 dark:stroke-[#818CF8]/70'
                        : 'stroke-[#CC4518]/65 dark:stroke-[#FB8356]/70';

                  return (
                    <g key={edge.id} className={`transition-opacity duration-150 ${dimClass}`}>
                      <path
                        d={edge.pathD}
                        data-wave={edge.wave}
                        fill="none"
                        className={
                          isLinked
                            ? 'js-conduit-path stroke-[#CC4518]/45 dark:stroke-[#FB8356]/50'
                            : edge.isLoopBack
                              ? 'js-conduit-path stroke-[#C7D2FE] dark:stroke-[#3730A3]'
                              : edge.isAiSubLink
                                ? 'js-conduit-path stroke-[#F5BFA8] dark:stroke-[#6D331B]'
                                : 'js-conduit-path stroke-[#DDD6C9] dark:stroke-[#322F2A]'
                        }
                        strokeWidth={isLinked ? '2.15' : '1.55'}
                        strokeDasharray={
                          edge.isAiSubLink || edge.isLoopBack ? '4 4' : undefined
                        }
                      />
                      <path
                        d={edge.pathD}
                        fill="none"
                        strokeDasharray={
                          edge.isAiSubLink ? '3 9' : edge.isLoopBack ? '4 10' : '5 11'
                        }
                        className={`js-conduit-dash ${
                          isLinked
                            ? 'stroke-[#CC4518] dark:stroke-[#FB8356]'
                            : edgeDashColor
                        }`}
                        strokeWidth={isLinked ? '2.15' : '1.55'}
                        strokeLinecap="round"
                      />
                      {edge.branchLabel && (
                        <text
                          x={edge.labelX}
                          y={edge.labelY}
                          textAnchor="middle"
                          paintOrder="stroke"
                          className={`pointer-events-none text-[9px] font-mono font-semibold stroke-[#FAF8F4] dark:stroke-[#181715] stroke-[3px] ${
                            edge.branchLabel === 'true' || edge.branchLabel === 'done'
                              ? 'fill-[#0F766E] dark:fill-[#2DD4BF]'
                              : edge.branchLabel === 'false'
                                ? 'fill-[#B45309] dark:fill-[#FBBF24]'
                                : edge.isLoopBack || edge.branchLabel === 'batch'
                                  ? 'fill-[#4338CA] dark:fill-[#818CF8]'
                                  : 'fill-[#C84317] dark:fill-[#FB8356]'
                          }`}
                        >
                          {edge.branchLabel}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* GSAP Traveling Execution Data Packets colored by source stage */}
                {n8nGraph.edges.map((edge) => {
                  const hasFocus = activeN8nNode !== null;
                  const isLinked = highlightedN8nEdges.has(edge.id);
                  const sourceCategory = n8nNodeCategoryById.get(edge.fromNodeId) ?? 'ai';
                  const packetColor = edge.isLoopBack
                    ? 'fill-[#4338CA] dark:fill-[#818CF8]'
                    : sourceCategory === 'trigger'
                      ? 'fill-[#D97706] dark:fill-[#FBBF24]'
                      : sourceCategory === 'logic'
                        ? 'fill-[#4338CA] dark:fill-[#818CF8]'
                        : 'fill-[#CC4518] dark:fill-[#FB8356]';

                  return (
                    <circle
                      key={`n8n-pkt-${edge.id}`}
                      r={isLinked ? '3.8' : n8nGraph.layoutMode === 'compact' ? '2.7' : '3.3'}
                      cx="-20"
                      cy="-20"
                      className={`js-data-packet pointer-events-none transition-opacity duration-150 ${packetColor} ${
                        hasFocus && !isLinked ? 'opacity-20' : ''
                      }`}
                    />
                  );
                })}

                {/* Real n8n Nodes positioned from workflow JSON */}
                {n8nGraph.nodes.map((node) => {
                  const isHighlighted = activeN8nNode?.id === node.id;
                  const isPrimaryAi =
                    node.category === 'ai' && !node.type.toLowerCase().includes('lmchat');
                  const isAiSub =
                    node.category === 'ai' && node.type.toLowerCase().includes('lmchat');
                  const isUltraCompact = node.height <= 40;
                  const compact = node.height < 48;
                  const catStyle = N8N_CATEGORY_STYLES[node.category];
                  const nodeTitleChars = node.width >= 145 ? 19 : node.width >= 134 ? 17 : 15;
                  const nodeSubChars = node.width >= 145 ? 16 : 13;

                  return (
                    <g key={node.id} {...getN8nNodeA11yProps(node)}>
                      {/* Sequential execution wave highlight ring */}
                      <rect
                        x={node.x - 2.5}
                        y={node.y - 2.5}
                        width={node.width + 5}
                        height={node.height + 5}
                        rx={isUltraCompact ? '10' : '12'}
                        fill="none"
                        data-wave={node.wave}
                        opacity="0"
                        className="js-n8n-exec-ring pointer-events-none stroke-[#0F766E] dark:stroke-[#2DD4BF]"
                        strokeWidth="1.75"
                      />

                      {/* Main Node Surface */}
                      <rect
                        x={node.x}
                        y={node.y}
                        width={node.width}
                        height={node.height}
                        rx={isUltraCompact ? '8' : '10'}
                        className={`transition-colors duration-150 ${
                          isPrimaryAi
                            ? isHighlighted
                              ? serviceAccent.svgPrimaryBoxHover
                              : serviceAccent.svgPrimaryBox
                            : isHighlighted
                              ? catStyle.fillActive
                              : catStyle.fill
                        }`}
                        strokeWidth={isHighlighted ? '1.9' : '1.25'}
                        strokeDasharray={node.disabled ? '4 3' : undefined}
                      />

                      {/* Semantic Left Color Accent Strip (on non-solid nodes, like authentic n8n) */}
                      {!isPrimaryAi && (
                        <rect
                          x={node.x + 1.5}
                          y={node.y + (isUltraCompact ? 6 : 8)}
                          width="3"
                          height={Math.max(14, node.height - (isUltraCompact ? 12 : 16))}
                          rx="1.5"
                          className={`pointer-events-none ${catStyle.stripFill}`}
                        />
                      )}

                      {/* Input / Output n8n Ports */}
                      {node.category !== 'trigger' && !isAiSub && (
                        <circle
                          cx={node.x}
                          cy={node.y + node.height / 2}
                          r={isUltraCompact ? '2.5' : '3'}
                          className={`pointer-events-none fill-white dark:fill-[#181715] ${catStyle.portStroke}`}
                          strokeWidth="1.4"
                        />
                      )}
                      {!isAiSub && (
                        <circle
                          cx={node.x + node.width}
                          cy={node.y + node.height / 2}
                          r={isUltraCompact ? '2.5' : '3'}
                          className={`pointer-events-none ${
                            isHighlighted
                              ? `${catStyle.portActiveFill} stroke-white dark:stroke-[#181715]`
                              : `fill-white dark:fill-[#181715] ${catStyle.portStroke}`
                          }`}
                          strokeWidth="1.4"
                        />
                      )}
                      {isAiSub && (
                        <circle
                          cx={node.x + node.width / 2}
                          cy={node.y}
                          r={isUltraCompact ? '2.5' : '3'}
                          className={`pointer-events-none fill-white dark:fill-[#181715] ${catStyle.portStroke}`}
                          strokeWidth="1.4"
                        />
                      )}

                      {/* Node Title */}
                      <text
                        x={node.x + (isPrimaryAi ? 9.5 : 10.5)}
                        y={node.y + (isUltraCompact ? 15.5 : compact ? 17.5 : 22)}
                        className={`pointer-events-none font-semibold ${
                          isUltraCompact
                            ? 'text-[9.5px]'
                            : compact
                              ? 'text-[10.5px]'
                              : 'text-[11.5px]'
                        } ${isPrimaryAi ? 'fill-white' : 'fill-[#161513] dark:fill-[#F5F3EE]'}`}
                      >
                        {truncateSvgText(node.name, nodeTitleChars)}
                      </text>

                      {/* Real n8n Node Type Sublabel */}
                      <text
                        x={node.x + (isPrimaryAi ? 9.5 : 10.5)}
                        y={node.y + (isUltraCompact ? 29 : compact ? 31.5 : 39)}
                        className={`pointer-events-none font-mono ${
                          isUltraCompact
                            ? 'text-[8.5px]'
                            : compact
                              ? 'text-[9px]'
                              : 'text-[10px]'
                        } ${isPrimaryAi ? 'fill-white/85' : 'fill-[#6E6960] dark:fill-[#A8A298]'}`}
                      >
                        {truncateSvgText(node.shortType, nodeSubChars)}
                      </text>

                      {/* GSAP Wave Execution Completion Indicator (ms) */}
                      {!node.disabled && (
                        <g
                          data-wave={node.wave}
                          className="js-n8n-exec-badge pointer-events-none"
                        >
                          <circle
                            cx={node.x + node.width - (isUltraCompact ? 8.5 : 11)}
                            cy={node.y + (isUltraCompact ? 8.5 : 11)}
                            r={isUltraCompact ? '2.5' : '3.2'}
                            className={
                              isPrimaryAi
                                ? 'fill-[#99F6E4]'
                                : 'fill-[#0F766E] dark:fill-[#2DD4BF]'
                            }
                          />
                          {!compact && (
                            <text
                              x={node.x + node.width - 11}
                              y={node.y + node.height - 9}
                              textAnchor="end"
                              className={`font-mono text-[9px] tabular-nums ${
                                isPrimaryAi
                                  ? 'fill-white/85'
                                  : 'fill-[#0F766E] dark:fill-[#2DD4BF]'
                              }`}
                            >
                              {node.durationMs}ms
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            /* 3-STAGE ARCHITECTURAL BLUEPRINT SVG (BI / ETL / PLAN) WITH SEMANTIC ACCENTS */
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className="w-full h-auto max-h-[305px] select-none"
              role="group"
              aria-label={t(blueprint.title, locale)}
            >
              {/* Stage Column Headers */}
              <text
                x="16"
                y="22"
                className="fill-[#B45309] dark:fill-[#FBBF24] text-[11px] font-mono font-medium"
              >
                {t(blueprint.stageLabels.extract, locale)}
              </text>
              <text
                x="260"
                y="22"
                className={`${serviceAccent.svgPacketFill} text-[11px] font-mono font-semibold`}
              >
                {t(blueprint.stageLabels.transform, locale)}
              </text>
              <text
                x="514"
                y="22"
                className="fill-[#0F766E] dark:fill-[#2DD4BF] text-[11px] font-mono font-medium"
              >
                {t(blueprint.stageLabels.load, locale)}
              </text>

              {/* Subtle Vertical Stage Separators */}
              <line
                x1="224"
                y1="34"
                x2="224"
                y2="294"
                strokeDasharray="3 5"
                className="stroke-[#E5E0D6] dark:stroke-[#2A2825]"
                strokeWidth="1"
              />
              <line
                x1="478"
                y1="34"
                x2="478"
                y2="294"
                strokeDasharray="3 5"
                className="stroke-[#E5E0D6] dark:stroke-[#2A2825]"
                strokeWidth="1"
              />

              {/* Base Static Conduit Paths + Lineage-Aware Animated Flow Overlays */}
              {CONDUIT_PATHS.map((d, idx) => {
                const hasFocus = activeBlueprintNode !== null;
                const isLinked = highlightedConduits.has(idx);
                const dimClass = hasFocus && !isLinked ? 'opacity-25' : 'opacity-100';
                return (
                  <g
                    key={`conduit-${idx}`}
                    className={`transition-opacity duration-150 ${dimClass}`}
                  >
                    <path
                      d={d}
                      fill="none"
                      className={
                        isLinked
                          ? `js-conduit-path ${serviceAccent.svgStrokeBase}`
                          : 'js-conduit-path stroke-[#DDD6C9] dark:stroke-[#322F2A]'
                      }
                      strokeWidth={isLinked ? '2.25' : '1.75'}
                    />
                    <path
                      d={d}
                      fill="none"
                      strokeDasharray="5 11"
                      className={`js-conduit-dash ${serviceAccent.svgStrokeDash} ${
                        isLinked ? 'opacity-100' : 'opacity-60'
                      }`}
                      strokeWidth={isLinked ? '2.25' : '1.75'}
                      strokeLinecap="round"
                    />
                  </g>
                );
              })}

              {/* Bridge between Transform Node 1 & Transform Node 2 */}
              <path
                d={TRANSFORM_BRIDGE_PATH}
                fill="none"
                className={`${serviceAccent.svgStrokeDash} transition-opacity duration-150 ${
                  activeBlueprintNode && activeBlueprintNode.role !== 'transform'
                    ? 'opacity-30'
                    : 'opacity-100'
                }`}
                strokeWidth="1.75"
                strokeDasharray="3 4"
              />

              {/* GSAP Traveling Data Packets */}
              {CONDUIT_PATHS.map((_, idx) => {
                const hasFocus = activeBlueprintNode !== null;
                const isLinked = highlightedConduits.has(idx);
                return (
                  <circle
                    key={`pkt-${idx}`}
                    r={isLinked ? '4.2' : '3.4'}
                    cx="-20"
                    cy="-20"
                    className={`js-data-packet pointer-events-none ${serviceAccent.svgPacketFill} transition-opacity duration-150 ${
                      hasFocus && !isLinked ? 'opacity-20' : ''
                    }`}
                  />
                );
              })}

              {/* COLUMN 1: 3 Interactive Extract / Source Nodes (Amber semantic accent) */}
              {blueprint.sources.map((node, idx) => {
                const y = sourceY[idx];
                const isHighlighted = activeBlueprintNode?.id === node.id;
                return (
                  <g key={node.id} {...getBlueprintNodeA11yProps(node)}>
                    <rect
                      x="16"
                      y={y}
                      width="172"
                      height="60"
                      rx="10"
                      className={`transition-colors duration-150 ${
                        isHighlighted
                          ? N8N_CATEGORY_STYLES.trigger.fillActive
                          : N8N_CATEGORY_STYLES.trigger.fill
                      }`}
                      strokeWidth={isHighlighted ? '1.8' : '1.25'}
                    />
                    <rect
                      x="17.5"
                      y={y + 9}
                      width="3.2"
                      height="42"
                      rx="1.6"
                      className="pointer-events-none fill-[#D97706] dark:fill-[#FBBF24]"
                    />
                    <circle
                      cx="188"
                      cy={y + 30}
                      r="3.2"
                      className={`pointer-events-none ${
                        isHighlighted
                          ? 'fill-[#D97706] dark:fill-[#FBBF24] stroke-white dark:stroke-[#181715]'
                          : 'fill-white dark:fill-[#181715] stroke-[#D97706] dark:stroke-[#FBBF24]'
                      }`}
                      strokeWidth="1.5"
                    />
                    <text
                      x="30"
                      y={y + 26}
                      className="pointer-events-none fill-[#161513] dark:fill-[#F5F3EE] text-[12.5px] font-semibold"
                    >
                      {t(node.label, locale)}
                    </text>
                    <text
                      x="30"
                      y={y + 44}
                      className="pointer-events-none fill-[#6E6960] dark:fill-[#A8A298] text-[11px]"
                    >
                      {t(node.sublabel, locale)}
                    </text>
                  </g>
                );
              })}

              {/* COLUMN 2: 2 Interactive Transform / Engine Nodes (Service semantic accent) */}
              {blueprint.transforms.map((node, idx) => {
                const y = transformY[idx];
                const isPrimary = idx === 0;
                const isHighlighted = activeBlueprintNode?.id === node.id;
                return (
                  <g key={node.id} {...getBlueprintNodeA11yProps(node)}>
                    <rect
                      x="260"
                      y={y}
                      width="182"
                      height="72"
                      rx="12"
                      className={`transition-colors duration-150 ${
                        isPrimary
                          ? isHighlighted
                            ? serviceAccent.svgPrimaryBoxHover
                            : serviceAccent.svgPrimaryBox
                          : isHighlighted
                            ? serviceAccent.svgSecondaryBoxHover
                            : serviceAccent.svgSecondaryBox
                      }`}
                      strokeWidth={isHighlighted ? '2' : '1.25'}
                    />
                    <circle
                      cx="260"
                      cy={y + 36}
                      r="3.2"
                      className={`pointer-events-none fill-white dark:fill-[#181715] ${serviceAccent.svgStrokeDash}`}
                      strokeWidth="1.75"
                    />
                    <circle
                      cx="442"
                      cy={y + 36}
                      r="3.2"
                      className={`pointer-events-none fill-white dark:fill-[#181715] ${serviceAccent.svgStrokeDash}`}
                      strokeWidth="1.75"
                    />
                    <text
                      x="276"
                      y={y + 31}
                      className={`pointer-events-none ${
                        isPrimary
                          ? 'fill-white text-[13px] font-semibold'
                          : 'fill-[#161513] dark:fill-[#F5F3EE] text-[13px] font-semibold'
                      }`}
                    >
                      {t(node.label, locale)}
                    </text>
                    <text
                      x="276"
                      y={y + 51}
                      className={`pointer-events-none ${
                        isPrimary
                          ? 'fill-white/85 text-[11px]'
                          : 'fill-[#5C5852] dark:fill-[#A8A298] text-[11px]'
                      }`}
                    >
                      {t(node.sublabel, locale)}
                    </text>
                  </g>
                );
              })}

              {/* COLUMN 3: Interactive Output 1 — Live Mini BI Dashboard Preview Card (Emerald-Teal) */}
              <g {...getBlueprintNodeA11yProps(blueprint.outputs[0])}>
                <rect
                  x="514"
                  y="42"
                  width="170"
                  height="126"
                  rx="12"
                  className={`transition-colors duration-150 ${
                    activeBlueprintNode?.id === blueprint.outputs[0].id
                      ? N8N_CATEGORY_STYLES.action.fillActive
                      : N8N_CATEGORY_STYLES.action.fill
                  }`}
                  strokeWidth={activeBlueprintNode?.id === blueprint.outputs[0].id ? '1.8' : '1.25'}
                />
                <circle
                  cx="514"
                  cy="106"
                  r="3.2"
                  className="pointer-events-none fill-white dark:fill-[#181715] stroke-[#0F766E] dark:stroke-[#2DD4BF]"
                  strokeWidth="1.75"
                />
                <text
                  x="528"
                  y="66"
                  className="pointer-events-none fill-[#161513] dark:fill-[#F5F3EE] text-[12.5px] font-semibold"
                >
                  {t(blueprint.outputs[0].label, locale)}
                </text>
                <text
                  x="528"
                  y="83"
                  className="pointer-events-none fill-[#6E6960] dark:fill-[#A8A298] text-[10.5px]"
                >
                  {t(blueprint.outputs[0].sublabel, locale)}
                </text>

                {blueprint.sparkBars.map((val, idx) => {
                  const barH = Math.round((val / 100) * 54);
                  const bx = 530 + idx * 28;
                  const by = 152 - barH;
                  const isLast = idx === blueprint.sparkBars.length - 1;
                  return (
                    <rect
                      key={`spark-${idx}`}
                      x={bx}
                      y={by}
                      width="18"
                      height={barH}
                      rx="3.5"
                      className={`pointer-events-none ${
                        isLast
                          ? `js-pipe-bar ${serviceAccent.svgPacketFill}`
                          : 'js-pipe-bar fill-[#0F766E]/30 dark:fill-[#2DD4BF]/30'
                      }`}
                    />
                  );
                })}
              </g>

              {/* COLUMN 3: Interactive Output 2 — Automated Business Action / Alert */}
              <g {...getBlueprintNodeA11yProps(blueprint.outputs[1])}>
                <rect
                  x="514"
                  y="188"
                  width="170"
                  height="74"
                  rx="12"
                  className={`transition-colors duration-150 ${
                    activeBlueprintNode?.id === blueprint.outputs[1].id
                      ? N8N_CATEGORY_STYLES.action.fillActive
                      : N8N_CATEGORY_STYLES.action.fill
                  }`}
                  strokeWidth={activeBlueprintNode?.id === blueprint.outputs[1].id ? '1.8' : '1.25'}
                />
                <rect
                  x="515.5"
                  y="198"
                  width="3.2"
                  height="54"
                  rx="1.6"
                  className="pointer-events-none fill-[#0F766E] dark:fill-[#2DD4BF]"
                />
                <circle
                  cx="514"
                  cy="224"
                  r="3.2"
                  className="pointer-events-none fill-white dark:fill-[#181715] stroke-[#0F766E] dark:stroke-[#2DD4BF]"
                  strokeWidth="1.75"
                />
                <text
                  x="528"
                  y="218"
                  className="pointer-events-none fill-[#161513] dark:fill-[#F5F3EE] text-[12.5px] font-semibold"
                >
                  {t(blueprint.outputs[1].label, locale)}
                </text>
                <text
                  x="528"
                  y="238"
                  className="pointer-events-none fill-[#0F766E] dark:fill-[#2DD4BF] text-[11px] font-mono font-medium"
                >
                  {t(blueprint.outputs[1].sublabel, locale)}
                </text>
              </g>
            </svg>
          )}
        </div>

        {/* Bottom Interactive Node Tech Inspector (Strictly locked height — 0px layout shift on hover/click) */}
        <div
          data-testid="node-tech-inspector"
          aria-live="polite"
          className="shrink-0 h-[92px] sm:h-[82px] px-4 sm:px-5 py-2.5 border-t border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] flex flex-col justify-start gap-1 overflow-hidden"
        >
          {inspectorActive ? (
            <>
              <div className="flex items-center justify-between gap-2 flex-nowrap">
                <div className="flex items-center gap-x-1.5 text-xs min-w-0 overflow-hidden whitespace-nowrap">
                  <span className="font-semibold text-[#161513] dark:text-[#F5F3EE] shrink-0">
                    {inspectorActive.label}
                  </span>
                  <span aria-hidden="true" className="text-[#A8A298] shrink-0">
                    ·
                  </span>
                  <span
                    className={`font-mono text-[11px] font-medium shrink-0 ${
                      STAGE_BADGE_COLORS[inspectorActive.role]
                    }`}
                  >
                    {t(STAGE_BADGE_LABELS[inspectorActive.role], locale)}
                  </span>
                  <span aria-hidden="true" className="text-[#A8A298] shrink-0 hidden md:inline">
                    ·
                  </span>
                  <span className="font-mono text-[11px] text-[#6E6960] dark:text-[#A8A298] truncate hidden md:inline">
                    {inspectorActive.protocol}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {pinnedNodeId === inspectorActive.id && (
                    <button
                      type="button"
                      onClick={() => setPinnedState(null)}
                      aria-label={locale === 'uk' ? 'Зняти вибір вузла' : 'Clear selected node'}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6E6960] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>{locale === 'uk' ? 'Скинути' : 'Clear'}</span>
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onInspectService(activeServiceId)}
                    className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline underline-offset-4 whitespace-nowrap cursor-pointer ${serviceAccent.accentText}`}
                  >
                    <span>{locale === 'uk' ? 'Склад послуги' : 'Service Scope'}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-[#555049] dark:text-[#B5AFA5] leading-[1.35] line-clamp-2">
                {inspectorActive.explanation}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 flex-nowrap">
                <p className="text-xs font-medium text-[#161513] dark:text-[#EAE6DF] truncate min-w-0">
                  {isLiveProductionShowcase
                    ? getOverlayStepCaption(liveScreenshotStep, locale)
                    : isN8nMode
                      ? locale === 'uk'
                        ? 'Воркфлоу завантажено локально — натисніть «Запустити» або клікніть будь-який вузол для перегляду нотаток'
                        : 'Workflow loaded locally — press “Run” or click any node to inspect notes and connections'
                      : locale === 'uk'
                        ? 'Наведіть або клікніть етап схеми — щоб побачити, як він працює'
                        : 'Hover or click any pipeline step to inspect how it works'}
                </p>

                <button
                  type="button"
                  onClick={() => onInspectService(activeServiceId)}
                  className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] rounded ${serviceAccent.accentText}`}
                >
                  <span>{locale === 'uk' ? 'Склад послуги' : 'Service Scope'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              <p className="font-mono text-[11px] text-[#6E6960] dark:text-[#A8A298] leading-[1.35] truncate">
                {isLiveProductionShowcase
                  ? locale === 'uk'
                    ? '1С .xls · Google Drive · Google Sheets · OpenAI API · Telegram · клікніть вузол на схемі'
                    : '1C .xls · Google Drive · Google Sheets · OpenAI API · Telegram · click any node'
                  : isN8nMode
                    ? n8nGraph.uniqueTechStack.join(' · ')
                    : blueprint.stack.join(' · ')}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Real n8n Workflow JSON Upload / Paste Modal */}
      <N8nImportModal
        key={modalKey}
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        currentRawJson={n8nRawJson}
        isCustomLoaded={isCustomN8n}
        onApplyWorkflow={handleApplyN8nWorkflow}
      />
    </>
  );
}
