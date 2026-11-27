'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, Layers, Lock, Play, Workflow, X } from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import { usePortfolioCases } from '@/components/PortfolioCasesProvider';
import CaseN8nWorkflowViewer, { type CaseN8nPresetId } from '@/components/CaseN8nWorkflowViewer';
import MultiSceneCaseViewer from '@/components/MultiSceneCaseViewer';
import { UI_COPY, t } from '@/lib/portfolioData';
import { PORTFOLIO_IMAGES } from '@/lib/portfolioImages';
import {
  buildCasePrefillSummary,
  filterCaseStudies,
  type CaseCategory,
  type ServiceId,
} from '@/lib/portfolioLogic';
import { formatScenesBadgeSummary, type UnifiedCaseStudy } from '@/lib/caseStudioTypes';
import { CASE_CATEGORY_TEXT } from '@/lib/serviceThemes';

interface CasesTabProps {
  onScopeSimilar: (serviceId: ServiceId, contextNote: string, contextSummary?: string) => void;
  onLaunchN8nCase?: (preset: CaseN8nPresetId) => void;
  initialCaseId?: string | null;
}

const CATEGORIES: readonly CaseCategory[] = ['all', 'ai', 'bi', 'etl'] as const;

export default function CasesTab({
  onScopeSimilar,
  onLaunchN8nCase,
  initialCaseId,
}: CasesTabProps) {
  const { locale } = useThemeLocale();
  const { cases, directCase, mediaUrls, ensureMediaLoaded } = usePortfolioCases();
  const [activeCategory, setActiveCategory] = useState<CaseCategory>('all');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId ?? null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const visibleCases = useMemo(
    () => filterCaseStudies(cases, activeCategory),
    [cases, activeCategory]
  );

  // Resolve selected case from public merged list or unlisted NDA directCase
  const selectedCase: UnifiedCaseStudy | null = useMemo(() => {
    if (!selectedCaseId) return null;
    const fromPublic = cases.find((c) => c.id === selectedCaseId);
    if (fromPublic) return fromPublic;
    if (directCase && directCase.id === selectedCaseId) return directCase;
    return null;
  }, [cases, directCase, selectedCaseId]);

  // Preload cover images for any Firestore case currently visible
  useEffect(() => {
    for (const item of visibleCases) {
      if (item.coverMediaId && !mediaUrls[item.coverMediaId]) {
        ensureMediaLoaded(item.coverMediaId);
      }
    }
    if (selectedCase?.coverMediaId && !mediaUrls[selectedCase.coverMediaId]) {
      ensureMediaLoaded(selectedCase.coverMediaId);
    }
  }, [visibleCases, selectedCase?.coverMediaId, mediaUrls, ensureMediaLoaded]);

  // Close case lightbox modal on Escape key
  useEffect(() => {
    if (!selectedCase) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedCaseId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCase]);

  const markImageFailed = (id: string) => {
    setFailedImages((prev) => ({ ...prev, [id]: true }));
  };

  const hasSelectedTestimonial =
    selectedCase !== null && t(selectedCase.testimonial.quote, locale).trim().length > 0;

  return (
    <section
      aria-label={locale === 'uk' ? 'Кейси' : 'Case Studies'}
      className="min-h-full lg:h-full w-full flex flex-col gap-4 lg:gap-5 pb-3 lg:pb-0"
    >
      {/* Header + Segmented Filter Control */}
      <div className="shrink-0 flex flex-col lg:flex-row lg:items-end justify-between gap-3 pb-3 xl:pb-4 border-b border-[#E5E0D6] dark:border-[#2A2825]">
        <div>
          <p className="text-xs font-medium text-[#5C5852] dark:text-[#A8A298] mb-1">
            {t(UI_COPY.cases.kicker, locale)}
          </p>
          <h2 className="text-2xl sm:text-[26px] xl:text-[28px] font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] leading-tight">
            {t(UI_COPY.cases.heading, locale)}
          </h2>
        </div>

        {/* Functional Filter Segmented Control */}
        <div
          role="group"
          aria-label={
            locale === 'uk' ? 'Фільтр категорій кейсів' : 'Filter case studies by category'
          }
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825] self-start lg:self-auto overflow-x-auto max-w-full"
        >
          {CATEGORIES.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveCategory(category)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-xs'
                    : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                }`}
              >
                {t(UI_COPY.cases.filters[category], locale)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bento Case Showcase Grid (strict 2x2 up to 4 items; fluid scroll beyond 4) */}
      <div
        className={`flex-1 min-h-0 grid gap-3.5 xl:gap-5 ${
          visibleCases.length === 1
            ? 'grid-cols-1 max-w-2xl'
            : visibleCases.length === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : visibleCases.length <= 4
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-rows-2'
                : 'grid-cols-1 md:grid-cols-2 auto-rows-[minmax(200px,auto)]'
        }`}
      >
        {visibleCases.map((item, idx) => {
          const firestoreCoverUrl = item.coverMediaId ? mediaUrls[item.coverMediaId] : '';
          const scenesSummary =
            item.scenes && item.scenes.length > 0
              ? formatScenesBadgeSummary(item.scenes, locale)
              : '';
          const hasDynamicN8nScene = Boolean(item.scenes?.some((s) => s.kind === 'n8n-json'));

          return (
            <motion.article
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="group relative rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] hover:border-[#CC4518]/50 dark:hover:border-[#FB8356]/50 transition-colors overflow-hidden min-h-[180px] lg:min-h-0"
            >
              <button
                type="button"
                data-testid={`case-card-${item.id}`}
                onClick={() => setSelectedCaseId(item.id)}
                aria-label={`${t(UI_COPY.cases.viewCase, locale)}: ${t(item.title, locale)}`}
                className="w-full h-full text-left flex flex-col lg:flex-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#CC4518] cursor-pointer"
              >
                {/* Media Thumbnail */}
                <div className="relative w-full lg:w-[34%] xl:w-[38%] h-44 md:h-40 lg:h-auto shrink-0 bg-[#EFECE5] dark:bg-[#1F1E1B] overflow-hidden border-b lg:border-b-0 lg:border-r border-[#E5E0D6] dark:border-[#2A2825]">
                  {item.n8nPreset ? (
                    <CaseN8nWorkflowViewer
                      preset={item.n8nPreset}
                      variant="thumbnail"
                      screenshotSrc={item.workflowScreenshotSrc}
                      title={t(item.title, locale)}
                    />
                  ) : item.source === 'firestore' && firestoreCoverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={firestoreCoverUrl}
                      alt={t(item.title, locale)}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : item.source === 'firestore' && hasDynamicN8nScene ? (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center bg-[#FAF8F4] dark:bg-[#141311]"
                      style={{
                        backgroundImage:
                          'radial-gradient(circle, rgba(120,113,108,0.2) 1px, transparent 1px)',
                        backgroundSize: '14px 14px',
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#CC4518]/12 dark:bg-[#FB8356]/15 border border-[#CC4518]/30 dark:border-[#FB8356]/35 flex items-center justify-center">
                        <Workflow
                          className="w-5 h-5 text-[#CC4518] dark:text-[#FB8356]"
                          aria-hidden="true"
                        />
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-[#161513] dark:text-[#F5F3EE]">
                        {locale === 'uk' ? 'Live n8n воркфлоу' : 'Live n8n workflow'}
                      </span>
                      {scenesSummary && (
                        <span className="font-mono text-[10px] text-[#6E6960] dark:text-[#A8A298]">
                          {scenesSummary}
                        </span>
                      )}
                    </div>
                  ) : !failedImages[item.id] ? (
                    <Image
                      src={PORTFOLIO_IMAGES[item.imageKey]}
                      alt={t(item.title, locale)}
                      fill
                      priority={idx === 0}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 24vw"
                      referrerPolicy="no-referrer"
                      onError={() => markImageFailed(item.id)}
                      className="object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#EFECE5] to-[#DDD6C9] dark:from-[#1F1E1B] dark:to-[#141311]">
                      <Layers className="w-7 h-7 text-[#78716C]" aria-hidden="true" />
                    </div>
                  )}
                </div>

                {/* Editorial Body */}
                <div className="flex-1 min-w-0 p-4 xl:p-5 flex flex-col justify-between gap-2.5">
                  <div className="space-y-1.5 min-w-0">
                    {/* Clean Unboxed Metadata */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6E6960] dark:text-[#A8A298]">
                      <span className={`font-semibold ${CASE_CATEGORY_TEXT[item.category]}`}>
                        {t(item.categoryLabel, locale)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{t(item.industry, locale)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{item.year}</span>
                      {scenesSummary && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-[11px] text-[#555049] dark:text-[#B5AFA5]">
                            {scenesSummary}
                          </span>
                        </>
                      )}
                    </div>

                    <h3 className="text-[15px] xl:text-base font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] leading-snug line-clamp-2 group-hover:text-[#C84317] dark:group-hover:text-[#FB8356] transition-colors">
                      {t(item.title, locale)}
                    </h3>

                    <p className="text-xs xl:text-[13px] text-[#555049] dark:text-[#B5AFA5] leading-relaxed line-clamp-2">
                      {t(item.summary, locale)}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-[#E5E0D6] dark:border-[#2A2825] flex items-center justify-between gap-2 min-w-0">
                    <span className="font-mono tabular-nums text-xs font-semibold text-[#0F766E] dark:text-[#2DD4BF] truncate min-w-0">
                      {t(item.headlineMetric, locale)}
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#C84317] dark:text-[#FB8356] group-hover:underline underline-offset-4 whitespace-nowrap shrink-0">
                      <span>{t(UI_COPY.cases.viewCase, locale)}</span>
                      <ArrowUpRight
                        className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </div>
              </button>
            </motion.article>
          );
        })}
      </div>

      {/* Fullscreen Accessible Case Study Lightbox Modal */}
      <AnimatePresence>
        {selectedCase && (
          <motion.div
            key="case-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#111110]/70"
            onClick={() => setSelectedCaseId(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="case-modal-title"
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.985 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl max-h-[88dvh] overflow-y-auto inner-scroll rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] shadow-2xl"
            >
              {/* Modal Top Bar */}
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 sm:px-7 py-4 bg-white/95 dark:bg-[#181715]/95 backdrop-blur-md border-b border-[#E5E0D6] dark:border-[#2A2825]">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6960] dark:text-[#A8A298]">
                  <span className={`font-semibold ${CASE_CATEGORY_TEXT[selectedCase.category]}`}>
                    {t(selectedCase.categoryLabel, locale)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{t(selectedCase.industry, locale)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {selectedCase.year}
                    {t(selectedCase.duration, locale)
                      ? ` · ${t(selectedCase.duration, locale)}`
                      : ''}
                  </span>
                  {selectedCase.status === 'unlisted' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-[#B45309] dark:text-[#FBBF24]">
                        <Lock className="w-3 h-3" aria-hidden="true" />
                        <span>{locale === 'uk' ? 'NDA · прямий доступ' : 'NDA · direct link'}</span>
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCaseId(null)}
                  aria-label={t(UI_COPY.cases.modal.closeLabel, locale)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#E5E0D6] dark:border-[#2A2825] text-[#161513] dark:text-[#F5F3EE] hover:bg-[#EFECE5] dark:hover:bg-[#24221F] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 sm:p-7 space-y-6">
                {selectedCase.scenes && selectedCase.scenes.length > 0 ? (
                  /* Multi-Scene Dynamic Case (n8n JSON + Telegram / Web UI / Annotated Screenshots) */
                  <div className="space-y-5">
                    <h3
                      id="case-modal-title"
                      className="text-xl sm:text-2xl font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] leading-snug"
                    >
                      {t(selectedCase.title, locale)}
                    </h3>

                    <MultiSceneCaseViewer
                      scenes={selectedCase.scenes}
                      localMediaMap={mediaUrls}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1">
                          {t(UI_COPY.cases.modal.challenge, locale)}
                        </p>
                        <p className="text-sm text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                          {t(selectedCase.challenge, locale)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1">
                          {t(UI_COPY.cases.modal.solution, locale)}
                        </p>
                        <p className="text-sm text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                          {t(selectedCase.solution, locale)}
                        </p>
                      </div>
                    </div>

                    {selectedCase.stack.length > 0 && (
                      <p className="text-xs font-mono text-[#6E6960] dark:text-[#918A7E]">
                        {t(UI_COPY.cases.modal.stack, locale)}: {selectedCase.stack.join(' · ')}
                      </p>
                    )}
                  </div>
                ) : selectedCase.n8nPreset ? (
                  /* Flagship Pixel-Calibrated n8n Case */
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h3
                        id="case-modal-title"
                        className="text-xl sm:text-2xl font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] leading-snug"
                      >
                        {t(selectedCase.title, locale)}
                      </h3>

                      {onLaunchN8nCase && (
                        <button
                          type="button"
                          data-testid="launch-case-n8n-canvas-btn"
                          onClick={() => {
                            const preset = selectedCase.n8nPreset!;
                            setSelectedCaseId(null);
                            onLaunchN8nCase(preset);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#CC4518]/45 dark:border-[#FB8356]/50 bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356] hover:bg-[#FFE6D9] dark:hover:bg-[#3A2218] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {locale === 'uk'
                              ? 'Запустити на головній схемі'
                              : 'Run on Live Canvas'}
                          </span>
                        </button>
                      )}
                    </div>

                    <CaseN8nWorkflowViewer
                      preset={selectedCase.n8nPreset}
                      variant="interactive"
                      screenshotSrc={selectedCase.workflowScreenshotSrc}
                      title={t(selectedCase.title, locale)}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1">
                          {t(UI_COPY.cases.modal.challenge, locale)}
                        </p>
                        <p className="text-sm text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                          {t(selectedCase.challenge, locale)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1">
                          {t(UI_COPY.cases.modal.solution, locale)}
                        </p>
                        <p className="text-sm text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                          {t(selectedCase.solution, locale)}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs font-mono text-[#6E6960] dark:text-[#918A7E]">
                      {t(UI_COPY.cases.modal.stack, locale)}: {selectedCase.stack.join(' · ')}
                    </p>
                  </div>
                ) : (
                  /* Editorial Single-Image Case */
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                    <div className="md:col-span-5 relative min-h-[200px] rounded-xl overflow-hidden border border-[#E5E0D6] dark:border-[#2A2825] bg-[#EFECE5] dark:bg-[#1F1E1B]">
                      {selectedCase.coverMediaId && mediaUrls[selectedCase.coverMediaId] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrls[selectedCase.coverMediaId]}
                          alt={t(selectedCase.title, locale)}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : !failedImages[selectedCase.id] ? (
                        <Image
                          src={PORTFOLIO_IMAGES[selectedCase.imageKey]}
                          alt={t(selectedCase.title, locale)}
                          fill
                          sizes="(max-width: 768px) 100vw, 35vw"
                          referrerPolicy="no-referrer"
                          onError={() => markImageFailed(selectedCase.id)}
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Layers className="w-8 h-8 text-[#78716C]" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-7 flex flex-col justify-between gap-4">
                      <div className="space-y-3">
                        <h3
                          id="case-modal-title"
                          className="text-xl sm:text-2xl font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] leading-snug"
                        >
                          {t(selectedCase.title, locale)}
                        </h3>

                        <div>
                          <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1">
                            {t(UI_COPY.cases.modal.challenge, locale)}
                          </p>
                          <p className="text-sm text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                            {t(selectedCase.challenge, locale)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1">
                            {t(UI_COPY.cases.modal.solution, locale)}
                          </p>
                          <p className="text-sm text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                            {t(selectedCase.solution, locale)}
                          </p>
                        </div>
                      </div>

                      {selectedCase.stack.length > 0 && (
                        <p className="text-xs font-mono text-[#6E6960] dark:text-[#918A7E]">
                          {t(UI_COPY.cases.modal.stack, locale)}: {selectedCase.stack.join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Quantified Outcomes Row */}
                {selectedCase.metrics.length > 0 && (
                  <div className="pt-5 border-t border-[#E5E0D6] dark:border-[#2A2825]">
                    <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-3">
                      {t(UI_COPY.cases.modal.outcomes, locale)}
                    </p>
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {selectedCase.metrics.map((metric, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-[#FAF8F4] dark:bg-[#131210] border border-[#E5E0D6] dark:border-[#2A2825]"
                        >
                          <dd className="font-mono tabular-nums text-xl sm:text-2xl font-semibold text-[#C84317] dark:text-[#FB8356]">
                            {metric.value}
                          </dd>
                          <dt className="mt-1 text-xs text-[#555049] dark:text-[#A8A298]">
                            {t(metric.label, locale)}
                          </dt>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

                {/* Attributable Client Testimonial (optional) + CTA */}
                <div className="pt-5 border-t border-[#E5E0D6] dark:border-[#2A2825] flex flex-col md:flex-row md:items-end justify-between gap-5">
                  {hasSelectedTestimonial ? (
                    <blockquote className="max-w-2xl space-y-2">
                      <p className="font-serif text-base sm:text-[17px] italic text-[#161513] dark:text-[#F5F3EE] leading-relaxed">
                        “{t(selectedCase.testimonial.quote, locale)}”
                      </p>
                      <footer className="text-xs text-[#6E6960] dark:text-[#A8A298]">
                        <span className="font-semibold text-[#161513] dark:text-[#EAE6DF]">
                          {t(selectedCase.testimonial.author, locale)}
                        </span>
                        {(t(selectedCase.testimonial.role, locale) ||
                          selectedCase.testimonial.company) && (
                          <>
                            {' · '}
                            {[
                              t(selectedCase.testimonial.role, locale),
                              selectedCase.testimonial.company,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </>
                        )}
                      </footer>
                    </blockquote>
                  ) : (
                    <p className="text-xs text-[#6E6960] dark:text-[#A8A298] max-w-xl">
                      {locale === 'uk'
                        ? 'Потрібна подібна система під ваші процеси? Залиште короткий опис задачі — підготую архітектуру та оцінку.'
                        : 'Need a similar system tailored to your workflows? Share a brief description for an architecture outline and estimate.'}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const caseTitle = t(selectedCase.title, locale);
                      const serviceId = selectedCase.relatedServiceId;
                      setSelectedCaseId(null);
                      onScopeSimilar(
                        serviceId,
                        locale === 'uk'
                          ? `Цікавить подібне рішення до кейсу «${caseTitle}».`
                          : `Interested in a similar system to "${caseTitle}".`,
                        buildCasePrefillSummary(caseTitle, locale)
                      );
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#CC4518] hover:bg-[#B23A12] dark:bg-[#DC5324] dark:hover:bg-[#EA6233] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>{t(UI_COPY.cases.modal.similarCta, locale)}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
