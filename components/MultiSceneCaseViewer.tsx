'use client';

import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Send,
  Workflow,
} from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import LiveN8nJsonGraphViewer from '@/components/LiveN8nJsonGraphViewer';
import { fetchCaseMediaById, fetchCaseWorkflowById } from '@/lib/caseRepository';
import type { CaseSceneDescriptor, CaseSceneKind, SceneHotspot } from '@/lib/caseStudioTypes';
import type { N8nRawWorkflow } from '@/lib/n8nWorkflowEngine';

interface MultiSceneCaseViewerProps {
  scenes: CaseSceneDescriptor[];
  localMediaMap?: Record<string, string>;
  localWorkflowMap?: Record<string, N8nRawWorkflow>;
}

const SCENE_KIND_ICON: Record<
  CaseSceneKind,
  React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
> = {
  'n8n-json': Workflow,
  'ui-telegram': Send,
  'ui-web': Globe,
  'ui-n8n-image': ImageIcon,
};

export default function MultiSceneCaseViewer({
  scenes,
  localMediaMap,
  localWorkflowMap,
}: MultiSceneCaseViewerProps) {
  const { locale } = useThemeLocale();
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [loadedMedia, setLoadedMedia] = useState<Record<string, string>>({});
  const [loadedWorkflows, setLoadedWorkflows] = useState<Record<string, N8nRawWorkflow>>({});

  const safeIndex = Math.min(activeIndex, Math.max(0, scenes.length - 1));
  const activeScene = scenes[safeIndex] ?? null;

  // Fetch remote media/workflow lazily when viewing a scene not already in local maps
  useEffect(() => {
    if (!activeScene) return;
    let cancelled = false;

    if (
      activeScene.mediaId &&
      !localMediaMap?.[activeScene.mediaId] &&
      !loadedMedia[activeScene.mediaId]
    ) {
      void fetchCaseMediaById(activeScene.mediaId)
        .then((rec) => {
          if (!cancelled && rec) {
            setLoadedMedia((prev) => ({ ...prev, [activeScene.mediaId]: rec.dataUrl }));
          }
        })
        .catch(() => {});
    }

    if (
      activeScene.n8nWorkflowId &&
      !localWorkflowMap?.[activeScene.n8nWorkflowId] &&
      !loadedWorkflows[activeScene.n8nWorkflowId]
    ) {
      void fetchCaseWorkflowById(activeScene.n8nWorkflowId)
        .then((wf) => {
          if (!cancelled && wf) {
            setLoadedWorkflows((prev) => ({ ...prev, [activeScene.n8nWorkflowId]: wf }));
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [activeScene, localMediaMap, localWorkflowMap, loadedMedia, loadedWorkflows]);

  if (!activeScene) return null;

  const activeMediaSrc =
    (activeScene.mediaId && (localMediaMap?.[activeScene.mediaId] || loadedMedia[activeScene.mediaId])) ||
    '';
  const activeWorkflow =
    (activeScene.n8nWorkflowId &&
      (localWorkflowMap?.[activeScene.n8nWorkflowId] || loadedWorkflows[activeScene.n8nWorkflowId])) ||
    null;

  const hotspots = activeScene.hotspots ?? [];
  const activeHotspot: SceneHotspot | null =
    hotspots.find((h) => h.id === selectedHotspotId) ?? hotspots[0] ?? null;

  const sceneTitle =
    locale === 'uk'
      ? activeScene.titleUk || activeScene.titleEn || `Сцена ${safeIndex + 1}`
      : activeScene.titleEn || activeScene.titleUk || `Scene ${safeIndex + 1}`;
  const sceneCaption =
    locale === 'uk'
      ? activeScene.captionUk || activeScene.captionEn
      : activeScene.captionEn || activeScene.captionUk;

  const handleSelectScene = (idx: number) => {
    setActiveIndex(idx);
    setSelectedHotspotId(null);
    setIsZoomed(false);
  };

  return (
    <div data-testid="multi-scene-case-viewer" className="space-y-3">
      {/* End-to-End Story Scene Switcher */}
      {scenes.length > 1 && (
        <div className="flex items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label={locale === 'uk' ? 'Сцени проєкту' : 'Project scenes'}
            className="flex items-center gap-1 p-1 rounded-lg bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825] overflow-x-auto max-w-full"
          >
            {scenes.map((scene, idx) => {
              const Icon = SCENE_KIND_ICON[scene.kind] ?? ImageIcon;
              const isCurrent = idx === safeIndex;
              const label =
                locale === 'uk'
                  ? scene.titleUk || scene.titleEn || `Сцена ${idx + 1}`
                  : scene.titleEn || scene.titleUk || `Scene ${idx + 1}`;
              return (
                <button
                  key={scene.id}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  onClick={() => handleSelectScene(idx)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCurrent
                      ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-2xs'
                      : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-65 tabular-nums">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden={true} />
                  <span className="max-w-[160px] truncate">{label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden sm:inline-flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={safeIndex === 0}
              onClick={() => handleSelectScene(Math.max(0, safeIndex - 1))}
              aria-label={locale === 'uk' ? 'Попередня сцена' : 'Previous scene'}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={safeIndex === scenes.length - 1}
              onClick={() => handleSelectScene(Math.min(scenes.length - 1, safeIndex + 1))}
              aria-label={locale === 'uk' ? 'Наступна сцена' : 'Next scene'}
              className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Scene Content Body */}
      {activeScene.kind === 'n8n-json' ? (
        activeWorkflow ? (
          <LiveN8nJsonGraphViewer workflow={activeWorkflow} title={sceneTitle} />
        ) : (
          <div className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] p-8 text-center text-xs text-[#6E6960] dark:text-[#A8A298]">
            {locale === 'uk' ? 'Завантаження інтерактивного воркфлоу n8n…' : 'Loading interactive n8n workflow…'}
          </div>
        )
      ) : (
        <div className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] overflow-hidden">
          {/* Scene Frame Header */}
          <div className="px-4 py-2 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-white/85 dark:bg-[#181715] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {activeScene.kind === 'ui-telegram' ? (
                <Send className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF] shrink-0" aria-hidden="true" />
              ) : activeScene.kind === 'ui-web' ? (
                <Globe className="w-3.5 h-3.5 text-[#4338CA] dark:text-[#818CF8] shrink-0" aria-hidden="true" />
              ) : (
                <Workflow className="w-3.5 h-3.5 text-[#C84317] dark:text-[#FB8356] shrink-0" aria-hidden="true" />
              )}
              <span className="text-xs font-semibold text-[#161513] dark:text-[#F5F3EE] truncate">
                {sceneTitle}
              </span>
              {hotspots.length > 0 && (
                <>
                  <span aria-hidden="true" className="text-[#C6BEB2] dark:text-[#44403A]">
                    ·
                  </span>
                  <span className="font-mono text-[11px] text-[#6E6960] dark:text-[#A8A298] whitespace-nowrap tabular-nums">
                    {locale === 'uk' ? `${hotspots.length} пояснень` : `${hotspots.length} callouts`}
                  </span>
                </>
              )}
            </div>

            {activeMediaSrc && (
              <button
                type="button"
                onClick={() => setIsZoomed((z) => !z)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#1B1A18] text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] cursor-pointer whitespace-nowrap"
              >
                {isZoomed ? (
                  <>
                    <Minimize2 className="w-3 h-3" aria-hidden="true" />
                    <span>{locale === 'uk' ? 'Звичайний' : 'Fit'}</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3 h-3" aria-hidden="true" />
                    <span>{locale === 'uk' ? 'Збільшити' : 'Zoom'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Screenshot Canvas + Numbered Hotspots */}
          <div className={`p-3 sm:p-4 ${isZoomed ? 'overflow-x-auto' : ''}`}>
            {activeMediaSrc ? (
              <div
                className={`mx-auto ${
                  activeScene.kind === 'ui-telegram' && !isZoomed
                    ? 'max-w-[440px]'
                    : isZoomed
                      ? 'min-w-[820px]'
                      : 'w-full'
                }`}
              >
                <div className="relative inline-block w-full rounded-lg overflow-hidden border border-[#DED8CC] dark:border-[#2E2B27] bg-white dark:bg-[#111110]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeMediaSrc}
                    alt={sceneTitle}
                    referrerPolicy="no-referrer"
                    className="w-full h-auto block select-none"
                  />

                  {/* Clickable Numbered Hotspot Markers */}
                  {hotspots.map((hs, hIdx) => {
                    const isSelected = activeHotspot?.id === hs.id;
                    const hsTitle =
                      locale === 'uk' ? hs.titleUk || hs.titleEn : hs.titleEn || hs.titleUk;
                    return (
                      <button
                        key={hs.id}
                        type="button"
                        onClick={() => setSelectedHotspotId(hs.id)}
                        aria-label={`${hIdx + 1}. ${hsTitle}`}
                        aria-pressed={isSelected}
                        style={{ left: `${hs.xPct}%`, top: `${hs.yPct}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full font-mono text-xs font-bold flex items-center justify-center border-2 transition-transform duration-150 cursor-pointer shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] ${
                          isSelected
                            ? 'bg-[#CC4518] text-white border-white scale-115 z-20'
                            : 'bg-[#161513]/90 text-white border-white/90 hover:scale-110 hover:bg-[#CC4518] z-10'
                        }`}
                      >
                        {hIdx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="min-h-[200px] flex items-center justify-center text-xs text-[#6E6960] dark:text-[#A8A298]">
                {locale === 'uk' ? 'Завантаження скріншоту…' : 'Loading screenshot…'}
              </div>
            )}
          </div>

          {/* Hotspot Engineering Callout Bar or Scene Caption */}
          {(activeHotspot || sceneCaption) && (
            <div className="px-4 py-3 border-t border-[#E5E0D6] dark:border-[#2A2825] bg-white/90 dark:bg-[#181715] space-y-2">
              {hotspots.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {hotspots.map((hs, hIdx) => {
                    const isSelected = activeHotspot?.id === hs.id;
                    const hsTitle =
                      locale === 'uk'
                        ? hs.titleUk || hs.titleEn || `Точка ${hIdx + 1}`
                        : hs.titleEn || hs.titleUk || `Point ${hIdx + 1}`;
                    return (
                      <button
                        key={hs.id}
                        type="button"
                        onClick={() => setSelectedHotspotId(hs.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer ${
                          isSelected
                            ? 'border-[#CC4518] dark:border-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356] font-semibold'
                            : 'border-[#E5E0D6] dark:border-[#2A2825] bg-transparent text-[#555049] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                        }`}
                      >
                        <span className="font-mono font-bold tabular-nums">{hIdx + 1}.</span>
                        <span>{hsTitle}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeHotspot ? (
                <p className="text-xs text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                  <span className="font-semibold text-[#161513] dark:text-[#F5F3EE]">
                    {locale === 'uk'
                      ? activeHotspot.titleUk || activeHotspot.titleEn
                      : activeHotspot.titleEn || activeHotspot.titleUk}
                    :{' '}
                  </span>
                  {locale === 'uk'
                    ? activeHotspot.noteUk || activeHotspot.noteEn || sceneCaption
                    : activeHotspot.noteEn || activeHotspot.noteUk || sceneCaption}
                </p>
              ) : (
                sceneCaption && (
                  <p className="text-xs text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                    {sceneCaption}
                  </p>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
