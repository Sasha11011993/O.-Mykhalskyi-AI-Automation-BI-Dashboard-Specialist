'use client';

import React, { useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { LayoutGrid, MoveHorizontal, Play, Workflow, X } from 'lucide-react';
import LiveN8nScreenshotOverlay from '@/components/LiveN8nScreenshotOverlay';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import {
  PRODUCTION_DEBT_CONTROL_WORKFLOW,
  formatWorkflowSummary,
  parseAndLayoutN8nWorkflow,
  type LayoutN8nNode,
  type N8nLayoutMode,
  type N8nNodeCategory,
  type N8nRawWorkflow,
} from '@/lib/n8nWorkflowEngine';
import {
  getOverlayStepCaption,
  type ExecutionStep,
} from '@/lib/n8nScreenshotOverlay';
import { t } from '@/lib/portfolioData';

export type CaseN8nPresetId = 'debt-control-15';

export function getCaseN8nWorkflowByPreset(preset: CaseN8nPresetId): N8nRawWorkflow {
  switch (preset) {
    case 'debt-control-15':
    default:
      return PRODUCTION_DEBT_CONTROL_WORKFLOW;
  }
}

const CATEGORY_STYLES: Record<
  N8nNodeCategory,
  {
    fill: string;
    fillActive: string;
    stripFill: string;
    portStroke: string;
  }
> = {
  trigger: {
    fill: 'fill-[#FFFDF8] dark:fill-[#1F1C15] stroke-[#E6D5B8] dark:stroke-[#4A3B20]',
    fillActive: 'fill-[#FEF7E6] dark:fill-[#2B2416] stroke-[#D97706] dark:stroke-[#FBBF24]',
    stripFill: 'fill-[#D97706] dark:fill-[#FBBF24]',
    portStroke: 'stroke-[#D97706] dark:stroke-[#FBBF24]',
  },
  ai: {
    fill: 'fill-[#CC4518] dark:fill-[#DC5324] stroke-[#B23A12] dark:stroke-[#FB8356]',
    fillActive: 'fill-[#B23A12] dark:fill-[#EA6233] stroke-[#7C2D12] dark:stroke-[#FDBA74]',
    stripFill: 'fill-white/80',
    portStroke: 'stroke-[#CC4518] dark:stroke-[#FB8356]',
  },
  logic: {
    fill: 'fill-[#F6F7FF] dark:fill-[#191B2B] stroke-[#CED3F5] dark:stroke-[#323866]',
    fillActive: 'fill-[#ECEEFF] dark:fill-[#212540] stroke-[#4338CA] dark:stroke-[#818CF8]',
    stripFill: 'fill-[#4338CA] dark:fill-[#818CF8]',
    portStroke: 'stroke-[#4338CA] dark:stroke-[#818CF8]',
  },
  action: {
    fill: 'fill-[#F3FBF8] dark:fill-[#12221E] stroke-[#B7E4D8] dark:stroke-[#1E4F49]',
    fillActive: 'fill-[#E5F7F1] dark:fill-[#172E28] stroke-[#0F766E] dark:stroke-[#2DD4BF]',
    stripFill: 'fill-[#0F766E] dark:fill-[#2DD4BF]',
    portStroke: 'stroke-[#0F766E] dark:stroke-[#2DD4BF]',
  },
};

function truncateLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(4, maxChars - 1)).trimEnd()}…`;
}

type CaseViewerMode = N8nLayoutMode | 'screenshot';

interface CaseN8nWorkflowViewerProps {
  preset: CaseN8nPresetId;
  variant: 'thumbnail' | 'interactive';
  screenshotSrc?: string;
  title?: string;
}

export default function CaseN8nWorkflowViewer({
  preset,
  variant,
  screenshotSrc,
  title,
}: CaseN8nWorkflowViewerProps) {
  const { locale } = useThemeLocale();
  const [viewMode, setViewMode] = useState<CaseViewerMode>(
    variant === 'interactive' && screenshotSrc ? 'screenshot' : 'compact'
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [liveStep, setLiveStep] = useState<ExecutionStep | null>(null);

  const panScrollRef = useRef<HTMLDivElement>(null);
  const dragPanRef = useRef<{
    active: boolean;
    startX: number;
    scrollLeft: number;
    moved: boolean;
  }>({ active: false, startX: 0, scrollLeft: 0, moved: false });

  const workflow = useMemo(() => getCaseN8nWorkflowByPreset(preset), [preset]);
  const graph = useMemo(() => {
    const mode: N8nLayoutMode =
      variant === 'thumbnail' || viewMode === 'screenshot' ? 'compact' : viewMode;
    const parsed = parseAndLayoutN8nWorkflow(workflow, mode);
    return parsed.ok ? parsed.graph : null;
  }, [workflow, variant, viewMode]);

  if (!graph) return null;

  const isScreenshotMode = variant === 'interactive' && viewMode === 'screenshot' && Boolean(screenshotSrc);
  const activeNodeId = hoveredNodeId ?? selectedNodeId;
  const activeNode: LayoutN8nNode | null =
    variant === 'interactive' && activeNodeId
      ? graph.nodes.find((n) => n.id === activeNodeId) ?? null
      : null;

  const highlightedEdges = new Set<string>(activeNode ? activeNode.edgeIds : []);
  const isPanorama = variant === 'interactive' && viewMode === 'panorama' && graph.layoutMode === 'panorama';
  const panoramaSvgWidth = Math.round(
    (graph.viewBoxWidth / Math.max(1, graph.viewBoxHeight)) * 276
  );

  const handlePanPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = panScrollRef.current;
    if (!el || !isPanorama) return;
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

  // Compact architectural mini-preview inside Case Card thumbnail
  if (variant === 'thumbnail') {
    return (
      <div
        data-testid={`case-n8n-thumbnail-${preset}`}
        className="absolute inset-0 flex flex-col justify-between bg-[#FAF8F4] dark:bg-[#141311] px-3 py-2.5 select-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(120,113,108,0.2) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        <div className="flex items-center justify-between gap-2 text-[10px] font-mono font-medium text-[#5C5852] dark:text-[#A8A298] whitespace-nowrap">
          <span className="inline-flex items-center gap-1 text-[#C84317] dark:text-[#FB8356] font-semibold shrink-0">
            <Workflow className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>n8n JSON</span>
          </span>
          <span className="tabular-nums shrink-0">
            {locale === 'uk' ? `${graph.nodes.length} вузлів` : `${graph.nodes.length} nodes`}
          </span>
        </div>

        {screenshotSrc ? (
          <div className="flex-1 min-h-0 flex items-center justify-center my-1.5">
            <div className="w-full rounded-lg border border-[#E2DDD2] dark:border-[#2E2C28] bg-[#F5F5F5] p-1 shadow-2xs overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]">
              <Image
                src={screenshotSrc}
                alt={
                  title ||
                  (locale === 'uk'
                    ? 'Скріншот реального n8n воркфлоу'
                    : 'Real production n8n workflow screenshot')
                }
                width={1191}
                height={547}
                referrerPolicy="no-referrer"
                className="w-full h-auto rounded-sm block"
              />
            </div>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${graph.viewBoxWidth} ${graph.viewBoxHeight}`}
            className="w-full h-auto flex-1 min-h-0"
            aria-hidden="true"
          >
            {graph.edges.map((edge) => (
              <path
                key={edge.id}
                d={edge.pathD}
                fill="none"
                className={
                  edge.isLoopBack
                    ? 'stroke-[#4338CA]/80 dark:stroke-[#818CF8]/85'
                    : 'stroke-[#BEB5A6] dark:stroke-[#46413A]'
                }
                strokeWidth="3.2"
                strokeDasharray={edge.isLoopBack ? '8 6' : undefined}
              />
            ))}

            {graph.nodes.map((node) => {
              const cat = CATEGORY_STYLES[node.category];
              const isAi = node.category === 'ai';
              return (
                <g key={node.id}>
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rx="8"
                    className={cat.fill}
                    strokeWidth="2.8"
                  />
                  {!isAi && (
                    <rect
                      x={node.x + 2.5}
                      y={node.y + 6}
                      width="6"
                      height={Math.max(12, node.height - 12)}
                      rx="3"
                      className={cat.stripFill}
                    />
                  )}
                  <rect
                    x={node.x + (isAi ? 12 : 16)}
                    y={node.y + 11}
                    width={Math.round(node.width * 0.56)}
                    height="5.5"
                    rx="2.5"
                    className={
                      isAi
                        ? 'fill-white/95'
                        : 'fill-[#161513]/70 dark:fill-[#F5F3EE]/75'
                    }
                  />
                  <rect
                    x={node.x + (isAi ? 12 : 16)}
                    y={node.y + 22}
                    width={Math.round(node.width * 0.36)}
                    height="4.5"
                    rx="2"
                    className={
                      isAi
                        ? 'fill-white/65'
                        : 'fill-[#6E6960]/55 dark:fill-[#A8A298]/55'
                    }
                  />
                </g>
              );
            })}
          </svg>
        )}

        <div className="flex items-center justify-between gap-2 text-[9.5px] font-mono text-[#6E6960] dark:text-[#918A7E] whitespace-nowrap">
          <span className="truncate">1С · Sheets · OpenAI</span>
          <span className="text-[#0F766E] dark:text-[#2DD4BF] font-semibold shrink-0">
            {locale === 'uk' ? 'Жива схема' : 'Live flow'}
          </span>
        </div>
      </div>
    );
  }

  // Full Interactive n8n Workflow Viewer inside Case Study Detail Modal
  return (
    <div
      data-testid={`case-n8n-interactive-${preset}`}
      className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] overflow-hidden"
    >
      {/* Top Bar: Workflow Title + Fit / 1:1 Panorama Toggle */}
      <div className="px-4 py-2.5 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-white/80 dark:bg-[#181715] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Workflow className="w-3.5 h-3.5 text-[#C84317] dark:text-[#FB8356] shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-[#161513] dark:text-[#F5F3EE] truncate">
            {locale === 'uk' ? 'Інтерактивна схема n8n (з реального JSON)' : 'Interactive n8n Workflow (from production JSON)'}
          </span>
          <span aria-hidden="true" className="text-[#C6BEB2] dark:text-[#44403A] hidden sm:inline">
            ·
          </span>
          <span className="font-mono text-[11px] text-[#6E6960] dark:text-[#A8A298] whitespace-nowrap hidden sm:inline">
            {formatWorkflowSummary(graph, locale)}
          </span>
        </div>

        <div
          role="group"
          aria-label={locale === 'uk' ? 'Режим перегляду схеми' : 'Workflow view mode'}
          className="inline-flex items-center gap-1 shrink-0"
        >
          {screenshotSrc && (
            <button
              type="button"
              data-testid="case-n8n-mode-screenshot"
              aria-pressed={viewMode === 'screenshot'}
              onClick={() => setViewMode('screenshot')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-mono font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'screenshot'
                  ? 'border-[#CC4518] dark:border-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356]'
                  : 'border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#6E6960] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
              }`}
            >
              <Play className="w-3 h-3" aria-hidden="true" />
              <span>{locale === 'uk' ? 'Живий скріншот' : 'Live Screenshot'}</span>
            </button>
          )}
          <button
            type="button"
            data-testid="case-n8n-mode-compact"
            aria-pressed={viewMode === 'compact'}
            onClick={() => setViewMode('compact')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-mono font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'compact'
                ? 'border-[#CC4518] dark:border-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356]'
                : 'border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#6E6960] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
            }`}
          >
            <LayoutGrid className="w-3 h-3" aria-hidden="true" />
            <span>{locale === 'uk' ? 'Огляд' : 'Fit'}</span>
          </button>
          <button
            type="button"
            data-testid="case-n8n-mode-panorama"
            aria-pressed={viewMode === 'panorama'}
            onClick={() => setViewMode('panorama')}
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-mono font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'panorama'
                ? 'border-[#CC4518] dark:border-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356]'
                : 'border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#6E6960] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
            }`}
          >
            <MoveHorizontal className="w-3 h-3" aria-hidden="true" />
            <span>{locale === 'uk' ? '1:1 Панорама' : '1:1 Pan'}</span>
          </button>
        </div>
      </div>

      {/* Live GSAP SVG Overlay over Real n8n Screenshot OR Interactive SVG Canvas */}
      {isScreenshotMode && screenshotSrc ? (
        <LiveN8nScreenshotOverlay
          screenshotSrc={screenshotSrc}
          title={title}
          graph={graph}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          onSelectNode={setSelectedNodeId}
          onHoverNode={setHoveredNodeId}
          onActiveStepChange={setLiveStep}
        />
      ) : (
        <div
          ref={panScrollRef}
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
          onPointerUp={handlePanPointerEnd}
          onPointerCancel={handlePanPointerEnd}
          onPointerLeave={handlePanPointerEnd}
          className={`px-3 py-2.5 ${
            isPanorama
              ? 'overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing'
              : ''
          }`}
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(120,113,108,0.17) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        >
        <svg
          data-testid="case-n8n-modal-svg"
          data-layout-mode={graph.layoutMode}
          viewBox={`0 0 ${graph.viewBoxWidth} ${graph.viewBoxHeight}`}
          width={isPanorama ? panoramaSvgWidth : undefined}
          height={isPanorama ? 276 : undefined}
          className={
            isPanorama
              ? 'block shrink-0 min-w-full select-none'
              : 'w-full h-auto max-h-[340px] select-none'
          }
          role="group"
          aria-label={`n8n workflow: ${graph.workflowName}`}
        >
          {/* Connections */}
          {graph.edges.map((edge) => {
            const hasFocus = activeNode !== null;
            const isLinked = highlightedEdges.has(edge.id);
            const dimClass = hasFocus && !isLinked ? 'opacity-20' : 'opacity-100';

            return (
              <g key={edge.id} className={`transition-opacity duration-150 ${dimClass}`}>
                <path
                  d={edge.pathD}
                  fill="none"
                  className={
                    isLinked
                      ? 'stroke-[#CC4518] dark:stroke-[#FB8356]'
                      : edge.isLoopBack
                        ? 'stroke-[#4338CA]/75 dark:stroke-[#818CF8]/80'
                        : 'stroke-[#C9C1B4] dark:stroke-[#3D3933]'
                  }
                  strokeWidth={isLinked ? '2.2' : '1.55'}
                  strokeDasharray={edge.isLoopBack ? '4 4' : undefined}
                />
                {edge.branchLabel && (
                  <text
                    x={edge.labelX}
                    y={edge.labelY}
                    textAnchor="middle"
                    paintOrder="stroke"
                    className={`pointer-events-none text-[9px] font-mono font-semibold stroke-[#FAF8F4] dark:stroke-[#141311] stroke-[3px] ${
                      edge.branchLabel === 'true' || edge.branchLabel === 'done'
                        ? 'fill-[#0F766E] dark:fill-[#2DD4BF]'
                        : edge.branchLabel === 'false'
                          ? 'fill-[#B45309] dark:fill-[#FBBF24]'
                          : 'fill-[#4338CA] dark:fill-[#818CF8]'
                    }`}
                  >
                    {edge.branchLabel}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {graph.nodes.map((node) => {
            const isHighlighted = activeNode?.id === node.id;
            const isAi = node.category === 'ai';
            const isUltraCompact = node.height <= 40;
            const cat = CATEGORY_STYLES[node.category];
            const titleChars = node.width >= 145 ? 19 : 15;
            const subChars = node.width >= 145 ? 16 : 13;

            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedNodeId === node.id}
                aria-label={`${node.name} — ${node.shortType}`}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId((prev) => (prev === node.id ? null : prev))}
                onFocus={() => setHoveredNodeId(node.id)}
                onBlur={() => setHoveredNodeId((prev) => (prev === node.id ? null : prev))}
                onClick={() => {
                  if (dragPanRef.current.moved) {
                    dragPanRef.current.moved = false;
                    return;
                  }
                  setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={isUltraCompact ? '8' : '10'}
                  className={`transition-colors duration-150 ${
                    isHighlighted ? cat.fillActive : cat.fill
                  }`}
                  strokeWidth={isHighlighted ? '1.9' : '1.25'}
                />
                {!isAi && (
                  <rect
                    x={node.x + 1.5}
                    y={node.y + (isUltraCompact ? 6 : 8)}
                    width="3"
                    height={Math.max(14, node.height - (isUltraCompact ? 12 : 16))}
                    rx="1.5"
                    className={`pointer-events-none ${cat.stripFill}`}
                  />
                )}
                {node.category !== 'trigger' && (
                  <circle
                    cx={node.x}
                    cy={node.y + node.height / 2}
                    r={isUltraCompact ? '2.5' : '3'}
                    className={`pointer-events-none fill-white dark:fill-[#181715] ${cat.portStroke}`}
                    strokeWidth="1.4"
                  />
                )}
                <circle
                  cx={node.x + node.width}
                  cy={node.y + node.height / 2}
                  r={isUltraCompact ? '2.5' : '3'}
                  className={`pointer-events-none fill-white dark:fill-[#181715] ${cat.portStroke}`}
                  strokeWidth="1.4"
                />
                <text
                  x={node.x + (isAi ? 9.5 : 10.5)}
                  y={node.y + (isUltraCompact ? 15.5 : 22)}
                  className={`pointer-events-none font-semibold ${
                    isUltraCompact ? 'text-[9.5px]' : 'text-[11.5px]'
                  } ${isAi ? 'fill-white' : 'fill-[#161513] dark:fill-[#F5F3EE]'}`}
                >
                  {truncateLabel(node.name, titleChars)}
                </text>
                <text
                  x={node.x + (isAi ? 9.5 : 10.5)}
                  y={node.y + (isUltraCompact ? 29 : 39)}
                  className={`pointer-events-none font-mono ${
                    isUltraCompact ? 'text-[8.5px]' : 'text-[10px]'
                  } ${isAi ? 'fill-white/85' : 'fill-[#6E6960] dark:fill-[#A8A298]'}`}
                >
                  {truncateLabel(node.shortType, subChars)}
                </text>
              </g>
            );
          })}
        </svg>
        </div>
      )}

      {/* Interactive Node Notes Inspector Strip */}
      <div
        data-testid="case-n8n-node-inspector"
        className="px-4 py-2.5 border-t border-[#E5E0D6] dark:border-[#2A2825] bg-white/85 dark:bg-[#181715] min-h-[58px] flex items-center justify-between gap-3"
      >
        {activeNode ? (
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[#161513] dark:text-[#F5F3EE] truncate">
                {activeNode.name}
              </span>
              <span aria-hidden="true" className="text-[#A8A298]">
                ·
              </span>
              <span className="font-mono text-[11px] text-[#0F766E] dark:text-[#2DD4BF] shrink-0">
                {t(activeNode.protocol, locale)}
              </span>
            </div>
            <p className="text-xs text-[#555049] dark:text-[#B5AFA5] leading-snug">
              {t(activeNode.explanation, locale)}
            </p>
          </div>
        ) : isScreenshotMode ? (
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[#161513] dark:text-[#F5F3EE] truncate">
                {liveStep
                  ? graph.nodes.find((n) => n.id === liveStep.nodeId)?.name ??
                    (locale === 'uk' ? 'Живе виконання n8n' : 'Live n8n execution')
                  : locale === 'uk'
                    ? 'Живе виконання n8n'
                    : 'Live n8n execution'}
              </span>
              <span aria-hidden="true" className="hidden sm:inline text-[#A8A298]">
                ·
              </span>
              <span className="hidden sm:inline font-mono text-[11px] text-[#6E6960] dark:text-[#A8A298] shrink-0">
                {locale === 'uk' ? 'Клікніть вузол на скріншоті для нотатки' : 'Click any node on screenshot to inspect'}
              </span>
            </div>
            <p className="text-xs text-[#555049] dark:text-[#B5AFA5] leading-snug">
              {getOverlayStepCaption(liveStep, locale)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#5C5852] dark:text-[#A8A298]">
            {locale === 'uk'
              ? 'Клікніть або наведіть на будь-який із 15 вузлів схеми, щоб прочитати технічні нотатки та перевірити зв’язки.'
              : 'Hover or click any of the 15 workflow nodes above to inspect its architecture notes and lineage.'}
          </p>
        )}

        {selectedNodeId && (
          <button
            type="button"
            data-testid="case-n8n-clear-node"
            onClick={() => setSelectedNodeId(null)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6E6960] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] shrink-0 cursor-pointer"
          >
            <span>{locale === 'uk' ? 'Скинути' : 'Clear'}</span>
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
