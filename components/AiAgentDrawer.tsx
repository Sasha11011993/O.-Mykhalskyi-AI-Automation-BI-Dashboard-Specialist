'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  RotateCcw,
  Send,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import { SERVICES_DATA, t } from '@/lib/portfolioData';
import {
  calculateAutomationRoi,
  formatCurrencyUsd,
  formatInteger,
  type RoiInput,
} from '@/lib/portfolioLogic';
import {
  AGENT_MAX_MESSAGE_CHARS,
  AGENT_STARTER_PROMPTS,
  AGENT_UI_COPY,
  type AgentRecommendation,
  type AgentResponsePayload,
  type AgentRoiEstimate,
  type AgentUiMessage,
} from '@/lib/agentLogic';

interface AiAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoi: RoiInput;
  onApplyRoi: (estimate: AgentRoiEstimate) => void;
  onTransferToBrief: (recommendation: AgentRecommendation) => void;
  onOpenContactDirect: () => void;
}

export default function AiAgentDrawer({
  isOpen,
  onClose,
  currentRoi,
  onApplyRoi,
  onTransferToBrief,
  onOpenContactDirect,
}: AiAgentDrawerProps) {
  const { locale } = useThemeLocale();
  const [messages, setMessages] = useState<AgentUiMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [appliedRoiMessageIds, setAppliedRoiMessageIds] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const msgCounterRef = useRef<number>(0);

  // Close drawer on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input slightly after drawer opens on desktop screens
  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      if (window.innerWidth >= 768) {
        textareaRef.current?.focus();
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Keep latest message visible
  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages.length, isLoading, errorMessage]);

  // Abort pending request on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const nextId = (prefix: string) => {
    msgCounterRef.current += 1;
    return `${prefix}-${msgCounterRef.current}`;
  };

  const sendMessage = async (rawText: string, isRetry = false) => {
    const text = rawText.trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
    setLastFailedPrompt(null);

    const historyBase = isRetry
      ? messages
      : [
          ...messages,
          {
            id: nextId('user'),
            role: 'user' as const,
            content: text,
          },
        ];

    if (!isRetry) {
      setMessages(historyBase);
      setInputValue('');
    }

    setIsLoading(true);
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          locale,
          currentRoi,
          messages: historyBase.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (AgentResponsePayload & { error?: string })
        | null;

      if (!response.ok || !payload || !payload.reply) {
        const errText =
          payload?.error ||
          (locale === 'uk'
            ? 'Не вдалося отримати відповідь від AI-агента. Спробуйте ще раз.'
            : 'Could not get a response from the AI assistant. Please try again.');
        setErrorMessage(errText);
        setLastFailedPrompt(text);
        return;
      }

      const assistantMsg: AgentUiMessage = {
        id: nextId('assistant'),
        role: 'assistant',
        content: payload.reply,
        recommendation: payload.recommendation,
        quickReplies: payload.quickReplies,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setErrorMessage(
        locale === 'uk'
          ? 'Помилка з’єднання із сервером. Перевірте мережу або відкрийте форму брифу.'
          : 'Network error while reaching the server. Please retry or open the brief form.'
      );
      setLastFailedPrompt(text);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendMessage(inputValue);
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(inputValue);
    }
  };

  const handleResetSession = () => {
    abortControllerRef.current?.abort();
    setMessages([]);
    setInputValue('');
    setIsLoading(false);
    setErrorMessage(null);
    setLastFailedPrompt(null);
    setAppliedRoiMessageIds({});
  };

  const handleApplyRoiClick = (messageId: string, estimate: AgentRoiEstimate) => {
    onApplyRoi(estimate);
    setAppliedRoiMessageIds((prev) => ({ ...prev, [messageId]: true }));
  };

  const latestAssistantId =
    [...messages].reverse().find((msg) => msg.role === 'assistant')?.id ?? null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-agent-drawer-title"
          data-testid="ai-agent-drawer"
        >
          {/* Backdrop Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-[#111110]/30 dark:bg-black/55"
          />

          {/* Slide-over Drawer Panel */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="relative z-10 h-dvh w-full sm:w-[440px] max-w-full flex flex-col bg-[#F7F5F0] dark:bg-[#111110] text-[#161513] dark:text-[#F5F3EE] border-l border-[#E5E0D6] dark:border-[#2A2825] shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="shrink-0 px-4 sm:px-5 py-3.5 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-white/85 dark:bg-[#161513]/95 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg border border-[#E5E0D6] dark:border-[#2A2825] bg-[#F7F5F0] dark:bg-[#1D1C19] flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-[#CC4518] dark:text-[#F97343]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2
                    id="ai-agent-drawer-title"
                    className="text-sm font-bold tracking-tight text-[#161513] dark:text-[#F5F3EE] truncate"
                  >
                    {t(AGENT_UI_COPY.drawerTitle, locale)}
                  </h2>
                  <p className="text-[11px] font-mono text-[#6E6960] dark:text-[#9C968B] truncate">
                    {t(AGENT_UI_COPY.drawerSubtitle, locale)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetSession}
                    aria-label={t(AGENT_UI_COPY.newSession, locale)}
                    title={t(AGENT_UI_COPY.newSession, locale)}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-md border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#1C1B18] text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span className="hidden sm:inline">{t(AGENT_UI_COPY.newSession, locale)}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t(AGENT_UI_COPY.closeDrawer, locale)}
                  className="p-1.5 rounded-md border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#1C1B18] text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Scrollable Conversation Area */}
            <div className="flex-1 min-h-0 overflow-y-auto inner-scroll px-4 sm:px-5 py-4 space-y-4">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] p-4 space-y-2">
                    <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#CC4518] dark:text-[#F97343]">
                      {locale === 'uk' ? 'Пресейл-інженер · Live AI' : 'Pre-Sales Engineer · Live AI'}
                    </p>
                    <h3 className="text-base font-bold tracking-tight leading-snug text-[#161513] dark:text-[#F5F3EE]">
                      {t(AGENT_UI_COPY.emptyHeading, locale)}
                    </h3>
                    <p className="text-xs leading-relaxed text-[#5C5852] dark:text-[#A8A298]">
                      {t(AGENT_UI_COPY.emptyLead, locale)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-mono uppercase tracking-[0.1em] text-[#6E6960] dark:text-[#9C968B] px-0.5">
                      {t(AGENT_UI_COPY.startersHeading, locale)}
                    </p>
                    <div className="space-y-2">
                      {AGENT_STARTER_PROMPTS.map((starter) => (
                        <button
                          key={starter.id}
                          type="button"
                          onClick={() => void sendMessage(t(starter.prompt, locale))}
                          disabled={isLoading}
                          className="w-full text-left rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] hover:border-[#CC4518]/60 dark:hover:border-[#F97343]/60 px-3.5 py-3 transition-colors group cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-mono font-semibold text-[#CC4518] dark:text-[#F97343]">
                              {t(starter.label, locale)}
                            </span>
                            <ArrowRight
                              className="w-3.5 h-3.5 text-[#8A8378] group-hover:text-[#CC4518] dark:group-hover:text-[#F97343] group-hover:translate-x-0.5 transition-all shrink-0"
                              aria-hidden="true"
                            />
                          </div>
                          <p className="text-xs leading-relaxed text-[#34312D] dark:text-[#D9D4CB]">
                            {t(starter.prompt, locale)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {messages.map((msg) => {
                    if (msg.role === 'user') {
                      return (
                        <div key={msg.id} className="flex justify-end">
                          <div className="max-w-[88%] rounded-xl bg-[#EFECE5] dark:bg-[#23221F] border border-[#E2DDD2] dark:border-[#32302B] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#161513] dark:text-[#F5F3EE] whitespace-pre-line">
                            {msg.content}
                          </div>
                        </div>
                      );
                    }

                    const rec = msg.recommendation;
                    const matchedService = rec
                      ? SERVICES_DATA.find((item) => item.id === rec.serviceId)
                      : undefined;
                    const computedRoi = rec?.roiEstimate
                      ? calculateAutomationRoi(rec.roiEstimate)
                      : null;
                    const isRoiApplied = Boolean(appliedRoiMessageIds[msg.id]);

                    return (
                      <div key={msg.id} className="space-y-2.5">
                        <div className="rounded-xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] p-3.5 space-y-3">
                          <p className="text-[13.5px] leading-relaxed text-[#161513] dark:text-[#F5F3EE] whitespace-pre-line">
                            {msg.content}
                          </p>

                          {/* Structured Recommendation Action Card */}
                          {rec && (
                            <div
                              data-testid="agent-recommendation-card"
                              className="rounded-lg border border-[#E5E0D6] dark:border-[#2E2C28] bg-[#FAF8F4] dark:bg-[#141311] p-3 space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-[#6E6960] dark:text-[#9C968B]">
                                    {t(AGENT_UI_COPY.recommendationLabel, locale)}
                                  </p>
                                  <p className="text-xs font-bold text-[#161513] dark:text-[#F5F3EE] mt-0.5">
                                    {matchedService
                                      ? `${matchedService.index} ${t(matchedService.title, locale)}`
                                      : rec.serviceId}
                                  </p>
                                </div>
                              </div>

                              {/* Timeline & Budget */}
                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#ECE7DD] dark:border-[#262421]">
                                <div>
                                  <p className="text-[10px] font-mono text-[#6E6960] dark:text-[#9C968B]">
                                    {t(AGENT_UI_COPY.timelineLabel, locale)}
                                  </p>
                                  <p className="text-xs font-mono font-semibold tabular-nums text-[#161513] dark:text-[#F5F3EE]">
                                    {rec.estimatedTimeline}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-mono text-[#6E6960] dark:text-[#9C968B]">
                                    {t(AGENT_UI_COPY.budgetLabel, locale)}
                                  </p>
                                  <p className="text-xs font-mono font-semibold tabular-nums text-[#161513] dark:text-[#F5F3EE]">
                                    {rec.estimatedBudgetRange}
                                  </p>
                                </div>
                              </div>

                              {/* Stack (Clean inline monospace — zero pills) */}
                              {rec.suggestedStack.length > 0 && (
                                <p className="text-[11px] font-mono text-[#5C5852] dark:text-[#A8A298] leading-snug">
                                  <span className="text-[#8A8378] dark:text-[#7D776E]">
                                    {t(AGENT_UI_COPY.stackLabel, locale)}:{' '}
                                  </span>
                                  {rec.suggestedStack.join(' · ')}
                                </p>
                              )}

                              {/* ROI Preview Block */}
                              {rec.roiEstimate && computedRoi && (
                                <div className="rounded-md border border-[#1F6E65]/30 dark:border-[#45A89D]/30 bg-[#1F6E65]/[0.05] dark:bg-[#45A89D]/[0.08] px-2.5 py-2 space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-[#1F6E65] dark:text-[#45A89D]">
                                      {t(AGENT_UI_COPY.roiPreviewLabel, locale)}
                                    </span>
                                    <span className="text-xs font-mono font-bold tabular-nums text-[#1F6E65] dark:text-[#45A89D]">
                                      {formatCurrencyUsd(computedRoi.annualSavingsUsd)}
                                      {locale === 'uk' ? '/рік' : '/yr'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] font-mono tabular-nums text-[#4E4A44] dark:text-[#BDB6AA]">
                                    {rec.roiEstimate.teamSize} {locale === 'uk' ? 'ос.' : 'ppl'} ·{' '}
                                    {rec.roiEstimate.weeklyManualHoursPerPerson}{' '}
                                    {locale === 'uk' ? 'год/тиж' : 'hrs/wk'} · $
                                    {rec.roiEstimate.hourlyRateUsd}
                                    {locale === 'uk' ? '/год' : '/hr'} →{' '}
                                    {formatInteger(computedRoi.monthlySavedHours)}{' '}
                                    {locale === 'uk' ? 'год/міс' : 'hrs/mo'} · ~
                                    {computedRoi.paybackWeeks} {locale === 'uk' ? 'тижн.' : 'wks'}
                                  </p>
                                </div>
                              )}

                              {/* 1-Click Action Buttons */}
                              <div className="flex flex-col gap-1.5 pt-1">
                                {rec.roiEstimate && (
                                  <button
                                    type="button"
                                    onClick={() => handleApplyRoiClick(msg.id, rec.roiEstimate!)}
                                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                                      isRoiApplied
                                        ? 'border-[#1F6E65] bg-[#1F6E65]/12 text-[#185952] dark:border-[#45A89D] dark:bg-[#45A89D]/15 dark:text-[#68C7BC]'
                                        : 'border-[#1F6E65]/45 dark:border-[#45A89D]/45 bg-white dark:bg-[#191816] text-[#1F6E65] dark:text-[#45A89D] hover:bg-[#1F6E65]/10 dark:hover:bg-[#45A89D]/15'
                                    }`}
                                  >
                                    {isRoiApplied ? (
                                      <>
                                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>{t(AGENT_UI_COPY.appliedRoiBtn, locale)}</span>
                                      </>
                                    ) : (
                                      <>
                                        <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>{t(AGENT_UI_COPY.applyRoiBtn, locale)}</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onTransferToBrief(rec)}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#CC4518] hover:bg-[#B23A12] dark:bg-[#F97343] dark:hover:bg-[#E56233] text-white dark:text-[#111110] transition-colors cursor-pointer"
                                >
                                  <span>{t(AGENT_UI_COPY.transferBriefBtn, locale)}</span>
                                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Quick Reply Suggestions under latest assistant message */}
                        {msg.id === latestAssistantId &&
                          !isLoading &&
                          msg.quickReplies &&
                          msg.quickReplies.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {msg.quickReplies.map((replyOption) => (
                                <button
                                  key={replyOption}
                                  type="button"
                                  onClick={() => void sendMessage(replyOption)}
                                  className="px-2.5 py-1.5 text-[11.5px] font-medium rounded-lg border border-[#DCD6CB] dark:border-[#2E2C28] bg-white/85 dark:bg-[#181715] text-[#34312D] dark:text-[#D5D0C6] hover:border-[#CC4518]/60 dark:hover:border-[#F97343]/60 hover:text-[#161513] dark:hover:text-[#F5F3EE] transition-colors cursor-pointer text-left"
                                >
                                  {replyOption}
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Calm Loading Indicator */}
              {isLoading && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] px-3.5 py-3 space-y-2"
                >
                  <p className="text-xs font-mono text-[#5C5852] dark:text-[#A8A298]">
                    {t(AGENT_UI_COPY.loadingText, locale)}
                  </p>
                  <div className="h-1 w-full rounded-full bg-[#EFECE5] dark:bg-[#262421] overflow-hidden">
                    <motion.div
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="h-full w-1/2 rounded-full bg-[#CC4518] dark:bg-[#F97343]"
                    />
                  </div>
                </div>
              )}

              {/* Honest Error Recovery Banner */}
              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#CC4518]/40 dark:border-[#F97343]/45 bg-[#CC4518]/[0.06] dark:bg-[#F97343]/[0.1] p-3.5 space-y-2.5"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle
                      className="w-4 h-4 text-[#CC4518] dark:text-[#F97343] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <p className="text-xs leading-relaxed text-[#161513] dark:text-[#F5F3EE]">
                      {errorMessage}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {lastFailedPrompt && (
                      <button
                        type="button"
                        onClick={() => void sendMessage(lastFailedPrompt, true)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-[#161513] dark:bg-[#F5F3EE] text-white dark:text-[#111110] hover:opacity-90 transition-opacity cursor-pointer"
                      >
                        {t(AGENT_UI_COPY.retryBtn, locale)}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onOpenContactDirect}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[#D8D1C4] dark:border-[#34312D] bg-white dark:bg-[#1A1917] text-[#161513] dark:text-[#F5F3EE] hover:border-[#CC4518]/60 transition-colors cursor-pointer"
                    >
                      {t(AGENT_UI_COPY.directContactBtn, locale)}
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer Footer */}
            <form
              onSubmit={handleSubmit}
              className="shrink-0 p-3.5 sm:p-4 border-t border-[#E5E0D6] dark:border-[#2A2825] bg-white/90 dark:bg-[#161513]/95 space-y-2"
            >
              <div className="flex items-end gap-2">
                <label htmlFor="ai-agent-input" className="sr-only">
                  {t(AGENT_UI_COPY.inputPlaceholder, locale)}
                </label>
                <textarea
                  ref={textareaRef}
                  id="ai-agent-input"
                  rows={2}
                  maxLength={AGENT_MAX_MESSAGE_CHARS}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={t(AGENT_UI_COPY.inputPlaceholder, locale)}
                  disabled={isLoading}
                  className="flex-1 resize-none rounded-lg border border-[#DCD6CB] dark:border-[#2E2C28] bg-[#FAF8F4] dark:bg-[#121110] px-3 py-2 text-xs sm:text-[13px] leading-relaxed text-[#161513] dark:text-[#F5F3EE] placeholder:text-[#8A8378] dark:placeholder:text-[#7D776E] focus:outline-none focus:border-[#CC4518] dark:focus:border-[#F97343] disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  aria-label={t(AGENT_UI_COPY.sendAria, locale)}
                  className="shrink-0 h-10 w-10 rounded-lg bg-[#161513] hover:bg-[#2B2825] dark:bg-[#F5F3EE] dark:hover:bg-[#E5E0D6] text-white dark:text-[#111110] disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono text-[#7D776E] dark:text-[#8C857B]">
                <span className="truncate">{t(AGENT_UI_COPY.footerHint, locale)}</span>
                {inputValue.length > AGENT_MAX_MESSAGE_CHARS - 200 && (
                  <span className="tabular-nums shrink-0">
                    {inputValue.length}/{AGENT_MAX_MESSAGE_CHARS}
                  </span>
                )}
              </div>
            </form>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
