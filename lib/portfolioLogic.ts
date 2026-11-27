export type Locale = 'uk' | 'en';
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';
export type TabId = 'overview' | 'services' | 'cases' | 'demo' | 'faq' | 'contact';
export type CaseCategory = 'all' | 'ai' | 'bi' | 'etl';
export type FaqCategory = 'all' | 'process' | 'pricing' | 'security';
export type ServiceId = 'ai-agents' | 'bi-dashboards' | 'etl-pipelines' | 'audit-architecture';
export type BiDomainId = 'ecommerce' | 'saas' | 'logistics';
export type BiPeriodId = '6m' | '12m';
export type BudgetTierId = 'starter' | 'growth' | 'enterprise';

export const TABS_ORDER: readonly TabId[] = [
  'overview',
  'services',
  'cases',
  'demo',
  'faq',
  'contact',
] as const;

export interface RoiInput {
  teamSize: number;
  weeklyManualHoursPerPerson: number;
  hourlyRateUsd: number;
}

export const ROI_HOURLY_RATE_MIN = 5;
export const ROI_HOURLY_RATE_MAX = 200;

export const DEFAULT_ROI_INPUT: RoiInput = {
  teamSize: 5,
  weeklyManualHoursPerPerson: 6,
  hourlyRateUsd: 15,
};

export const ROI_RATE_PRESETS = [10, 20, 40] as const;

export interface RoiResult {
  monthlyManualHours: number;
  monthlySavedHours: number;
  monthlySavingsUsd: number;
  annualSavingsUsd: number;
  estimatedProjectCostUsd: number;
  paybackWeeks: number;
  recommendedServiceId: ServiceId;
}

export interface CaseFilterableItem {
  id: string;
  category: Exclude<CaseCategory, 'all'>;
}

export interface InquiryFormValues {
  name: string;
  email: string;
  serviceId: ServiceId;
  budget: BudgetTierId;
  details: string;
}

export interface InquiryValidationErrors {
  name?: string;
  email?: string;
  details?: string;
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean
): ResolvedTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export function getAdjacentTab(current: TabId, direction: 'next' | 'prev'): TabId {
  const index = TABS_ORDER.indexOf(current);
  const safeIndex = index === -1 ? 0 : index;
  const delta = direction === 'next' ? 1 : -1;
  const nextIndex = (safeIndex + delta + TABS_ORDER.length) % TABS_ORDER.length;
  return TABS_ORDER[nextIndex];
}

export function getTabIndexNumber(tab: TabId): string {
  const idx = TABS_ORDER.indexOf(tab);
  return String((idx === -1 ? 0 : idx) + 1).padStart(2, '0');
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function parseHourlyRateInput(raw: string, fallback: number): number {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return clampNumber(Math.round(fallback), ROI_HOURLY_RATE_MIN, ROI_HOURLY_RATE_MAX);
  return clampNumber(Number.parseInt(digits, 10), ROI_HOURLY_RATE_MIN, ROI_HOURLY_RATE_MAX);
}

export function calculateAutomationRoi(rawInput: RoiInput): RoiResult {
  const teamSize = Math.round(clampNumber(rawInput.teamSize, 1, 100));
  const weeklyHours = clampNumber(rawInput.weeklyManualHoursPerPerson, 1, 40);
  const hourlyRate = clampNumber(rawInput.hourlyRateUsd, ROI_HOURLY_RATE_MIN, ROI_HOURLY_RATE_MAX);

  // Average 4.33 weeks per month; realistic 72% automation capture rate
  const monthlyManualHours = Math.round(teamSize * weeklyHours * 4.33);
  const monthlySavedHours = Math.round(monthlyManualHours * 0.72);
  const monthlySavingsUsd = Math.round(monthlySavedHours * hourlyRate);
  const annualSavingsUsd = monthlySavingsUsd * 12;

  let estimatedProjectCostUsd = 2200;
  let recommendedServiceId: ServiceId = 'ai-agents';

  if (annualSavingsUsd >= 120000) {
    estimatedProjectCostUsd = 6800;
    recommendedServiceId = 'etl-pipelines';
  } else if (annualSavingsUsd >= 45000) {
    estimatedProjectCostUsd = 3900;
    recommendedServiceId = 'bi-dashboards';
  }

  const weeklySavingsUsd = monthlySavingsUsd / 4.33;
  const paybackWeeks =
    weeklySavingsUsd > 0
      ? Math.max(1, Math.round((estimatedProjectCostUsd / weeklySavingsUsd) * 10) / 10)
      : 0;

  return {
    monthlyManualHours,
    monthlySavedHours,
    monthlySavingsUsd,
    annualSavingsUsd,
    estimatedProjectCostUsd,
    paybackWeeks,
    recommendedServiceId,
  };
}

export function filterCaseStudies<T extends CaseFilterableItem>(
  items: readonly T[],
  category: CaseCategory
): T[] {
  if (category === 'all') return [...items];
  return items.filter((item) => item.category === category);
}

export interface FaqFilterableItem {
  id: string;
  category: Exclude<FaqCategory, 'all'>;
}

export function filterFaqItems<T extends FaqFilterableItem>(
  items: readonly T[],
  category: FaqCategory
): T[] {
  if (category === 'all') return [...items];
  return items.filter((item) => item.category === category);
}

export function toggleFaqItem(currentOpenId: string | null, clickedId: string): string | null {
  return currentOpenId === clickedId ? null : clickedId;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateInquiryForm(
  values: InquiryFormValues,
  locale: Locale
): InquiryValidationErrors {
  const errors: InquiryValidationErrors = {};
  const trimmedName = values.name.trim();
  const trimmedEmail = values.email.trim();
  const trimmedDetails = values.details.trim();

  if (trimmedName.length < 2) {
    errors.name =
      locale === 'uk'
        ? 'Вкажіть ваше ім’я (мінімум 2 символи).'
        : 'Please enter your name (at least 2 characters).';
  }

  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email =
      locale === 'uk'
        ? 'Введіть коректну електронну адресу.'
        : 'Please enter a valid email address.';
  }

  if (trimmedDetails.length < 12) {
    errors.details =
      locale === 'uk'
        ? 'Опишіть задачу коротко (мінімум 12 символів).'
        : 'Please briefly describe your scope (at least 12 characters).';
  }

  return errors;
}

export function formatCurrencyUsd(amount: number): string {
  const rounded = Math.round(amount);
  return `$${rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatInteger(amount: number): string {
  const rounded = Math.round(amount);
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function buildRoiInquiryDraft(roi: RoiResult, input: RoiInput, locale: Locale): string {
  if (locale === 'uk') {
    return `Запит на план впровадження: команда ${input.teamSize} ос., ~${input.weeklyManualHoursPerPerson} год/тиждень ручної роботи ($${input.hourlyRateUsd}/год). Розрахункова економія: ${formatInteger(roi.monthlySavedHours)} год/міс (${formatCurrencyUsd(roi.annualSavingsUsd)}/рік), окупність ~${roi.paybackWeeks} тижн.`;
  }
  return `Implementation plan request: team of ${input.teamSize}, ~${input.weeklyManualHoursPerPerson} manual hrs/week ($${input.hourlyRateUsd}/hr). Estimated impact: ${formatInteger(roi.monthlySavedHours)} hrs/mo saved (${formatCurrencyUsd(roi.annualSavingsUsd)}/yr), payback ~${roi.paybackWeeks} wks.`;
}

export function computeNextBatchRecords(currentRecords: number, batchDelta: number): number {
  const safeCurrent = Math.max(0, Math.round(currentRecords));
  const safeDelta = Math.max(1, Math.round(batchDelta));
  return safeCurrent + safeDelta;
}

export type PipelineStageRole = 'extract' | 'transform' | 'load';

export function resolveActivePipelineNode(
  hoveredNodeId: string | null,
  pinnedNodeId: string | null
): string | null {
  return hoveredNodeId ?? pinnedNodeId;
}

export function togglePinnedNode(
  currentPinnedId: string | null,
  clickedNodeId: string
): string | null {
  return currentPinnedId === clickedNodeId ? null : clickedNodeId;
}

export interface SixMonthPaybackPoint {
  monthIndex: number;
  cumulativeSavingsUsd: number;
  netPositionUsd: number;
  isBreakEvenOrPositive: boolean;
  heightPct: number;
}

export function computeSixMonthPaybackCurve(roi: RoiResult): SixMonthPaybackPoint[] {
  const monthlySavings = Math.max(1, roi.annualSavingsUsd / 12);
  const projectCost = Math.max(1, roi.estimatedProjectCostUsd);
  const maxMonthSix = monthlySavings * 6;

  return Array.from({ length: 6 }, (_, idx) => {
    const monthIndex = idx + 1;
    const cumulativeSavingsUsd = Math.round(monthlySavings * monthIndex);
    const netPositionUsd = Math.round(cumulativeSavingsUsd - projectCost);
    const heightPct = Math.max(18, Math.min(100, Math.round((cumulativeSavingsUsd / maxMonthSix) * 100)));
    return {
      monthIndex,
      cumulativeSavingsUsd,
      netPositionUsd,
      isBreakEvenOrPositive: cumulativeSavingsUsd >= projectCost,
      heightPct,
    };
  });
}

export function computeSliderFillPct(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0;
  }
  const clamped = clampNumber(value, min, max);
  return Math.round(((clamped - min) / (max - min)) * 1000) / 10;
}

export interface BiSeriesPointLike {
  revenue: number;
  automatedShare: number;
}

export interface BiPointInspection {
  index: number;
  revenue: number;
  automatedShare: number;
  deltaRevenue: number | null;
  deltaPct: number | null;
}

export function computeBiPointInspection(
  series: readonly BiSeriesPointLike[],
  rawIndex: number
): BiPointInspection | null {
  if (series.length === 0) return null;
  const index = Math.max(0, Math.min(series.length - 1, Math.round(rawIndex)));
  const current = series[index];
  const prev = index > 0 ? series[index - 1] : null;
  const deltaRevenue = prev ? current.revenue - prev.revenue : null;
  const deltaPct =
    prev && prev.revenue > 0
      ? Math.round(((current.revenue - prev.revenue) / prev.revenue) * 1000) / 10
      : null;

  return {
    index,
    revenue: current.revenue,
    automatedShare: current.automatedShare,
    deltaRevenue,
    deltaPct,
  };
}

export function buildRoiPrefillSummary(roi: RoiResult, locale: Locale): string {
  const annual = formatCurrencyUsd(roi.annualSavingsUsd);
  return locale === 'uk'
    ? `Розрахунок ROI (${annual}/рік) підставлено у бриф`
    : `ROI estimate (${annual}/yr) prefilled into your brief`;
}

export function buildCasePrefillSummary(caseTitle: string, locale: Locale): string {
  return locale === 'uk'
    ? `Контекст кейсу «${caseTitle}» додано до брифу`
    : `Case context "${caseTitle}" prefilled into your brief`;
}
