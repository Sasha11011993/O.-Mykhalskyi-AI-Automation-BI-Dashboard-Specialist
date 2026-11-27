'use client';

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ArrowRight, Check } from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import { SERVICES_DATA, UI_COPY, t } from '@/lib/portfolioData';
import type { ServiceId } from '@/lib/portfolioLogic';
import { SERVICE_ACCENTS } from '@/lib/serviceThemes';

interface ServicesTabProps {
  initialServiceId?: ServiceId;
  onRequestService: (serviceId: ServiceId) => void;
}

export default function ServicesTab({
  initialServiceId = 'ai-agents',
  onRequestService,
}: ServicesTabProps) {
  const { locale } = useThemeLocale();
  const [selectedId, setSelectedId] = useState<ServiceId>(initialServiceId);
  const detailRef = useRef<HTMLDivElement>(null);

  const activeService =
    SERVICES_DATA.find((service) => service.id === selectedId) ?? SERVICES_DATA[0];
  const activeAccent = SERVICE_ACCENTS[activeService.id];

  // GSAP subtle stagger reveal whenever the selected service changes
  useEffect(() => {
    const panel = detailRef.current;
    if (!panel) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.js-service-stagger',
        { y: 8, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.24,
          stagger: 0.03,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
        }
      );
    }, panel);

    return () => ctx.revert();
  }, [selectedId, locale]);

  return (
    <section
      aria-label={locale === 'uk' ? 'Послуги' : 'Services'}
      className="min-h-full lg:h-full w-full flex flex-col gap-4 xl:gap-6 pb-3 lg:pb-0"
    >
      {/* Editorial Section Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 xl:pb-4 border-b border-[#E5E0D6] dark:border-[#2A2825]">
        <div>
          <p className="text-xs font-medium text-[#5C5852] dark:text-[#A8A298] mb-0.5 xl:mb-1">
            {t(UI_COPY.services.kicker, locale)}
          </p>
          <h2 className="text-2xl sm:text-[26px] xl:text-[28px] font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] leading-tight">
            {t(UI_COPY.services.heading, locale)}
          </h2>
        </div>
        <p className={`font-mono tabular-nums text-xs font-semibold ${activeAccent.accentText}`}>
          {activeService.index} / 04
        </p>
      </div>

      {/* Master-Detail Asymmetric Split */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 xl:gap-10 items-stretch">
        {/* Left Navigation Index (Editorial Numbered List with Semantic Left Strip) */}
        <div
          role="tablist"
          aria-orientation="vertical"
          aria-label={locale === 'uk' ? 'Список послуг' : 'Services list'}
          className="lg:col-span-5 flex flex-col justify-between gap-2"
        >
          {SERVICES_DATA.map((service) => {
            const isSelected = service.id === activeService.id;
            const accent = SERVICE_ACCENTS[service.id];
            return (
              <button
                key={service.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedId(service.id)}
                className={`relative overflow-hidden group flex-1 text-left pl-5 pr-4 py-3 xl:py-3.5 rounded-xl border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] cursor-pointer flex items-center justify-between gap-4 ${
                  isSelected
                    ? `${accent.activeCard} shadow-2xs`
                    : 'bg-white/60 dark:bg-[#181715]/60 border-[#E5E0D6] dark:border-[#2A2825] text-[#555049] dark:text-[#A8A298] hover:bg-white dark:hover:bg-[#181715] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-2.5 bottom-2.5 w-[3.5px] rounded-r-full transition-opacity ${
                    accent.barBg
                  } ${isSelected ? 'opacity-100' : 'opacity-25 group-hover:opacity-60'}`}
                />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2.5">
                    <span
                      className={`font-mono tabular-nums text-xs font-semibold ${
                        isSelected ? accent.accentText : 'text-[#78716C] dark:text-[#8A8277]'
                      }`}
                    >
                      {service.index}
                    </span>
                    <span className="text-sm sm:text-[15px] font-semibold tracking-tight truncate">
                      {t(service.title, locale)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6E6960] dark:text-[#918A7E] pl-7">
                    {t(service.timeline, locale)} · {t(service.investment, locale)}
                  </p>
                </div>

                <ArrowRight
                  aria-hidden="true"
                  className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                    isSelected
                      ? `${accent.accentText} translate-x-0.5`
                      : 'text-[#A8A298] opacity-0 group-hover:opacity-100'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right Detail Inspector Pane (Single Elevation Surface) */}
        <div
          ref={detailRef}
          role="tabpanel"
          className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] p-5 xl:p-7 flex flex-col justify-between gap-4 xl:gap-5"
        >
          <div className="space-y-3 xl:space-y-4">
            <div className="js-service-stagger flex flex-wrap items-center justify-between gap-2">
              <span className={`font-mono tabular-nums text-xs font-semibold ${activeAccent.accentText}`}>
                {activeService.index} {t(activeService.shortTitle, locale)}
              </span>
              <span className="text-xs font-mono tabular-nums text-[#6E6960] dark:text-[#A8A298]">
                {t(UI_COPY.services.timelineLabel, locale)}: {t(activeService.timeline, locale)} ·{' '}
                {t(UI_COPY.services.investmentLabel, locale)}: {t(activeService.investment, locale)}
              </span>
            </div>

            <h3 className="js-service-stagger text-xl sm:text-2xl font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] leading-snug">
              {t(activeService.title, locale)}
            </h3>

            <p className="js-service-stagger text-sm sm:text-[15px] leading-[1.6] text-[#555049] dark:text-[#B5AFA5]">
              {t(activeService.summary, locale)}
            </p>

            {/* Deliverables */}
            <div className="js-service-stagger pt-2 border-t border-[#E5E0D6] dark:border-[#2A2825]">
              <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-2.5">
                {t(UI_COPY.services.deliverablesLabel, locale)}
              </p>
              <ul className="space-y-2">
                {activeService.deliverables.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-sm text-[#3F3B36] dark:text-[#D6D1C7] leading-snug"
                  >
                    <Check
                      className={`w-4 h-4 shrink-0 mt-0.5 ${activeAccent.accentText}`}
                      aria-hidden="true"
                    />
                    <span>{t(item, locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Metadata & Primary Service Action */}
          <div className="js-service-stagger pt-4 border-t border-[#E5E0D6] dark:border-[#2A2825] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF]">
                {t(UI_COPY.services.impactLabel, locale)}
              </p>
              <p className="text-xs sm:text-[13px] text-[#555049] dark:text-[#B5AFA5]">
                {t(activeService.outcome, locale)}
              </p>
              <p className="text-xs font-mono text-[#6E6960] dark:text-[#918A7E] pt-0.5">
                {activeService.stack.join(' · ')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onRequestService(activeService.id)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#CC4518] hover:bg-[#B23A12] dark:bg-[#DC5324] dark:hover:bg-[#EA6233] rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t(UI_COPY.services.requestBtn, locale)}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
