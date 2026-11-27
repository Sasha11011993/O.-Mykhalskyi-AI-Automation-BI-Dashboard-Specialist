'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronDown, ShieldCheck } from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import { FAQ_COPY, FAQ_ITEMS, t } from '@/lib/portfolioData';
import {
  filterFaqItems,
  toggleFaqItem,
  type FaqCategory,
  type ServiceId,
  type TabId,
} from '@/lib/portfolioLogic';

interface FaqTabProps {
  onNavigate: (tab: TabId) => void;
  onRequestAudit: (serviceId: ServiceId, note: string, contextSummary?: string) => void;
}

const FAQ_CATEGORIES: readonly FaqCategory[] = ['all', 'process', 'pricing', 'security'] as const;

export default function FaqTab({ onNavigate, onRequestAudit }: FaqTabProps) {
  const { locale } = useThemeLocale();
  const [activeCategory, setActiveCategory] = useState<FaqCategory>('all');
  const [openId, setOpenId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);

  const visibleItems = filterFaqItems(FAQ_ITEMS, activeCategory);

  const handleSelectCategory = (nextCategory: FaqCategory) => {
    setActiveCategory(nextCategory);
    const nextList = filterFaqItems(FAQ_ITEMS, nextCategory);
    if (nextList.length > 0 && !nextList.some((item) => item.id === openId)) {
      setOpenId(nextList[0].id);
    }
  };

  const handleToggleItem = (id: string) => {
    setOpenId((prev) => toggleFaqItem(prev, id));
  };

  const handleStartAudit = () => {
    const note =
      locale === 'uk'
        ? 'Цікавить фіксований спринт «Аудит і план автоматизації» ($850) для оцінки процесів та архітектури.'
        : 'Interested in the fixed “Audit & Automation Roadmap” sprint ($850) to map processes and architecture.';
    const summary =
      locale === 'uk'
        ? 'Обрано формат старту: Аудит і план ($850)'
        : 'Selected kickoff track: Audit & Roadmap ($850)';
    onRequestAudit('audit-architecture', note, summary);
  };

  return (
    <section
      aria-label={locale === 'uk' ? 'Часті питання' : 'Frequently Asked Questions'}
      className="min-h-full lg:h-full w-full flex flex-col gap-4 [@media(min-height:800px)]:gap-5 pb-3 lg:pb-0"
    >
      {/* Header + Category Filter Segmented Control */}
      <div className="shrink-0 pb-3 [@media(min-height:800px)]:pb-4 border-b border-[#E5E0D6] dark:border-[#2A2825] flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#5C5852] dark:text-[#A8A298] mb-1">
            {t(FAQ_COPY.kicker, locale)}
          </p>
          <h2 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] leading-tight">
            {t(FAQ_COPY.heading, locale)}
          </h2>
        </div>

        <div
          role="group"
          aria-label={locale === 'uk' ? 'Фільтр категорій питань' : 'Filter FAQ topics'}
          className="inline-flex items-center p-1 rounded-lg bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825] self-start sm:self-auto"
        >
          {FAQ_CATEGORIES.map((category) => {
            const isSelected = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                data-testid={`faq-filter-${category}`}
                aria-pressed={isSelected}
                onClick={() => handleSelectCategory(category)}
                className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] ${
                  isSelected
                    ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-2xs font-semibold'
                    : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                }`}
              >
                {t(FAQ_COPY.filters[category], locale)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Editorial Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-stretch">
        {/* Left Column on Desktop (Below Accordion on Mobile): 3-Step Summary + Direct CTA */}
        <aside className="order-2 lg:order-1 lg:col-span-4 flex flex-col justify-between gap-4">
          {/* Compact Numbered Collaboration Blueprint */}
          <div className="space-y-3 [@media(min-height:800px)]:space-y-4">
            <h3 className="text-xs font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE]">
              {t(FAQ_COPY.processTitle, locale)}
            </h3>
            <ol className="space-y-2.5 [@media(min-height:800px)]:space-y-3.5">
              {FAQ_COPY.steps.map((step) => (
                <li key={step.index} className="flex items-start gap-2.5">
                  <span className="font-mono text-xs font-semibold text-[#C84317] dark:text-[#FB8356] mt-0.5 shrink-0">
                    {step.index}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#161513] dark:text-[#F5F3EE] leading-snug">
                      {t(step.title, locale)}
                    </p>
                    <p className="mt-0.5 text-xs text-[#5C5852] dark:text-[#A8A298] leading-[1.45]">
                      {t(step.desc, locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Direct Action Card */}
          <div className="p-4 [@media(min-height:800px)]:p-5 rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck
                className="w-4 h-4 text-[#0F766E] dark:text-[#2DD4BF] mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-semibold text-[#161513] dark:text-[#F5F3EE] leading-snug">
                  {t(FAQ_COPY.ctaTitle, locale)}
                </h3>
                <p className="mt-1 text-xs text-[#5C5852] dark:text-[#A8A298] leading-[1.5]">
                  {t(FAQ_COPY.ctaLead, locale)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
              <button
                type="button"
                data-testid="faq-ask-btn"
                onClick={() => onNavigate('contact')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#CC4518] hover:bg-[#B23A12] dark:bg-[#DC5324] dark:hover:bg-[#EA6233] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518]"
              >
                <span>{t(FAQ_COPY.ctaPrimary, locale)}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>

              <button
                type="button"
                data-testid="faq-audit-btn"
                onClick={handleStartAudit}
                className="inline-flex items-center px-2 py-1.5 text-xs font-medium text-[#161513] dark:text-[#F5F3EE] hover:text-[#C84317] dark:hover:text-[#FB8356] underline-offset-4 hover:underline transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] rounded-md"
              >
                {t(FAQ_COPY.ctaAudit, locale)}
              </button>
            </div>
          </div>
        </aside>

        {/* Right Column on Desktop (First on Mobile): Accessible Animated Accordion */}
        <div
          data-testid="faq-accordion"
          className="order-1 lg:order-2 lg:col-span-8 flex flex-col justify-start gap-2 [@media(min-height:800px)]:gap-2.5"
        >
          {visibleItems.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                data-testid={`faq-item-${item.id}`}
                className={`rounded-xl border transition-colors duration-150 ${
                  isOpen
                    ? 'bg-white dark:bg-[#181715] border-[#CC4518]/45 dark:border-[#FB8356]/45 shadow-2xs'
                    : 'bg-white/75 dark:bg-[#181715]/75 border-[#E5E0D6] dark:border-[#2A2825] hover:bg-white dark:hover:bg-[#181715] hover:border-[#D5CEC2] dark:hover:border-[#3A3732]'
                }`}
              >
                <h3 className="m-0">
                  <button
                    id={`faq-trigger-${item.id}`}
                    type="button"
                    data-testid={`faq-trigger-${item.id}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${item.id}`}
                    onClick={() => handleToggleItem(item.id)}
                    className="w-full px-4 py-2.5 [@media(min-height:800px)]:py-3.5 flex items-center justify-between gap-3 text-left cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518]"
                  >
                    <div className="flex items-baseline gap-2.5 min-w-0">
                      <span
                        className={`font-mono text-xs font-semibold shrink-0 transition-colors ${
                          isOpen
                            ? 'text-[#C84317] dark:text-[#FB8356]'
                            : 'text-[#78716C] dark:text-[#8A8277]'
                        }`}
                      >
                        {item.index}
                      </span>
                      <span className="text-[13.5px] sm:text-sm font-semibold text-[#161513] dark:text-[#F5F3EE] leading-snug">
                        {t(item.question, locale)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="hidden sm:inline font-mono text-[11px] text-[#6E6960] dark:text-[#918A7E] whitespace-nowrap">
                        {t(item.meta, locale)}
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                          isOpen
                            ? 'rotate-180 text-[#C84317] dark:text-[#FB8356]'
                            : 'text-[#78716C] dark:text-[#8A8277]'
                        }`}
                      />
                    </div>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${item.id}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${item.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 [@media(min-height:800px)]:pb-4 pl-10 [@media(min-height:800px)]:pl-11 pr-5 border-t border-[#EFECE5] dark:border-[#24221F] pt-2.5">
                        <p className="text-[13px] sm:text-[13.5px] leading-[1.55] text-[#4C4741] dark:text-[#B8B2A7]">
                          {t(item.answer, locale)}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
