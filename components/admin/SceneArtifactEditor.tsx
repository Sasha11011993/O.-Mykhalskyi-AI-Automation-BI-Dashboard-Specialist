'use client';

import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  FileJson,
  Globe,
  Image as ImageIcon,
  MapPin,
  Plus,
  Send,
  Star,
  Trash2,
  Upload,
  Workflow,
} from 'lucide-react';
import LiveN8nJsonGraphViewer from '@/components/LiveN8nJsonGraphViewer';
import { compressScreenshotFile } from '@/lib/caseMediaCompress';
import {
  BLUEPRINT_LIMITS,
  clampHotspotCoord,
  generateSafeAssetId,
  reconstructN8nWorkflowFromFirestore,
  serializeN8nWorkflowForFirestore,
  type CaseMediaRecord,
  type CaseSceneDescriptor,
  type CaseSceneKind,
  type CaseWorkflowRecord,
  type SceneHotspot,
} from '@/lib/caseStudioTypes';
import type { N8nRawWorkflow } from '@/lib/n8nWorkflowEngine';

interface SceneArtifactEditorProps {
  caseId: string;
  ownerId: string;
  visibility: 'draft' | 'published' | 'unlisted';
  scenes: CaseSceneDescriptor[];
  coverMediaId: string;
  mediaPreviewMap: Record<string, string>;
  workflowPreviewMap: Record<string, N8nRawWorkflow>;
  onChangeScenes: (next: CaseSceneDescriptor[]) => void;
  onChangeCoverMediaId: (mediaId: string) => void;
  onAddPendingMedia: (media: CaseMediaRecord) => void;
  onAddPendingWorkflow: (workflow: CaseWorkflowRecord, rawForPreview: N8nRawWorkflow) => void;
  onDeleteAssetIds: (deleted: { mediaId?: string; workflowId?: string }) => void;
  onMergeDetectedStack: (detectedTags: string[]) => void;
}

const SCENE_KINDS: Array<{
  kind: CaseSceneKind;
  label: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}> = [
  { kind: 'n8n-json', label: 'n8n JSON (жива анімація)', icon: Workflow },
  { kind: 'ui-telegram', label: 'Скріншот Telegram', icon: Send },
  { kind: 'ui-web', label: 'Скріншот Web / BI', icon: Globe },
  { kind: 'ui-n8n-image', label: 'Скріншот n8n', icon: ImageIcon },
];

export default function SceneArtifactEditor({
  caseId,
  ownerId,
  visibility,
  scenes,
  coverMediaId,
  mediaPreviewMap,
  workflowPreviewMap,
  onChangeScenes,
  onChangeCoverMediaId,
  onAddPendingMedia,
  onAddPendingWorkflow,
  onDeleteAssetIds,
  onMergeDetectedStack,
}: SceneArtifactEditorProps) {
  const [selectedSceneIdx, setSelectedSceneIdx] = useState<number>(0);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pasteJsonOpen, setPasteJsonOpen] = useState<boolean>(false);
  const [pastedJsonText, setPastedJsonText] = useState<string>('');
  const [defaultImageKind, setDefaultImageKind] = useState<Exclude<CaseSceneKind, 'n8n-json'>>('ui-telegram');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const safeIdx = Math.min(selectedSceneIdx, Math.max(0, scenes.length - 1));
  const activeScene = scenes[safeIdx] ?? null;

  const ingestN8nJsonText = (rawText: string, fileNameHint?: string) => {
    setErrorMessage(null);
    setStatusMessage(null);
    const result = serializeN8nWorkflowForFirestore(rawText);
    if (!result.ok) {
      setErrorMessage(result.errorUk);
      return;
    }

    if (scenes.length >= BLUEPRINT_LIMITS.MAX_SCENES) {
      setErrorMessage(`Максимум ${BLUEPRINT_LIMITS.MAX_SCENES} сцен в одному кейсі.`);
      return;
    }

    const wfId = generateSafeAssetId('wf');
    const wfRecord: CaseWorkflowRecord = {
      id: wfId,
      caseId,
      ownerId,
      visibility,
      workflowName: result.workflowName,
      nodes: result.nodes,
      links: result.links,
    };
    const previewWf = reconstructN8nWorkflowFromFirestore(wfRecord);
    onAddPendingWorkflow(wfRecord, previewWf);
    onMergeDetectedStack(result.uniqueTechStack);

    const newScene: CaseSceneDescriptor = {
      id: generateSafeAssetId('scene'),
      kind: 'n8n-json',
      titleUk: result.workflowName || fileNameHint?.replace(/\.json$/i, '') || 'Воркфлоу n8n',
      titleEn: result.workflowName || 'n8n Workflow',
      captionUk: `${result.nodeCount} вузлів n8n · автоматично анімований граф`,
      captionEn: `${result.nodeCount} n8n nodes · auto-animated workflow graph`,
      mediaId: '',
      n8nWorkflowId: wfId,
      hotspots: [],
    };

    const nextScenes = [...scenes, newScene];
    onChangeScenes(nextScenes);
    setSelectedSceneIdx(nextScenes.length - 1);
    setPasteJsonOpen(false);
    setPastedJsonText('');
    setStatusMessage(
      `Імпортовано воркфлоу «${result.workflowName}» (${result.nodeCount} вузлів) та додано теги стеку.`
    );
  };

  const ingestFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setErrorMessage(null);
    setStatusMessage(null);
    setIsProcessing(true);

    let workingScenes = [...scenes];
    let firstCover = coverMediaId;
    let addedCount = 0;

    try {
      for (const file of files) {
        if (workingScenes.length >= BLUEPRINT_LIMITS.MAX_SCENES) {
          setErrorMessage(`Досягнуто ліміт ${BLUEPRINT_LIMITS.MAX_SCENES} сцен на кейс.`);
          break;
        }

        const isJson =
          file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';

        if (isJson) {
          const text = await file.text();
          const result = serializeN8nWorkflowForFirestore(text);
          if (!result.ok) {
            setErrorMessage(`${file.name}: ${result.errorUk}`);
            continue;
          }
          const wfId = generateSafeAssetId('wf');
          const wfRecord: CaseWorkflowRecord = {
            id: wfId,
            caseId,
            ownerId,
            visibility,
            workflowName: result.workflowName,
            nodes: result.nodes,
            links: result.links,
          };
          onAddPendingWorkflow(wfRecord, reconstructN8nWorkflowFromFirestore(wfRecord));
          onMergeDetectedStack(result.uniqueTechStack);

          workingScenes = [
            ...workingScenes,
            {
              id: generateSafeAssetId('scene'),
              kind: 'n8n-json',
              titleUk: result.workflowName || file.name.replace(/\.json$/i, ''),
              titleEn: result.workflowName || 'n8n Workflow',
              captionUk: `${result.nodeCount} вузлів n8n · автоматична жива схема`,
              captionEn: `${result.nodeCount} n8n nodes · auto-animated graph`,
              mediaId: '',
              n8nWorkflowId: wfId,
              hotspots: [],
            },
          ];
          addedCount += 1;
        } else if (file.type.startsWith('image/')) {
          const compressed = await compressScreenshotFile(file);
          const mediaId = generateSafeAssetId('media');
          const mediaRecord: CaseMediaRecord = {
            id: mediaId,
            caseId,
            ownerId,
            visibility,
            mimeType: compressed.mimeType,
            dataUrl: compressed.dataUrl,
            width: compressed.width,
            height: compressed.height,
          };
          onAddPendingMedia(mediaRecord);
          if (!firstCover) {
            firstCover = mediaId;
            onChangeCoverMediaId(mediaId);
          }

          // Smart kind inference based on aspect ratio if user left default
          const inferredKind: Exclude<CaseSceneKind, 'n8n-json'> =
            compressed.height > compressed.width * 1.15 ? 'ui-telegram' : defaultImageKind;
          const baseTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

          workingScenes = [
            ...workingScenes,
            {
              id: generateSafeAssetId('scene'),
              kind: inferredKind,
              titleUk:
                inferredKind === 'ui-telegram'
                  ? baseTitle || 'Інтерфейс у Telegram'
                  : inferredKind === 'ui-web'
                    ? baseTitle || 'Веб-інтерфейс / BI'
                    : baseTitle || 'Скріншот воркфлоу n8n',
              titleEn:
                inferredKind === 'ui-telegram'
                  ? 'Telegram Interface'
                  : inferredKind === 'ui-web'
                    ? 'Web / BI Interface'
                    : 'n8n Workflow Canvas',
              captionUk: '',
              captionEn: '',
              mediaId,
              n8nWorkflowId: '',
              hotspots: [],
            },
          ];
          addedCount += 1;
          setStatusMessage(
            `Стиснуто ${file.name} → ${Math.round(compressed.approxBytes / 1024)} KB (${compressed.width}×${compressed.height})`
          );
        } else {
          setErrorMessage(`Непідтримуваний формат файлу: ${file.name}. Додайте .json або зображення.`);
        }
      }

      if (addedCount > 0) {
        onChangeScenes(workingScenes);
        setSelectedSceneIdx(workingScenes.length - 1);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Помилка обробки файлу.');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateActiveScene = (patch: Partial<CaseSceneDescriptor>) => {
    if (!activeScene) return;
    const next = scenes.map((s, idx) => (idx === safeIdx ? { ...s, ...patch } : s));
    onChangeScenes(next);
  };

  const moveScene = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= scenes.length) return;
    const copy = [...scenes];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    onChangeScenes(copy);
    setSelectedSceneIdx(target);
  };

  const removeScene = (idx: number) => {
    const removed = scenes[idx];
    if (!removed) return;
    onDeleteAssetIds({
      mediaId: removed.mediaId || undefined,
      workflowId: removed.n8nWorkflowId || undefined,
    });
    const next = scenes.filter((_, i) => i !== idx);
    onChangeScenes(next);
    if (removed.mediaId && removed.mediaId === coverMediaId) {
      const nextMedia = next.find((s) => s.mediaId)?.mediaId ?? '';
      onChangeCoverMediaId(nextMedia);
    }
    setSelectedSceneIdx(Math.max(0, idx - 1));
    setSelectedHotspotId(null);
  };

  const handleImageClickAddHotspot = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!activeScene || activeScene.kind === 'n8n-json') return;
    if ((activeScene.hotspots ?? []).length >= BLUEPRINT_LIMITS.MAX_HOTSPOTS_PER_SCENE) {
      setErrorMessage(`Максимум ${BLUEPRINT_LIMITS.MAX_HOTSPOTS_PER_SCENE} міток на один скріншот.`);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const xPct = clampHotspotCoord(((event.clientX - rect.left) / rect.width) * 100);
    const yPct = clampHotspotCoord(((event.clientY - rect.top) / rect.height) * 100);
    const num = (activeScene.hotspots?.length ?? 0) + 1;

    const newHs: SceneHotspot = {
      id: generateSafeAssetId('hs'),
      xPct,
      yPct,
      titleUk: `Ключовий елемент ${num}`,
      titleEn: `Key Highlight ${num}`,
      noteUk: '',
      noteEn: '',
    };

    updateActiveScene({ hotspots: [...(activeScene.hotspots ?? []), newHs] });
    setSelectedHotspotId(newHs.id);
    setErrorMessage(null);
  };

  const updateHotspot = (hsId: string, patch: Partial<SceneHotspot>) => {
    if (!activeScene) return;
    updateActiveScene({
      hotspots: (activeScene.hotspots ?? []).map((h) => (h.id === hsId ? { ...h, ...patch } : h)),
    });
  };

  const deleteHotspot = (hsId: string) => {
    if (!activeScene) return;
    updateActiveScene({
      hotspots: (activeScene.hotspots ?? []).filter((h) => h.id !== hsId),
    });
    if (selectedHotspotId === hsId) setSelectedHotspotId(null);
  };

  const activeMediaSrc = activeScene?.mediaId ? mediaPreviewMap[activeScene.mediaId] : '';
  const activeWorkflow = activeScene?.n8nWorkflowId
    ? workflowPreviewMap[activeScene.n8nWorkflowId]
    : null;

  return (
    <div className="space-y-5">
      {/* Drag & Drop Ingestion Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) {
            void ingestFiles(e.dataTransfer.files);
          }
        }}
        className={`rounded-xl border-2 border-dashed p-5 transition-colors ${
          isDragging
            ? 'border-[#CC4518] bg-[#FFF2EB]/70 dark:bg-[#2B1A13]/40'
            : 'border-[#D8D1C4] dark:border-[#34312D] bg-[#FAF8F4] dark:bg-[#141311]'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#161513] dark:text-[#F5F3EE]">
              Перетягніть файли сюди: n8n `.json` та скріншоти (Telegram, Web, BI, n8n)
            </p>
            <p className="text-xs text-[#5C5852] dark:text-[#A8A298]">
              n8n `.json` одразу анімується й авто-заповнить стек · скріншоти автоматично стискаються у легкий WebP
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="Тип за замовчуванням для скріншотів"
              value={defaultImageKind}
              onChange={(e) =>
                setDefaultImageKind(e.target.value as Exclude<CaseSceneKind, 'n8n-json'>)
              }
              className="px-2.5 py-2 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#161513] dark:text-[#F5F3EE]"
            >
              <option value="ui-telegram">Скріншот: Telegram</option>
              <option value="ui-web">Скріншот: Web / BI</option>
              <option value="ui-n8n-image">Скріншот: n8n</option>
            </select>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".json,application/json,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                if (e.target.files?.length) {
                  void ingestFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />

            <button
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#CC4518] hover:bg-[#B23A12] text-white transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{isProcessing ? 'Обробка…' : 'Завантажити файли'}</span>
            </button>

            <button
              type="button"
              onClick={() => setPasteJsonOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#161513] dark:text-[#F5F3EE] hover:border-[#CC4518]/60 whitespace-nowrap cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-[#CC4518]" aria-hidden="true" />
              <span>Вставити n8n JSON</span>
            </button>
          </div>
        </div>

        {pasteJsonOpen && (
          <div className="mt-4 pt-4 border-t border-[#E5E0D6] dark:border-[#2A2825] space-y-2.5">
            <textarea
              rows={5}
              value={pastedJsonText}
              onChange={(e) => setPastedJsonText(e.target.value)}
              placeholder='Вставте експорт воркфлоу з n8n ({"name": "...", "nodes": [...], "connections": {...}})'
              className="w-full rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] px-3 py-2 font-mono text-xs text-[#161513] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#CC4518]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPasteJsonOpen(false)}
                className="px-3 py-1.5 text-xs font-medium text-[#5C5852] dark:text-[#A8A298] cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                onClick={() => ingestN8nJsonText(pastedJsonText)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#161513] dark:bg-[#F5F3EE] text-white dark:text-[#111110] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Додати як живу сцену</span>
              </button>
            </div>
          </div>
        )}

        {statusMessage && (
          <p className="mt-3 text-xs font-medium text-[#0F766E] dark:text-[#2DD4BF]">
            {statusMessage}
          </p>
        )}
        {errorMessage && (
          <p className="mt-3 text-xs font-medium text-[#C84317] dark:text-[#FB8356]">
            {errorMessage}
          </p>
        )}
      </div>

      {/* Ordered Scenes List + Active Scene Editor */}
      {scenes.length === 0 ? (
        <div className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] p-8 text-center space-y-2">
          <p className="text-sm font-medium text-[#161513] dark:text-[#F5F3EE]">
            Поки немає жодної сцени
          </p>
          <p className="text-xs text-[#6E6960] dark:text-[#A8A298] max-w-md mx-auto">
            Закиньте один або кілька `.json` воркфлоу з n8n та скріншоти результату (Telegram-бот, веб-дашборд, Google Sheets) — вони вишикуються у послідовну історію кейсу.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Ordered Scenes Queue */}
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#6E6960] dark:text-[#A8A298]">
              <span className="font-semibold text-[#161513] dark:text-[#F5F3EE]">
                Сцени проєкту ({scenes.length}/{BLUEPRINT_LIMITS.MAX_SCENES})
              </span>
              <span>Порядок показу</span>
            </div>

            <div className="space-y-1.5">
              {scenes.map((scene, idx) => {
                const isSelected = idx === safeIdx;
                const kindMeta = SCENE_KINDS.find((k) => k.kind === scene.kind);
                const Icon = kindMeta?.icon ?? ImageIcon;
                const isCover = Boolean(scene.mediaId && scene.mediaId === coverMediaId);

                return (
                  <div
                    key={scene.id}
                    className={`rounded-xl border p-2.5 transition-colors ${
                      isSelected
                        ? 'border-[#CC4518] dark:border-[#FB8356] bg-[#FFF8F4] dark:bg-[#231914]'
                        : 'border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSceneIdx(idx);
                          setSelectedHotspotId(null);
                        }}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#161513] dark:text-[#F5F3EE]">
                          <span className="font-mono text-[11px] text-[#6E6960] dark:text-[#A8A298] tabular-nums">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <Icon className="w-3.5 h-3.5 text-[#CC4518] shrink-0" aria-hidden={true} />
                          <span className="truncate">{scene.titleUk || 'Без назви'}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#6E6960] dark:text-[#A8A298] truncate">
                          {kindMeta?.label}
                          {scene.hotspots.length > 0 ? ` · ${scene.hotspots.length} міток` : ''}
                          {isCover ? ' · Обкладинка' : ''}
                        </p>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveScene(idx, -1)}
                          aria-label="Перемістити сцену вгору"
                          className="p-1 rounded text-[#6E6960] hover:text-[#161513] dark:text-[#A8A298] dark:hover:text-[#F5F3EE] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === scenes.length - 1}
                          onClick={() => moveScene(idx, 1)}
                          aria-label="Перемістити сцену вниз"
                          className="p-1 rounded text-[#6E6960] hover:text-[#161513] dark:text-[#A8A298] dark:hover:text-[#F5F3EE] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeScene(idx)}
                          aria-label="Видалити сцену"
                          className="p-1 rounded text-[#6E6960] hover:text-[#C84317] dark:text-[#A8A298] dark:hover:text-[#FB8356] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Active Scene Settings + Interactive Hotspot Placer / Live n8n Preview */}
          {activeScene && (
            <div className="lg:col-span-8 rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] p-4 space-y-4">
              {/* Scene Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5852] dark:text-[#A8A298] mb-1">
                    Назва сцени (UK)
                  </label>
                  <input
                    type="text"
                    value={activeScene.titleUk}
                    onChange={(e) => updateActiveScene({ titleUk: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311] text-[#161513] dark:text-[#F5F3EE]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5852] dark:text-[#A8A298] mb-1">
                    Scene Title (EN)
                  </label>
                  <input
                    type="text"
                    value={activeScene.titleEn}
                    onChange={(e) => updateActiveScene({ titleEn: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311] text-[#161513] dark:text-[#F5F3EE]"
                  />
                </div>
              </div>

              {activeScene.kind !== 'n8n-json' && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-[#EFECE5] dark:bg-[#1F1E1B] border border-[#E5E0D6] dark:border-[#2A2825]">
                    {(['ui-telegram', 'ui-web', 'ui-n8n-image'] as const).map((k) => {
                      const label =
                        k === 'ui-telegram' ? 'Telegram' : k === 'ui-web' ? 'Web / BI' : 'Скріншот n8n';
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => updateActiveScene({ kind: k })}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                            activeScene.kind === k
                              ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-2xs'
                              : 'text-[#5C5852] dark:text-[#A8A298]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {activeScene.mediaId && (
                    <button
                      type="button"
                      onClick={() => onChangeCoverMediaId(activeScene.mediaId)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border cursor-pointer ${
                        coverMediaId === activeScene.mediaId
                          ? 'border-[#0F766E] bg-[#F3FBF8] dark:bg-[#12221E] text-[#0F766E] dark:text-[#2DD4BF]'
                          : 'border-[#DDD6C9] dark:border-[#33302B] text-[#5C5852] dark:text-[#A8A298]'
                      }`}
                    >
                      <Star className="w-3 h-3" aria-hidden="true" />
                      <span>
                        {coverMediaId === activeScene.mediaId
                          ? 'Обкладинка картки'
                          : 'Зробити обкладинкою'}
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Scene Interactive Preview / Hotspot Placer */}
              {activeScene.kind === 'n8n-json' ? (
                activeWorkflow ? (
                  <LiveN8nJsonGraphViewer workflow={activeWorkflow} title={activeScene.titleUk} compact />
                ) : (
                  <p className="text-xs text-[#6E6960] dark:text-[#A8A298]">
                    Воркфлоу завантажується…
                  </p>
                )
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#161513] dark:text-[#F5F3EE]">
                      <MapPin className="w-3.5 h-3.5 text-[#CC4518]" aria-hidden="true" />
                      <span>Клікніть у будь-яке місце на скріншоті, щоб поставити мітку ① ② ③</span>
                    </span>
                    <span className="font-mono text-[11px] text-[#6E6960] dark:text-[#A8A298] tabular-nums">
                      {activeScene.hotspots.length}/{BLUEPRINT_LIMITS.MAX_HOTSPOTS_PER_SCENE}
                    </span>
                  </div>

                  {activeMediaSrc ? (
                    <div
                      className={`mx-auto ${
                        activeScene.kind === 'ui-telegram' ? 'max-w-[380px]' : 'w-full'
                      }`}
                    >
                      <div
                        onClick={handleImageClickAddHotspot}
                        className="relative inline-block w-full rounded-lg overflow-hidden border border-[#DED8CC] dark:border-[#2E2B27] cursor-crosshair"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeMediaSrc}
                          alt={activeScene.titleUk}
                          referrerPolicy="no-referrer"
                          className="w-full h-auto block select-none"
                        />
                        {activeScene.hotspots.map((hs, hIdx) => {
                          const isSelected = selectedHotspotId === hs.id;
                          return (
                            <button
                              key={hs.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedHotspotId(hs.id);
                              }}
                              style={{ left: `${hs.xPct}%`, top: `${hs.yPct}%` }}
                              className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full font-mono text-xs font-bold flex items-center justify-center border-2 shadow-md cursor-pointer ${
                                isSelected
                                  ? 'bg-[#CC4518] text-white border-white scale-115 z-20'
                                  : 'bg-[#161513]/90 text-white border-white hover:bg-[#CC4518] z-10'
                              }`}
                            >
                              {hIdx + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-[#E5E0D6] dark:border-[#2A2825] p-6 text-center text-xs text-[#6E6960]">
                      Завантаження зображення…
                    </div>
                  )}

                  {/* Hotspot Text Editors */}
                  {activeScene.hotspots.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-[#E5E0D6] dark:border-[#2A2825]">
                      {activeScene.hotspots.map((hs, hIdx) => (
                        <div
                          key={hs.id}
                          onClick={() => setSelectedHotspotId(hs.id)}
                          className={`rounded-lg border p-2.5 space-y-2 ${
                            selectedHotspotId === hs.id
                              ? 'border-[#CC4518]/60 bg-[#FFF8F4] dark:bg-[#231914]'
                              : 'border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-[#CC4518] dark:text-[#FB8356]">
                              Мітка #{hIdx + 1} ({hs.xPct}%, {hs.yPct}%)
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteHotspot(hs.id);
                              }}
                              aria-label={`Видалити мітку ${hIdx + 1}`}
                              className="text-[#6E6960] hover:text-[#C84317] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={hs.titleUk}
                              onChange={(e) => updateHotspot(hs.id, { titleUk: e.target.value })}
                              placeholder="Заголовок мітки (UK)"
                              className="px-2.5 py-1.5 text-xs rounded border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE]"
                            />
                            <input
                              type="text"
                              value={hs.titleEn}
                              onChange={(e) => updateHotspot(hs.id, { titleEn: e.target.value })}
                              placeholder="Callout Title (EN, optional)"
                              className="px-2.5 py-1.5 text-xs rounded border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE]"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={hs.noteUk}
                            onChange={(e) => updateHotspot(hs.id, { noteUk: e.target.value })}
                            placeholder="Коротке інженерне пояснення для клієнта (1–2 речення)"
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE]"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Scene Caption */}
              <div>
                <label className="block text-[11px] font-medium text-[#5C5852] dark:text-[#A8A298] mb-1">
                  Короткий підпис під сценою (UK)
                </label>
                <input
                  type="text"
                  value={activeScene.captionUk}
                  onChange={(e) => updateActiveScene({ captionUk: e.target.value })}
                  placeholder="Наприклад: Щоранку бот надсилає готове зведення прострочки у Telegram керівника"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311] text-[#161513] dark:text-[#F5F3EE]"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
