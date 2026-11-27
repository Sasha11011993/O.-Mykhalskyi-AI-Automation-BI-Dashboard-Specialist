'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import { BI_DATASETS, SERVICES_DATA, UI_COPY, t } from '@/lib/portfolioData';
import {
  ROI_HOURLY_RATE_MAX,
  ROI_HOURLY_RATE_MIN,
  buildRoiInquiryDraft,
  buildRoiPrefillSummary,
  calculateAutomationRoi,
  computeBiPointInspection,
  computeSixMonthPaybackCurve,
  computeSliderFillPct,
  formatCurrencyUsd,
  formatInteger,
  parseHourlyRateInput,
  type BiDomainId,
  type BiPeriodId,
  type RoiInput,
  type ServiceId,
} from '@/lib/portfolioLogic';

type WorkbenchMode = 'bi' | 'roi';

interface LiveDemoTabProps {
  mode: WorkbenchMode;
  onModeChange: (nextMode: WorkbenchMode) => void;
  roiInput: RoiInput;
  onChangeRoiInput: (next: RoiInput) => void;
  onTransferRoiPlan: (serviceId: ServiceId, draftText: string, contextSummary?: string) => void;
}

const DOMAINS: readonly BiDomainId[] = ['ecommerce', 'saas', 'logistics'] as const;
const PERIODS: readonly BiPeriodId[] = ['6m', '12m'] as const;

export default function LiveDemoTab({
  mode,
  onModeChange,
  roiInput,
  onChangeRoiInput,
  onTransferRoiPlan,
}: LiveDemoTabProps) {
  const { locale } = useThemeLocale();
  const [domain, setDomain] = useState<BiDomainId>('ecommerce');
  const [period, setPeriod] = useState<BiPeriodId>('6m');
  const [inspectedIdx, setInspectedIdx] = useState<number | null>(null);
  const [rateDraft, setRateDraft] = useState<string | null>(null);

  const { teamSize, weeklyManualHoursPerPerson: weeklyManualHours, hourlyRateUsd } = roiInput;
  const displayedRate = rateDraft ?? String(hourlyRateUsd);

  const handleDemoRateInputChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '').slice(0, 3);
    setRateDraft(cleaned);
    if (!cleaned) return;
    const parsed = Number.parseInt(cleaned, 10);
    if (parsed >= ROI_HOURLY_RATE_MIN && parsed <= ROI_HOURLY_RATE_MAX) {
      onChangeRoiInput({ ...roiInput, hourlyRateUsd: parsed });
    }
  };

  const commitDemoRateDraft = () => {
    if (rateDraft === null) return;
    const normalized = parseHourlyRateInput(rateDraft, hourlyRateUsd);
    setRateDraft(null);
    if (normalized !== hourlyRateUsd) {
      onChangeRoiInput({ ...roiInput, hourlyRateUsd: normalized });
    }
  };

  const chartRef = useRef<SVGSVGElement>(null);

  const activeDataset = BI_DATASETS[domain];
  const activeSeries = period === '6m' ? activeDataset.series6m : activeDataset.series12m;
  const maxRevenue = Math.max(...activeSeries.map((pt) => pt.revenue), 1);

  const effectiveIdx =
    inspectedIdx !== null && inspectedIdx < activeSeries.length
      ? inspectedIdx
      : activeSeries.length - 1;
  const inspectedPoint = computeBiPointInspection(activeSeries, effectiveIdx);
  const inspectedSeriesItem = activeSeries[effectiveIdx] ?? activeSeries[activeSeries.length - 1];

  const roiResult = useMemo(
    () => calculateAutomationRoi(roiInput),
    [roiInput]
  );

  const paybackCurve = useMemo(() => computeSixMonthPaybackCurve(roiResult), [roiResult]);

  const recommendedService =
    SERVICES_DATA.find((s) => s.id === roiResult.recommendedServiceId) ?? SERVICES_DATA[0];

  // GSAP choreographed SVG bar & trend-line transition when switching BI domain or period
  useEffect(() => {
    if (mode !== 'bi') return;
    const svg = chartRef.current;
    if (!svg) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.js-bi-bar',
        { scaleY: 0.08, transformOrigin: 'bottom center' },
        {
          scaleY: 1,
          duration: 0.45,
          stagger: 0.04,
          ease: 'power3.out',
        }
      );

      const trendPath = svg.querySelector<SVGPathElement>('.js-bi-trend-path');
      if (trendPath) {
        const len = trendPath.getTotalLength();
        gsap.fromTo(
          trendPath,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration: 0.65, ease: 'power2.out' }
        );
      }
    }, svg);

    return () => ctx.revert();
  }, [mode, domain, period]);

  // Compute SVG geometry with tall balanced vertical proportions and separated visual bands
  const chartWidth = 640;
  const chartHeight = 232;
  const padX = 28;
  const padTop = 26;
  const padBottom = 28;
  const plotW = chartWidth - padX * 2;
  const plotH = chartHeight - padTop - padBottom;
  const slotW = plotW / activeSeries.length;
  const barW = Math.min(50, slotW * 0.48);

  const trendPoints = activeSeries.map((pt, idx) => {
    const cx = padX + idx * slotW + slotW / 2;
    // Map automation share (35%–100%) cleanly into upper visual band
    const normalized = Math.max(0, Math.min(1, (pt.automatedShare - 30) / 70));
    const cy = padTop + plotH * 0.30 * (1 - normalized);
    return { cx, cy, share: pt.automatedShare };
  });

  const trendPathD = trendPoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.cx.toFixed(1)} ${p.cy.toFixed(1)}`)
    .join(' ');

  return (
    <section
      aria-label={locale === 'uk' ? 'Інтерактивне демо' : 'Interactive Live Demo'}
      className="min-h-full lg:h-full w-full flex flex-col gap-3 [@media(min-height:800px)]:gap-5 pb-3 lg:pb-0"
    >
      {/* Section Header + Mode Switcher */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-2 pb-2.5 [@media(min-height:800px)]:pb-4 border-b border-[#E5E0D6] dark:border-[#2A2825]">
        <div>
          <p className="text-xs font-medium text-[#5C5852] dark:text-[#A8A298] mb-0.5 [@media(min-height:800px)]:mb-1">
            {t(UI_COPY.demo.kicker, locale)}
          </p>
          <h2 className="text-2xl sm:text-[25px] [@media(min-height:800px)]:text-[28px] font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] leading-tight">
            {t(UI_COPY.demo.heading, locale)}
          </h2>
        </div>

        {/* Functional Mode Segmented Control */}
        <div
          role="tablist"
          aria-label={locale === 'uk' ? 'Режим інтерактивної демонстрації' : 'Demo mode'}
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825] self-start md:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'bi'}
            onClick={() => onModeChange('bi')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] cursor-pointer ${
              mode === 'bi'
                ? 'bg-white dark:bg-[#292724] text-[#0F766E] dark:text-[#2DD4BF] shadow-xs'
                : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
            }`}
          >
            {t(UI_COPY.demo.modes.bi, locale)}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'roi'}
            onClick={() => onModeChange('roi')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] cursor-pointer ${
              mode === 'roi'
                ? 'bg-white dark:bg-[#292724] text-[#C84317] dark:text-[#FB8356] shadow-xs'
                : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
            }`}
          >
            {t(UI_COPY.demo.modes.roi, locale)}
          </button>
        </div>
      </div>

      {mode === 'bi' ? (
        /* MODE A: Interactive Executive BI Dashboard Preview */
        <div className="flex-1 min-h-0 flex flex-col gap-2.5 [@media(min-height:800px)]:gap-4">
          {/* Toolbar: Domain Switcher + Period Switcher */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label={locale === 'uk' ? 'Сектор бізнесу' : 'Business domain'}
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825]"
              >
                {DOMAINS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={domain === d}
                    onClick={() => {
                      setDomain(d);
                      setInspectedIdx(null);
                    }}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      domain === d
                        ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-xs'
                        : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                    }`}
                  >
                    {t(BI_DATASETS[d].label, locale)}
                  </button>
                ))}
              </div>
              <span className="hidden xl:inline text-xs text-[#6E6960] dark:text-[#A8A298]">
                {t(activeDataset.subtitle, locale)}
              </span>
            </div>

            <div
              role="group"
              aria-label={locale === 'uk' ? 'Період аналізу' : 'Reporting period'}
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825]"
            >
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  onClick={() => {
                    setPeriod(p);
                    setInspectedIdx(null);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    period === p
                      ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-xs'
                      : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  {t(UI_COPY.demo.periods[p], locale)}
                </button>
              ))}
            </div>
          </div>

          {/* 4-Column Executive KPI Row */}
          <dl className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-2.5 [@media(min-height:800px)]:gap-3">
            {activeDataset.kpis.map((kpi) => (
              <div
                key={kpi.id}
                className="px-3.5 py-2 [@media(min-height:800px)]:px-4 [@media(min-height:800px)]:py-3 rounded-xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] flex flex-col justify-between gap-0.5 [@media(min-height:800px)]:gap-1"
              >
                <dt className="text-[11px] [@media(min-height:800px)]:text-xs text-[#6E6960] dark:text-[#A8A298] truncate">
                  {t(kpi.label, locale)}
                </dt>
                <div className="flex items-baseline justify-between gap-1.5">
                  <dd className="font-mono tabular-nums text-lg sm:text-xl [@media(min-height:800px)]:text-2xl font-semibold text-[#161513] dark:text-[#F5F3EE] whitespace-nowrap">
                    {period === '6m' ? kpi.value6m : kpi.value12m}
                  </dd>
                  <span className="inline-flex items-center gap-0.5 font-mono tabular-nums text-[10px] [@media(min-height:800px)]:text-[11px] font-medium text-[#0F766E] dark:text-[#2DD4BF] whitespace-nowrap shrink-0">
                    <TrendingUp className="w-3 h-3" aria-hidden="true" />
                    {t(kpi.delta, locale)}
                  </span>
                </div>
              </div>
            ))}
          </dl>

          {/* Chart + High-Density Breakdown Split */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 [@media(min-height:800px)]:gap-4 items-stretch">
            {/* GSAP Animated Two-Tone SVG Chart Card (Teal Revenue Bars + Terracotta Automation Trend) */}
            <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] p-3.5 [@media(min-height:800px)]:p-5 flex flex-col justify-between gap-2 min-h-0">
              <div className="flex flex-wrap items-center justify-between gap-2 min-h-[22px]">
                <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF]">
                  {t(UI_COPY.demo.chartTitle, locale)}
                </p>

                {/* Fixed-height Live Month Inspector (updates smoothly on hover/tap with 0px shift) */}
                {inspectedPoint && inspectedSeriesItem ? (
                  <div
                    data-testid="bi-chart-inspector"
                    aria-live="polite"
                    className="flex items-center gap-2 text-[11px] font-mono tabular-nums"
                  >
                    <span className="font-semibold text-[#161513] dark:text-[#F5F3EE]">
                      {t(inspectedSeriesItem.label, locale)}
                    </span>
                    <span aria-hidden="true" className="text-[#C6BEB2] dark:text-[#44403A]">
                      ·
                    </span>
                    <span className="font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
                      ${inspectedPoint.revenue}k
                    </span>
                    <span aria-hidden="true" className="text-[#C6BEB2] dark:text-[#44403A]">
                      ·
                    </span>
                    <span className="font-semibold text-[#C84317] dark:text-[#FB8356]">
                      {inspectedPoint.automatedShare}%
                    </span>
                    {inspectedPoint.deltaPct !== null && (
                      <>
                        <span aria-hidden="true" className="text-[#C6BEB2] dark:text-[#44403A]">
                          ·
                        </span>
                        <span
                          className={`font-medium ${
                            inspectedPoint.deltaPct >= 0
                              ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                              : 'text-[#B45309] dark:text-[#FBBF24]'
                          }`}
                        >
                          {inspectedPoint.deltaPct >= 0 ? '+' : ''}
                          {inspectedPoint.deltaPct}% MoM
                        </span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              <div
                className="flex-1 min-h-[150px] [@media(min-height:800px)]:min-h-[190px] flex items-center"
                onMouseLeave={() => setInspectedIdx(null)}
              >
                <svg
                  ref={chartRef}
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-full max-h-[195px] [@media(min-height:800px)]:max-h-[268px] overflow-visible"
                  role="img"
                  aria-label={t(UI_COPY.demo.chartTitle, locale)}
                >
                  {/* Horizontal subtle grid lines */}
                  {[0.25, 0.5, 0.75, 1].map((fraction) => {
                    const y = padTop + plotH * (1 - fraction);
                    return (
                      <line
                        key={fraction}
                        x1={padX}
                        x2={chartWidth - padX}
                        y1={y}
                        y2={y}
                        className="stroke-[#E5E0D6] dark:stroke-[#2A2825]"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* Active Column Vertical Guide Line */}
                  {trendPoints[effectiveIdx] && (
                    <line
                      x1={trendPoints[effectiveIdx].cx}
                      x2={trendPoints[effectiveIdx].cx}
                      y1={padTop - 4}
                      y2={padTop + plotH}
                      strokeDasharray="3 3"
                      className="stroke-[#0F766E]/35 dark:stroke-[#2DD4BF]/35 transition-all duration-150"
                      strokeWidth="1"
                    />
                  )}

                  {/* Revenue Bars (Deep Teal tint with active hovered/selected highlight) */}
                  {activeSeries.map((pt, idx) => {
                    const barHeight = Math.max(28, (pt.revenue / maxRevenue) * plotH * 0.58);
                    const x = padX + idx * slotW + (slotW - barW) / 2;
                    const y = padTop + plotH - barHeight;
                    const labelX = padX + idx * slotW + slotW / 2;
                    const isHighlighted = idx === effectiveIdx;
                    return (
                      <g key={`${domain}-${period}-${idx}`}>
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={barHeight}
                          rx={5}
                          className={`js-bi-bar transition-colors duration-150 ${
                            isHighlighted
                              ? 'fill-[#0F766E] dark:fill-[#14B8A6]'
                              : 'fill-[#0F766E]/22 dark:fill-[#2DD4BF]/25'
                          }`}
                        />
                        <text
                          x={labelX}
                          y={y + 15}
                          textAnchor="middle"
                          className={`text-[10px] font-mono font-medium pointer-events-none ${
                            isHighlighted
                              ? 'fill-white dark:fill-[#111110]'
                              : 'fill-[#161513] dark:fill-[#F5F3EE]'
                          }`}
                        >
                          ${pt.revenue}k
                        </text>
                        <text
                          x={labelX}
                          y={chartHeight - 6}
                          textAnchor="middle"
                          className={`text-[11px] font-mono pointer-events-none ${
                            isHighlighted
                              ? 'fill-[#161513] dark:fill-[#F5F3EE] font-semibold'
                              : 'fill-[#6E6960] dark:fill-[#A8A298]'
                          }`}
                        >
                          {t(pt.label, locale)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Automation Share Trend Line (Signature Terracotta — rich two-tone contrast) */}
                  <path
                    d={trendPathD}
                    fill="none"
                    className="js-bi-trend-path stroke-[#CC4518] dark:stroke-[#FB8356] pointer-events-none"
                    strokeWidth="2.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {trendPoints.map((pt, idx) => {
                    const isHighlighted = idx === effectiveIdx;
                    return (
                      <g key={`pt-${idx}`} className="pointer-events-none">
                        <circle
                          cx={pt.cx}
                          cy={pt.cy}
                          r={isHighlighted ? 5 : 3.5}
                          className={`transition-all duration-150 ${
                            isHighlighted
                              ? 'fill-[#CC4518] dark:fill-[#FB8356] stroke-white dark:stroke-[#181715]'
                              : 'fill-white dark:fill-[#181715] stroke-[#CC4518] dark:stroke-[#FB8356]'
                          }`}
                          strokeWidth="2"
                        />
                        <text
                          x={pt.cx}
                          y={pt.cy - 10}
                          textAnchor="middle"
                          className={`text-[10px] font-mono ${
                            isHighlighted
                              ? 'fill-[#C84317] dark:fill-[#FB8356] font-bold'
                              : 'fill-[#C84317]/85 dark:fill-[#FB8356]/85 font-medium'
                          }`}
                        >
                          {pt.share}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Full-Column Invisible Hit Zones for effortless mouse hover, keyboard focus & mobile tap */}
                  {activeSeries.map((pt, idx) => {
                    const slotX = padX + idx * slotW;
                    return (
                      <rect
                        key={`hit-${domain}-${period}-${idx}`}
                        data-testid={`bi-bar-hit-${idx}`}
                        x={slotX}
                        y={padTop - 10}
                        width={slotW}
                        height={plotH + padBottom}
                        fill="transparent"
                        role="button"
                        tabIndex={0}
                        aria-label={`${t(pt.label, locale)}: $${pt.revenue}k, ${pt.automatedShare}%`}
                        onMouseEnter={() => setInspectedIdx(idx)}
                        onFocus={() => setInspectedIdx(idx)}
                        onClick={() => setInspectedIdx(idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setInspectedIdx(idx);
                          }
                        }}
                        className="cursor-pointer focus:outline-none"
                      />
                    );
                  })}
                </svg>
              </div>

              {/* Compact Data Lineage & Refresh Strip */}
              <div className="pt-2 border-t border-[#E5E0D6] dark:border-[#2A2825] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#6E6960] dark:text-[#A8A298]">
                <span>{t(activeDataset.refreshCadence, locale)}</span>
                <span className="truncate">{activeDataset.sources.join(' · ')}</span>
              </div>
            </div>

            {/* High-Density Tabular Breakdown + Executive Insight Card */}
            <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] p-3.5 [@media(min-height:800px)]:p-5 flex flex-col justify-between gap-2 [@media(min-height:800px)]:gap-4 min-h-0">
              <div className="space-y-2 [@media(min-height:800px)]:space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E0D6] dark:border-[#2A2825] text-[11px] font-semibold text-[#6E6960] dark:text-[#A8A298]">
                        <th className="pb-1.5 [@media(min-height:800px)]:pb-2.5 pr-2">{t(UI_COPY.demo.tableHeaders.channel, locale)}</th>
                        <th className="pb-1.5 [@media(min-height:800px)]:pb-2.5 px-2 text-right">
                          {t(UI_COPY.demo.tableHeaders.automation, locale)}
                        </th>
                        <th className="pb-1.5 [@media(min-height:800px)]:pb-2.5 pl-2 text-right">
                          {t(UI_COPY.demo.tableHeaders.impact, locale)}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E0D6] dark:divide-[#2A2825] text-xs [@media(min-height:800px)]:text-[13px]">
                      {activeDataset.rows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-[#FAF8F4] dark:hover:bg-[#1F1E1B] transition-colors"
                        >
                          <td className="py-1.5 [@media(min-height:800px)]:py-2.5 pr-2">
                            <div className="font-medium text-[#161513] dark:text-[#F5F3EE] leading-snug">
                              {t(row.channel, locale)}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-[#6E6960] dark:text-[#A8A298]">
                              {t(row.volume, locale)}
                            </div>
                          </td>
                          <td className="py-1.5 [@media(min-height:800px)]:py-2.5 px-2 text-right font-mono tabular-nums text-[#161513] dark:text-[#EAE6DF] whitespace-nowrap">
                            {row.automationRate}
                          </td>
                          <td className="py-1.5 [@media(min-height:800px)]:py-2.5 pl-2 text-right font-mono tabular-nums font-semibold text-[#0F766E] dark:text-[#2DD4BF] whitespace-nowrap">
                            {t(row.marginImpact, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Executive Model Insight Callout (eliminates empty vertical space cleanly) */}
                <div className="p-2.5 [@media(min-height:800px)]:p-3.5 rounded-xl bg-[#FAF8F4] dark:bg-[#131210] border border-[#E5E0D6] dark:border-[#2A2825] space-y-1 [@media(min-height:800px)]:space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.04em] text-[#0F766E] dark:text-[#2DD4BF]">
                      {locale === 'uk' ? 'Висновок моделі' : 'Executive Insight'}
                    </span>
                    <span className="text-[11px] font-mono text-[#6E6960] dark:text-[#918A7E] whitespace-nowrap shrink-0">
                      {activeDataset.sources.length}{' '}
                      {locale === 'uk' ? 'джерела' : 'sources'}
                    </span>
                  </div>
                  <p className="text-xs leading-[1.45] [@media(min-height:800px)]:leading-[1.55] text-[#45413B] dark:text-[#C8C2B8]">
                    {t(activeDataset.insight, locale)}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E5E0D6] dark:border-[#2A2825] flex items-center justify-between gap-2 text-xs text-[#6E6960] dark:text-[#A8A298]">
                <span className="truncate">
                  {locale === 'uk'
                    ? 'Симуляція типової моделі даних'
                    : 'Interactive reference data model'}
                </span>
                <button
                  type="button"
                  onClick={() => onModeChange('roi')}
                  className="font-semibold text-[#C84317] dark:text-[#FB8356] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {locale === 'uk' ? 'Порахувати свій ROI →' : 'Estimate Your ROI →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* MODE B: Interactive Automation ROI Calculator */
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 xl:gap-8 items-stretch">
          {/* Left Inputs Card */}
          <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] p-4 [@media(min-height:800px)]:p-6 flex flex-col justify-between gap-3 [@media(min-height:800px)]:gap-5">
            <div className="space-y-2.5 [@media(min-height:800px)]:space-y-5">
              <h3 className="text-sm sm:text-base font-semibold text-[#161513] dark:text-[#F5F3EE]">
                {t(UI_COPY.demo.roi.inputsHeading, locale)}
              </h3>

              {/* Slider 1: Team Size */}
              <div className="space-y-1 [@media(min-height:800px)]:space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <label
                    htmlFor="roi-team-size"
                    className="font-medium text-[#3F3B36] dark:text-[#D6D1C7]"
                  >
                    {t(UI_COPY.demo.roi.teamSize, locale)}
                  </label>
                  <span className="font-mono tabular-nums font-semibold text-[#161513] dark:text-[#F5F3EE] whitespace-nowrap shrink-0">
                    {teamSize} {t(UI_COPY.demo.roi.teamUnit, locale)}
                  </span>
                </div>
                <input
                  id="roi-team-size"
                  type="range"
                  min={1}
                  max={40}
                  step={1}
                  value={teamSize}
                  onChange={(e) =>
                    onChangeRoiInput({ ...roiInput, teamSize: Number(e.target.value) })
                  }
                  style={
                    {
                      '--slider-fill': `${computeSliderFillPct(teamSize, 1, 40)}%`,
                    } as React.CSSProperties
                  }
                  className="roi-range-slider"
                />
              </div>

              {/* Slider 2: Weekly Manual Hours */}
              <div className="space-y-1 [@media(min-height:800px)]:space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <label
                    htmlFor="roi-weekly-hours"
                    className="font-medium text-[#3F3B36] dark:text-[#D6D1C7]"
                  >
                    {t(UI_COPY.demo.roi.weeklyHours, locale)}
                  </label>
                  <span className="font-mono tabular-nums font-semibold text-[#161513] dark:text-[#F5F3EE] whitespace-nowrap shrink-0">
                    {weeklyManualHours} {t(UI_COPY.demo.roi.hoursUnit, locale)}
                  </span>
                </div>
                <input
                  id="roi-weekly-hours"
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={weeklyManualHours}
                  onChange={(e) =>
                    onChangeRoiInput({
                      ...roiInput,
                      weeklyManualHoursPerPerson: Number(e.target.value),
                    })
                  }
                  style={
                    {
                      '--slider-fill': `${computeSliderFillPct(weeklyManualHours, 2, 30)}%`,
                    } as React.CSSProperties
                  }
                  className="roi-range-slider"
                />
              </div>

              {/* Slider 3: Hourly Rate ($5–$200, synced slider + direct numeric input) */}
              <div className="space-y-1 [@media(min-height:800px)]:space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <label
                    htmlFor="roi-hourly-rate-input"
                    className="font-medium text-[#3F3B36] dark:text-[#D6D1C7]"
                  >
                    {t(UI_COPY.demo.roi.hourlyRate, locale)}
                  </label>
                  <div className="inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                    <div className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-[#FAF8F4] dark:bg-[#1B1A18] border border-[#DDD6C9] dark:border-[#33302B] focus-within:border-[#CC4518] dark:focus-within:border-[#FB8356] transition-colors">
                      <span
                        aria-hidden="true"
                        className="font-mono text-xs font-semibold text-[#78716C] dark:text-[#8A8277]"
                      >
                        $
                      </span>
                      <input
                        id="roi-hourly-rate-input"
                        data-testid="demo-roi-rate-input"
                        type="text"
                        inputMode="numeric"
                        aria-label={
                          locale === 'uk'
                            ? 'Власна ставка за годину в доларах США'
                            : 'Custom hourly rate in USD'
                        }
                        value={displayedRate}
                        onFocus={(e) => {
                          setRateDraft(String(hourlyRateUsd));
                          e.currentTarget.select();
                        }}
                        onChange={(e) => handleDemoRateInputChange(e.target.value)}
                        onBlur={commitDemoRateDraft}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            commitDemoRateDraft();
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-10 bg-transparent font-mono tabular-nums text-sm font-semibold text-[#161513] dark:text-[#F5F3EE] text-right focus:outline-none"
                      />
                    </div>
                    <span className="font-mono text-xs text-[#6E6960] dark:text-[#A8A298]">
                      / {t(UI_COPY.demo.roi.hoursUnit, locale)}
                    </span>
                  </div>
                </div>
                <input
                  id="roi-hourly-rate"
                  aria-label={t(UI_COPY.demo.roi.hourlyRate, locale)}
                  type="range"
                  min={ROI_HOURLY_RATE_MIN}
                  max={ROI_HOURLY_RATE_MAX}
                  step={1}
                  value={hourlyRateUsd}
                  onChange={(e) => {
                    setRateDraft(null);
                    onChangeRoiInput({ ...roiInput, hourlyRateUsd: Number(e.target.value) });
                  }}
                  style={
                    {
                      '--slider-fill': `${computeSliderFillPct(
                        hourlyRateUsd,
                        ROI_HOURLY_RATE_MIN,
                        ROI_HOURLY_RATE_MAX
                      )}%`,
                    } as React.CSSProperties
                  }
                  className="roi-range-slider"
                />
              </div>
            </div>

            {/* Automation Scope Breakdown (explains where the 72% capture comes from) */}
            <div className="p-2.5 [@media(min-height:800px)]:p-4 rounded-xl bg-[#FAF8F4] dark:bg-[#131210] border border-[#E5E0D6] dark:border-[#2A2825] space-y-2 [@media(min-height:800px)]:space-y-3">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono font-semibold text-[#5C5852] dark:text-[#A8A298]">
                <span>
                  {locale === 'uk'
                    ? 'Структура автоматизації (72% рутини)'
                    : 'Automation Capture Breakdown (72%)'}
                </span>
                <span className="text-[#161513] dark:text-[#F5F3EE] whitespace-nowrap shrink-0">
                  {formatInteger(roiResult.monthlySavedHours)}{' '}
                  {locale === 'uk' ? 'год/міс' : 'hrs/mo'}
                </span>
              </div>

              <div className="space-y-1.5 [@media(min-height:800px)]:space-y-2.5">
                {[
                  {
                    label:
                      locale === 'uk'
                        ? 'Збір даних, ETL та звірка CRM/ERP'
                        : 'Data Extraction, ETL & CRM Sync',
                    share: 28,
                    barClass: 'bg-[#D97706] dark:bg-[#FBBF24]',
                  },
                  {
                    label:
                      locale === 'uk'
                        ? 'AI-агенти: тріаж, скоринг та відповіді'
                        : 'AI Agents: Triage, Scoring & Replies',
                    share: 26,
                    barClass: 'bg-[#CC4518] dark:bg-[#FB8356]',
                  },
                  {
                    label:
                      locale === 'uk'
                        ? 'Автоматична BI-звітність та алерти'
                        : 'Automated Executive BI & Alerts',
                    share: 18,
                    barClass: 'bg-[#0F766E] dark:bg-[#2DD4BF]',
                  },
                ].map((layer) => (
                  <div key={layer.share} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#3F3B36] dark:text-[#D6D1C7]">{layer.label}</span>
                      <span className="font-mono tabular-nums text-[11px] font-medium text-[#6E6960] dark:text-[#A8A298] whitespace-nowrap shrink-0">
                        {layer.share}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#E8E2D8] dark:bg-[#262421] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${layer.barClass}`}
                        style={{ width: `${Math.round((layer.share / 32) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="pt-2 [@media(min-height:800px)]:pt-3 border-t border-[#E5E0D6] dark:border-[#2A2825] text-[11px] [@media(min-height:800px)]:text-xs text-[#6E6960] dark:text-[#A8A298] leading-snug [@media(min-height:800px)]:leading-relaxed">
              {locale === 'uk'
                ? 'Розрахунок базується на консервативному коефіцієнті 72% автоматизації рутинних операцій (звірка даних, звітність, обробка заявок).'
                : 'Projection assumes a conservative 72% automation capture rate across repetitive reporting, triage, and CRM/ERP data entry.'}
            </p>
          </div>

          {/* Right Live ROI Output Card */}
          <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] p-4 [@media(min-height:800px)]:p-6 flex flex-col justify-between gap-2.5 [@media(min-height:800px)]:gap-4">
            <div className="space-y-2.5 [@media(min-height:800px)]:space-y-4">
              <h3 className="text-sm sm:text-base font-semibold text-[#161513] dark:text-[#F5F3EE]">
                {t(UI_COPY.demo.roi.resultsHeading, locale)}
              </h3>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 [@media(min-height:800px)]:gap-3.5">
                <div className="p-2.5 [@media(min-height:800px)]:p-3.5 rounded-xl bg-[#F3FBF8] dark:bg-[#12221E] border border-[#B7E4D8] dark:border-[#1E4F49]">
                  <dt className="text-xs text-[#0F766E] dark:text-[#2DD4BF]">
                    {t(UI_COPY.demo.roi.annualSavingsLabel, locale)}
                  </dt>
                  <dd
                    data-testid="roi-annual-savings"
                    className="mt-0.5 [@media(min-height:800px)]:mt-1 font-mono tabular-nums text-2xl [@media(min-height:800px)]:text-3xl font-semibold text-[#0F766E] dark:text-[#2DD4BF]"
                  >
                    {formatCurrencyUsd(roiResult.annualSavingsUsd)}
                  </dd>
                </div>

                <div className="p-2.5 [@media(min-height:800px)]:p-3.5 rounded-xl bg-[#FAF8F4] dark:bg-[#131210] border border-[#E5E0D6] dark:border-[#2A2825]">
                  <dt className="text-xs text-[#6E6960] dark:text-[#A8A298]">
                    {t(UI_COPY.demo.roi.savedHoursLabel, locale)}
                  </dt>
                  <dd className="mt-0.5 [@media(min-height:800px)]:mt-1 font-mono tabular-nums text-2xl [@media(min-height:800px)]:text-3xl font-semibold text-[#161513] dark:text-[#F5F3EE]">
                    {formatInteger(roiResult.monthlySavedHours)}{' '}
                    <span className="text-sm font-normal text-[#6E6960] dark:text-[#A8A298]">
                      {t(UI_COPY.demo.roi.hoursUnit, locale)}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 [@media(min-height:800px)]:gap-4 pt-2 [@media(min-height:800px)]:pt-3 border-t border-[#E5E0D6] dark:border-[#2A2825]">
                <div>
                  <p className="text-xs text-[#6E6960] dark:text-[#A8A298]">
                    {t(UI_COPY.demo.roi.paybackLabel, locale)}
                  </p>
                  <p className="mt-0.5 font-mono tabular-nums text-base [@media(min-height:800px)]:text-lg font-semibold text-[#B45309] dark:text-[#FBBF24]">
                    ~{roiResult.paybackWeeks} {t(UI_COPY.demo.roi.weeksUnit, locale)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[#6E6960] dark:text-[#A8A298]">
                    {t(UI_COPY.demo.roi.recommendedLabel, locale)}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[#161513] dark:text-[#F5F3EE]">
                    {t(recommendedService.title, locale)}
                  </p>
                </div>
              </div>

              {/* Dynamic 6-Month Cumulative Payback Timeline */}
              <div className="p-2.5 [@media(min-height:800px)]:p-3.5 rounded-xl bg-[#FAF8F4] dark:bg-[#131210] border border-[#E5E0D6] dark:border-[#2A2825] space-y-1.5 [@media(min-height:800px)]:space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[11px] font-mono">
                  <span className="font-semibold text-[#5C5852] dark:text-[#A8A298]">
                    {locale === 'uk'
                      ? 'Накопичена економія за 6 місяців'
                      : '6-Month Cumulative Savings Curve'}
                  </span>
                  <span className="font-semibold text-[#0F766E] dark:text-[#2DD4BF] whitespace-nowrap">
                    {locale === 'uk' ? 'Чистий ефект:' : '6m Net:'}{' '}
                    {paybackCurve[5].netPositionUsd >= 0 ? '+' : ''}
                    {formatCurrencyUsd(paybackCurve[5].netPositionUsd)}
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-2 items-end h-[66px] [@media(min-height:800px)]:h-[86px] pt-1.5 [@media(min-height:800px)]:pt-3">
                  {paybackCurve.map((pt) => (
                    <div key={pt.monthIndex} className="h-full flex flex-col justify-end items-center gap-0.5 [@media(min-height:800px)]:gap-1">
                      <span className="font-mono tabular-nums text-[10px] text-[#6E6960] dark:text-[#A8A298]">
                        ${Math.round(pt.cumulativeSavingsUsd / 1000)}k
                      </span>
                      <div
                        className={`w-full rounded-t-md transition-all duration-300 ${
                          pt.isBreakEvenOrPositive
                            ? pt.monthIndex === 6
                              ? 'bg-[#0F766E] dark:bg-[#14B8A6]'
                              : 'bg-[#0F766E]/35 dark:bg-[#2DD4BF]/35'
                            : 'bg-[#D97706]/45 dark:bg-[#FBBF24]/45'
                        }`}
                        style={{ height: `${Math.max(14, Math.round(pt.heightPct * 0.44))}px` }}
                      />
                      <span className="font-mono text-[10px] text-[#6E6960] dark:text-[#918A7E]">
                        {locale === 'uk' ? `М${pt.monthIndex}` : `M${pt.monthIndex}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 [@media(min-height:800px)]:pt-3 border-t border-[#E5E0D6] dark:border-[#2A2825] flex flex-wrap items-center justify-between gap-2.5">
              <span className="font-mono tabular-nums text-xs text-[#6E6960] dark:text-[#A8A298] whitespace-nowrap">
                {locale === 'uk' ? 'Орієнтир впровадження:' : 'Est. build scope:'}{' '}
                {formatCurrencyUsd(roiResult.estimatedProjectCostUsd)}
              </span>

              <button
                type="button"
                onClick={() => {
                  const draft = buildRoiInquiryDraft(
                    roiResult,
                    {
                      teamSize,
                      weeklyManualHoursPerPerson: weeklyManualHours,
                      hourlyRateUsd,
                    },
                    locale
                  );
                    const summary = buildRoiPrefillSummary(roiResult, locale);
                    onTransferRoiPlan(roiResult.recommendedServiceId, draft, summary);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 [@media(min-height:800px)]:py-2.5 text-sm font-semibold text-white bg-[#CC4518] hover:bg-[#B23A12] dark:bg-[#DC5324] dark:hover:bg-[#EA6233] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t(UI_COPY.demo.roi.transferBtn, locale)}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
