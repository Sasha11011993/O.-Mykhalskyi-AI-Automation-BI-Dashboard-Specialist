'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import {
  ROI_HOURLY_RATE_MAX,
  ROI_HOURLY_RATE_MIN,
  ROI_RATE_PRESETS,
  buildRoiInquiryDraft,
  buildRoiPrefillSummary,
  calculateAutomationRoi,
  computeSliderFillPct,
  formatCurrencyUsd,
  formatInteger,
  parseHourlyRateInput,
  type RoiInput,
  type ServiceId,
} from '@/lib/portfolioLogic';

interface HeroRoiStripProps {
  roiInput: RoiInput;
  onChangeRoiInput: (next: RoiInput) => void;
  onOpenDetailedRoi: () => void;
  onTransferRoiPlan: (serviceId: ServiceId, draftText: string, contextSummary?: string) => void;
}

export default function HeroRoiStrip({
  roiInput,
  onChangeRoiInput,
  onOpenDetailedRoi,
  onTransferRoiPlan,
}: HeroRoiStripProps) {
  const { locale } = useThemeLocale();
  const [rateDraft, setRateDraft] = useState<string | null>(null);

  const roiResult = useMemo(() => calculateAutomationRoi(roiInput), [roiInput]);

  const displayedRate = rateDraft ?? String(roiInput.hourlyRateUsd);

  const handleRateInputChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '').slice(0, 3);
    setRateDraft(cleaned);
    if (!cleaned) return;
    const parsed = Number.parseInt(cleaned, 10);
    if (parsed >= ROI_HOURLY_RATE_MIN && parsed <= ROI_HOURLY_RATE_MAX) {
      onChangeRoiInput({ ...roiInput, hourlyRateUsd: parsed });
    }
  };

  const commitRateDraft = () => {
    if (rateDraft === null) return;
    const normalized = parseHourlyRateInput(rateDraft, roiInput.hourlyRateUsd);
    setRateDraft(null);
    if (normalized !== roiInput.hourlyRateUsd) {
      onChangeRoiInput({ ...roiInput, hourlyRateUsd: normalized });
    }
  };

  const handleSelectPresetRate = (rate: number) => {
    setRateDraft(null);
    onChangeRoiInput({ ...roiInput, hourlyRateUsd: rate });
  };

  const handleRequestPlan = () => {
    const draft = buildRoiInquiryDraft(roiResult, roiInput, locale);
    const summary = buildRoiPrefillSummary(roiResult, locale);
    onTransferRoiPlan(roiResult.recommendedServiceId, draft, summary);
  };

  return (
    <div
      data-testid="hero-roi-strip"
      role="region"
      aria-label={
        locale === 'uk'
          ? 'Швидкий калькулятор окупності автоматизації'
          : 'Quick Automation ROI Calculator'
      }
      className="shrink-0 w-full rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] px-4 xl:px-5 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 lg:gap-4 xl:gap-5"
    >
      {/* Left Zone: Tactile Interactive Controls (Team, Manual Hours, Hourly Rate Presets) */}
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-12 gap-3 lg:gap-3 xl:gap-4 items-center">
        {/* Slider 1: Team Size */}
        <div className="sm:col-span-4 space-y-1">
          <div className="flex items-center justify-between gap-1 text-[11px]">
            <label
              htmlFor="hero-roi-team"
              className="font-medium text-[#5C5852] dark:text-[#A8A298] whitespace-nowrap"
            >
              {locale === 'uk' ? 'Команда' : 'Team'}
            </label>
            <span className="font-mono tabular-nums font-semibold text-[#161513] dark:text-[#F5F3EE] whitespace-nowrap">
              {roiInput.teamSize} {locale === 'uk' ? 'ос.' : 'ppl'}
            </span>
          </div>
          <input
            id="hero-roi-team"
            data-testid="hero-roi-team-slider"
            type="range"
            min={1}
            max={40}
            step={1}
            value={roiInput.teamSize}
            onChange={(e) =>
              onChangeRoiInput({ ...roiInput, teamSize: Number(e.target.value) })
            }
            style={
              {
                '--slider-fill': `${computeSliderFillPct(roiInput.teamSize, 1, 40)}%`,
              } as React.CSSProperties
            }
            className="roi-range-slider"
          />
        </div>

        {/* Slider 2: Weekly Manual Hours */}
        <div className="sm:col-span-4 space-y-1">
          <div className="flex items-center justify-between gap-1 text-[11px]">
            <label
              htmlFor="hero-roi-hours"
              className="font-medium text-[#5C5852] dark:text-[#A8A298] whitespace-nowrap"
            >
              {locale === 'uk' ? 'Рутина / тижд.' : 'Manual / wk'}
            </label>
            <span className="font-mono tabular-nums font-semibold text-[#161513] dark:text-[#F5F3EE] whitespace-nowrap">
              {roiInput.weeklyManualHoursPerPerson} {locale === 'uk' ? 'год' : 'hrs'}
            </span>
          </div>
          <input
            id="hero-roi-hours"
            data-testid="hero-roi-hours-slider"
            type="range"
            min={2}
            max={30}
            step={1}
            value={roiInput.weeklyManualHoursPerPerson}
            onChange={(e) =>
              onChangeRoiInput({
                ...roiInput,
                weeklyManualHoursPerPerson: Number(e.target.value),
              })
            }
            style={
              {
                '--slider-fill': `${computeSliderFillPct(roiInput.weeklyManualHoursPerPerson, 2, 30)}%`,
              } as React.CSSProperties
            }
            className="roi-range-slider"
          />
        </div>

        {/* Hourly Rate: Direct Numeric Input ($5–$200) + Quick Presets ($10 / $20 / $40) */}
        <div className="sm:col-span-4 space-y-1">
          <div className="flex items-center justify-between gap-1.5 text-[11px]">
            <label
              htmlFor="hero-roi-rate-input"
              className="font-medium text-[#5C5852] dark:text-[#A8A298] whitespace-nowrap"
            >
              {locale === 'uk' ? 'Ставка / год' : 'Hourly rate'}
            </label>
            <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#FAF8F4] dark:bg-[#1B1A18] border border-[#DDD6C9] dark:border-[#33302B] focus-within:border-[#CC4518] dark:focus-within:border-[#FB8356] transition-colors">
              <span
                aria-hidden="true"
                className="font-mono text-[11px] font-semibold text-[#78716C] dark:text-[#8A8277]"
              >
                $
              </span>
              <input
                id="hero-roi-rate-input"
                data-testid="hero-roi-rate-input"
                type="text"
                inputMode="numeric"
                aria-label={
                  locale === 'uk'
                    ? 'Власна ставка за годину в доларах США'
                    : 'Custom hourly rate in USD'
                }
                value={displayedRate}
                onFocus={(e) => {
                  setRateDraft(String(roiInput.hourlyRateUsd));
                  e.currentTarget.select();
                }}
                onChange={(e) => handleRateInputChange(e.target.value)}
                onBlur={commitRateDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitRateDraft();
                    e.currentTarget.blur();
                  }
                }}
                className="w-8 bg-transparent font-mono tabular-nums text-[11px] font-semibold text-[#161513] dark:text-[#F5F3EE] text-right focus:outline-none"
              />
            </div>
          </div>
          <div
            role="group"
            aria-label={locale === 'uk' ? 'Швидкий вибір ставки за годину' : 'Hourly rate presets'}
            className="inline-flex w-full items-center p-0.5 rounded-lg bg-[#EFECE5] dark:bg-[#1F1E1B] border border-[#E5E0D6] dark:border-[#2A2825]"
          >
            {ROI_RATE_PRESETS.map((rate) => {
              const isSelected = roiInput.hourlyRateUsd === rate;
              return (
                <button
                  key={rate}
                  type="button"
                  data-testid={`hero-roi-rate-preset-${rate}`}
                  aria-pressed={isSelected}
                  onClick={() => handleSelectPresetRate(rate)}
                  className={`flex-1 py-0.5 text-[11px] font-mono tabular-nums font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] ${
                    isSelected
                      ? 'bg-white dark:bg-[#2B2926] text-[#161513] dark:text-[#F5F3EE] shadow-2xs'
                      : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  ${rate}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Subtle Architectural Divider */}
      <div
        aria-hidden="true"
        className="hidden lg:block w-px self-stretch bg-[#E5E0D6] dark:bg-[#2A2825] shrink-0"
      />

      {/* Right Zone: Live Projected Savings Readout + Full Chart & Plan Transfer Actions */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 sm:gap-5 pt-2.5 lg:pt-0 border-t lg:border-t-0 border-[#E5E0D6] dark:border-[#2A2825] shrink-0">
        {/* Live Tabular Metrics */}
        <dl className="flex items-center gap-4 sm:gap-5">
          <div className="flex flex-col">
            <dd
              data-testid="hero-roi-annual-savings"
              className="font-mono tabular-nums text-xl sm:text-[22px] font-semibold tracking-tight text-[#0F766E] dark:text-[#2DD4BF] leading-none whitespace-nowrap"
            >
              {formatCurrencyUsd(roiResult.annualSavingsUsd)}
            </dd>
            <dt className="mt-1 text-[11px] text-[#6E6960] dark:text-[#A8A298] whitespace-nowrap">
              {locale === 'uk' ? 'економія / рік' : 'annual savings'}
            </dt>
          </div>

          <div className="flex flex-col">
            <dd
              data-testid="hero-roi-monthly-hours"
              className="font-mono tabular-nums text-sm sm:text-base font-semibold text-[#161513] dark:text-[#F5F3EE] leading-none whitespace-nowrap"
            >
              {formatInteger(roiResult.monthlySavedHours)}{' '}
              <span className="text-[11px] font-normal text-[#6E6960] dark:text-[#A8A298]">
                {locale === 'uk' ? 'год/міс' : 'hrs/mo'}
              </span>
            </dd>
            <dt className="mt-1 text-[11px] text-[#6E6960] dark:text-[#A8A298] whitespace-nowrap">
              {locale === 'uk' ? 'вивільнено' : 'reclaimed'}
            </dt>
          </div>

          <div className="hidden sm:flex flex-col">
            <dd
              data-testid="hero-roi-payback"
              className="font-mono tabular-nums text-sm sm:text-base font-semibold text-[#B45309] dark:text-[#FBBF24] leading-none whitespace-nowrap"
            >
              ~{roiResult.paybackWeeks} {locale === 'uk' ? 'тижн.' : 'wks'}
            </dd>
            <dt className="mt-1 text-[11px] text-[#6E6960] dark:text-[#A8A298] whitespace-nowrap">
              {locale === 'uk' ? 'окупність' : 'payback'}
            </dt>
          </div>
        </dl>

        {/* Actions: Open Full 6m ROI Chart + Transfer Plan Directly to Contact */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            type="button"
            data-testid="hero-roi-chart-btn"
            onClick={onOpenDetailedRoi}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#1B1A18] text-[#161513] dark:text-[#F5F3EE] hover:border-[#CC4518] dark:hover:border-[#FB8356] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518]"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" aria-hidden="true" />
            <span>{locale === 'uk' ? 'Графік 6 міс.' : '6m Chart'}</span>
          </button>

          <button
            type="button"
            data-testid="hero-roi-plan-btn"
            onClick={handleRequestPlan}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#CC4518] hover:bg-[#B23A12] dark:bg-[#DC5324] dark:hover:bg-[#EA6233] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518]"
          >
            <span>{locale === 'uk' ? 'Отримати план' : 'Get Plan'}</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
