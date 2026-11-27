'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Bot,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Lock,
  LogIn,
  LogOut,
  Plus,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  Trash2,
  Undo2,
} from 'lucide-react';
import MultiSceneCaseViewer from '@/components/MultiSceneCaseViewer';
import SceneArtifactEditor from '@/components/admin/SceneArtifactEditor';
import AdminCaseAgentDrawer from '@/components/admin/AdminCaseAgentDrawer';
import AiRoutingSettingsPanel from '@/components/admin/AiRoutingSettingsPanel';
import {
  applyCaseAgentPatch,
  popUndoSnapshot,
  pushUndoSnapshot,
  type CaseAgentResponse,
  type DraftUndoSnapshot,
} from '@/lib/caseAgentLogic';
import {
  OWNER_ADMIN_EMAIL,
  auth,
  isOwnerAdminUser,
  runFirestoreConnectionCheck,
  signInWithGooglePopup,
  signOutAdmin,
} from '@/lib/firebase';
import {
  deleteCaseWithAssets,
  fetchCaseMediaById,
  fetchCaseWorkflowById,
  fetchPortfolioSettings,
  saveCaseWithAssets,
  savePortfolioSettings,
  subscribeOwnerCases,
  updateCaseSortOrderBatch,
} from '@/lib/caseRepository';
import {
  createBlankCaseDraft,
  reconstructN8nWorkflowFromFirestore,
  slugifyCaseId,
  validateCaseDraftForSave,
  type CaseMediaRecord,
  type CaseVisibility,
  type CaseWorkflowRecord,
  type PortfolioCaseRecord,
  type PortfolioSettingsRecord,
} from '@/lib/caseStudioTypes';
import { CASE_STUDIES_DATA } from '@/lib/portfolioData';
import type { CaseCategory, ServiceId } from '@/lib/portfolioLogic';
import type { N8nRawWorkflow } from '@/lib/n8nWorkflowEngine';

type EditorTab = 'passport' | 'scenes' | 'preview';
type ListFilter = 'all' | CaseVisibility;

const STATUS_LABELS: Record<CaseVisibility, string> = {
  published: 'Опубліковано',
  draft: 'Чернетка',
  unlisted: 'NDA (посилання)',
};

const STATUS_COLORS: Record<CaseVisibility, string> = {
  published: 'text-[#0F766E] dark:text-[#2DD4BF]',
  draft: 'text-[#6E6960] dark:text-[#A8A298]',
  unlisted: 'text-[#B45309] dark:text-[#FBBF24]',
};

export default function AdminCaseWorkspace() {
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);

  const [cases, setCases] = useState<PortfolioCaseRecord[]>([]);
  const [settings, setSettings] = useState<PortfolioSettingsRecord>({
    ownerId: '',
    heroCaseId: '',
    hiddenStaticCaseIds: [],
  });
  const [listFilter, setListFilter] = useState<ListFilter>('all');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [draft, setDraft] = useState<PortfolioCaseRecord | null>(null);
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>('passport');
  const [stackInput, setStackInput] = useState<string>('');

  // Asset caches for live preview & atomic batch saving
  const [pendingMedia, setPendingMedia] = useState<Record<string, CaseMediaRecord>>({});
  const [pendingWorkflows, setPendingWorkflows] = useState<Record<string, CaseWorkflowRecord>>({});
  const [loadedMediaUrls, setLoadedMediaUrls] = useState<Record<string, string>>({});
  const [loadedWorkflows, setLoadedWorkflows] = useState<Record<string, N8nRawWorkflow>>({});
  const [deletedMediaIds, setDeletedMediaIds] = useState<string[]>([]);
  const [deletedWorkflowIds, setDeletedWorkflowIds] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isAgentOpen, setIsAgentOpen] = useState<boolean>(false);
  const [isAiRoutingOpen, setIsAiRoutingOpen] = useState<boolean>(false);
  const [undoStack, setUndoStack] = useState<DraftUndoSnapshot[]>([]);
  const [agentSessionKey, setAgentSessionKey] = useState<number>(0);

  const isAuthorizedOwner = isOwnerAdminUser(user);

  useEffect(() => {
    runFirestoreConnectionCheck();
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to owner cases + load settings strictly after authorized owner sign-in
  useEffect(() => {
    if (!authReady || !isAuthorizedOwner) return;

    const unsub = subscribeOwnerCases(
      (list) => {
        setCases(list);
      },
      (err) => {
        setSaveFeedback({ type: 'err', text: err.message });
      }
    );

    void fetchPortfolioSettings()
      .then((s) => {
        if (s) setSettings(s);
      })
      .catch(() => {});

    return () => unsub();
  }, [authReady, isAuthorizedOwner]);

  // Load media & workflows when selecting an existing Firestore case
  useEffect(() => {
    if (!draft) return;
    let cancelled = false;

    const mediaIds = Array.from(
      new Set([draft.coverMediaId, ...draft.scenes.map((s) => s.mediaId)].filter(Boolean))
    );
    const wfIds = Array.from(
      new Set(draft.scenes.map((s) => s.n8nWorkflowId).filter(Boolean))
    );

    void (async () => {
      for (const mId of mediaIds) {
        if (pendingMedia[mId] || loadedMediaUrls[mId]) continue;
        const rec = await fetchCaseMediaById(mId).catch(() => null);
        if (!cancelled && rec) {
          setLoadedMediaUrls((prev) => ({ ...prev, [mId]: rec.dataUrl }));
        }
      }
      for (const wId of wfIds) {
        if (pendingWorkflows[wId] || loadedWorkflows[wId]) continue;
        const wf = await fetchCaseWorkflowById(wId).catch(() => null);
        if (!cancelled && wf) {
          setLoadedWorkflows((prev) => ({ ...prev, [wId]: wf }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draft, pendingMedia, pendingWorkflows, loadedMediaUrls, loadedWorkflows]);

  const mediaPreviewMap = useMemo(() => {
    const map: Record<string, string> = { ...loadedMediaUrls };
    for (const [id, rec] of Object.entries(pendingMedia)) {
      map[id] = rec.dataUrl;
    }
    return map;
  }, [loadedMediaUrls, pendingMedia]);

  const workflowPreviewMap = useMemo(() => {
    const map: Record<string, N8nRawWorkflow> = { ...loadedWorkflows };
    for (const [id, rec] of Object.entries(pendingWorkflows)) {
      map[id] = reconstructN8nWorkflowFromFirestore(rec);
    }
    return map;
  }, [loadedWorkflows, pendingWorkflows]);

  const filteredCases = useMemo(() => {
    if (listFilter === 'all') return cases;
    return cases.filter((c) => c.status === listFilter);
  }, [cases, listFilter]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Не вдалося завершити вхід через Google. Перевірте, чи дозволені спливаючі вікна.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const resetPendingAssetBuffers = () => {
    setPendingMedia({});
    setPendingWorkflows({});
    setDeletedMediaIds([]);
    setDeletedWorkflowIds([]);
    setSaveFeedback(null);
    setConfirmDeleteId(null);
    setUndoStack([]);
    setAgentSessionKey((k) => k + 1);
  };

  const handleApplyAgentResponse = (response: CaseAgentResponse): number => {
    if (!draft) return 0;
    const { nextDraft, nextStackInput, appliedFieldsCount } = applyCaseAgentPatch(
      draft,
      stackInput,
      response,
      { isCreatingNew }
    );
    if (appliedFieldsCount === 0) return 0;

    setUndoStack((prev) => pushUndoSnapshot(prev, { draft, stackInput }, 10));
    setDraft(nextDraft);
    setStackInput(nextStackInput);
    setSaveFeedback({
      type: 'ok',
      text: `AI-агент оновив чернетку (${appliedFieldsCount} змін). Перевірте дані або натисніть Undo для відкату.`,
    });
    return appliedFieldsCount;
  };

  const handleUndoAgentChange = () => {
    const { restored, remaining } = popUndoSnapshot(undoStack);
    if (!restored) return;
    setUndoStack(remaining);
    setDraft(restored.draft);
    setStackInput(restored.stackInput);
    setSaveFeedback({
      type: 'ok',
      text: 'Останню зміну AI-агента скасовано.',
    });
  };

  const handleStartNewCase = () => {
    if (!user) return;
    resetPendingAssetBuffers();
    const blank = createBlankCaseDraft(cases.length, user.uid);
    setIsCreatingNew(true);
    setSelectedId(blank.id);
    setDraft(blank);
    setStackInput(blank.stack.join(', '));
    setActiveEditorTab('passport');
  };

  const handleSelectExistingCase = (record: PortfolioCaseRecord) => {
    resetPendingAssetBuffers();
    setIsCreatingNew(false);
    setSelectedId(record.id);
    setDraft({
      ...record,
      metrics:
        record.metrics.length >= 3
          ? record.metrics
          : [
              ...record.metrics,
              ...Array.from({ length: 3 - record.metrics.length }, () => ({
                value: '',
                labelUk: '',
                labelEn: '',
              })),
            ],
    });
    setStackInput(record.stack.join(', '));
    setActiveEditorTab('passport');
  };

  const handleSaveDraft = async (overrideStatus?: CaseVisibility) => {
    if (!draft || !user) return;
    const candidate: PortfolioCaseRecord = {
      ...draft,
      status: overrideStatus ?? draft.status,
      stack: stackInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const validation = validateCaseDraftForSave(candidate, 'uk');
    if (!validation.valid) {
      const firstErr = Object.values(validation.errors)[0] ?? 'Перевірте обов’язкові поля.';
      setSaveFeedback({ type: 'err', text: firstErr });
      setActiveEditorTab('passport');
      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    const existingRecord = cases.find((c) => c.id === candidate.id);
    const existingMediaIds = existingRecord
      ? Array.from(
          new Set(
            [existingRecord.coverMediaId, ...existingRecord.scenes.map((s) => s.mediaId)].filter(
              Boolean
            )
          )
        )
      : [];
    const existingWorkflowIds = existingRecord
      ? Array.from(new Set(existingRecord.scenes.map((s) => s.n8nWorkflowId).filter(Boolean)))
      : [];

    try {
      const saved = await saveCaseWithAssets({
        draft: candidate,
        ownerId: user.uid,
        isExisting: !isCreatingNew && Boolean(existingRecord),
        pendingMedia,
        pendingWorkflows,
        existingMediaIds,
        existingWorkflowIds,
        deletedMediaIds,
        deletedWorkflowIds,
      });

      setIsCreatingNew(false);
      setSelectedId(saved.id);
      setDraft({
        ...saved,
        metrics:
          saved.metrics.length >= 3
            ? saved.metrics
            : [
                ...saved.metrics,
                ...Array.from({ length: 3 - saved.metrics.length }, () => ({
                  value: '',
                  labelUk: '',
                  labelEn: '',
                })),
              ],
      });
      setPendingMedia({});
      setPendingWorkflows({});
      setDeletedMediaIds([]);
      setDeletedWorkflowIds([]);

      if (saved.featuredInHero && settings.heroCaseId !== saved.id) {
        await savePortfolioSettings(
          { heroCaseId: saved.id, hiddenStaticCaseIds: settings.hiddenStaticCaseIds },
          user.uid
        );
        setSettings((prev) => ({ ...prev, heroCaseId: saved.id }));
      }

      setSaveFeedback({
        type: 'ok',
        text:
          saved.status === 'published'
            ? 'Кейс збережено та опубліковано на живому портфоліо.'
            : saved.status === 'unlisted'
              ? 'NDA-кейс збережено — доступний за прямим посиланням.'
              : 'Чернетку збережено у Firestore.',
      });
    } catch (err) {
      setSaveFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Помилка збереження у Firestore.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCurrentCase = async () => {
    if (!draft) return;
    const existingRecord = cases.find((c) => c.id === draft.id);
    if (!existingRecord) {
      setDraft(null);
      setSelectedId(null);
      setIsCreatingNew(false);
      return;
    }

    setIsSaving(true);
    try {
      await deleteCaseWithAssets(existingRecord);
      setDraft(null);
      setSelectedId(null);
      setIsCreatingNew(false);
      setConfirmDeleteId(null);
      setSaveFeedback({ type: 'ok', text: 'Кейс та його медіафайли видалено.' });
    } catch (err) {
      setSaveFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Не вдалося видалити кейс.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveCaseOrder = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= cases.length) return;
    const reordered = [...cases];
    const [item] = reordered.splice(idx, 1);
    reordered.splice(target, 0, item);
    const updates = reordered.map((c, i) => ({ id: c.id, sortOrder: i }));
    await updateCaseSortOrderBatch(updates);
  };

  const handleToggleHeroCase = async (caseId: string) => {
    if (!user) return;
    const nextHero = settings.heroCaseId === caseId ? '' : caseId;
    await savePortfolioSettings(
      { heroCaseId: nextHero, hiddenStaticCaseIds: settings.hiddenStaticCaseIds },
      user.uid
    );
    setSettings((prev) => ({ ...prev, heroCaseId: nextHero }));
  };

  const handleToggleStaticVisibility = async (staticId: string) => {
    if (!user) return;
    const isHidden = settings.hiddenStaticCaseIds.includes(staticId);
    const nextHidden = isHidden
      ? settings.hiddenStaticCaseIds.filter((id) => id !== staticId)
      : [...settings.hiddenStaticCaseIds, staticId];
    await savePortfolioSettings(
      { heroCaseId: settings.heroCaseId, hiddenStaticCaseIds: nextHidden },
      user.uid
    );
    setSettings((prev) => ({ ...prev, hiddenStaticCaseIds: nextHidden }));
  };

  const handleCopyShareLink = async () => {
    if (!draft || typeof window === 'undefined') return;
    const url = `${window.location.origin}/?case=${encodeURIComponent(draft.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      // Fallback ignored
    }
  };

  // Loading auth state
  if (!authReady) {
    return (
      <div className="min-h-dvh bg-[#F7F5F0] dark:bg-[#111110] flex items-center justify-center p-6">
        <p className="text-sm text-[#5C5852] dark:text-[#A8A298]">
          Перевірка авторизації кабінету…
        </p>
      </div>
    );
  }

  // Unauthenticated Sign-In Gate
  if (!user) {
    return (
      <div className="min-h-dvh bg-[#F7F5F0] dark:bg-[#111110] text-[#161513] dark:text-[#F5F3EE] flex flex-col">
        <header className="h-15 border-b border-[#E5E0D6] dark:border-[#2A2825] px-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-base font-bold tracking-tight whitespace-nowrap"
          >
            <span aria-hidden="true" className="w-2 h-2 rounded-xs bg-[#CC4518]" />
            <span>O. Mykhalskyi</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] whitespace-nowrap"
          >
            <span>Повернутися до портфоліо</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] p-7 space-y-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#C84317] dark:text-[#FB8356]">
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Захищений кабінет власника</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight leading-snug">
                Керування кейсами портфоліо
              </h1>
              <p className="text-sm text-[#555049] dark:text-[#A8A298] leading-relaxed">
                Увійдіть через Google-акаунт власника, щоб додавати n8n воркфлоу, скріншоти Telegram і веб-інтерфейсів із мітками, керувати чернетками та NDA-посиланнями.
              </p>
            </div>

            {authError && (
              <p className="text-xs text-[#C84317] dark:text-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13] border border-[#CC4518]/30 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}

            <button
              type="button"
              data-testid="admin-google-signin-btn"
              disabled={isSigningIn}
              onClick={handleGoogleLogin}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg bg-[#161513] hover:bg-[#2B2825] dark:bg-[#F5F3EE] dark:hover:bg-[#E5E0D6] text-white dark:text-[#111110] transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>{isSigningIn ? 'Відкриття Google Auth…' : 'Увійти через Google'}</span>
            </button>

            <p className="text-[11px] text-[#6E6960] dark:text-[#918A7E] leading-relaxed">
              Доступ до запису у Firestore обмежений правилами безпеки виключно для верифікованого акаунта власника.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Signed in with non-owner email
  if (!isAuthorizedOwner) {
    return (
      <div className="min-h-dvh bg-[#F7F5F0] dark:bg-[#111110] text-[#161513] dark:text-[#F5F3EE] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] p-7 space-y-4">
          <div className="flex items-center gap-2 text-[#C84317] dark:text-[#FB8356]">
            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            <h1 className="text-lg font-semibold">Доступ заборонено</h1>
          </div>
          <p className="text-sm text-[#555049] dark:text-[#A8A298] leading-relaxed">
            Ви увійшли як <span className="font-mono font-semibold">{user.email}</span>, але редагування портфоліо дозволено лише власнику ({OWNER_ADMIN_EMAIL}).
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void signOutAdmin()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#161513] dark:bg-[#F5F3EE] text-white dark:text-[#111110] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Вийти й змінити акаунт</span>
            </button>
            <Link href="/" className="text-xs font-medium text-[#5C5852] hover:underline">
              На сайт
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Owner Case Studio Workspace
  return (
    <div className="min-h-dvh bg-[#F7F5F0] dark:bg-[#111110] text-[#161513] dark:text-[#F5F3EE] flex flex-col">
      {/* Top Admin Header — Clean Breadcrumb + Primary Actions */}
      <header className="sticky top-0 z-30 h-14 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-[#F7F5F0]/95 dark:bg-[#111110]/95 backdrop-blur-sm px-4 lg:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-sm min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-bold tracking-tight whitespace-nowrap shrink-0"
          >
            <span aria-hidden="true" className="w-2 h-2 rounded-xs bg-[#CC4518]" />
            <span>O. Mykhalskyi</span>
          </Link>
          <span aria-hidden="true" className="text-[#C6BEB2] dark:text-[#44403A]">
            /
          </span>
          <span className="font-medium text-[#5C5852] dark:text-[#A8A298] truncate">
            Кабінет кейсів
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="hidden lg:inline font-mono text-xs text-[#6E6960] dark:text-[#A8A298]">
            {user.email}
          </span>
          <button
            type="button"
            data-testid="admin-ai-routing-btn"
            onClick={() => setIsAiRoutingOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] hover:border-[#CC4518]/60 cursor-pointer whitespace-nowrap"
          >
            <SlidersHorizontal
              className="w-3.5 h-3.5 text-[#CC4518] dark:text-[#FB8356]"
              aria-hidden="true"
            />
            <span>AI-моделі</span>
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] hover:border-[#CC4518]/60 whitespace-nowrap"
          >
            <span>Відкрити сайт</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={() => void signOutAdmin()}
            aria-label="Вийти з кабінету"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Вийти</span>
          </button>
        </div>
      </header>

      {/* Main 2-Column SaaS Studio Layout */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-0">
        {/* Left Sidebar: Dynamic Cases + Built-in Static Cases */}
        <aside className="lg:col-span-4 xl:col-span-3 border-b lg:border-b-0 lg:border-r border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] p-4 space-y-5">
          <div className="space-y-3">
            <button
              type="button"
              data-testid="admin-new-case-btn"
              onClick={handleStartNewCase}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg bg-[#CC4518] hover:bg-[#B23A12] text-white transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Новий кейс</span>
            </button>

            <div
              role="group"
              aria-label="Фільтр статусу кейсів"
              className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825]"
            >
              {(
                [
                  { id: 'all', label: 'Усі' },
                  { id: 'published', label: 'Опубл.' },
                  { id: 'draft', label: 'Черн.' },
                  { id: 'unlisted', label: 'NDA' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setListFilter(f.id)}
                  className={`py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                    listFilter === f.id
                      ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-2xs'
                      : 'text-[#5C5852] dark:text-[#A8A298]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Firestore Cases List */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#5C5852] dark:text-[#A8A298]">
              Ваші кейси у базі ({filteredCases.length})
            </p>
            {filteredCases.length === 0 ? (
              <p className="text-xs text-[#6E6960] dark:text-[#918A7E] py-3">
                Поки немає доданих кейсів. Натисніть «Новий кейс», щоб закинути перший проєкт.
              </p>
            ) : (
              <div className="space-y-1.5">
                {filteredCases.map((item, idx) => {
                  const isActive = selectedId === item.id && !isCreatingNew;
                  const isHero = settings.heroCaseId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-2.5 transition-colors ${
                        isActive
                          ? 'border-[#CC4518] dark:border-[#FB8356] bg-white dark:bg-[#1B1917]'
                          : 'border-[#E5E0D6] dark:border-[#2A2825] bg-white/70 dark:bg-[#181715]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectExistingCase(item)}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <p className="text-xs font-semibold text-[#161513] dark:text-[#F5F3EE] line-clamp-2">
                            {item.titleUk}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                            <span className={`font-medium ${STATUS_COLORS[item.status]}`}>
                              {STATUS_LABELS[item.status]}
                            </span>
                            <span aria-hidden="true" className="text-[#C6BEB2]">
                              ·
                            </span>
                            <span className="font-mono text-[#6E6960] dark:text-[#A8A298] tabular-nums">
                              {item.scenes.length} сцен
                            </span>
                          </div>
                        </button>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <button
                            type="button"
                            title={isHero ? 'Закріплено в Hero' : 'Закріпити в Hero'}
                            onClick={() => void handleToggleHeroCase(item.id)}
                            className={`p-1 rounded cursor-pointer ${
                              isHero
                                ? 'text-[#CC4518] dark:text-[#FB8356]'
                                : 'text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                            }`}
                          >
                            <Star className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          {listFilter === 'all' && (
                            <div className="inline-flex items-center gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => void handleMoveCaseOrder(idx, -1)}
                                aria-label="Підняти вище"
                                className="p-0.5 text-[#6E6960] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === filteredCases.length - 1}
                                onClick={() => void handleMoveCaseOrder(idx, 1)}
                                aria-label="Опустити нижче"
                                className="p-0.5 text-[#6E6960] disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Built-in Static Cases Visibility & Hero Override */}
          <div className="pt-4 border-t border-[#E5E0D6] dark:border-[#2A2825] space-y-2">
            <p className="text-xs font-semibold text-[#5C5852] dark:text-[#A8A298]">
              Вбудовані кейси (видимість на сайті)
            </p>
            <div className="space-y-1.5">
              {CASE_STUDIES_DATA.map((sc) => {
                const isHidden = settings.hiddenStaticCaseIds.includes(sc.id);
                return (
                  <div
                    key={sc.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-[#E5E0D6] dark:border-[#2A2825] bg-white/60 dark:bg-[#181715]"
                  >
                    <span
                      className={`text-xs truncate ${
                        isHidden
                          ? 'line-through text-[#918A7E]'
                          : 'text-[#161513] dark:text-[#F5F3EE]'
                      }`}
                    >
                      {sc.title.uk}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleToggleStaticVisibility(sc.id)}
                      aria-label={isHidden ? `Показати ${sc.title.uk}` : `Сховати ${sc.title.uk}`}
                      className="p-1 rounded text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] shrink-0 cursor-pointer"
                    >
                      {isHidden ? (
                        <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Main Area: Active Case Editor or Welcome Prompt */}
        <main className="lg:col-span-8 xl:col-span-9 p-4 sm:p-6 space-y-5">
          {!draft ? (
            <div className="h-full min-h-[420px] rounded-2xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] p-8 flex flex-col items-center justify-center text-center space-y-4">
              <Layers className="w-8 h-8 text-[#CC4518]" aria-hidden="true" />
              <div className="space-y-1.5 max-w-md">
                <h2 className="text-lg font-semibold">Оберіть кейс зліва або створіть новий</h2>
                <p className="text-sm text-[#5C5852] dark:text-[#A8A298]">
                  Просто перетягніть n8n `.json` воркфлоу та скріншоти Telegram або веб-панелі — кейс одразу стане живим та з’явиться на сайті після публікації.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartNewCase}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#CC4518] hover:bg-[#B23A12] text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Створити перший кейс</span>
              </button>
            </div>
          ) : (
            <>
              {/* Editor Top Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E5E0D6] dark:border-[#2A2825]">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-semibold ${STATUS_COLORS[draft.status]}`}>
                      {STATUS_LABELS[draft.status]}
                    </span>
                    <span aria-hidden="true" className="text-[#C6BEB2]">
                      ·
                    </span>
                    <span className="font-mono text-[#6E6960] dark:text-[#A8A298] truncate">
                      /?case={draft.id}
                    </span>
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight truncate">
                    {draft.titleUk || 'Новий кейс портфоліо'}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    data-testid="admin-open-case-agent-btn"
                    aria-expanded={isAgentOpen}
                    onClick={() => setIsAgentOpen((open) => !open)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      isAgentOpen
                        ? 'border-[#CC4518] dark:border-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356]'
                        : 'border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] hover:border-[#CC4518]/65 dark:hover:border-[#FB8356]/65'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5 text-[#CC4518] dark:text-[#FB8356]" aria-hidden="true" />
                    <span>AI-агент</span>
                  </button>

                  {undoStack.length > 0 && (
                    <button
                      type="button"
                      data-testid="admin-header-undo-btn"
                      onClick={handleUndoAgentChange}
                      className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#555049] dark:text-[#B5AFA5] hover:text-[#161513] dark:hover:text-[#F5F3EE] cursor-pointer whitespace-nowrap"
                    >
                      <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span className="font-mono tabular-nums">Undo ({undoStack.length})</span>
                    </button>
                  )}

                  {!isCreatingNew && (
                    <button
                      type="button"
                      onClick={() => void handleCopyShareLink()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] cursor-pointer whitespace-nowrap"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#0F766E]" aria-hidden="true" />
                          <span>Посилання скопійовано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Посилання (NDA)</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void handleSaveDraft()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-[#161513] dark:border-[#F5F3EE] text-[#161513] dark:text-[#F5F3EE] hover:bg-[#161513]/5 dark:hover:bg-white/5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isSaving ? 'Збереження…' : 'Зберегти'}</span>
                  </button>

                  {draft.status !== 'published' && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void handleSaveDraft('published')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#CC4518] hover:bg-[#B23A12] text-white cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      <span>Опублікувати на сайт</span>
                    </button>
                  )}

                  {!isCreatingNew &&
                    (confirmDeleteId === draft.id ? (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleDeleteCurrentCase()}
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-[#DC2626] text-white cursor-pointer whitespace-nowrap"
                      >
                        <span>Підтвердити видалення</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(draft.id)}
                        aria-label="Видалити кейс"
                        className="p-2 rounded-lg border border-[#DDD6C9] dark:border-[#33302B] text-[#6E6960] hover:text-[#DC2626] cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    ))}
                </div>
              </div>

              {saveFeedback && (
                <div
                  className={`rounded-lg px-3.5 py-2.5 text-xs font-medium border ${
                    saveFeedback.type === 'ok'
                      ? 'border-[#0F766E]/35 bg-[#F3FBF8] dark:bg-[#12221E] text-[#0F766E] dark:text-[#2DD4BF]'
                      : 'border-[#CC4518]/40 bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356]'
                  }`}
                >
                  {saveFeedback.text}
                </div>
              )}

              {/* 3 Workspace Tabs */}
              <div
                role="tablist"
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825]"
              >
                {(
                  [
                    { id: 'passport', label: '01. Паспорт кейсу', icon: FileText },
                    {
                      id: 'scenes',
                      label: `02. Сцени та файли (${draft.scenes.length})`,
                      icon: Layers,
                    },
                    { id: 'preview', label: '03. Живе прев’ю', icon: Eye },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = activeEditorTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveEditorTab(tab.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-2xs'
                          : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Passport Form */}
              {activeEditorTab === 'passport' && (
                <div className="rounded-2xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Назва кейсу (UK) *
                      </label>
                      <input
                        type="text"
                        value={draft.titleUk}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              titleUk: val,
                              id: isCreatingNew ? slugifyCaseId(val || prev.id) : prev.id,
                            };
                          });
                        }}
                        placeholder="Наприклад: Автоматизація заявок у Telegram + CRM"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Case Title (EN, опційно)
                      </label>
                      <input
                        type="text"
                        value={draft.titleEn}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, titleEn: e.target.value } : prev))
                        }
                        placeholder="Telegram Lead Automation + CRM Sync"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="col-span-2 md:col-span-2">
                      <label className="block text-xs font-medium mb-1">URL-slug кейсу</label>
                      <input
                        type="text"
                        disabled={!isCreatingNew}
                        value={draft.id}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, id: slugifyCaseId(e.target.value) } : prev
                          )
                        }
                        className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311] disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Статус</label>
                      <select
                        value={draft.status}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, status: e.target.value as CaseVisibility } : prev
                          )
                        }
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      >
                        <option value="draft">Чернетка</option>
                        <option value="published">Опубліковано</option>
                        <option value="unlisted">NDA (за посиланням)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Категорія</label>
                      <select
                        value={draft.category}
                        onChange={(e) => {
                          const cat = e.target.value as Exclude<CaseCategory, 'all'>;
                          const serviceMap: Record<Exclude<CaseCategory, 'all'>, ServiceId> = {
                            ai: 'ai-agents',
                            bi: 'bi-dashboards',
                            etl: 'etl-pipelines',
                          };
                          setDraft((prev) =>
                            prev
                              ? { ...prev, category: cat, relatedServiceId: serviceMap[cat] }
                              : prev
                          );
                        }}
                        className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      >
                        <option value="ai">AI-автоматизація</option>
                        <option value="bi">BI-дашборди</option>
                        <option value="etl">Дані та ETL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Рік</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={draft.year}
                        onChange={(e) =>
                          setDraft((prev) => (prev ? { ...prev, year: e.target.value } : prev))
                        }
                        className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Галузь / Ніша (UK)</label>
                      <input
                        type="text"
                        value={draft.industryUk}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, industryUk: e.target.value } : prev
                          )
                        }
                        placeholder="E-commerce · CRM + Telegram"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Термін реалізації</label>
                      <input
                        type="text"
                        value={draft.durationUk}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, durationUk: e.target.value } : prev
                          )
                        }
                        placeholder="2 тижні"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Головна метрика на картці
                      </label>
                      <input
                        type="text"
                        value={draft.headlineMetricUk}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, headlineMetricUk: e.target.value } : prev
                          )
                        }
                        placeholder="-70% ручної роботи · 2 тижні"
                        className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Короткий опис на картці (1–2 речення)
                    </label>
                    <textarea
                      rows={2}
                      value={draft.summaryUk}
                      onChange={(e) =>
                        setDraft((prev) => (prev ? { ...prev, summaryUk: e.target.value } : prev))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">Виклик клієнта (UK)</label>
                      <textarea
                        rows={3}
                        value={draft.challengeUk}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, challengeUk: e.target.value } : prev
                          )
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        Архітектурне рішення (UK)
                      </label>
                      <textarea
                        rows={3}
                        value={draft.solutionUk}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev ? { ...prev, solutionUk: e.target.value } : prev
                          )
                        }
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Технологічний стек (через кому — автодоповнюється з n8n JSON)
                    </label>
                    <input
                      type="text"
                      value={stackInput}
                      onChange={(e) => setStackInput(e.target.value)}
                      placeholder="n8n, OpenAI API, Telegram, Google Sheets"
                      className="w-full px-3 py-2 font-mono text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                    />
                  </div>

                  {/* 3 Quantified Outcome Metrics */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold">Вимірювані результати (до 3 показників)</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {draft.metrics.slice(0, 3).map((m, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] space-y-2"
                        >
                          <input
                            type="text"
                            value={m.value}
                            onChange={(e) => {
                              const nextMetrics = [...draft.metrics];
                              nextMetrics[idx] = { ...nextMetrics[idx], value: e.target.value };
                              setDraft((prev) => (prev ? { ...prev, metrics: nextMetrics } : prev));
                            }}
                            placeholder={idx === 0 ? '-65%' : idx === 1 ? '18 сек' : '100%'}
                            className="w-full px-2.5 py-1.5 font-mono text-sm font-semibold rounded border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715]"
                          />
                          <input
                            type="text"
                            value={m.labelUk}
                            onChange={(e) => {
                              const nextMetrics = [...draft.metrics];
                              nextMetrics[idx] = { ...nextMetrics[idx], labelUk: e.target.value };
                              setDraft((prev) => (prev ? { ...prev, metrics: nextMetrics } : prev));
                            }}
                            placeholder="Пояснення метрики (UK)"
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715]"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Optional Testimonial */}
                  <div className="pt-3 border-t border-[#E5E0D6] dark:border-[#2A2825] space-y-2.5">
                    <p className="text-xs font-semibold">Відгук або підсумок замовника (опційно)</p>
                    <textarea
                      rows={2}
                      value={draft.testimonial.quoteUk}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev
                            ? {
                                ...prev,
                                testimonial: { ...prev.testimonial, quoteUk: e.target.value },
                              }
                            : prev
                        )
                      }
                      placeholder="Коротка цитата про бізнес-ефект впровадження…"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        value={draft.testimonial.authorUk}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  testimonial: { ...prev.testimonial, authorUk: e.target.value },
                                }
                              : prev
                          )
                        }
                        placeholder="Автор / Відділ"
                        className="px-3 py-1.5 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                      <input
                        type="text"
                        value={draft.testimonial.roleUk}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  testimonial: { ...prev.testimonial, roleUk: e.target.value },
                                }
                              : prev
                          )
                        }
                        placeholder="Роль (напр. COO)"
                        className="px-3 py-1.5 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                      <input
                        type="text"
                        value={draft.testimonial.company}
                        onChange={(e) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  testimonial: { ...prev.testimonial, company: e.target.value },
                                }
                              : prev
                          )
                        }
                        placeholder="Компанія або NDA"
                        className="px-3 py-1.5 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Drag & Drop Scenes & Hotspots */}
              {activeEditorTab === 'scenes' && (
                <SceneArtifactEditor
                  caseId={draft.id}
                  ownerId={user.uid}
                  visibility={draft.status}
                  scenes={draft.scenes}
                  coverMediaId={draft.coverMediaId}
                  mediaPreviewMap={mediaPreviewMap}
                  workflowPreviewMap={workflowPreviewMap}
                  onChangeScenes={(nextScenes) =>
                    setDraft((prev) => (prev ? { ...prev, scenes: nextScenes } : prev))
                  }
                  onChangeCoverMediaId={(mediaId) =>
                    setDraft((prev) => (prev ? { ...prev, coverMediaId: mediaId } : prev))
                  }
                  onAddPendingMedia={(media) =>
                    setPendingMedia((prev) => ({ ...prev, [media.id]: media }))
                  }
                  onAddPendingWorkflow={(wfRecord, previewWf) => {
                    setPendingWorkflows((prev) => ({ ...prev, [wfRecord.id]: wfRecord }));
                    setLoadedWorkflows((prev) => ({ ...prev, [wfRecord.id]: previewWf }));
                  }}
                  onDeleteAssetIds={({ mediaId, workflowId }) => {
                    if (mediaId) setDeletedMediaIds((prev) => [...prev, mediaId]);
                    if (workflowId) setDeletedWorkflowIds((prev) => [...prev, workflowId]);
                  }}
                  onMergeDetectedStack={(tags) => {
                    const current = stackInput
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const merged = Array.from(new Set([...current, ...tags])).slice(0, 15);
                    setStackInput(merged.join(', '));
                  }}
                />
              )}

              {/* Tab 3: Live Public Preview */}
              {activeEditorTab === 'preview' && (
                <div className="rounded-2xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] p-6 space-y-6">
                  <div className="space-y-1">
                    <p className="text-xs text-[#6E6960] dark:text-[#A8A298]">
                      {draft.industryUk || 'Галузь'} · {draft.year} · {draft.durationUk}
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {draft.titleUk || 'Без назви'}
                    </h2>
                  </div>

                  {draft.scenes.length > 0 ? (
                    <MultiSceneCaseViewer
                      scenes={draft.scenes}
                      localMediaMap={mediaPreviewMap}
                      localWorkflowMap={workflowPreviewMap}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#DDD6C9] dark:border-[#33302B] p-6 text-center text-xs text-[#6E6960]">
                      Додайте сцени на вкладці «02. Сцени та файли», щоб побачити інтерактивне прев’ю.
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <p className="text-xs font-semibold mb-1">Виклик клієнта</p>
                      <p className="text-sm text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                        {draft.challengeUk || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1">Архітектурне рішення</p>
                      <p className="text-sm text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                        {draft.solutionUk || '—'}
                      </p>
                    </div>
                  </div>

                  {draft.metrics.some((m) => m.value.trim()) && (
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#E5E0D6] dark:border-[#2A2825]">
                      {draft.metrics
                        .filter((m) => m.value.trim())
                        .map((m, i) => (
                          <div
                            key={i}
                            className="p-3.5 rounded-xl bg-[#FAF8F4] dark:bg-[#131210] border border-[#E5E0D6] dark:border-[#2A2825]"
                          >
                            <dd className="font-mono tabular-nums text-xl font-semibold text-[#C84317] dark:text-[#FB8356]">
                              {m.value}
                            </dd>
                            <dt className="mt-1 text-xs text-[#555049] dark:text-[#A8A298]">
                              {m.labelUk}
                            </dt>
                          </div>
                        ))}
                    </dl>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Slide-over AI Case Producer Agent Drawer */}
      {draft && (
        <AdminCaseAgentDrawer
          key={agentSessionKey}
          isOpen={isAgentOpen}
          onClose={() => setIsAgentOpen(false)}
          draft={draft}
          stackInput={stackInput}
          mediaPreviewMap={mediaPreviewMap}
          workflowPreviewMap={workflowPreviewMap}
          undoCount={undoStack.length}
          getAuthToken={() => user.getIdToken()}
          onApplyAgentResponse={handleApplyAgentResponse}
          onUndoLastChange={handleUndoAgentChange}
        />
      )}

      {/* AI Provider Failover Priority & Model Selection Modal */}
      <AiRoutingSettingsPanel
        open={isAiRoutingOpen}
        onClose={() => setIsAiRoutingOpen(false)}
        user={user}
        settings={settings}
        onSaved={(updated) => {
          setSettings((prev) => ({
            ...prev,
            aiProviderOrder: updated.aiProviderOrder,
            aiDisabledProviders: updated.aiDisabledProviders,
            aiOpenaiModel: updated.aiOpenaiModel,
            aiAnthropicModel: updated.aiAnthropicModel,
            aiOpenrouterModel: updated.aiOpenrouterModel,
          }));
        }}
      />
    </div>
  );
}
