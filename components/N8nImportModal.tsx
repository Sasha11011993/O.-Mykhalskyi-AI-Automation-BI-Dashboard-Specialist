'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, FileJson, Play, RotateCcw, Upload, Workflow, X } from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import {
  PRODUCTION_DEBT_CONTROL_WORKFLOW,
  getDefaultN8nWorkflow,
  parseAndLayoutN8nWorkflow,
  type ParsedN8nGraph,
} from '@/lib/n8nWorkflowEngine';

interface N8nImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRawJson: string;
  isCustomLoaded: boolean;
  onApplyWorkflow: (graph: ParsedN8nGraph, rawJson: string, isCustom: boolean) => void;
}

export default function N8nImportModal({
  isOpen,
  onClose,
  currentRawJson,
  isCustomLoaded,
  onApplyWorkflow,
}: N8nImportModalProps) {
  const { locale } = useThemeLocale();
  const [draftJson, setDraftJson] = useState<string>(currentRawJson);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setDraftJson(content);
      setErrorText(null);
      const parsed = parseAndLayoutN8nWorkflow(content);
      if (parsed.ok) {
        onApplyWorkflow(parsed.graph, content, true);
        onClose();
      } else {
        setErrorText(locale === 'uk' ? parsed.errorUk : parsed.errorEn);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleApply = () => {
    const parsed = parseAndLayoutN8nWorkflow(draftJson);
    if (!parsed.ok) {
      setErrorText(locale === 'uk' ? parsed.errorUk : parsed.errorEn);
      return;
    }
    setErrorText(null);
    onApplyWorkflow(parsed.graph, draftJson, true);
    onClose();
  };

  const handleResetDefault = () => {
    const localizedDefault = getDefaultN8nWorkflow(locale);
    const prettyDefault = JSON.stringify(localizedDefault, null, 2);
    const parsed = parseAndLayoutN8nWorkflow(localizedDefault);
    if (parsed.ok) {
      setDraftJson(prettyDefault);
      setErrorText(null);
      onApplyWorkflow(parsed.graph, prettyDefault, false);
      onClose();
    }
  };

  const handleLoadProductionPreset = () => {
    const prettySample = JSON.stringify(PRODUCTION_DEBT_CONTROL_WORKFLOW, null, 2);
    const parsed = parseAndLayoutN8nWorkflow(PRODUCTION_DEBT_CONTROL_WORKFLOW, 'compact');
    if (parsed.ok) {
      setDraftJson(prettySample);
      setErrorText(null);
      onApplyWorkflow(parsed.graph, prettySample, true);
      onClose();
    }
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(draftJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={locale === 'uk' ? 'Імпорт реального n8n воркфлоу' : 'Import real n8n workflow'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-[#111110]/72 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] shadow-2xl overflow-hidden flex flex-col max-h-[86dvh]"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E5E0D6] dark:border-[#2A2825] flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4 text-[#C84317] dark:text-[#FB8356]" aria-hidden="true" />
                  <h3 className="text-sm sm:text-base font-semibold text-[#161513] dark:text-[#F5F3EE]">
                    {locale === 'uk'
                      ? 'Справжній n8n Workflow (JSON)'
                      : 'Real n8n Workflow (JSON)'}
                  </h3>
                </div>
                <p className="text-xs text-[#5C5852] dark:text-[#A8A298]">
                  {locale === 'uk'
                    ? 'Завантажте .json експорт із вашого n8n (Workflow → Download) або вставте код нижче. Обробка відбувається локально у браузері.'
                    : 'Upload a .json export directly from n8n (Workflow → Download) or paste JSON below. Parsed 100% locally in your browser.'}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={locale === 'uk' ? 'Закрити вікно' : 'Close dialog'}
                className="p-1.5 rounded-lg text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] hover:bg-[#EFECE5] dark:hover:bg-[#24221F] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Action Toolbar */}
            <div className="px-5 py-2.5 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#141311] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] hover:border-[#CC4518] dark:hover:border-[#FB8356] transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#C84317] dark:text-[#FB8356]" aria-hidden="true" />
                  <span>{locale === 'uk' ? 'Завантажити .json файл' : 'Upload .json file'}</span>
                </button>

                <button
                  type="button"
                  data-testid="load-production-n8n-preset-btn"
                  onClick={handleLoadProductionPreset}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#181715] text-[#161513] dark:text-[#F5F3EE] hover:border-[#0F766E] dark:hover:border-[#2DD4BF] transition-colors cursor-pointer"
                >
                  <Workflow className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" aria-hidden="true" />
                  <span>
                    {locale === 'uk'
                      ? '1С → Sheets → AI (15 вузлів)'
                      : '1C → Sheets → AI (15 nodes)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] transition-colors cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" aria-hidden="true" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>
                    {copied
                      ? locale === 'uk'
                        ? 'Скопійовано'
                        : 'Copied'
                      : locale === 'uk'
                        ? 'Копіювати JSON'
                        : 'Copy JSON'}
                  </span>
                </button>
              </div>

              {isCustomLoaded && (
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#5C5852] dark:text-[#A8A298] hover:text-[#C84317] dark:hover:text-[#FB8356] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{locale === 'uk' ? 'Повернути базовий' : 'Reset default'}</span>
                </button>
              )}
            </div>

            {/* JSON Editor */}
            <div className="p-5 flex-1 min-h-0 flex flex-col gap-2.5">
              <label htmlFor="n8n-json-input" className="sr-only">
                {locale === 'uk' ? 'JSON-код n8n воркфлоу' : 'n8n workflow JSON'}
              </label>
              <textarea
                id="n8n-json-input"
                data-testid="n8n-json-textarea"
                value={draftJson}
                onChange={(e) => {
                  setDraftJson(e.target.value);
                  if (errorText) setErrorText(null);
                }}
                spellCheck={false}
                rows={12}
                placeholder='{"name": "My Workflow", "nodes": [...], "connections": {...}}'
                className="w-full flex-1 min-h-[220px] rounded-xl border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#111110] p-3.5 font-mono text-xs leading-relaxed text-[#161513] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#CC4518] resize-none"
              />

              {errorText && (
                <p
                  role="alert"
                  className="text-xs font-medium text-[#B91C1C] dark:text-[#FCA5A5]"
                >
                  {errorText}
                </p>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-3.5 border-t border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4]/90 dark:bg-[#141311]/90 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-[#5C5852] dark:text-[#A8A298]">
                {locale === 'uk'
                  ? 'Підтримка: nodes, connections, IF/Switch, AI sub-nodes'
                  : 'Supports: nodes, connections, IF/Switch, AI sub-nodes'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] rounded-lg transition-colors cursor-pointer"
                >
                  {locale === 'uk' ? 'Скасувати' : 'Cancel'}
                </button>
                <button
                  type="button"
                  data-testid="apply-n8n-json-btn"
                  onClick={handleApply}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#CC4518] hover:bg-[#B23A12] dark:bg-[#DC5324] dark:hover:bg-[#EA6233] rounded-lg transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{locale === 'uk' ? 'Застосувати та анімувати' : 'Apply & Animate'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
