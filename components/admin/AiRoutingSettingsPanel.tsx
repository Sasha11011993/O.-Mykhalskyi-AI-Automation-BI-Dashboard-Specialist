'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { User } from 'firebase/auth';
import {
  ArrowDown,
  ArrowUp,
  Check,
  KeyRound,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { saveAiRoutingSettings } from '@/lib/caseRepository';
import {
  AI_MODEL_ID_PATTERN,
  AI_MODEL_PRESETS,
  AI_ROUTING_PROVIDER_IDS,
  sanitizeAiRoutingSettings,
  type AiRoutingProviderId,
  type AiRoutingSettings,
  type PortfolioSettingsRecord,
} from '@/lib/caseStudioTypes';

interface ProviderStatusResponse {
  configured: Record<AiRoutingProviderId, boolean>;
  envDefaults: {
    geminiModel: string;
    openaiModel: string;
    anthropicModel: string;
    openrouterModel: string;
    providerOrder: AiRoutingProviderId[];
  };
}

interface AiRoutingSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  user: User;
  settings: PortfolioSettingsRecord;
  onSaved: (updated: AiRoutingSettings) => void;
}

const PROVIDER_META: Record<
  AiRoutingProviderId,
  { name: string; envVarName: string; roleNote: string }
> = {
  gemini: {
    name: 'Google Gemini',
    envVarName: 'GEMINI_API_KEY',
    roleNote: 'Швидка мультимодальна модель платформи (Vision + JSON)',
  },
  openai: {
    name: 'OpenAI',
    envVarName: 'OPENAI_API_KEY',
    roleNote: 'GPT-4o / GPT-4.1 — резервний провайдер із підтримкою скріншотів',
  },
  anthropic: {
    name: 'Anthropic Claude',
    envVarName: 'ANTHROPIC_API_KEY',
    roleNote: 'Claude Haiku / Sonnet — сильна генерація українського та англійського тексту',
  },
  openrouter: {
    name: 'OpenRouter',
    envVarName: 'OPENROUTER_API_KEY',
    roleNote: 'Єдиний шлюз до десятків моделей (Gemini, GPT, Claude, DeepSeek)',
  },
};

export default function AiRoutingSettingsPanel({
  open,
  onClose,
  user,
  settings,
  onSaved,
}: AiRoutingSettingsPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <AiRoutingSettingsModalContent
          onClose={onClose}
          user={user}
          settings={settings}
          onSaved={onSaved}
        />
      )}
    </AnimatePresence>
  );
}

function AiRoutingSettingsModalContent({
  onClose,
  user,
  settings,
  onSaved,
}: Omit<AiRoutingSettingsPanelProps, 'open'>) {
  const initialRouting = sanitizeAiRoutingSettings({
    aiProviderOrder: settings.aiProviderOrder,
    aiDisabledProviders: settings.aiDisabledProviders,
    aiOpenaiModel: settings.aiOpenaiModel,
    aiAnthropicModel: settings.aiAnthropicModel,
    aiOpenrouterModel: settings.aiOpenrouterModel,
  });

  const [providerOrder, setProviderOrder] = useState<AiRoutingProviderId[]>(
    initialRouting.aiProviderOrder
  );
  const [disabledProviders, setDisabledProviders] = useState<AiRoutingProviderId[]>(
    initialRouting.aiDisabledProviders
  );
  const [openaiModel, setOpenaiModel] = useState<string>(initialRouting.aiOpenaiModel);
  const [anthropicModel, setAnthropicModel] = useState<string>(initialRouting.aiAnthropicModel);
  const [openrouterModel, setOpenrouterModel] = useState<string>(initialRouting.aiOpenrouterModel);

  const [serverStatus, setServerStatus] = useState<ProviderStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Fetch secret-free availability booleans from server on modal mount
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/ai-routing-status', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as ProviderStatusResponse;
        if (!cancelled) {
          setServerStatus(data);
        }
      } catch {
        // Non-blocking: UI still works with defaults
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const moveProvider = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= providerOrder.length) return;
    const next = [...providerOrder];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    setProviderOrder(next);
    setFeedback(null);
  };

  const toggleProviderEnabled = (id: AiRoutingProviderId) => {
    setDisabledProviders((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setFeedback(null);
  };

  const handleResetDefaults = () => {
    setProviderOrder([...AI_ROUTING_PROVIDER_IDS]);
    setDisabledProviders([]);
    setOpenaiModel('');
    setAnthropicModel('');
    setOpenrouterModel('');
    setFeedback(null);
  };

  const validateModelField = (value: string, label: string, maxLen: number): string | null => {
    const trimmed = value.trim();
    if (trimmed.length > maxLen) {
      return `Назва моделі для ${label} занадто довга (макс. ${maxLen} символів).`;
    }
    if (trimmed && !AI_MODEL_ID_PATTERN.test(trimmed)) {
      return `Недопустимі символи в ID моделі ${label}. Дозволені латиниця, цифри, крапка, дефіс, скісна риска та двокрапка.`;
    }
    return null;
  };

  const handleSave = async () => {
    const errOpenai = validateModelField(openaiModel, 'OpenAI', 80);
    const errAnthropic = validateModelField(anthropicModel, 'Anthropic', 80);
    const errOpenrouter = validateModelField(openrouterModel, 'OpenRouter', 120);
    const firstErr = errOpenai || errAnthropic || errOpenrouter;
    if (firstErr) {
      setFeedback({ type: 'err', text: firstErr });
      return;
    }

    const activeCount = providerOrder.filter((id) => !disabledProviders.includes(id)).length;
    if (activeCount === 0) {
      setFeedback({
        type: 'err',
        text: 'Залиште хоча б одного активного AI-провайдера, інакше AI-асистенти не зможуть відповідати.',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const saved = await saveAiRoutingSettings(
        {
          aiProviderOrder: providerOrder,
          aiDisabledProviders: disabledProviders,
          aiOpenaiModel: openaiModel.trim(),
          aiAnthropicModel: anthropicModel.trim(),
          aiOpenrouterModel: openrouterModel.trim(),
        },
        user.uid,
        {
          heroCaseId: settings.heroCaseId,
          hiddenStaticCaseIds: settings.hiddenStaticCaseIds,
        }
      );

      // Immediately flush server routing cache + stale provider cooldowns
      try {
        const token = await user.getIdToken();
        await fetch('/api/admin/ai-routing-status', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Cache expires automatically within 20s even if refresh ping fails
      }

      onSaved(saved);
      setFeedback({
        type: 'ok',
        text: 'Пріоритет провайдерів і моделі збережено. Новий маршрут уже активний для обох AI-агентів.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Не вдалося зберегти налаштування AI-маршрутизації.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderModelSelector = (
    provider: Exclude<AiRoutingProviderId, 'gemini'>,
    value: string,
    onChange: (next: string) => void,
    envDefault: string,
    maxLen: number
  ) => {
    const presets = AI_MODEL_PRESETS[provider];
    const isPreset = presets.some((p) => p.id === value);
    const selectValue = value === '' ? '__default__' : isPreset ? value : '__custom__';

    return (
      <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-[#6E6960] dark:text-[#A8A298]">
            Пресет моделі
          </span>
          <select
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__default__') onChange('');
              else if (v !== '__custom__') onChange(v);
            }}
            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-[#FAF8F4] dark:bg-[#141311] text-[#161513] dark:text-[#F5F3EE] focus:outline-none focus:border-[#CC4518]"
          >
            <option value="__default__">За замовчуванням ({envDefault})</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            {!isPreset && value !== '' && (
              <option value="__custom__">Власний ID моделі</option>
            )}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-[#6E6960] dark:text-[#A8A298]">
            Або точний ID моделі
          </span>
          <input
            type="text"
            value={value}
            maxLength={maxLen}
            onChange={(e) => {
              onChange(e.target.value);
              setFeedback(null);
            }}
            placeholder={envDefault}
            className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-[#DDD6C9] dark:border-[#33302B] bg-white dark:bg-[#141311] text-[#161513] dark:text-[#F5F3EE] placeholder:text-[#9C9488] focus:outline-none focus:border-[#CC4518]"
          />
        </label>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#161513]/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-routing-modal-title"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[88dvh] flex flex-col rounded-2xl border border-[#E5E0D6] dark:border-[#2A2825] bg-[#F7F5F0] dark:bg-[#141311] text-[#161513] dark:text-[#F5F3EE] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <SlidersHorizontal
                  className="w-4 h-4 text-[#CC4518] dark:text-[#FB8356] shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <h2
                    id="ai-routing-modal-title"
                    className="text-sm sm:text-base font-semibold tracking-tight truncate"
                  >
                    AI-моделі та порядок перемикання
                  </h2>
                  <p className="text-xs text-[#6E6960] dark:text-[#A8A298] truncate">
                    Керуйте пріоритетом провайдерів і моделями для обох AI-агентів без редагування коду
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрити налаштування AI-моделей"
                className="p-1.5 rounded-lg text-[#6E6960] hover:text-[#161513] dark:text-[#A8A298] dark:hover:text-[#F5F3EE] hover:bg-[#EFECE5] dark:hover:bg-[#242220] cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Ordered Failover Chain */}
              <div className="space-y-2.5">
                {providerOrder.map((providerId, idx) => {
                  const meta = PROVIDER_META[providerId];
                  const isPaused = disabledProviders.includes(providerId);
                  const isKeyActive = serverStatus?.configured[providerId];
                  const envDefaults = serverStatus?.envDefaults;

                  return (
                    <div
                      key={providerId}
                      className={`rounded-xl border p-3.5 transition-colors ${
                        isPaused
                          ? 'border-[#E5E0D6] dark:border-[#2A2825] bg-[#EFECE5]/60 dark:bg-[#181715]/50 opacity-75'
                          : 'border-[#DDD6C9] dark:border-[#2E2B27] bg-white dark:bg-[#181715]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="mt-0.5 w-6 h-6 rounded-md bg-[#FAF8F4] dark:bg-[#22201D] border border-[#E5E0D6] dark:border-[#33302B] font-mono text-xs font-semibold flex items-center justify-center shrink-0 tabular-nums">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{meta.name}</span>
                              <span className="font-mono text-[11px] text-[#6E6960] dark:text-[#A8A298]">
                                {meta.envVarName}
                              </span>
                            </div>
                            <p className="text-xs text-[#6E6960] dark:text-[#A8A298] mt-0.5">
                              {meta.roleNote}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Server Secret Read-only Indicator */}
                          <span
                            className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                              loadingStatus
                                ? 'border-[#E5E0D6] dark:border-[#2A2825] text-[#6E6960] dark:text-[#A8A298]'
                                : isKeyActive
                                  ? 'border-[#0F766E]/30 bg-[#0F766E]/8 text-[#0F766E] dark:text-[#2DD4BF]'
                                  : 'border-[#E5E0D6] dark:border-[#33302B] text-[#7A746B] dark:text-[#918A7E]'
                            }`}
                          >
                            {loadingStatus
                              ? 'Перевірка…'
                              : isKeyActive
                                ? 'Ключ активний'
                                : 'Ключ не задано'}
                          </span>

                          {/* Enable / Pause Toggle */}
                          <button
                            type="button"
                            onClick={() => toggleProviderEnabled(providerId)}
                            title={isPaused ? 'Увімкнути провайдера' : 'Поставити на паузу'}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                              isPaused
                                ? 'border-[#DDD6C9] dark:border-[#33302B] text-[#5C5852] dark:text-[#A8A298] bg-white dark:bg-[#1E1C1A]'
                                : 'border-[#CC4518]/30 text-[#C84317] dark:text-[#FB8356] bg-[#FFF2EB] dark:bg-[#2B1A13]'
                            }`}
                          >
                            {isPaused ? (
                              <>
                                <PlayCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Пауза</span>
                              </>
                            ) : (
                              <>
                                <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Увімкнено</span>
                              </>
                            )}
                          </button>

                          {/* Reorder Priority Up / Down */}
                          <div className="inline-flex items-center border border-[#DDD6C9] dark:border-[#33302B] rounded-md overflow-hidden bg-[#FAF8F4] dark:bg-[#141311]">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveProvider(idx, -1)}
                              aria-label={`Підняти ${meta.name} вище`}
                              className="p-1 text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === providerOrder.length - 1}
                              onClick={() => moveProvider(idx, 1)}
                              aria-label={`Опустити ${meta.name} нижче`}
                              className="p-1 border-l border-[#DDD6C9] dark:border-[#33302B] text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                            >
                              <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Model Selection per Provider */}
                      {providerId === 'gemini' ? (
                        <div className="mt-2.5 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#FAF8F4] dark:bg-[#141311] border border-[#E5E0D6] dark:border-[#2A2825] text-xs">
                          <span className="text-[#6E6960] dark:text-[#A8A298]">
                            Активна модель платформи
                          </span>
                          <span className="font-mono font-medium text-[#161513] dark:text-[#F5F3EE]">
                            {envDefaults?.geminiModel ?? 'gemini-4-hydrogen'}
                          </span>
                        </div>
                      ) : providerId === 'openai' ? (
                        renderModelSelector(
                          'openai',
                          openaiModel,
                          setOpenaiModel,
                          envDefaults?.openaiModel ?? 'gpt-4o-mini',
                          80
                        )
                      ) : providerId === 'anthropic' ? (
                        renderModelSelector(
                          'anthropic',
                          anthropicModel,
                          setAnthropicModel,
                          envDefaults?.anthropicModel ?? 'claude-3-5-haiku-latest',
                          80
                        )
                      ) : (
                        renderModelSelector(
                          'openrouter',
                          openrouterModel,
                          setOpenrouterModel,
                          envDefaults?.openrouterModel ?? 'google/gemini-2.5-flash',
                          120
                        )
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Security Boundary Note — Why API Keys Live in Server Secrets */}
              <div className="rounded-xl border border-[#E5E0D6] dark:border-[#2A2825] bg-[#FAF8F4] dark:bg-[#181715] p-3.5 flex items-start gap-2.5 text-xs text-[#555049] dark:text-[#A8A298] leading-relaxed">
                <KeyRound
                  className="w-4 h-4 text-[#CC4518] dark:text-[#FB8356] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p>
                  <strong className="font-semibold text-[#161513] dark:text-[#F5F3EE]">
                    Де змінювати самі API-ключі без правок коду:
                  </strong>{' '}
                  із міркувань безпеки ключі ніколи не зберігаються в базі даних і не передаються у браузер. Додавайте або оновлюйте{' '}
                  <span className="font-mono">GEMINI_API_KEY</span>,{' '}
                  <span className="font-mono">OPENAI_API_KEY</span>,{' '}
                  <span className="font-mono">ANTHROPIC_API_KEY</span>,{' '}
                  <span className="font-mono">OPENROUTER_API_KEY</span> у{' '}
                  <strong className="font-medium text-[#161513] dark:text-[#F5F3EE]">
                    Settings → Secrets
                  </strong>{' '}
                  або у{' '}
                  <strong className="font-medium text-[#161513] dark:text-[#F5F3EE]">
                    Vercel → Project Settings → Environment Variables
                  </strong>
                  .
                </p>
              </div>

              {feedback && (
                <div
                  role="status"
                  className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-center gap-2 ${
                    feedback.type === 'ok'
                      ? 'border-[#0F766E]/30 bg-[#F0FDFA] dark:bg-[#0F2422] text-[#0F766E] dark:text-[#2DD4BF]'
                      : 'border-[#CC4518]/30 bg-[#FFF2EB] dark:bg-[#2B1A13] text-[#C84317] dark:text-[#FB8356]'
                  }`}
                >
                  {feedback.type === 'ok' && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  <span>{feedback.text}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-[#E5E0D6] dark:border-[#2A2825] bg-white dark:bg-[#181715] flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Скинути до стандартних</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-[#DDD6C9] dark:border-[#33302B] text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] cursor-pointer"
                >
                  Закрити
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSave()}
                  data-testid="save-ai-routing-btn"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#CC4518] hover:bg-[#B23A12] disabled:opacity-60 text-white transition-colors cursor-pointer"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{isSaving ? 'Збереження…' : 'Зберегти маршрут'}</span>
                </button>
              </div>
            </div>
      </motion.div>
    </motion.div>
  );
}
