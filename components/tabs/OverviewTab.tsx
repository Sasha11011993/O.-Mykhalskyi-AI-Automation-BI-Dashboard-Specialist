'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowRight } from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import PipelineArchitectureCanvas from '@/components/PipelineArchitectureCanvas';
import type { CaseN8nPresetId } from '@/components/CaseN8nWorkflowViewer';
import HeroRoiStrip from '@/components/HeroRoiStrip';
import { SERVICES_DATA, UI_COPY, t } from '@/lib/portfolioData';
import type { RoiInput, ServiceId, TabId } from '@/lib/portfolioLogic';
import { SERVICE_ACCENTS } from '@/lib/serviceThemes';

interface OverviewTabProps {
  onNavigate: (tab: TabId) => void;
  onInspectService: (serviceId: ServiceId) => void;
  onOpenCaseStudy?: (caseId: string) => void;
  roiInput: RoiInput;
  onChangeRoiInput: (next: RoiInput) => void;
  onOpenDetailedRoi: () => void;
  onTransferRoiPlan: (serviceId: ServiceId, draftText: string, contextSummary?: string) => void;
  externalN8nPreset?: { preset: CaseN8nPresetId; version: number } | null;
}

export default function OverviewTab({
  onNavigate,
  onInspectService,
  onOpenCaseStudy,
  roiInput,
  onChangeRoiInput,
  onOpenDetailedRoi,
  onTransferRoiPlan,
  externalN8nPreset,
}: OverviewTabProps) {
  const { locale } = useThemeLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  // Default to real n8n AI workflow on first paint so live n8n execution is immediately visible
  const [selectedServiceId, setSelectedServiceId] = useState<ServiceId>('ai-agents');

  // GSAP choreographed subtle hero reveal (compositor transform only, zero layout shift)
  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.from('.js-hero-reveal', {
        y: 10,
        duration: 0.34,
        stagger: 0.04,
        ease: 'power2.out',
        clearProps: 'transform',
      });
    }, container);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      aria-label={locale === 'uk' ? 'Огляд портфоліо' : 'Portfolio Overview'}
      className="min-h-full lg:h-full w-full flex flex-col justify-between gap-4 lg:gap-5 pb-3 lg:pb-0"
    >
      {/* Top Architectural Split: Immediate Services Index + Compact Proof (Left) + Live n8n/ETL Canvas (Right) */}
      <div className="lg:flex-1 lg:min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-8 items-stretch">
        {/* Left Column: Clear Positioning + Compact Unboxed Proof Line + 4-Service Interactive Selector */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-2.5 sm:gap-3.5">
          <div className="space-y-2 sm:space-y-3">
            <p className="js-hero-reveal text-xs sm:text-[13px] font-medium text-[#5C5852] dark:text-[#A8A298] tracking-[0.01em]">
              {t(UI_COPY.overview.kicker, locale)}
            </p>

            <h1 className="js-hero-reveal text-[clamp(1.65rem,2.85vw,2.65rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-[#161513] dark:text-[#F5F3EE] [text-wrap:balance]">
              {t(UI_COPY.overview.headline, locale)}
            </h1>

            <p className="js-hero-reveal text-[13.5px] sm:text-[14.5px] leading-[1.5] sm:leading-[1.55] text-[#555049] dark:text-[#A8A298] max-w-[54ch]">
              {t(UI_COPY.overview.lead, locale)}
            </p>
          </div>

          {/* Instant 4-Service Directory: Client immediately sees all services & switches live n8n/BI/ETL flow */}
          <div className="js-hero-reveal space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-[#5C5852] dark:text-[#A8A298]">
              <span>
                {locale === 'uk'
                  ? 'Ключові послуги — оберіть для перегляду архітектури'
                  : 'Core Services — select to preview live architecture'}
              </span>
            </div>

            <div
              role="group"
              aria-label={locale === 'uk' ? 'Швидкий огляд послуг' : 'Quick service selector'}
              className="grid grid-cols-2 gap-1.5 sm:gap-2"
            >
              {SERVICES_DATA.map((service) => {
                const isSelected = selectedServiceId === service.id;
                const accent = SERVICE_ACCENTS[service.id];
                return (
                  <button
                    key={service.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedServiceId(service.id)}
                    className={`relative overflow-hidden text-left pl-2.5 pr-2 py-1.5 sm:pl-3.5 sm:pr-3 sm:py-2 rounded-xl border transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] ${
                      isSelected
                        ? `${accent.activeCard} shadow-2xs`
                        : 'bg-white/75 dark:bg-[#181715]/75 border-[#E5E0D6] dark:border-[#2A2825] text-[#555049] dark:text-[#A8A298] hover:bg-white dark:hover:bg-[#181715] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-opacity ${
                        accent.barBg
                      } ${isSelected ? 'opacity-100' : 'opacity-30'}`}
                    />
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs sm:text-[13px] font-semibold tracking-tight truncate">
                        <span
                          className={`font-mono mr-1 sm:mr-1.5 ${
                            isSelected ? accent.accentText : 'text-[#78716C] dark:text-[#8A8277]'
                          }`}
                        >
                          {service.index}
                        </span>
                        {t(service.shortTitle, locale)}
                      </span>
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${accent.barBg}`}
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] sm:text-[11px] tracking-tighter sm:tracking-normal font-mono tabular-nums text-[#6E6960] dark:text-[#918A7E] truncate">
                      {t(service.timeline, locale)} · {t(service.investment, locale)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary & Secondary Actions */}
          <div className="js-hero-reveal flex flex-wrap items-center gap-4 pt-0.5">
            <button
              type="button"
              onClick={() => onNavigate('cases')}
              className="inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold text-white bg-[#CC4518] hover:bg-[#B23A12] dark:bg-[#DC5324] dark:hover:bg-[#EA6233] rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#111110] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t(UI_COPY.overview.ctaPrimary, locale)}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('demo')}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium text-[#161513] dark:text-[#F5F3EE] hover:text-[#C84317] dark:hover:text-[#FB8356] transition-colors duration-150 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] rounded-md whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t(UI_COPY.overview.ctaSecondary, locale)}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Interactive n8n & ETL/BI Flow Architecture Canvas */}
        <div className="js-hero-reveal lg:col-span-7 lg:min-h-0">
          <PipelineArchitectureCanvas
            activeServiceId={selectedServiceId}
            onSelectService={setSelectedServiceId}
            onInspectService={onInspectService}
            onOpenCaseStudy={onOpenCaseStudy}
            externalN8nPreset={externalN8nPreset}
          />
        </div>
      </div>

      {/* Bottom Full-Width Interactive Live ROI Strip (Synced with Live Demo & Contact) */}
      <div className="js-hero-reveal shrink-0">
        <HeroRoiStrip
          roiInput={roiInput}
          onChangeRoiInput={onChangeRoiInput}
          onOpenDetailedRoi={onOpenDetailedRoi}
          onTransferRoiPlan={onTransferRoiPlan}
        />
      </div>
    </section>
  );
}
