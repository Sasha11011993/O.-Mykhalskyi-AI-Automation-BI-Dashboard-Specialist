'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  Bot,
  Briefcase,
  Compass,
  HelpCircle,
  Layers,
  Mail,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';
import { ThemeLocaleProvider, useThemeLocale } from '@/components/ThemeLocaleContext';
import FirebaseErrorBoundary from '@/components/FirebaseErrorBoundary';
import { PortfolioCasesProvider, usePortfolioCases } from '@/components/PortfolioCasesProvider';
import AiAgentDrawer from '@/components/AiAgentDrawer';
import type { CaseN8nPresetId } from '@/components/CaseN8nWorkflowViewer';
import OverviewTab from '@/components/tabs/OverviewTab';
import ServicesTab from '@/components/tabs/ServicesTab';
import CasesTab from '@/components/tabs/CasesTab';
import LiveDemoTab from '@/components/tabs/LiveDemoTab';
import FaqTab from '@/components/tabs/FaqTab';
import ContactTab from '@/components/tabs/ContactTab';
import {
  AGENT_UI_COPY,
  type AgentRecommendation,
  type AgentRoiEstimate,
} from '@/lib/agentLogic';
import { BRAND_NAME, MOBILE_TAB_LABELS, TAB_LABELS, UI_COPY, t } from '@/lib/portfolioData';
import {
  DEFAULT_ROI_INPUT,
  TABS_ORDER,
  getAdjacentTab,
  getTabIndexNumber,
  type RoiInput,
  type ServiceId,
  type TabId,
  type ThemePreference,
} from '@/lib/portfolioLogic';

const TAB_ICONS: Record<TabId, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  overview: Compass,
  services: Layers,
  cases: Briefcase,
  demo: BarChart3,
  faq: HelpCircle,
  contact: Mail,
};

function PortfolioWorkspace() {
  const {
    locale,
    setLocale,
    toggleLocale,
    themePreference,
    resolvedTheme,
    setThemePreference,
    cycleTheme,
  } = useThemeLocale();

  const { resolveCaseById } = usePortfolioCases();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [direction, setDirection] = useState<number>(1);
  const [prefilledServiceId, setPrefilledServiceId] = useState<ServiceId>('ai-agents');
  const [focusedServiceId, setFocusedServiceId] = useState<ServiceId>('etl-pipelines');
  const [prefilledDetails, setPrefilledDetails] = useState<string>('');
  const [prefillSummary, setPrefillSummary] = useState<string>('');
  const [prefillVersion, setPrefillVersion] = useState<number>(0);
  const [roiInput, setRoiInput] = useState<RoiInput>(DEFAULT_ROI_INPUT);
  const [demoMode, setDemoMode] = useState<'bi' | 'roi'>('bi');
  const [isAgentOpen, setIsAgentOpen] = useState<boolean>(false);
  const [launchedN8nPreset, setLaunchedN8nPreset] = useState<{
    preset: CaseN8nPresetId;
    version: number;
  } | null>(null);
  const [requestedCaseId, setRequestedCaseId] = useState<string | null>(null);
  const [caseOpenVersion, setCaseOpenVersion] = useState<number>(0);

  // Support shareable direct links /?case=<id> (including unlisted NDA cases)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const caseParam = params.get('case')?.trim();
    if (!caseParam) return;

    let cancelled = false;
    void resolveCaseById(caseParam).then((found) => {
      if (cancelled || !found) return;
      setRequestedCaseId(found.id);
      setCaseOpenVersion((v) => v + 1);
      setDirection(1);
      setActiveTab('cases');
    });

    return () => {
      cancelled = true;
    };
  }, [resolveCaseById]);

  const navigateToTab = useCallback(
    (nextTab: TabId) => {
      if (nextTab === activeTab) return;
      if (nextTab === 'cases') {
        setRequestedCaseId(null);
      }
      const currentIdx = TABS_ORDER.indexOf(activeTab);
      const nextIdx = TABS_ORDER.indexOf(nextTab);
      setDirection(nextIdx >= currentIdx ? 1 : -1);
      setActiveTab(nextTab);
    },
    [activeTab]
  );

  // Keyboard SPA navigation (1-6 and ArrowLeft/ArrowRight) outside text inputs and drawer
  useEffect(() => {
    if (isAgentOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (event.key >= '1' && event.key <= '6') {
        const idx = Number(event.key) - 1;
        const targetTab = TABS_ORDER[idx];
        if (targetTab) navigateToTab(targetTab);
      } else if (event.key === 'ArrowRight') {
        navigateToTab(getAdjacentTab(activeTab, 'next'));
      } else if (event.key === 'ArrowLeft') {
        navigateToTab(getAdjacentTab(activeTab, 'prev'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isAgentOpen, navigateToTab]);

  const handleInspectService = (serviceId: ServiceId) => {
    setFocusedServiceId(serviceId);
    navigateToTab('services');
  };

  const handleRequestService = (serviceId: ServiceId) => {
    setPrefilledServiceId(serviceId);
    setPrefillSummary('');
    setPrefillVersion((v) => v + 1);
    navigateToTab('contact');
  };

  const handlePrefillAndContact = (
    serviceId: ServiceId,
    note: string,
    contextSummary?: string
  ) => {
    setPrefilledServiceId(serviceId);
    setPrefilledDetails(note);
    setPrefillSummary(contextSummary ?? '');
    setPrefillVersion((v) => v + 1);
    navigateToTab('contact');
  };

  const handleOpenDetailedRoi = () => {
    setDemoMode('roi');
    navigateToTab('demo');
  };

  const handleApplyAgentRoi = (estimate: AgentRoiEstimate) => {
    setRoiInput(estimate);
    setDemoMode('roi');
    navigateToTab('demo');
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsAgentOpen(false);
    }
  };

  const handleTransferAgentBrief = (recommendation: AgentRecommendation) => {
    if (recommendation.roiEstimate) {
      setRoiInput(recommendation.roiEstimate);
    }
    setPrefilledServiceId(recommendation.serviceId);
    setPrefilledDetails(recommendation.briefDraft);
    setPrefillSummary(recommendation.briefSummary);
    setPrefillVersion((v) => v + 1);
    navigateToTab('contact');
    setIsAgentOpen(false);
  };

  const handleOpenContactDirect = () => {
    setIsAgentOpen(false);
    navigateToTab('contact');
  };

  const handleLaunchN8nCase = (preset: CaseN8nPresetId) => {
    setLaunchedN8nPreset((prev) => ({ preset, version: (prev?.version ?? 0) + 1 }));
    navigateToTab('overview');
  };

  const handleOpenCaseStudy = (caseId: string) => {
    setRequestedCaseId(caseId);
    setCaseOpenVersion((v) => v + 1);
    const currentIdx = TABS_ORDER.indexOf(activeTab);
    const nextIdx = TABS_ORDER.indexOf('cases');
    setDirection(nextIdx >= currentIdx ? 1 : -1);
    setActiveTab('cases');
  };

  const renderThemeIcon = (pref: ThemePreference) => {
    if (pref === 'dark') return <Moon className="w-3.5 h-3.5" aria-hidden="true" />;
    if (pref === 'light') return <Sun className="w-3.5 h-3.5" aria-hidden="true" />;
    return <Monitor className="w-3.5 h-3.5" aria-hidden="true" />;
  };

  return (
    <div
      data-active-tab={activeTab}
      data-theme={resolvedTheme}
      className="h-dvh w-full overflow-hidden flex flex-col bg-[#F7F5F0] dark:bg-[#111110] text-[#161513] dark:text-[#F5F3EE] transition-colors duration-200"
    >
      {/* Top Navigation Bar — Strictly 3-Zone Contract on Desktop */}
      <header className="shrink-0 h-13 md:h-16 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-[#F7F5F0]/95 dark:bg-[#111110]/95 backdrop-blur-sm">
        <div className="h-full max-w-[1280px] mx-auto px-4 md:px-5 lg:px-8 flex items-center justify-between gap-3 md:gap-4 lg:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigateToTab('overview')}
            className="inline-flex items-center gap-2 text-base lg:text-lg font-bold tracking-tight text-[#161513] dark:text-[#F5F3EE] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] rounded px-1 cursor-pointer"
          >
            <span
              aria-hidden="true"
              className="w-2 h-2 rounded-xs bg-[#CC4518] dark:bg-[#F97343] shrink-0"
            />
            <span>{BRAND_NAME}</span>
          </button>

          {/* Zone 2 (Desktop): 6 Single-Line Tab Links with Motion Shared Underline */}
          <nav
            aria-label={locale === 'uk' ? 'Основна навігація' : 'Primary navigation'}
            className="hidden md:flex items-center gap-3.5 lg:gap-6"
          >
            {TABS_ORDER.map((tabId) => {
              const isActive = activeTab === tabId;
              return (
                <button
                  key={tabId}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => navigateToTab(tabId)}
                  className={`relative py-2 text-[13px] lg:text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] rounded cursor-pointer ${
                    isActive
                      ? 'text-[#161513] dark:text-[#F5F3EE]'
                      : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  {t(TAB_LABELS[tabId], locale)}
                  {isActive && (
                    <motion.span
                      layoutId="desktop-tab-underline"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                      className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-[#CC4518] dark:bg-[#F97343] rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3 (Desktop): Secondary AI Agent Trigger + Primary Graphite CTA */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsAgentOpen(true)}
              aria-label={t(AGENT_UI_COPY.openDrawerAria, locale)}
              aria-expanded={isAgentOpen}
              className="inline-flex items-center gap-1.5 px-2.5 lg:px-3 py-1.5 lg:py-2 text-xs font-semibold rounded-lg border border-[#D8D1C4] dark:border-[#34312D] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] hover:border-[#CC4518]/60 dark:hover:border-[#F97343]/60 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-[#CC4518] dark:text-[#F97343]" aria-hidden="true" />
              <span>{t(AGENT_UI_COPY.headerButtonDesktop, locale)}</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToTab('contact')}
              className="px-3 lg:px-4 py-1.5 lg:py-2 text-xs font-semibold text-white bg-[#161513] hover:bg-[#2B2825] dark:bg-[#F5F3EE] dark:hover:bg-[#E5E0D6] dark:text-[#111110] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] cursor-pointer"
            >
              {t(UI_COPY.primaryCta, locale)}
            </button>
          </div>

          {/* Mobile Compact Utility Controls (AI Agent + Language + Theme) */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsAgentOpen(true)}
              aria-label={t(AGENT_UI_COPY.openDrawerAria, locale)}
              aria-expanded={isAgentOpen}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-[#CC4518]/45 dark:border-[#F97343]/50 bg-[#CC4518]/[0.07] dark:bg-[#F97343]/[0.12] text-[#B83B12] dark:text-[#FBA07A] whitespace-nowrap cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t(AGENT_UI_COPY.headerButtonMobile, locale)}</span>
            </button>
            <button
              type="button"
              onClick={toggleLocale}
              aria-label={locale === 'uk' ? 'Перемкнути мову на англійську' : 'Switch language to Ukrainian'}
              className="px-2 py-1.5 text-xs font-mono font-semibold rounded-md border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] whitespace-nowrap cursor-pointer"
            >
              {locale === 'uk' ? 'EN' : 'UA'}
            </button>
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={
                locale === 'uk'
                  ? `Змінити тему (поточна: ${t(UI_COPY.themeLabels[themePreference], locale)})`
                  : `Cycle color theme (current: ${t(UI_COPY.themeLabels[themePreference], locale)})`
              }
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] whitespace-nowrap cursor-pointer"
            >
              {renderThemeIcon(themePreference)}
              <span>{t(UI_COPY.themeLabels[themePreference], locale)}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Single-Viewport SPA Stage */}
      <main className="flex-1 min-h-0 w-full overflow-y-auto inner-scroll">
        <div className="min-h-full lg:h-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 lg:py-4 [@media(min-height:800px)]:py-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: direction * 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -14 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="min-h-full lg:h-full w-full"
            >
              {activeTab === 'overview' && (
                <OverviewTab
                  onNavigate={(nextTab) => {
                    if (nextTab === 'demo') setDemoMode('bi');
                    navigateToTab(nextTab);
                  }}
                  onInspectService={handleInspectService}
                  onOpenCaseStudy={handleOpenCaseStudy}
                  roiInput={roiInput}
                  onChangeRoiInput={setRoiInput}
                  onOpenDetailedRoi={handleOpenDetailedRoi}
                  onTransferRoiPlan={handlePrefillAndContact}
                  externalN8nPreset={launchedN8nPreset}
                />
              )}
              {activeTab === 'services' && (
                <ServicesTab
                  key={focusedServiceId}
                  initialServiceId={focusedServiceId}
                  onRequestService={handleRequestService}
                />
              )}
              {activeTab === 'cases' && (
                <CasesTab
                  key={caseOpenVersion}
                  initialCaseId={requestedCaseId}
                  onScopeSimilar={handlePrefillAndContact}
                  onLaunchN8nCase={handleLaunchN8nCase}
                />
              )}
              {activeTab === 'demo' && (
                <LiveDemoTab
                  mode={demoMode}
                  onModeChange={setDemoMode}
                  roiInput={roiInput}
                  onChangeRoiInput={setRoiInput}
                  onTransferRoiPlan={handlePrefillAndContact}
                />
              )}
              {activeTab === 'faq' && (
                <FaqTab
                  onNavigate={navigateToTab}
                  onRequestAudit={handlePrefillAndContact}
                />
              )}
              {activeTab === 'contact' && (
                <ContactTab
                  key={prefillVersion}
                  prefilledServiceId={prefilledServiceId}
                  prefilledDetails={prefilledDetails}
                  prefillSummary={prefillSummary}
                  onClearPrefillNote={() => {
                    setPrefilledDetails('');
                    setPrefillSummary('');
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Desktop Architectural Bottom Bar: Quiet Copyright + Language & Theme Controls */}
      <footer className="hidden md:block shrink-0 h-11 border-t border-[#E5E0D6] dark:border-[#2A2825] bg-[#F7F5F0] dark:bg-[#111110]">
        <div className="h-full max-w-[1280px] mx-auto px-6 lg:px-8 flex items-center justify-between gap-4 text-xs text-[#5C5852] dark:text-[#A8A298]">
          <div className="flex items-center gap-3 whitespace-nowrap">
            <span>{t(UI_COPY.footerMeta, locale)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-[#161513] dark:text-[#F5F3EE]">
              {getTabIndexNumber(activeTab)} / 06
            </span>
          </div>

          <span className="hidden lg:inline text-[11px] text-[#6E6960] dark:text-[#918A7E]">
            {t(UI_COPY.keyboardHint, locale)}
          </span>

          {/* Real Functional Language & Theme Controls */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Language Segmented Control */}
            <div
              role="group"
              aria-label={locale === 'uk' ? 'Вибір мови' : 'Language selector'}
              className="inline-flex items-center p-0.5 rounded-md bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825]"
            >
              {(['uk', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  aria-pressed={locale === lang}
                  onClick={() => setLocale(lang)}
                  className={`px-2 py-0.5 text-[11px] font-mono font-semibold rounded transition-colors cursor-pointer ${
                    locale === lang
                      ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-2xs'
                      : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  {lang === 'uk' ? 'UA' : 'EN'}
                </button>
              ))}
            </div>

            {/* Theme Segmented Control (Auto / Light / Dark) */}
            <div
              role="group"
              aria-label={locale === 'uk' ? 'Вибір теми оформлення' : 'Color theme selector'}
              className="inline-flex items-center p-0.5 rounded-md bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825]"
            >
              {(['system', 'light', 'dark'] as const).map((pref) => (
                <button
                  key={pref}
                  type="button"
                  aria-pressed={themePreference === pref}
                  onClick={() => setThemePreference(pref)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    themePreference === pref
                      ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-2xs'
                      : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  {renderThemeIcon(pref)}
                  <span>{t(UI_COPY.themeLabels[pref], locale)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile Compact Bottom Tab Bar (Combined Top + Bottom = 110px / 844px = 13% <= 15% cap) */}
      <nav
        aria-label={locale === 'uk' ? 'Мобільна навігація вкладками' : 'Mobile tab navigation'}
        className="md:hidden shrink-0 h-[58px] border-t border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#161513] grid grid-cols-6"
      >
        {TABS_ORDER.map((tabId) => {
          const Icon = TAB_ICONS[tabId];
          const isActive = activeTab === tabId;
          return (
            <button
              key={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => navigateToTab(tabId)}
              className={`flex flex-col items-center justify-center gap-0.5 px-0.5 text-[9.5px] tracking-tight font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#C84317] dark:text-[#FB8356]'
                  : 'text-[#5C5852] dark:text-[#A8A298]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden={true} />
              <span className="truncate max-w-full">{t(MOBILE_TAB_LABELS[tabId], locale)}</span>
            </button>
          );
        })}
      </nav>
      {/* Slide-over AI Agent Drawer */}
      <AiAgentDrawer
        isOpen={isAgentOpen}
        onClose={() => setIsAgentOpen(false)}
        currentRoi={roiInput}
        onApplyRoi={handleApplyAgentRoi}
        onTransferToBrief={handleTransferAgentBrief}
        onOpenContactDirect={handleOpenContactDirect}
      />
    </div>
  );
}

export default function PortfolioShell() {
  return (
    <ThemeLocaleProvider>
      <FirebaseErrorBoundary>
        <PortfolioCasesProvider>
          <PortfolioWorkspace />
        </PortfolioCasesProvider>
      </FirebaseErrorBoundary>
    </ThemeLocaleProvider>
  );
}
