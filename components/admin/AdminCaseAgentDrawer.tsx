'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Bot,
  Check,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  Undo2,
  Workflow,
  X,
} from 'lucide-react';
import {
  ADMIN_AGENT_PRESETS,
  buildDraftSnapshotForAgent,
  buildWorkflowSummaryForAgent,
  extractBase64ImageFromDataUrl,
  type CaseAgentMessage,
  type CaseAgentResponse,
  type CaseAgentSceneImage,
  type CaseAgentWorkflowSummary,
} from '@/lib/caseAgentLogic';
import type { PortfolioCaseRecord } from '@/lib/caseStudioTypes';
import type { N8nRawWorkflow } from '@/lib/n8nWorkflowEngine';

interface DrawerChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  response?: CaseAgentResponse;
  applied?: boolean;
}

interface AdminCaseAgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  draft: PortfolioCaseRecord;
  stackInput: string;
  mediaPreviewMap: Record<string, string>;
  workflowPreviewMap: Record<string, N8nRawWorkflow>;
  undoCount: number;
  getAuthToken: () => Promise<string>;
  onApplyAgentResponse: (response: CaseAgentResponse) => number;
  onUndoLastChange: () => void;
}

export default function AdminCaseAgentDrawer({
  isOpen,
  onClose,
  draft,
  stackInput,
  mediaPreviewMap,
  workflowPreviewMap,
  undoCount,
  getAuthToken,
  onApplyAgentResponse,
  onUndoLastChange,
}: AdminCaseAgentDrawerProps) {
  const [turns, setTurns] = useState<DrawerChatTurn[]>([]);
  const [input, setInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [autoApply, setAutoApply] = useState<boolean>(true);
  const [disabledVisionSceneIds, setDisabledVisionSceneIds] = useState<Record<string, boolean>>({});

  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const turnSeqRef = useRef<number>(0);

  // Compute live workflow summaries & available visual screenshots from current draft
  const workflowSummaries = useMemo<CaseAgentWorkflowSummary[]>(() => {
    const list: CaseAgentWorkflowSummary[] = [];
    for (const scene of draft.scenes) {
      if (scene.kind === 'n8n-json' && scene.n8nWorkflowId) {
        const wf = workflowPreviewMap[scene.n8nWorkflowId];
        if (wf) {
          list.push(buildWorkflowSummaryForAgent(scene.id, wf));
        }
      }
    }
    return list;
  }, [draft.scenes, workflowPreviewMap]);

  const visualScenes = useMemo(() => {
    return draft.scenes
      .filter((s) => s.kind !== 'n8n-json' && s.mediaId && mediaPreviewMap[s.mediaId])
      .map((s, idx) => ({
        sceneId: s.id,
        sceneTitle: s.titleUk || s.titleEn || `Сцена ${idx + 1}`,
        sceneKind: s.kind,
        dataUrl: mediaPreviewMap[s.mediaId],
      }));
  }, [draft.scenes, mediaPreviewMap]);

  const activeVisionImages = useMemo<CaseAgentSceneImage[]>(() => {
    const selected: CaseAgentSceneImage[] = [];
    for (const vs of visualScenes) {
      if (disabledVisionSceneIds[vs.sceneId]) continue;
      if (selected.length >= 3) break;
      const extracted = extractBase64ImageFromDataUrl(vs.dataUrl);
      if (extracted) {
        selected.push({
          sceneId: vs.sceneId,
          sceneTitle: vs.sceneTitle,
          sceneKind: vs.sceneKind,
          mimeType: extracted.mimeType,
          base64Data: extracted.base64Data,
        });
      }
    }
    return selected;
  }, [visualScenes, disabledVisionSceneIds]);

  const totalN8nNodes = useMemo(
    () => workflowSummaries.reduce((acc, w) => acc + w.nodeCount, 0),
    [workflowSummaries]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [turns, isSending, isOpen]);

  const toggleVisionScene = (sceneId: string) => {
    setDisabledVisionSceneIds((prev) => ({ ...prev, [sceneId]: !prev[sceneId] }));
  };

  const handleManualApplyTurn = (turnId: string, response: CaseAgentResponse) => {
    const count = onApplyAgentResponse(response);
    if (count >= 0) {
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, applied: true } : t)));
    }
  };

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isSending) return;

    setErrorMsg(null);
    setLastFailedPrompt(null);
    setInput('');

    turnSeqRef.current += 1;
    const userTurn: DrawerChatTurn = {
      id: `u-${turnSeqRef.current}`,
      role: 'user',
      content: trimmed,
    };

    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setIsSending(true);

    try {
      const idToken = await getAuthToken();
      const historyPayload: CaseAgentMessage[] = nextTurns.slice(-10).map((t) => ({
        role: t.role,
        content: t.content,
      }));

      const draftSnapshot = buildDraftSnapshotForAgent(draft, stackInput);

      const res = await fetch('/api/admin/case-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          messages: historyPayload,
          draftSnapshot,
          workflowSummaries,
          sceneImages: activeVisionImages,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | CaseAgentResponse
        | { error?: string }
        | null;

      if (!res.ok || !data || !('reply' in data)) {
        const msg =
          data && 'error' in data && data.error
            ? data.error
            : 'Не вдалося отримати відповідь від AI-агента.';
        setErrorMsg(msg);
        setLastFailedPrompt(trimmed);
        return;
      }

      const hasPatch =
        Boolean(data.casePatch && Object.keys(data.casePatch).length > 0) ||
        Boolean(data.scenePatches && data.scenePatches.length > 0);

      let wasApplied = false;
      if (autoApply && hasPatch) {
        const appliedCount = onApplyAgentResponse(data);
        wasApplied = appliedCount > 0;
      }

      turnSeqRef.current += 1;
      const assistantTurn: DrawerChatTurn = {
        id: `a-${turnSeqRef.current}`,
        role: 'assistant',
        content: data.reply,
        response: data,
        applied: wasApplied,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Мережева помилка під час звернення до AI-агента.'
      );
      setLastFailedPrompt(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const latestAssistantTurnId = useMemo(() => {
    for (let i = turns.length - 1; i >= 0; i -= 1) {
      if (turns[i].role === 'assistant') return turns[i].id;
    }
    return null;
  }, [turns]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile / Tablet Backdrop (non-blocking on wide xl screens so owner sees live form updates) */}
          <motion.div
            key="admin-agent-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#111110]/45 xl:hidden"
            aria-hidden="true"
          />

          {/* Slide-over Studio AI Agent Drawer */}
          <motion.aside
            key="admin-agent-drawer"
            role="dialog"
            aria-modal="false"
            aria-label="AI-агент продюсер кейсу"
            data-testid="admin-case-agent-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[440px] max-w-full bg-white dark:bg-[#181715] border-l border-[#E5E0D6] dark:border-[#2A2825] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="shrink-0 px-4 py-3.5 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#CC4518]/12 dark:bg-[#FB8356]/15 border border-[#CC4518]/30 dark:border-[#FB8356]/35 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-[#CC4518] dark:text-[#FB8356]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] truncate">
                    AI-агент кейсу
                  </h2>
                  <p className="font-mono tabular-nums text-[11px] text-[#6E6960] dark:text-[#A8A298] truncate">
                    {workflowSummaries.length > 0 || visualScenes.length > 0
                      ? [
                          workflowSummaries.length > 0
                            ? `${workflowSummaries.length} n8n (${totalN8nNodes} вузлів)`
                            : null,
                          visualScenes.length > 0
                            ? `${activeVisionImages.length}/${visualScenes.length} фото`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : 'Готовий до ваших тез або файлів'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {undoCount > 0 && (
                  <button
                    type="button"
                    data-testid="agent-drawer-undo-btn"
                    onClick={onUndoLastChange}
                    title="Скасувати останню зміну агента"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#161513] dark:text-[#F5F3EE] hover:border-[#CC4518]/60 cursor-pointer whitespace-nowrap"
                  >
                    <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="font-mono tabular-nums">Undo ({undoCount})</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Закрити панель AI-агента"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#E5E0D6] dark:border-[#2A2825] text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Context & Controls Bar (Vision scene toggles + Auto-apply toggle) */}
            <div className="shrink-0 px-4 py-2.5 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <label className="inline-flex items-center gap-1.5 text-[#555049] dark:text-[#B5AFA5] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoApply}
                    onChange={(e) => setAutoApply(e.target.checked)}
                    className="accent-[#CC4518] rounded cursor-pointer"
                  />
                  <span>Автозастосування в чернетку</span>
                </label>

                {turns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setTurns([]);
                      setErrorMsg(null);
                      setLastFailedPrompt(null);
                    }}
                    className="text-[11px] text-[#6E6960] hover:text-[#161513] dark:hover:text-[#F5F3EE] cursor-pointer"
                  >
                    Очистити чат
                  </button>
                )}
              </div>

              {(workflowSummaries.length > 0 || visualScenes.length > 0) && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {workflowSummaries.map((wf) => (
                    <span
                      key={wf.sceneId}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono rounded-md bg-[#FAF8F4] dark:bg-[#141311] border border-[#E5E0D6] dark:border-[#2A2825] text-[#555049] dark:text-[#B5AFA5]"
                    >
                      <Workflow className="w-3 h-3 text-[#CC4518] dark:text-[#FB8356]" aria-hidden="true" />
                      <span className="max-w-[130px] truncate">{wf.workflowName}</span>
                    </span>
                  ))}

                  {visualScenes.map((vs) => {
                    const isEnabled = !disabledVisionSceneIds[vs.sceneId];
                    return (
                      <button
                        key={vs.sceneId}
                        type="button"
                        aria-pressed={isEnabled}
                        onClick={() => toggleVisionScene(vs.sceneId)}
                        title={
                          isEnabled
                            ? 'Скріншот передається агенту для Vision-аналізу (клікніть, щоб вимкнути)'
                            : 'Скріншот вимкнено з контексту (клікніть, щоб увімкнути)'
                        }
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                          isEnabled
                            ? 'border-[#0F766E]/45 bg-[#F3FBF8] dark:bg-[#12221E] text-[#0F766E] dark:text-[#2DD4BF]'
                            : 'border-[#E5E0D6] dark:border-[#2A2825] bg-transparent text-[#918A7E] line-through'
                        }`}
                      >
                        <ImageIcon className="w-3 h-3" aria-hidden="true" />
                        <span className="max-w-[115px] truncate">{vs.sceneTitle}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4 One-Click Quick Action Presets */}
            <div className="shrink-0 px-4 py-2.5 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4]/70 dark:bg-[#141311]/70">
              <div className="grid grid-cols-2 gap-1.5">
                {ADMIN_AGENT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isSending}
                    data-testid={`agent-preset-${preset.id}`}
                    onClick={() => void sendMessage(preset.prompt)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] hover:border-[#CC4518]/65 dark:hover:border-[#FB8356]/65 transition-colors text-left truncate cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3 text-[#CC4518] dark:text-[#FB8356] shrink-0" aria-hidden="true" />
                    <span className="truncate">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 min-h-0 overflow-y-auto inner-scroll px-4 py-4 space-y-3.5">
              {turns.length === 0 ? (
                <div className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] p-4 space-y-2.5">
                  <p className="text-xs font-semibold text-[#161513] dark:text-[#F5F3EE]">
                    Як працює AI-продюсер кейсів
                  </p>
                  <p className="text-xs text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                    Закиньте у вкладку <span className="font-semibold">«02. Сцени та файли»</span> ваш n8n <span className="font-mono">.json</span> та скріншоти інтерфейсу, а сюди напишіть 2–3 тези про проєкт (або натисніть кнопку вище).
                  </p>
                  <p className="text-[11px] text-[#6E6960] dark:text-[#918A7E] leading-relaxed">
                    Агент заповнить лише локальну чернетку й ніколи не опублікує кейс без вашої кнопки «Зберегти / Опублікувати». Будь-яку правку можна миттєво відкотити через <span className="font-mono">Undo</span>.
                  </p>
                </div>
              ) : (
                turns.map((turn) => {
                  const isUser = turn.role === 'user';
                  const hasPatch = Boolean(
                    turn.response &&
                      ((turn.response.casePatch &&
                        Object.keys(turn.response.casePatch).length > 0) ||
                        (turn.response.scenePatches && turn.response.scenePatches.length > 0))
                  );
                  const isLatestAssistant = turn.id === latestAssistantTurnId;

                  return (
                    <div
                      key={turn.id}
                      className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-[#161513] dark:bg-[#F5F3EE] text-white dark:text-[#111110]'
                            : 'bg-[#FAF8F4] dark:bg-[#141311] border border-[#E5E0D6] dark:border-[#2A2825] text-[#161513] dark:text-[#F5F3EE]'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{turn.content}</p>
                      </div>

                      {/* Structured Patch Diff Card */}
                      {!isUser && turn.response && hasPatch && (
                        <div className="w-full rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#1B1A18] p-3 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-[#161513] dark:text-[#F5F3EE]">
                              Підготовлені зміни
                            </span>
                            {turn.applied ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0F766E] dark:text-[#2DD4BF]">
                                <Check className="w-3 h-3" aria-hidden="true" />
                                <span>Застосовано</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#B45309] dark:text-[#FBBF24]">
                                Очікує підтвердження
                              </span>
                            )}
                          </div>

                          {turn.response.changeSummary.length > 0 && (
                            <ul className="space-y-1 text-[11px] text-[#555049] dark:text-[#B5AFA5]">
                              {turn.response.changeSummary.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span
                                    aria-hidden="true"
                                    className="font-mono text-[#CC4518] dark:text-[#FB8356]"
                                  >
                                    ·
                                  </span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            {!turn.applied ? (
                              <button
                                type="button"
                                onClick={() => handleManualApplyTurn(turn.id, turn.response!)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-[#CC4518] hover:bg-[#B23A12] text-white cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Застосувати в чернетку</span>
                              </button>
                            ) : (
                              undoCount > 0 && (
                                <button
                                  type="button"
                                  onClick={onUndoLastChange}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] text-[#555049] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] cursor-pointer"
                                >
                                  <Undo2 className="w-3 h-3" aria-hidden="true" />
                                  <span>Скасувати (Undo)</span>
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Follow-up Quick Replies */}
                      {!isUser &&
                        isLatestAssistant &&
                        !isSending &&
                        turn.response &&
                        turn.response.quickReplies.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                            {turn.response.quickReplies.map((qr, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => void sendMessage(qr)}
                                className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#1B1A18] text-[#555049] dark:text-[#B5AFA5] hover:border-[#CC4518]/60 hover:text-[#161513] dark:hover:text-[#F5F3EE] transition-colors cursor-pointer"
                              >
                                {qr}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })
              )}

              {/* Pending State */}
              {isSending && (
                <div className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] px-3.5 py-3 flex items-center gap-2.5 text-xs text-[#555049] dark:text-[#B5AFA5]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#CC4518] dark:text-[#FB8356] shrink-0" aria-hidden="true" />
                  <span>
                    {activeVisionImages.length > 0
                      ? 'Аналізую вузли n8n і скріншоти сцен…'
                      : 'Формую структурований патч кейсу…'}
                  </span>
                </div>
              )}

              {/* Error State with Retry */}
              {errorMsg && (
                <div className="rounded-xl border border-[#DC2626]/35 bg-[#FEF2F2] dark:bg-[#2A1515] p-3 space-y-2 text-xs text-[#B91C1C] dark:text-[#FCA5A5]">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="leading-relaxed">{errorMsg}</p>
                  </div>
                  {lastFailedPrompt && (
                    <button
                      type="button"
                      onClick={() => void sendMessage(lastFailedPrompt)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md border border-[#DC2626]/40 hover:bg-[#DC2626]/10 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" aria-hidden="true" />
                      <span>Повторити запит</span>
                    </button>
                  )}
                </div>
              )}

              <div ref={scrollEndRef} />
            </div>

            {/* Bottom Prompt Composer */}
            <form
              onSubmit={handleSubmit}
              className="shrink-0 p-3.5 border-t border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311]"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  disabled={isSending}
                  placeholder="Опишіть кейс тезами або що змінити (Enter — надіслати)…"
                  className="flex-1 resize-none px-3 py-2 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] placeholder:text-[#918A7E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518]"
                />
                <button
                  type="submit"
                  disabled={isSending || !input.trim()}
                  aria-label="Надіслати запит агенту"
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#CC4518] hover:bg-[#B23A12] text-white transition-colors shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
