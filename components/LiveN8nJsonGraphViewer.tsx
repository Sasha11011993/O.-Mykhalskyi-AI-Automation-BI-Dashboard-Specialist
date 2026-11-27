'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { LayoutGrid, MoveHorizontal, Pause, Play, RotateCcw, Workflow, X } from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import {
  formatWorkflowSummary,
  parseAndLayoutN8nWorkflow,
  type LayoutN8nNode,
  type N8nLayoutMode,
  type N8nNodeCategory,
  type N8nRawWorkflow,
} from '@/lib/n8nWorkflowEngine';
import { t } from '@/lib/portfolioData';

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

interface LiveN8nJsonGraphViewerProps {
  workflow: N8nRawWorkflow;
  title?: string;
  compact?: boolean;
}

export default function LiveN8nJsonGraphViewer({
  workflow,
  title,
  compact = false,
}: LiveN8nJsonGraphViewerProps) {
  const { locale } = useThemeLocale();
  const [layoutMode, setLayoutMode] = useState<N8nLayoutMode>('compact');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [activeWave, setActiveWave] = useState<number>(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const traceRefs = useRef<Record<string, SVGPathElement | null>>({});
  const pulseRingRefs = useRef<Record<string, SVGRectElement | null>>({});
  const doneBadgeRefs = useRef<Record<string, SVGGElement | null>>({});
  const packetRefs = useRef<Record<string, SVGCircleElement | null>>({});
  const panScrollRef = useRef<HTMLDivElement>(null);

  const graph = useMemo(() => {
    const parsed = parseAndLayoutN8nWorkflow(workflow, layoutMode);
    return parsed.ok ? parsed.graph : null;
  }, [workflow, layoutMode]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setReducedMotion(mq.matches);
      if (mq.matches) setIsPlaying(false);
    };
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  // Build wave-by-wave GSAP Master Timeline over the auto-laid-out n8n JSON graph
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !graph || graph.nodes.length === 0) return;

    timelineRef.current?.kill();
    timelineRef.current = null;

    const ctx = gsap.context(() => {
      const edgeLengths = new Map<string, number>();
      for (const edge of graph.edges) {
        const el = traceRefs.current[edge.id];
        if (el) {
          const len = Math.max(1, el.getTotalLength());
          edgeLengths.set(edge.id, len);
          gsap.set(el, {
            strokeDasharray: len,
            strokeDashoffset: reducedMotion ? 0 : len,
            opacity: reducedMotion ? 0.85 : 0,
          });
        }
        const pkt = packetRefs.current[edge.id];
        if (pkt) gsap.set(pkt, { opacity: 0 });
      }

      for (const node of graph.nodes) {
        const ring = pulseRingRefs.current[node.id];
        const badge = doneBadgeRefs.current[node.id];
        if (ring) gsap.set(ring, { opacity: 0 });
        if (badge) {
          gsap.set(badge, {
            opacity: reducedMotion ? 1 : 0,
            scale: reducedMotion ? 1 : 0.4,
            transformOrigin: 'center center',
          });
        }
      }

      if (reducedMotion) {
        setActiveWave(graph.totalWaves);
        return;
      }

      const resetAll = () => {
        for (const edge of graph.edges) {
          const el = traceRefs.current[edge.id];
          const len = edgeLengths.get(edge.id) ?? 100;
          if (el) gsap.set(el, { strokeDashoffset: len, opacity: 0 });
          const pkt = packetRefs.current[edge.id];
          if (pkt) gsap.set(pkt, { opacity: 0 });
        }
        for (const node of graph.nodes) {
          const ring = pulseRingRefs.current[node.id];
          const badge = doneBadgeRefs.current[node.id];
          if (ring) gsap.set(ring, { opacity: 0 });
          if (badge) gsap.set(badge, { opacity: 0, scale: 0.4 });
        }
      };

      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 1.6,
        onRepeat: () => resetAll(),
      });

      tl.call(() => resetAll());

      const waves = Array.from(new Set(graph.nodes.map((n) => n.wave))).sort((a, b) => a - b);

      waves.forEach((waveNum, idx) => {
        const waveNodes = graph.nodes.filter((n) => n.wave === waveNum);
        const outgoingEdges = graph.edges.filter((e) =>
          waveNodes.some((n) => n.id === e.fromNodeId)
        );

        tl.call(() => setActiveWave(idx + 1));

        // 1. Activate nodes in this wave
        const waveLabel = `wave-node-${idx}`;
        tl.addLabel(waveLabel);
        for (const node of waveNodes) {
          const ring = pulseRingRefs.current[node.id];
          const badge = doneBadgeRefs.current[node.id];
          if (ring) {
            tl.fromTo(
              ring,
              { opacity: 0.95 },
              { opacity: 0, duration: 0.34, ease: 'power2.out' },
              waveLabel
            );
          }
          if (badge) {
            tl.to(
              badge,
              { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(2)' },
              `${waveLabel}+=0.14`
            );
          }
        }

        // 2. Travel glowing packets along outgoing edges of this wave
        if (outgoingEdges.length > 0) {
          const edgeLabel = `wave-edge-${idx}`;
          tl.addLabel(edgeLabel, `${waveLabel}+=0.22`);
          for (const edge of outgoingEdges) {
            const pathEl = traceRefs.current[edge.id];
            const pktEl = packetRefs.current[edge.id];
            const len = edgeLengths.get(edge.id) ?? 100;
            if (!pathEl) continue;

            const proxy = { p: 0 };
            tl.set(pathEl, { strokeDasharray: len, strokeDashoffset: len, opacity: 0.9 }, edgeLabel);
            tl.to(
              pathEl,
              { strokeDashoffset: 0, duration: 0.36, ease: 'power1.inOut' },
              edgeLabel
            );

            if (pktEl) {
              tl.set(pktEl, { opacity: 1 }, edgeLabel);
              tl.to(
                proxy,
                {
                  p: 1,
                  duration: 0.36,
                  ease: 'power1.inOut',
                  onUpdate: () => {
                    const pt = pathEl.getPointAtLength(proxy.p * len);
                    pktEl.setAttribute('cx', pt.x.toFixed(1));
                    pktEl.setAttribute('cy', pt.y.toFixed(1));
                  },
                },
                edgeLabel
              );
              tl.set(pktEl, { opacity: 0 }, `${edgeLabel}+=0.36`);
            }
          }
          tl.to({}, { duration: 0.38 }, edgeLabel);
        } else {
          tl.to({}, { duration: 0.36 }, waveLabel);
        }
      });

      timelineRef.current = tl;
      setIsPlaying(true);
    }, stage);

    return () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
      ctx.revert();
    };
  }, [graph, reducedMotion]);

  if (!graph) {
    return (
      <div className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] p-6 text-center text-xs text-[#6E6960] dark:text-[#A8A298]">
        {locale === 'uk' ? 'Не вдалося побудувати граф n8n.' : 'Could not parse n8n workflow graph.'}
      </div>
    );
  }

  const activeNodeId = hoveredNodeId ?? selectedNodeId;
  const activeNode: LayoutN8nNode | null = activeNodeId
    ? graph.nodes.find((n) => n.id === activeNodeId) ?? null
    : null;
  const highlightedEdges = new Set<string>(activeNode ? activeNode.edgeIds : []);
  const isPanorama = layoutMode === 'panorama' && graph.layoutMode === 'panorama';
  const panoramaSvgWidth = Math.round(
    (graph.viewBoxWidth / Math.max(1, graph.viewBoxHeight)) * 276
  );

  const handleTogglePlay = () => {
    const tl = timelineRef.current;
    if (!tl || reducedMotion) return;
    if (isPlaying) {
      tl.pause();
      setIsPlaying(false);
    } else {
      tl.play();
      setIsPlaying(true);
    }
  };

  const handleReplay = () => {
    const tl = timelineRef.current;
    if (!tl || reducedMotion) return;
    tl.restart(true);
    setIsPlaying(true);
  };

  return (
    <div
      ref={stageRef}
      data-testid="live-n8n-json-viewer"
      className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] overflow-hidden"
    >
      {/* Top Toolbar */}
      <div className="px-3.5 py-2 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-white/85 dark:bg-[#181715] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Workflow className="w-3.5 h-3.5 text-[#C84317] dark:text-[#FB8356] shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-[#161513] dark:text-[#F5F3EE] truncate">
            {title || graph.workflowName}
          </span>
          <span aria-hidden="true" className="text-[#C6BEB2] dark:text-[#44403A] hidden sm:inline">
            ·
          </span>
          <span className="font-mono text-[11px] text-[#6E6960] dark:text-[#A8A298] whitespace-nowrap hidden sm:inline tabular-nums">
            {formatWorkflowSummary(graph, locale)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!reducedMotion && (
            <span className="hidden md:inline font-mono text-[10.5px] text-[#0F766E] dark:text-[#2DD4BF] tabular-nums mr-1">
              {locale === 'uk'
                ? `Хвиля ${activeWave}/${graph.totalWaves}`
                : `Wave ${activeWave}/${graph.totalWaves}`}
            </span>
          )}

          {graph.supportsPanorama && !compact && (
            <div className="inline-flex items-center gap-1 mr-1">
              <button
                type="button"
                aria-pressed={layoutMode === 'compact'}
                onClick={() => setLayoutMode('compact')}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-mono font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  layoutMode === 'compact'
                    ? 'border-[#CC4518] dark:border-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356]'
                    : 'border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#6E6960] dark:text-[#A8A298]'
                }`}
              >
                <LayoutGrid className="w-3 h-3" aria-hidden="true" />
                <span>{locale === 'uk' ? 'Огляд' : 'Fit'}</span>
              </button>
              <button
                type="button"
                aria-pressed={layoutMode === 'panorama'}
                onClick={() => setLayoutMode('panorama')}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-mono font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  layoutMode === 'panorama'
                    ? 'border-[#CC4518] dark:border-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356]'
                    : 'border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#6E6960] dark:text-[#A8A298]'
                }`}
              >
                <MoveHorizontal className="w-3 h-3" aria-hidden="true" />
                <span>{locale === 'uk' ? '1:1' : '1:1'}</span>
              </button>
            </div>
          )}

          {!reducedMotion && (
            <>
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label={isPlaying ? 'Пауза' : 'Старт'}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-medium rounded border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#161513] dark:text-[#F5F3EE] whitespace-nowrap cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <Play className="w-3 h-3" aria-hidden="true" />
                )}
                <span>{isPlaying ? (locale === 'uk' ? 'Пауза' : 'Pause') : locale === 'uk' ? 'Старт' : 'Play'}</span>
              </button>
              <button
                type="button"
                onClick={handleReplay}
                aria-label={locale === 'uk' ? 'Повторити' : 'Replay'}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-medium rounded border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Animated SVG Graph Stage */}
      <div
        ref={panScrollRef}
        className={`px-3 py-2.5 ${isPanorama ? 'overflow-x-auto overflow-y-hidden' : ''}`}
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(120,113,108,0.17) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        <svg
          viewBox={`0 0 ${graph.viewBoxWidth} ${graph.viewBoxHeight}`}
          width={isPanorama ? panoramaSvgWidth : undefined}
          height={isPanorama ? 276 : undefined}
          className={
            isPanorama
              ? 'block shrink-0 min-w-full select-none'
              : `w-full h-auto ${compact ? 'max-h-[260px]' : 'max-h-[340px]'} select-none`
          }
          role="group"
          aria-label={`n8n workflow: ${graph.workflowName}`}
        >
          {/* Base Gray Connections + Live Animated Traces */}
          {graph.edges.map((edge) => {
            const hasFocus = activeNode !== null;
            const isLinked = highlightedEdges.has(edge.id);
            const dimClass = hasFocus && !isLinked ? 'opacity-20' : 'opacity-100';
            const traceColor = edge.isLoopBack
              ? '#4338CA'
              : edge.branchLabel === 'false' || edge.branchLabel === 'done'
                ? '#0F766E'
                : '#CC4518';

            return (
              <g key={edge.id} className={`transition-opacity duration-150 ${dimClass}`}>
                <path
                  d={edge.pathD}
                  fill="none"
                  className={
                    edge.isLoopBack
                      ? 'stroke-[#4338CA]/35 dark:stroke-[#818CF8]/35'
                      : 'stroke-[#D2C9BC] dark:stroke-[#38342F]'
                  }
                  strokeWidth="1.6"
                  strokeDasharray={edge.isLoopBack ? '4 4' : undefined}
                />
                <path
                  ref={(el) => {
                    traceRefs.current[edge.id] = el;
                  }}
                  d={edge.pathD}
                  fill="none"
                  stroke={traceColor}
                  strokeWidth={isLinked ? '2.6' : '2.2'}
                  strokeLinecap="round"
                  opacity={0}
                />
                <circle
                  ref={(el) => {
                    packetRefs.current[edge.id] = el;
                  }}
                  cx={edge.startX}
                  cy={edge.startY}
                  r="4"
                  fill={traceColor}
                  stroke="#FFFFFF"
                  strokeWidth="1.4"
                  opacity={0}
                  className="pointer-events-none"
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

          {/* Nodes + Active Pulse Ring + Emerald Checkmark */}
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
                onClick={() => setSelectedNodeId((prev) => (prev === node.id ? null : node.id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <rect
                  ref={(el) => {
                    pulseRingRefs.current[node.id] = el;
                  }}
                  x={node.x - 3.5}
                  y={node.y - 3.5}
                  width={node.width + 7}
                  height={node.height + 7}
                  rx={isUltraCompact ? '10' : '12'}
                  fill="none"
                  stroke="#CC4518"
                  strokeWidth="2.4"
                  opacity={0}
                  className="pointer-events-none"
                />
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

                {/* Completed wave checkmark */}
                <g
                  ref={(el) => {
                    doneBadgeRefs.current[node.id] = el;
                  }}
                  transform={`translate(${node.x + node.width - 5}, ${node.y + 5})`}
                  opacity={0}
                  className="pointer-events-none"
                >
                  <circle r="6" fill="#0F766E" stroke="#FFFFFF" strokeWidth="1.5" />
                  <polyline
                    points="-2.3,0.1 -0.6,1.8 2.6,-1.7"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Node Inspector Footer */}
      {!compact && (
        <div className="px-4 py-2.5 border-t border-[#E5E0D6] dark:border-[#2A2825] bg-white/85 dark:bg-[#181715] min-h-[54px] flex items-center justify-between gap-3">
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
          ) : (
            <p className="text-xs text-[#5C5852] dark:text-[#A8A298]">
              {locale === 'uk'
                ? 'Наведіть або клікніть будь-який вузол n8n, щоб переглянути його роль та зв’язки.'
                : 'Hover or click any n8n node above to inspect its role and connections.'}
            </p>
          )}
          {selectedNodeId && (
            <button
              type="button"
              onClick={() => setSelectedNodeId(null)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6E6960] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] shrink-0 cursor-pointer"
            >
              <span>{locale === 'uk' ? 'Скинути' : 'Clear'}</span>
              <X className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
