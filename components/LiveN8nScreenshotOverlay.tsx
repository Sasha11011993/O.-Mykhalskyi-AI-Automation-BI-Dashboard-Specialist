'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import gsap from 'gsap';
import { CheckCircle2, Pause, Play, RotateCcw, ShieldAlert } from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import type { ParsedN8nGraph } from '@/lib/n8nWorkflowEngine';
import {
  DEBT_CONTROL_SCREENSHOT_SPEC,
  buildScreenshotExecutionPlan,
  type ExecutionStep,
  type OverlayBranch,
  type OverlayWireKind,
} from '@/lib/n8nScreenshotOverlay';

interface LiveN8nScreenshotOverlayProps {
  screenshotSrc: string;
  title?: string;
  graph: ParsedN8nGraph;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onHoverNode: (nodeId: string | null) => void;
  onActiveStepChange?: (step: ExecutionStep | null) => void;
  compact?: boolean;
  externalReplayNonce?: number;
}

function getWireStrokeColor(kind: OverlayWireKind): string {
  switch (kind) {
    case 'loop-out':
    case 'loop-back':
      return '#4338CA';
    case 'done-out':
    case 'branch-false':
      return '#0F766E';
    case 'branch-true':
    case 'return-rail':
    case 'trigger':
    case 'main':
    default:
      return '#CC4518';
  }
}

export default function LiveN8nScreenshotOverlay({
  screenshotSrc,
  title,
  graph,
  selectedNodeId,
  hoveredNodeId,
  onSelectNode,
  onHoverNode,
  onActiveStepChange,
  compact = false,
  externalReplayNonce = 0,
}: LiveN8nScreenshotOverlayProps) {
  const { locale } = useThemeLocale();
  const [branch, setBranch] = useState<OverlayBranch>('anomaly');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [replayNonce, setReplayNonce] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(1);
  const [activeLoopIter, setActiveLoopIter] = useState<1 | 2 | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const wirePathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const activeRingRefs = useRef<Record<string, SVGRectElement | null>>({});
  const doneBorderRefs = useRef<Record<string, SVGRectElement | null>>({});
  const doneBadgeRefs = useRef<Record<string, SVGGElement | null>>({});
  const packetGroupRef = useRef<SVGGElement | null>(null);
  const packetCoreRef = useRef<SVGCircleElement | null>(null);
  const packetHaloRef = useRef<SVGCircleElement | null>(null);
  const onActiveStepChangeRef = useRef(onActiveStepChange);

  useEffect(() => {
    onActiveStepChangeRef.current = onActiveStepChange;
  }, [onActiveStepChange]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      const prefersReduced = mq.matches;
      setReducedMotion(prefersReduced);
      if (prefersReduced) {
        setIsPlaying(false);
      }
    };
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  const plan = useMemo(() => buildScreenshotExecutionPlan(branch), [branch]);

  const nodeLookup = useMemo(() => {
    const map = new Map<string, { name: string; shortType: string }>();
    for (const n of graph.nodes) {
      map.set(n.id, { name: n.name, shortType: n.shortType });
    }
    return map;
  }, [graph.nodes]);

  const activeWireSet = useMemo(() => new Set(plan.activeWireIds), [plan.activeWireIds]);
  const skippedNodeSet = useMemo(() => new Set(plan.skippedNodeIds), [plan.skippedNodeIds]);
  const executedNodeSet = useMemo(() => new Set(plan.executedNodeIds), [plan.executedNodeIds]);

  // Build and manage GSAP Master Timeline
  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return;

    timelineRef.current?.kill();
    timelineRef.current = null;

    const ctx = gsap.context(() => {
      const allWireIds = DEBT_CONTROL_SCREENSHOT_SPEC.wires.map((w) => w.id);
      const allNodeIds = DEBT_CONTROL_SCREENSHOT_SPEC.nodes.map((n) => n.nodeId);

      // Measure wire path lengths once per build
      const wireLengths = new Map<string, number>();
      for (const wireId of allWireIds) {
        const el = wirePathRefs.current[wireId];
        if (el) {
          const len = Math.max(1, el.getTotalLength());
          wireLengths.set(wireId, len);
          gsap.set(el, {
            strokeDasharray: len,
            strokeDashoffset: reducedMotion && activeWireSet.has(wireId) ? 0 : len,
            opacity: reducedMotion && activeWireSet.has(wireId) ? 0.92 : 0,
          });
        }
      }

      // Initial node FX posture (static completed when prefers-reduced-motion)
      for (const nodeId of allNodeIds) {
        const ringEl = activeRingRefs.current[nodeId];
        const borderEl = doneBorderRefs.current[nodeId];
        const badgeEl = doneBadgeRefs.current[nodeId];
        const isDoneStatic = reducedMotion && executedNodeSet.has(nodeId);

        if (ringEl) gsap.set(ringEl, { opacity: 0 });
        if (borderEl) gsap.set(borderEl, { opacity: isDoneStatic ? 0.9 : 0 });
        if (badgeEl) {
          gsap.set(badgeEl, {
            opacity: isDoneStatic ? 1 : 0,
            scale: isDoneStatic ? 1 : 0.45,
            transformOrigin: 'center center',
          });
        }
      }

      if (packetGroupRef.current) {
        gsap.set(packetGroupRef.current, { opacity: 0 });
      }

      if (reducedMotion) {
        const finalStep = plan.steps[plan.steps.length - 1] ?? null;
        setActiveStepIndex(plan.steps.length);
        setActiveLoopIter(null);
        onActiveStepChangeRef.current?.(finalStep);
        return;
      }

      const resetVisualState = () => {
        for (const wireId of allWireIds) {
          const el = wirePathRefs.current[wireId];
          const len = wireLengths.get(wireId) ?? 100;
          if (el) {
            gsap.set(el, { strokeDashoffset: len, opacity: 0 });
          }
        }
        for (const nodeId of allNodeIds) {
          const ringEl = activeRingRefs.current[nodeId];
          const borderEl = doneBorderRefs.current[nodeId];
          const badgeEl = doneBadgeRefs.current[nodeId];
          if (ringEl) gsap.set(ringEl, { opacity: 0 });
          if (borderEl) gsap.set(borderEl, { opacity: 0 });
          if (badgeEl) gsap.set(badgeEl, { opacity: 0, scale: 0.45 });
        }
        if (packetGroupRef.current) {
          gsap.set(packetGroupRef.current, { opacity: 0 });
        }
      };

      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 1.8,
        onRepeat: () => {
          resetVisualState();
        },
      });

      tl.call(() => {
        resetVisualState();
      });

      for (const step of plan.steps) {
        const wireSpec = step.wireId
          ? DEBT_CONTROL_SCREENSHOT_SPEC.wires.find((w) => w.id === step.wireId)
          : null;
        const wireColor = wireSpec ? getWireStrokeColor(wireSpec.kind) : '#CC4518';

        // 1. Animate wire trace + traveling packet along exact SVG curve
        if (step.wireId && wireSpec) {
          const pathEl = wirePathRefs.current[step.wireId];
          const len = wireLengths.get(step.wireId) ?? 100;
          if (pathEl) {
            const proxy = { p: 0 };

            tl.set(pathEl, {
              strokeDasharray: len,
              strokeDashoffset: len,
              opacity: 0.94,
            });

            if (packetCoreRef.current && packetHaloRef.current && packetGroupRef.current) {
              tl.set(packetCoreRef.current, { attr: { fill: wireColor } });
              tl.set(packetHaloRef.current, { attr: { fill: wireColor } });
              tl.set(packetGroupRef.current, { opacity: 1 });
            }

            tl.to(
              pathEl,
              {
                strokeDashoffset: 0,
                duration: step.wireDurationSec,
                ease: 'power1.inOut',
              },
              '<'
            );

            tl.to(
              proxy,
              {
                p: 1,
                duration: step.wireDurationSec,
                ease: 'power1.inOut',
                onUpdate: () => {
                  const pt = pathEl.getPointAtLength(proxy.p * len);
                  if (packetGroupRef.current) {
                    packetGroupRef.current.setAttribute(
                      'transform',
                      `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`
                    );
                  }
                },
              },
              '<'
            );

            if (packetGroupRef.current) {
              tl.set(packetGroupRef.current, { opacity: 0 });
            }
          }
        }

        // 2. Activate target node ring, update step telemetry, then settle green checkmark
        const ringEl = activeRingRefs.current[step.nodeId];
        const borderEl = doneBorderRefs.current[step.nodeId];
        const badgeEl = doneBadgeRefs.current[step.nodeId];

        tl.call(() => {
          setActiveStepIndex(step.stepIndex);
          setActiveLoopIter(step.loopIteration ?? null);
          onActiveStepChangeRef.current?.(step);
        });

        if (ringEl) {
          tl.set(ringEl, {
            attr: {
              stroke: step.loopIteration ? '#4338CA' : wireColor,
            },
          });
          tl.fromTo(
            ringEl,
            { opacity: 0.95 },
            { opacity: 0.15, duration: step.nodeDwellSec, ease: 'power2.out' }
          );
          tl.set(ringEl, { opacity: 0 });
        } else {
          tl.to({}, { duration: step.nodeDwellSec });
        }

        if (borderEl) {
          tl.to(
            borderEl,
            {
              opacity: 0.92,
              duration: 0.14,
              ease: 'power1.out',
            },
            `-=${Math.min(0.14, step.nodeDwellSec * 0.6)}`
          );
        }

        if (badgeEl) {
          tl.to(
            badgeEl,
            {
              opacity: 1,
              scale: 1,
              duration: 0.18,
              ease: 'back.out(2)',
            },
            '<'
          );
        }
      }

      timelineRef.current = tl;
      setIsPlaying(true);
    }, stageEl);

    return () => {
      timelineRef.current?.kill();
      timelineRef.current = null;
      ctx.revert();
    };
  }, [branch, reducedMotion, replayNonce, plan, activeWireSet, executedNodeSet]);

  useEffect(() => {
    if (externalReplayNonce === 0 || reducedMotion) return;
    const tl = timelineRef.current;
    if (tl) {
      tl.restart(true);
      setIsPlaying(true);
    }
  }, [externalReplayNonce, reducedMotion]);

  const handleTogglePlay = () => {
    if (reducedMotion) return;
    const tl = timelineRef.current;
    if (!tl) return;
    if (isPlaying) {
      tl.pause();
      setIsPlaying(false);
    } else {
      tl.play();
      setIsPlaying(true);
    }
  };

  const handleReplay = () => {
    if (reducedMotion) return;
    const tl = timelineRef.current;
    if (tl) {
      tl.restart(true);
      setIsPlaying(true);
    } else {
      setReplayNonce((n) => n + 1);
    }
  };

  const handleSelectBranch = (nextBranch: OverlayBranch) => {
    if (nextBranch === branch) {
      handleReplay();
      return;
    }
    setBranch(nextBranch);
    setActiveStepIndex(1);
    setActiveLoopIter(null);
  };

  const activeInspectNodeId = hoveredNodeId ?? selectedNodeId;
  const formattedStep = `${String(activeStepIndex).padStart(2, '0')}/${String(plan.steps.length).padStart(2, '0')}`;

  return (
    <div
      ref={stageRef}
      data-testid="case-n8n-screenshot-stage"
      data-branch={branch}
      data-playing={String(isPlaying)}
      data-step={activeStepIndex}
      className={compact ? 'w-full flex flex-col justify-between gap-2' : 'bg-[#FAF8F4] dark:bg-[#141311]'}
    >
      {/* Compact Single-Row Control Strip: Branch Switch + Playback + Step Readout */}
      <div
        className={
          compact
            ? 'px-1 flex flex-wrap items-center justify-between gap-1.5'
            : 'px-3.5 py-2 border-b border-[#E8E3D9] dark:border-[#262421] bg-[#F5F2EB]/75 dark:bg-[#191816] flex flex-wrap items-center justify-between gap-2'
        }
      >
        <div
          role="group"
          aria-label={locale === 'uk' ? 'Сценарій розгалуження IF' : 'IF branch scenario'}
          className="inline-flex items-center gap-1 p-0.5 rounded-md bg-[#EAE5DC] dark:bg-[#23211E] border border-[#DED8CC] dark:border-[#302D28]"
        >
          <button
            type="button"
            data-testid="screenshot-branch-anomaly"
            aria-pressed={branch === 'anomaly'}
            onClick={() => handleSelectBranch('anomaly')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#CC4518] ${
              branch === 'anomaly'
                ? 'bg-white dark:bg-[#161513] text-[#B83B12] dark:text-[#FB8356] shadow-2xs'
                : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{locale === 'uk' ? 'Аномалія → OpenAI' : 'Anomaly → OpenAI'}</span>
          </button>
          <button
            type="button"
            data-testid="screenshot-branch-normal"
            aria-pressed={branch === 'normal'}
            onClick={() => handleSelectBranch('normal')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0F766E] ${
              branch === 'normal'
                ? 'bg-white dark:bg-[#161513] text-[#0F766E] dark:text-[#2DD4BF] shadow-2xs'
                : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{locale === 'uk' ? 'Норма → $0 LLM' : 'Normal → $0 LLM'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-[#5C5852] dark:text-[#A8A298] tabular-nums whitespace-nowrap">
            <span data-testid="screenshot-step-counter" className="font-semibold text-[#161513] dark:text-[#F5F3EE]">
              {formattedStep}
            </span>
            <span aria-hidden="true" className="text-[#C6BEB2] dark:text-[#44403A]">
              ·
            </span>
            <span className={branch === 'normal' ? 'text-[#0F766E] dark:text-[#2DD4BF]' : 'text-[#B83B12] dark:text-[#FB8356]'}>
              {activeLoopIter
                ? locale === 'uk'
                  ? compact
                    ? `Цикл ${activeLoopIter}/2`
                    : `Цикл Sheets ${activeLoopIter}/2`
                  : compact
                    ? `Loop ${activeLoopIter}/2`
                    : `Sheets Loop ${activeLoopIter}/2`
                : compact
                  ? branch === 'normal'
                    ? '$0 LLM'
                    : 'OpenAI'
                  : locale === 'uk'
                    ? plan.llmCostLabelUk
                    : plan.llmCostLabelEn}
            </span>
          </div>

          {!reducedMotion && (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                data-testid="screenshot-toggle-play"
                onClick={handleTogglePlay}
                aria-label={
                  isPlaying
                    ? locale === 'uk'
                      ? 'Пауза анімації'
                      : 'Pause animation'
                    : locale === 'uk'
                      ? 'Відтворити анімацію'
                      : 'Play animation'
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#161513] dark:text-[#F5F3EE] hover:border-[#C2B9A9] dark:hover:border-[#4A453E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>{locale === 'uk' ? 'Пауза' : 'Pause'}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>{locale === 'uk' ? 'Старт' : 'Play'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                data-testid="screenshot-replay"
                onClick={handleReplay}
                aria-label={locale === 'uk' ? 'Повторити запуск' : 'Replay workflow run'}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] hover:border-[#C2B9A9] dark:hover:border-[#4A453E] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>{locale === 'uk' ? 'Повторити' : 'Replay'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Synchronized 1191x547 Screenshot + Live GSAP SVG Overlay */}
      <div className={compact ? '' : 'p-2.5 sm:p-3'}>
        <div
          className={`rounded-lg border border-[#E2DDD2] dark:border-[#322F2A] bg-[#F6F6F6] overflow-hidden ${
            compact ? 'p-0.5' : 'p-1'
          }`}
        >
          <div className="relative w-full aspect-[1191/547] select-none overflow-hidden rounded-sm">
            {/* Layer 1: Authentic Production n8n Screenshot */}
            <Image
              src={screenshotSrc}
              alt={
                title ||
                (locale === 'uk'
                  ? 'Інтерактивний скріншот робочого полотна n8n (15 вузлів)'
                  : 'Interactive production n8n editor workflow screenshot (15 nodes)')
              }
              width={1191}
              height={547}
              priority
              referrerPolicy="no-referrer"
              className="w-full h-full object-fill block pointer-events-none"
            />

            {/* Layers 2-4: Exact 1:1 SVG Overlay */}
            <svg
              data-testid="case-n8n-live-overlay-svg"
              viewBox={`0 0 ${DEBT_CONTROL_SCREENSHOT_SPEC.width} ${DEBT_CONTROL_SCREENSHOT_SPEC.height}`}
              className="absolute inset-0 w-full h-full"
              role="group"
              aria-label={
                locale === 'uk'
                  ? 'Живий інтерактивний шар виконання поверх скріншоту n8n'
                  : 'Live interactive execution overlay on n8n screenshot'
              }
            >
              <defs>
                <filter id="n8n-packet-glow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="3.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Soft dimming veil over skipped OpenAI branch when in Normal ($0 LLM) mode */}
              {branch === 'normal' && (
                <g className="pointer-events-none">
                  <rect
                    x="634"
                    y="191"
                    width="284"
                    height="118"
                    rx="10"
                    fill="#F6F6F6"
                    fillOpacity="0.58"
                    stroke="#CBD5E1"
                    strokeWidth="1.2"
                    strokeDasharray="5 4"
                  />
                  <text
                    x="776"
                    y="206"
                    textAnchor="middle"
                    paintOrder="stroke"
                    stroke="#F6F6F6"
                    strokeWidth="4"
                    className="font-mono text-[11px] font-semibold fill-[#0F766E]"
                  >
                    {locale === 'uk' ? 'OpenAI пропущено · $0 LLM' : 'OpenAI bypassed · $0 LLM'}
                  </text>
                  <text
                    x="776"
                    y="343"
                    textAnchor="middle"
                    paintOrder="stroke"
                    stroke="#F6F6F6"
                    strokeWidth="4"
                    className="font-mono text-[10.5px] font-semibold fill-[#0F766E]"
                  >
                    {locale === 'uk' ? 'IF: false → пряма доставка ($0 LLM)' : 'IF: false → direct delivery ($0 LLM)'}
                  </text>
                </g>
              )}

              {/* Layer 2: Animated Wire Traces aligned 1:1 to gray n8n connectors */}
              <g className="pointer-events-none">
                {DEBT_CONTROL_SCREENSHOT_SPEC.wires.map((wire) => {
                  const strokeColor = getWireStrokeColor(wire.kind);
                  const isLoop = wire.kind === 'loop-out' || wire.kind === 'loop-back';
                  return (
                    <path
                      key={wire.id}
                      ref={(el) => {
                        wirePathRefs.current[wire.id] = el;
                      }}
                      d={wire.d}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isLoop ? 3 : 2.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0}
                    />
                  );
                })}
              </g>

              {/* Layer 3: Node Execution Borders, Active Pulse Rings & Emerald Checkmarks */}
              <g className="pointer-events-none">
                {DEBT_CONTROL_SCREENSHOT_SPEC.nodes.map((box) => {
                  const isSkipped = skippedNodeSet.has(box.nodeId);
                  return (
                    <g key={`fx-${box.nodeId}`}>
                      {/* Completed execution emerald border (authentic n8n green run state) */}
                      <rect
                        ref={(el) => {
                          doneBorderRefs.current[box.nodeId] = el;
                        }}
                        x={box.x - 1}
                        y={box.y - 1}
                        width={box.w + 2}
                        height={box.h + 2}
                        rx={box.rx}
                        fill="none"
                        stroke="#0F766E"
                        strokeWidth="2.4"
                        opacity={0}
                      />

                      {/* Active pulse ring while data executes inside this node */}
                      <rect
                        ref={(el) => {
                          activeRingRefs.current[box.nodeId] = el;
                        }}
                        x={box.x - 4.5}
                        y={box.y - 4.5}
                        width={box.w + 9}
                        height={box.h + 9}
                        rx={box.rx + 3}
                        fill="none"
                        stroke="#CC4518"
                        strokeWidth="3.2"
                        opacity={0}
                      />

                      {/* Completed emerald checkmark badge at bottom-right of node square */}
                      {!isSkipped && (
                        <g
                          ref={(el) => {
                            doneBadgeRefs.current[box.nodeId] = el;
                          }}
                          transform={`translate(${box.x + box.w - 3}, ${box.y + box.h - 3})`}
                          opacity={0}
                        >
                          <circle r="8.5" fill="#0F766E" stroke="#FFFFFF" strokeWidth="2" />
                          <polyline
                            points="-3.4,0.2 -1,2.7 3.8,-2.5"
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Compact iteration counter above SplitInBatches during the 2 loop cycles */}
                {activeLoopIter && (
                  <g transform="translate(241.5, 320)">
                    <rect
                      x="-24"
                      y="-13"
                      width="48"
                      height="18"
                      rx="4"
                      fill="#4338CA"
                    />
                    <text
                      x="0"
                      y="-0.5"
                      textAnchor="middle"
                      className="font-mono text-[10.5px] font-semibold fill-white"
                    >
                      {`×${activeLoopIter}/2`}
                    </text>
                  </g>
                )}

                {/* Traveling Glowing Data Packet */}
                <g ref={packetGroupRef} opacity={0} filter="url(#n8n-packet-glow)">
                  <circle ref={packetHaloRef} cx="0" cy="0" r="8.5" fill="#CC4518" opacity="0.28" />
                  <circle
                    ref={packetCoreRef}
                    cx="0"
                    cy="0"
                    r="4.6"
                    fill="#CC4518"
                    stroke="#FFFFFF"
                    strokeWidth="1.6"
                  />
                </g>
              </g>

              {/* Layer 4: Accessible Clickable / Hoverable Hit Targets for All 15 Nodes */}
              <g>
                {DEBT_CONTROL_SCREENSHOT_SPEC.nodes.map((box) => {
                  const meta = nodeLookup.get(box.nodeId);
                  const nodeLabel = meta ? `${meta.name} (${meta.shortType})` : box.nodeId;
                  const isInspected = activeInspectNodeId === box.nodeId;
                  const isSelected = selectedNodeId === box.nodeId;

                  return (
                    <g
                      key={`hit-${box.nodeId}`}
                      role="button"
                      tabIndex={0}
                      data-testid={`screenshot-node-${box.nodeId}`}
                      aria-label={nodeLabel}
                      aria-pressed={isSelected}
                      onMouseEnter={() => onHoverNode(box.nodeId)}
                      onMouseLeave={() => onHoverNode(null)}
                      onFocus={() => onHoverNode(box.nodeId)}
                      onBlur={() => onHoverNode(null)}
                      onClick={() => onSelectNode(isSelected ? null : box.nodeId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectNode(isSelected ? null : box.nodeId);
                        }
                      }}
                      className="cursor-pointer outline-none"
                    >
                      {/* Selection / Hover outline strictly on the n8n square */}
                      {isInspected && (
                        <rect
                          x={box.x - 3.5}
                          y={box.y - 3.5}
                          width={box.w + 7}
                          height={box.h + 7}
                          rx={box.rx + 2}
                          fill="#CC4518"
                          fillOpacity="0.08"
                          stroke="#CC4518"
                          strokeWidth="2.6"
                          className="pointer-events-none"
                        />
                      )}
                      {/* Transparent hit zone covering square + caption below */}
                      <rect
                        x={box.hitX}
                        y={box.hitY}
                        width={box.hitW}
                        height={box.hitH}
                        rx="10"
                        fill="transparent"
                      />
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
