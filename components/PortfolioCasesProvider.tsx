'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CASE_STUDIES_DATA } from '@/lib/portfolioData';
import { runFirestoreConnectionCheck } from '@/lib/firebase';
import {
  fetchCaseByIdDirect,
  fetchCaseMediaById,
  fetchCaseWorkflowById,
  fetchPortfolioSettings,
  fetchPublishedCases,
} from '@/lib/caseRepository';
import {
  firestoreRecordToUnifiedCase,
  mergePublicCases,
  type PortfolioCaseRecord,
  type PortfolioSettingsRecord,
  type UnifiedCaseStudy,
} from '@/lib/caseStudioTypes';
import type { N8nRawWorkflow } from '@/lib/n8nWorkflowEngine';

interface PortfolioCasesContextValue {
  cases: UnifiedCaseStudy[];
  heroCase: UnifiedCaseStudy | null;
  directCase: UnifiedCaseStudy | null;
  settings: PortfolioSettingsRecord | null;
  isLoadingRemote: boolean;
  mediaUrls: Record<string, string>;
  workflows: Record<string, N8nRawWorkflow>;
  ensureMediaLoaded: (mediaId: string) => void;
  ensureWorkflowLoaded: (workflowId: string) => void;
  resolveCaseById: (caseId: string) => Promise<UnifiedCaseStudy | null>;
}

const PortfolioCasesContext = createContext<PortfolioCasesContextValue | null>(null);

export function PortfolioCasesProvider({ children }: { children: React.ReactNode }) {
  const [remoteCases, setRemoteCases] = useState<PortfolioCaseRecord[]>([]);
  const [settings, setSettings] = useState<PortfolioSettingsRecord | null>(null);
  const [directCase, setDirectCase] = useState<UnifiedCaseStudy | null>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState<boolean>(true);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [workflows, setWorkflows] = useState<Record<string, N8nRawWorkflow>>({});

  useEffect(() => {
    runFirestoreConnectionCheck();

    let cancelled = false;
    void (async () => {
      try {
        const [published, loadedSettings] = await Promise.all([
          fetchPublishedCases().catch(() => [] as PortfolioCaseRecord[]),
          fetchPortfolioSettings().catch(() => null),
        ]);
        if (cancelled) return;
        setRemoteCases(published);
        setSettings(loadedSettings);

        // Preload cover images for published Firestore cases
        const coverIds = Array.from(
          new Set(published.map((c) => c.coverMediaId).filter(Boolean))
        );
        if (coverIds.length > 0) {
          const loaded = await Promise.all(
            coverIds.map((id) => fetchCaseMediaById(id).catch(() => null))
          );
          if (!cancelled) {
            const nextMap: Record<string, string> = {};
            for (const m of loaded) {
              if (m) nextMap[m.id] = m.dataUrl;
            }
            if (Object.keys(nextMap).length > 0) {
              setMediaUrls((prev) => ({ ...prev, ...nextMap }));
            }
          }
        }
      } finally {
        if (!cancelled) setIsLoadingRemote(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const ensureMediaLoaded = useCallback((mediaId: string) => {
    if (!mediaId) return;
    setMediaUrls((prev) => {
      if (prev[mediaId]) return prev;
      void fetchCaseMediaById(mediaId)
        .then((rec) => {
          if (rec) {
            setMediaUrls((curr) => (curr[mediaId] ? curr : { ...curr, [mediaId]: rec.dataUrl }));
          }
        })
        .catch(() => {
          // Handled via fallback UI
        });
      return prev;
    });
  }, []);

  const ensureWorkflowLoaded = useCallback((workflowId: string) => {
    if (!workflowId) return;
    setWorkflows((prev) => {
      if (prev[workflowId]) return prev;
      void fetchCaseWorkflowById(workflowId)
        .then((wf) => {
          if (wf) {
            setWorkflows((curr) => (curr[workflowId] ? curr : { ...curr, [workflowId]: wf }));
          }
        })
        .catch(() => {
          // Handled via fallback UI
        });
      return prev;
    });
  }, []);

  const cases = useMemo(
    () => mergePublicCases(CASE_STUDIES_DATA, remoteCases, settings),
    [remoteCases, settings]
  );

  const heroCase = useMemo(() => {
    if (settings?.heroCaseId) {
      const explicit = cases.find((c) => c.id === settings.heroCaseId);
      if (explicit) return explicit;
    }
    const flagged = cases.find((c) => c.source === 'firestore' && c.featuredInHero);
    if (flagged) return flagged;
    return cases.find((c) => c.id === 'debt-control-1c-n8n') ?? cases[0] ?? null;
  }, [cases, settings]);

  const resolveCaseById = useCallback(
    async (caseId: string): Promise<UnifiedCaseStudy | null> => {
      const localMatch = cases.find((c) => c.id === caseId);
      if (localMatch) return localMatch;
      const fetched = await fetchCaseByIdDirect(caseId).catch(() => null);
      if (!fetched) return null;
      const unified = firestoreRecordToUnifiedCase(fetched);
      setDirectCase(unified);
      return unified;
    },
    [cases]
  );

  return (
    <PortfolioCasesContext.Provider
      value={{
        cases,
        heroCase,
        directCase,
        settings,
        isLoadingRemote,
        mediaUrls,
        workflows,
        ensureMediaLoaded,
        ensureWorkflowLoaded,
        resolveCaseById,
      }}
    >
      {children}
    </PortfolioCasesContext.Provider>
  );
}

export function usePortfolioCases(): PortfolioCasesContextValue {
  const ctx = useContext(PortfolioCasesContext);
  if (!ctx) {
    throw new Error('usePortfolioCases must be used inside PortfolioCasesProvider');
  }
  return ctx;
}
