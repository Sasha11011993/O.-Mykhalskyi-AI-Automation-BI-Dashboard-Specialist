'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  Copy,
  Mail,
  Send,
  X,
} from 'lucide-react';
import { useThemeLocale } from '@/components/ThemeLocaleContext';
import { SERVICES_DATA, UI_COPY, t } from '@/lib/portfolioData';
import {
  validateInquiryForm,
  type BudgetTierId,
  type InquiryFormValues,
  type InquiryValidationErrors,
  type ServiceId,
} from '@/lib/portfolioLogic';

interface ContactTabProps {
  prefilledServiceId: ServiceId;
  prefilledDetails: string;
  prefillSummary: string;
  onClearPrefillNote: () => void;
}

const CONTACT_EMAIL = 'hello@mykhalskyi-data.ua';
const TELEGRAM_URL = 'https://t.me/omykhalskyi_bi';
const LINKEDIN_URL = 'https://www.linkedin.com/in/oleksandr-mykhalskyi/';
const UPWORK_URL = 'https://www.upwork.com/freelancers/~017067f374a7349529';
const FREELANCEHUNT_URL = 'https://freelancehunt.com/freelancer/Oleksandr_Mykhalskyi.html';
const X_URL = 'https://x.com/omykhalskyi';
const THREADS_URL = 'https://www.threads.com/@sashamikhalskii';
const BUDGET_TIERS: readonly BudgetTierId[] = ['starter', 'growth', 'enterprise'] as const;

interface SubmittedReceipt {
  referenceId: string;
  values: InquiryFormValues;
}

export default function ContactTab({
  prefilledServiceId,
  prefilledDetails,
  prefillSummary,
  onClearPrefillNote,
}: ContactTabProps) {
  const { locale } = useThemeLocale();

  const [values, setValues] = useState<InquiryFormValues>({
    name: '',
    email: '',
    serviceId: prefilledServiceId,
    budget: 'growth',
    details: prefilledDetails,
  });
  const [showPrefillBanner, setShowPrefillBanner] = useState<boolean>(
    Boolean(prefillSummary || prefilledDetails.trim())
  );
  const [errors, setErrors] = useState<InquiryValidationErrors>({});
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedReceipt | null>(null);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
    } catch {
      // Fallback gracefully in restricted clipboard contexts
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateInquiryForm(values, locale);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, locale }),
      });
      const data = (await response.json()) as { ok?: boolean; referenceId?: string };
      if (!response.ok || !data.ok) {
        throw new Error('Request failed');
      }

      setSubmitted({
        referenceId: data.referenceId ?? `OM-${String(Math.floor(1000 + Math.random() * 9000))}`,
        values: { ...values },
      });
      onClearPrefillNote();
    } catch {
      setSubmitError(
        locale === 'uk'
          ? 'Не вдалося надіслати бриф. Напишіть, будь ласка, напряму в Telegram або LinkedIn.'
          : 'Could not submit the brief right now. Please message me directly on LinkedIn or Telegram.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(null);
    setValues({
      name: '',
      email: '',
      serviceId: 'ai-agents',
      budget: 'growth',
      details: '',
    });
    setErrors({});
  };

  return (
    <section
      aria-label={locale === 'uk' ? 'Контакти та бриф' : 'Contact & Project Brief'}
      className="min-h-full lg:h-full w-full flex flex-col gap-5 pb-3 lg:pb-0"
    >
      {/* Header */}
      <div className="shrink-0 pb-4 border-b border-[#E5E0D6] dark:border-[#2A2825]">
        <p className="text-xs font-medium text-[#5C5852] dark:text-[#A8A298] mb-1">
          {t(UI_COPY.contact.kicker, locale)}
        </p>
        <h2 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[#161513] dark:text-[#F5F3EE] leading-tight">
          {t(UI_COPY.contact.heading, locale)}
        </h2>
      </div>

      {/* Balanced 2-Column Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch">
        {/* Left Column: Direct Channels + Availability + Structured Process + Proof Quote */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          {/* Direct Email & Quick Telegram Action */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2.5 p-3.5 rounded-xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825]">
              <div className="flex items-center gap-2.5 min-w-0">
                <Mail className="w-4 h-4 text-[#C84317] dark:text-[#FB8356] shrink-0" aria-hidden="true" />
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-mono text-xs sm:text-[13px] font-medium text-[#161513] dark:text-[#F5F3EE] hover:underline underline-offset-4 truncate"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#EFECE5] dark:bg-[#24221F] text-[#161513] dark:text-[#F5F3EE] hover:bg-[#E5E0D6] dark:hover:bg-[#302D29] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" aria-hidden="true" />
                    <span>{t(UI_COPY.contact.copiedEmail, locale)}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t(UI_COPY.contact.copyEmail, locale)}</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Telegram Direct Button + Clickable Social Links */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-0.5">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="contact-telegram-btn"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#161513] hover:bg-[#2B2825] text-white dark:bg-[#F5F3EE] dark:hover:bg-[#E5E0D6] dark:text-[#111110] transition-colors whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{locale === 'uk' ? 'Написати в Telegram' : 'Message on Telegram'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </a>

              <div className="flex flex-wrap items-center gap-2 text-xs text-[#6E6960] dark:text-[#A8A298]">
                <a
                  href={LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#161513] dark:hover:text-[#F5F3EE] underline-offset-4 hover:underline transition-colors"
                >
                  LinkedIn
                </a>
                <span aria-hidden="true">·</span>
                <a
                  href={UPWORK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#161513] dark:hover:text-[#F5F3EE] underline-offset-4 hover:underline transition-colors"
                >
                  Upwork
                </a>
                <span aria-hidden="true">·</span>
                <a
                  href={FREELANCEHUNT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#161513] dark:hover:text-[#F5F3EE] underline-offset-4 hover:underline transition-colors"
                >
                  Freelancehunt
                </a>
                <span aria-hidden="true">·</span>
                <a
                  href={X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#161513] dark:hover:text-[#F5F3EE] underline-offset-4 hover:underline transition-colors"
                >
                  X
                </a>
                <span aria-hidden="true">·</span>
                <a
                  href={THREADS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#161513] dark:hover:text-[#F5F3EE] underline-offset-4 hover:underline transition-colors"
                >
                  Threads
                </a>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px]">EET</span>
              </div>
            </div>

            {/* Clean Unboxed Availability Line (no decorative pulsing dots) */}
            <p
              data-testid="contact-availability"
              className="flex items-center gap-1.5 px-0.5 text-xs font-medium text-[#0F766E] dark:text-[#2DD4BF]"
            >
              <CalendarCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                {locale === 'uk'
                  ? '1 вільний слот на запуск цього місяця'
                  : '1 open project slot this month'}
              </span>
            </p>
          </div>

          {/* 3-Step Engagement Rhythm */}
          <div className="space-y-3 pt-4 border-t border-[#E5E0D6] dark:border-[#2A2825]">
            <p className="text-xs font-semibold text-[#161513] dark:text-[#EAE6DF]">
              {t(UI_COPY.contact.processHeading, locale)}
            </p>
            <ol className="space-y-2.5">
              {UI_COPY.contact.processSteps.map((step) => (
                <li key={step.num} className="flex items-start gap-3">
                  <span className="font-mono tabular-nums text-xs font-semibold text-[#C84317] dark:text-[#FB8356] mt-0.5 shrink-0">
                    {step.num}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#161513] dark:text-[#F5F3EE]">
                      {t(step.title, locale)}
                    </p>
                    <p className="text-xs text-[#555049] dark:text-[#A8A298] leading-relaxed">
                      {t(step.desc, locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Authentic Author & Engineering Principle Card */}
          <div className="pt-4 border-t border-[#E5E0D6] dark:border-[#2A2825] flex items-start gap-3.5">
            <img
              src="/assets/avatar-oleksandr.jpg"
              alt={locale === 'uk' ? 'Олександр Михальський' : 'Oleksandr Mykhalskyi'}
              className="w-12 h-12 rounded-full object-cover border border-[#E5E0D6] dark:border-[#2A2825] shrink-0"
            />
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-semibold text-[#161513] dark:text-[#F5F3EE]">
                {locale === 'uk'
                  ? 'Олександр Михальський · Магістр торгівлі та економіки (ВТЕІ ДТЕУ)'
                  : 'Oleksandr Mykhalskyi · M.Sc. in Trade & Economics'}
              </p>
              <p className="text-xs text-[#555049] dark:text-[#A8A298] leading-relaxed">
                {locale === 'uk'
                  ? 'Інженерний принцип: чистий код у n8n виконує рутину за $0 на LLM, а AI вмикається лише для аномалій, голосу чи неструктурованих даних.'
                  : 'Engineering rule: pure code in n8n handles routine math at $0 LLM cost, while AI activates only for anomalies, voice, or unstructured inputs.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Validated Interactive Brief Form or Confirmation State */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#181715] border border-[#E5E0D6] dark:border-[#2A2825] p-5 sm:p-6 flex flex-col justify-center">
          {submitted ? (
            <div className="space-y-5 py-2" data-testid="inquiry-confirmation">
              <div className="flex items-center gap-3">
                <CheckCircle2
                  className="w-7 h-7 text-[#0F766E] dark:text-[#2DD4BF] shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-lg font-semibold text-[#161513] dark:text-[#F5F3EE]">
                    {t(UI_COPY.contact.form.successTitle, locale)}
                  </h3>
                  <p className="font-mono tabular-nums text-xs text-[#6E6960] dark:text-[#A8A298]">
                    {t(UI_COPY.contact.form.refLabel, locale)}: {submitted.referenceId}
                  </p>
                </div>
              </div>

              <p className="text-sm text-[#555049] dark:text-[#B5AFA5] leading-relaxed">
                {t(UI_COPY.contact.form.successSubtitle, locale)}
              </p>

              <dl className="p-4 rounded-xl bg-[#FAF8F4] dark:bg-[#131210] border border-[#E5E0D6] dark:border-[#2A2825] space-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6E6960] dark:text-[#A8A298]">
                    {t(UI_COPY.contact.form.nameLabel, locale)}
                  </dt>
                  <dd className="font-medium text-[#161513] dark:text-[#F5F3EE]">
                    {submitted.values.name}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6E6960] dark:text-[#A8A298]">
                    {t(UI_COPY.contact.form.emailLabel, locale)}
                  </dt>
                  <dd className="font-mono text-[#161513] dark:text-[#F5F3EE]">
                    {submitted.values.email}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6E6960] dark:text-[#A8A298]">
                    {t(UI_COPY.contact.form.budgetLabel, locale)}
                  </dt>
                  <dd className="font-mono text-[#161513] dark:text-[#F5F3EE]">
                    {t(UI_COPY.contact.form.budgets[submitted.values.budget], locale)}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-[#E5E0D6] dark:border-[#2A2825] text-[#161513] dark:text-[#F5F3EE] hover:bg-[#EFECE5] dark:hover:bg-[#24221F] transition-colors cursor-pointer"
              >
                {t(UI_COPY.contact.form.resetBtn, locale)}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
              {/* Context Confirmation Banner when prefilled from ROI calculator or Case Study */}
              {showPrefillBanner && values.details.trim().length > 0 && (
                <div
                  data-testid="contact-prefill-banner"
                  className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-[#F3FBF8] dark:bg-[#12221E] border border-[#B7E4D8] dark:border-[#1E4F49] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 text-[#0F766E] dark:text-[#2DD4BF]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="font-medium truncate">
                      {prefillSummary ||
                        (locale === 'uk'
                          ? 'Дані розрахунку підставлено у бриф'
                          : 'Your estimate has been prefilled into the brief')}
                    </span>
                  </div>
                  <button
                    type="button"
                    data-testid="contact-prefill-clear"
                    onClick={() => {
                      setValues((prev) => ({ ...prev, details: '' }));
                      setShowPrefillBanner(false);
                      onClearPrefillNote();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                    <span>{locale === 'uk' ? 'Очистити' : 'Clear'}</span>
                  </button>
                </div>
              )}

              {/* Name & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="brief-name"
                    className="block text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1.5"
                  >
                    {t(UI_COPY.contact.form.nameLabel, locale)}
                  </label>
                  <input
                    id="brief-name"
                    type="text"
                    value={values.name}
                    onChange={(e) => {
                      setValues((prev) => ({ ...prev, name: e.target.value }));
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder={t(UI_COPY.contact.form.namePlaceholder, locale)}
                    aria-invalid={Boolean(errors.name)}
                    className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF8F4] dark:bg-[#131210] border border-[#DDD6C9] dark:border-[#33302B] text-[#161513] dark:text-[#F5F3EE] placeholder:text-[#918A7E] focus:outline-none focus:ring-2 focus:ring-[#CC4518] focus:border-transparent"
                  />
                  {errors.name && (
                    <p
                      role="alert"
                      className="mt-1 flex items-center gap-1 text-xs text-[#DC2626] dark:text-[#F87171]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="brief-email"
                    className="block text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1.5"
                  >
                    {t(UI_COPY.contact.form.emailLabel, locale)}
                  </label>
                  <input
                    id="brief-email"
                    type="email"
                    value={values.email}
                    onChange={(e) => {
                      setValues((prev) => ({ ...prev, email: e.target.value }));
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder={t(UI_COPY.contact.form.emailPlaceholder, locale)}
                    aria-invalid={Boolean(errors.email)}
                    className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF8F4] dark:bg-[#131210] border border-[#DDD6C9] dark:border-[#33302B] text-[#161513] dark:text-[#F5F3EE] placeholder:text-[#918A7E] focus:outline-none focus:ring-2 focus:ring-[#CC4518] focus:border-transparent"
                  />
                  {errors.email && (
                    <p
                      role="alert"
                      className="mt-1 flex items-center gap-1 text-xs text-[#DC2626] dark:text-[#F87171]"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{errors.email}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Service Select & Budget Segmented Control */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="brief-service"
                    className="block text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1.5"
                  >
                    {t(UI_COPY.contact.form.serviceLabel, locale)}
                  </label>
                  <select
                    id="brief-service"
                    value={values.serviceId}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        serviceId: e.target.value as ServiceId,
                      }))
                    }
                    className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#FAF8F4] dark:bg-[#131210] border border-[#DDD6C9] dark:border-[#33302B] text-[#161513] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#CC4518]"
                  >
                    {SERVICES_DATA.map((service) => (
                      <option key={service.id} value={service.id}>
                        {t(service.title, locale)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1.5">
                    {t(UI_COPY.contact.form.budgetLabel, locale)}
                  </span>
                  <div
                    role="group"
                    aria-label={t(UI_COPY.contact.form.budgetLabel, locale)}
                    className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#EFECE5] dark:bg-[#1B1A18] border border-[#E5E0D6] dark:border-[#2A2825]"
                  >
                    {BUDGET_TIERS.map((tier) => {
                      const active = values.budget === tier;
                      return (
                        <button
                          key={tier}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setValues((prev) => ({ ...prev, budget: tier }))}
                          className={`py-1.5 px-2 text-xs font-mono tabular-nums font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                            active
                              ? 'bg-white dark:bg-[#292724] text-[#161513] dark:text-[#F5F3EE] shadow-xs'
                              : 'text-[#5C5852] dark:text-[#A8A298] hover:text-[#161513] dark:hover:text-[#F5F3EE]'
                          }`}
                        >
                          {t(UI_COPY.contact.form.budgets[tier], locale)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Project Brief Textarea */}
              <div>
                <label
                  htmlFor="brief-details"
                  className="block text-xs font-semibold text-[#161513] dark:text-[#EAE6DF] mb-1.5"
                >
                  {t(UI_COPY.contact.form.detailsLabel, locale)}
                </label>
                <textarea
                  id="brief-details"
                  rows={3}
                  value={values.details}
                  onChange={(e) => {
                    setValues((prev) => ({ ...prev, details: e.target.value }));
                    if (errors.details) setErrors((prev) => ({ ...prev, details: undefined }));
                  }}
                  placeholder={t(UI_COPY.contact.form.detailsPlaceholder, locale)}
                  aria-invalid={Boolean(errors.details)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#FAF8F4] dark:bg-[#131210] border border-[#DDD6C9] dark:border-[#33302B] text-[#161513] dark:text-[#F5F3EE] placeholder:text-[#918A7E] focus:outline-none focus:ring-2 focus:ring-[#CC4518] focus:border-transparent resize-none"
                />
                {errors.details && (
                  <p
                    role="alert"
                    className="mt-1 flex items-center gap-1 text-xs text-[#DC2626] dark:text-[#F87171]"
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{errors.details}</span>
                  </p>
                )}
              </div>

              {submitError && (
                <p
                  role="alert"
                  className="flex items-center gap-1.5 text-xs text-[#DC2626] dark:text-[#F87171]"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{submitError}</span>
                </p>
              )}

              <div className="pt-1 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#CC4518] hover:bg-[#B23A12] dark:bg-[#DC5324] dark:hover:bg-[#EA6233] disabled:opacity-60 rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CC4518] whitespace-nowrap cursor-pointer"
                >
                  <span>
                    {submitting
                      ? locale === 'uk'
                        ? 'Надсилання...'
                        : 'Sending...'
                      : t(UI_COPY.contact.form.submitBtn, locale)}
                  </span>
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
