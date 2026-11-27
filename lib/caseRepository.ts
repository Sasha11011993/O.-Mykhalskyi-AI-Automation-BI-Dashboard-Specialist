'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  BLUEPRINT_LIMITS,
  reconstructN8nWorkflowFromFirestore,
  sanitizeAiRoutingSettings,
  sanitizeCasePayloadForFirestore,
  type AiRoutingSettings,
  type CaseMediaRecord,
  type CaseVisibility,
  type CaseWorkflowRecord,
  type PortfolioCaseRecord,
  type PortfolioSettingsRecord,
} from './caseStudioTypes';
import type { N8nRawWorkflow } from './n8nWorkflowEngine';

const mediaCache = new Map<string, CaseMediaRecord>();
const workflowCache = new Map<string, CaseWorkflowRecord>();

export function primeMediaCache(media: CaseMediaRecord): void {
  mediaCache.set(media.id, media);
}

export function primeWorkflowCache(workflow: CaseWorkflowRecord): void {
  workflowCache.set(workflow.id, workflow);
}

export function getCachedMedia(mediaId: string): CaseMediaRecord | undefined {
  return mediaCache.get(mediaId);
}

export function getCachedWorkflow(workflowId: string): CaseWorkflowRecord | undefined {
  return workflowCache.get(workflowId);
}

export async function fetchPublishedCases(): Promise<PortfolioCaseRecord[]> {
  const path = 'cases';
  try {
    const q = query(collection(db, path), where('status', '==', 'published'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as PortfolioCaseRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchCaseByIdDirect(caseId: string): Promise<PortfolioCaseRecord | null> {
  if (!BLUEPRINT_LIMITS.ID_PATTERN.test(caseId)) return null;
  const path = `cases/${caseId}`;
  try {
    const snap = await getDoc(doc(db, 'cases', caseId));
    if (!snap.exists()) return null;
    return snap.data() as PortfolioCaseRecord;
  } catch (error) {
    // Unauthenticated lookup of a draft or non-existent ID returns permission-denied by design
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchPortfolioSettings(): Promise<PortfolioSettingsRecord | null> {
  const path = 'portfolio_settings/main';
  try {
    const snap = await getDoc(doc(db, 'portfolio_settings', 'main'));
    if (!snap.exists()) return null;
    return snap.data() as PortfolioSettingsRecord;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function savePortfolioSettings(
  settings: Pick<PortfolioSettingsRecord, 'heroCaseId' | 'hiddenStaticCaseIds'>,
  ownerId: string
): Promise<void> {
  const path = 'portfolio_settings/main';
  const ref = doc(db, 'portfolio_settings', 'main');
  const cleanHero = settings.heroCaseId.trim().slice(0, BLUEPRINT_LIMITS.MAX_ID_LEN);
  const cleanHidden = Array.from(
    new Set(settings.hiddenStaticCaseIds.map((s) => s.trim().slice(0, 80)).filter(Boolean))
  ).slice(0, BLUEPRINT_LIMITS.MAX_HIDDEN_STATIC_IDS);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        heroCaseId: cleanHero,
        hiddenStaticCaseIds: cleanHidden,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId,
        heroCaseId: cleanHero,
        hiddenStaticCaseIds: cleanHidden,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveAiRoutingSettings(
  routing: Partial<AiRoutingSettings>,
  ownerId: string,
  fallbackShowcase?: Pick<PortfolioSettingsRecord, 'heroCaseId' | 'hiddenStaticCaseIds'>
): Promise<AiRoutingSettings> {
  const path = 'portfolio_settings/main';
  const ref = doc(db, 'portfolio_settings', 'main');
  const clean = sanitizeAiRoutingSettings(routing);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        aiProviderOrder: clean.aiProviderOrder,
        aiDisabledProviders: clean.aiDisabledProviders,
        aiOpenaiModel: clean.aiOpenaiModel,
        aiAnthropicModel: clean.aiAnthropicModel,
        aiOpenrouterModel: clean.aiOpenrouterModel,
        updatedAt: serverTimestamp(),
      });
    } else {
      const cleanHero = (fallbackShowcase?.heroCaseId ?? '').trim().slice(0, BLUEPRINT_LIMITS.MAX_ID_LEN);
      const cleanHidden = Array.from(
        new Set((fallbackShowcase?.hiddenStaticCaseIds ?? []).map((s) => s.trim().slice(0, 80)).filter(Boolean))
      ).slice(0, BLUEPRINT_LIMITS.MAX_HIDDEN_STATIC_IDS);

      await setDoc(ref, {
        ownerId,
        heroCaseId: cleanHero,
        hiddenStaticCaseIds: cleanHidden,
        aiProviderOrder: clean.aiProviderOrder,
        aiDisabledProviders: clean.aiDisabledProviders,
        aiOpenaiModel: clean.aiOpenaiModel,
        aiAnthropicModel: clean.aiAnthropicModel,
        aiOpenrouterModel: clean.aiOpenrouterModel,
        updatedAt: serverTimestamp(),
      });
    }
    return clean;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchCaseMediaById(mediaId: string): Promise<CaseMediaRecord | null> {
  if (!mediaId || !BLUEPRINT_LIMITS.ID_PATTERN.test(mediaId)) return null;
  const cached = mediaCache.get(mediaId);
  if (cached) return cached;

  const path = `case_media/${mediaId}`;
  try {
    const snap = await getDoc(doc(db, 'case_media', mediaId));
    if (!snap.exists()) return null;
    const record = snap.data() as CaseMediaRecord;
    mediaCache.set(mediaId, record);
    return record;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchCaseWorkflowById(workflowId: string): Promise<N8nRawWorkflow | null> {
  if (!workflowId || !BLUEPRINT_LIMITS.ID_PATTERN.test(workflowId)) return null;
  const cached = workflowCache.get(workflowId);
  if (cached) return reconstructN8nWorkflowFromFirestore(cached);

  const path = `case_workflows/${workflowId}`;
  try {
    const snap = await getDoc(doc(db, 'case_workflows', workflowId));
    if (!snap.exists()) return null;
    const record = snap.data() as CaseWorkflowRecord;
    workflowCache.set(workflowId, record);
    return reconstructN8nWorkflowFromFirestore(record);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
      return null;
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeOwnerCases(
  onData: (cases: PortfolioCaseRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'cases';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => d.data() as PortfolioCaseRecord)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError && wrapped instanceof Error) {
          onError(wrapped);
        }
      }
    }
  );
}

export interface SaveCaseWithAssetsInput {
  draft: PortfolioCaseRecord;
  ownerId: string;
  isExisting: boolean;
  pendingMedia: Record<string, CaseMediaRecord>;
  pendingWorkflows: Record<string, CaseWorkflowRecord>;
  existingMediaIds: string[];
  existingWorkflowIds: string[];
  deletedMediaIds: string[];
  deletedWorkflowIds: string[];
}

/**
 * Atomically saves the case document alongside all newly uploaded compressed screenshots
 * and sanitized n8n workflows in a single Firestore writeBatch so `existsAfter(...)`
 * security rules always pass cleanly.
 */
export async function saveCaseWithAssets(input: SaveCaseWithAssetsInput): Promise<PortfolioCaseRecord> {
  const sanitized = sanitizeCasePayloadForFirestore(input.draft, input.ownerId);
  const casePath = `cases/${sanitized.id}`;
  const caseRef = doc(db, 'cases', sanitized.id);
  const batch = writeBatch(db);

  if (input.isExisting) {
    const {
      id: _id,
      ownerId: _ownerId,
      ...mutableFields
    } = sanitized;
    void _id;
    void _ownerId;
    batch.update(caseRef, {
      ...mutableFields,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(caseRef, {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Collect active referenced asset IDs
  const referencedMediaIds = new Set<string>();
  if (sanitized.coverMediaId) referencedMediaIds.add(sanitized.coverMediaId);
  const referencedWorkflowIds = new Set<string>();
  for (const scene of sanitized.scenes) {
    if (scene.mediaId) referencedMediaIds.add(scene.mediaId);
    if (scene.n8nWorkflowId) referencedWorkflowIds.add(scene.n8nWorkflowId);
  }

  // Write new pending media docs & update visibility of existing kept media docs
  for (const mediaId of referencedMediaIds) {
    const pending = input.pendingMedia[mediaId];
    if (pending) {
      const mediaRef = doc(db, 'case_media', mediaId);
      const record: CaseMediaRecord = {
        ...pending,
        id: mediaId,
        caseId: sanitized.id,
        ownerId: input.ownerId,
        visibility: sanitized.status,
      };
      batch.set(mediaRef, {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      mediaCache.set(mediaId, record);
    } else if (input.existingMediaIds.includes(mediaId)) {
      batch.update(doc(db, 'case_media', mediaId), {
        visibility: sanitized.status,
        updatedAt: serverTimestamp(),
      });
      const cached = mediaCache.get(mediaId);
      if (cached) mediaCache.set(mediaId, { ...cached, visibility: sanitized.status });
    }
  }

  // Write new pending workflow docs & update visibility of existing kept workflow docs
  for (const wfId of referencedWorkflowIds) {
    const pending = input.pendingWorkflows[wfId];
    if (pending) {
      const wfRef = doc(db, 'case_workflows', wfId);
      const record: CaseWorkflowRecord = {
        ...pending,
        id: wfId,
        caseId: sanitized.id,
        ownerId: input.ownerId,
        visibility: sanitized.status,
      };
      batch.set(wfRef, {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      workflowCache.set(wfId, record);
    } else if (input.existingWorkflowIds.includes(wfId)) {
      batch.update(doc(db, 'case_workflows', wfId), {
        visibility: sanitized.status,
        updatedAt: serverTimestamp(),
      });
      const cached = workflowCache.get(wfId);
      if (cached) workflowCache.set(wfId, { ...cached, visibility: sanitized.status });
    }
  }

  // Delete orphaned/removed media & workflow docs
  for (const oldMediaId of input.deletedMediaIds) {
    if (!referencedMediaIds.has(oldMediaId)) {
      batch.delete(doc(db, 'case_media', oldMediaId));
      mediaCache.delete(oldMediaId);
    }
  }
  for (const oldWfId of input.deletedWorkflowIds) {
    if (!referencedWorkflowIds.has(oldWfId)) {
      batch.delete(doc(db, 'case_workflows', oldWfId));
      workflowCache.delete(oldWfId);
    }
  }

  try {
    await batch.commit();
    return sanitized;
  } catch (error) {
    handleFirestoreError(
      error,
      input.isExisting ? OperationType.UPDATE : OperationType.CREATE,
      casePath
    );
  }
}

export async function updateCaseVisibilityQuick(
  record: PortfolioCaseRecord,
  nextStatus: CaseVisibility
): Promise<void> {
  const path = `cases/${record.id}`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'cases', record.id), {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  });

  const mediaIds = new Set<string>();
  if (record.coverMediaId) mediaIds.add(record.coverMediaId);
  const wfIds = new Set<string>();
  for (const s of record.scenes) {
    if (s.mediaId) mediaIds.add(s.mediaId);
    if (s.n8nWorkflowId) wfIds.add(s.n8nWorkflowId);
  }

  for (const mId of mediaIds) {
    batch.update(doc(db, 'case_media', mId), {
      visibility: nextStatus,
      updatedAt: serverTimestamp(),
    });
  }
  for (const wId of wfIds) {
    batch.update(doc(db, 'case_workflows', wId), {
      visibility: nextStatus,
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCaseSortOrderBatch(
  updates: Array<{ id: string; sortOrder: number }>
): Promise<void> {
  const path = 'cases';
  const batch = writeBatch(db);
  for (const u of updates) {
    batch.update(doc(db, 'cases', u.id), {
      sortOrder: Math.max(0, Math.min(9999, Math.round(u.sortOrder))),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCaseWithAssets(record: PortfolioCaseRecord): Promise<void> {
  const path = `cases/${record.id}`;
  const batch = writeBatch(db);
  batch.delete(doc(db, 'cases', record.id));

  const mediaIds = new Set<string>();
  if (record.coverMediaId) mediaIds.add(record.coverMediaId);
  const wfIds = new Set<string>();
  for (const s of record.scenes) {
    if (s.mediaId) mediaIds.add(s.mediaId);
    if (s.n8nWorkflowId) wfIds.add(s.n8nWorkflowId);
  }

  for (const mId of mediaIds) {
    batch.delete(doc(db, 'case_media', mId));
    mediaCache.delete(mId);
  }
  for (const wId of wfIds) {
    batch.delete(doc(db, 'case_workflows', wId));
    workflowCache.delete(wId);
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
