import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTheme,
  getAdjacentTab,
  getTabIndexNumber,
  calculateAutomationRoi,
  filterCaseStudies,
  validateInquiryForm,
  formatCurrencyUsd,
  buildRoiInquiryDraft,
  computeNextBatchRecords,
  resolveActivePipelineNode,
  togglePinnedNode,
  computeSixMonthPaybackCurve,
  computeSliderFillPct,
  computeBiPointInspection,
  buildRoiPrefillSummary,
  buildCasePrefillSummary,
  DEFAULT_ROI_INPUT,
  ROI_HOURLY_RATE_MAX,
  ROI_HOURLY_RATE_MIN,
  ROI_RATE_PRESETS,
  parseHourlyRateInput,
  filterFaqItems,
  toggleFaqItem,
} from './portfolioLogic';
import { CASE_STUDIES_DATA, PIPELINE_BLUEPRINTS, SERVICES_DATA } from './portfolioData';

test('resolveTheme respects explicit overrides and system preference', () => {
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});

test('getAdjacentTab wraps around boundaries cleanly', () => {
  assert.equal(getAdjacentTab('overview', 'next'), 'services');
  assert.equal(getAdjacentTab('demo', 'next'), 'faq');
  assert.equal(getAdjacentTab('faq', 'next'), 'contact');
  assert.equal(getAdjacentTab('contact', 'next'), 'overview');
  assert.equal(getAdjacentTab('overview', 'prev'), 'contact');
  assert.equal(getTabIndexNumber('demo'), '04');
  assert.equal(getTabIndexNumber('faq'), '05');
  assert.equal(getTabIndexNumber('contact'), '06');
});

test('calculateAutomationRoi computes deterministic savings and tiers', () => {
  const small = calculateAutomationRoi({
    teamSize: 3,
    weeklyManualHoursPerPerson: 5,
    hourlyRateUsd: 25,
  });
  assert.equal(small.monthlyManualHours, 65);
  assert.equal(small.monthlySavedHours, 47);
  assert.equal(small.monthlySavingsUsd, 1175);
  assert.equal(small.annualSavingsUsd, 14100);
  assert.equal(small.recommendedServiceId, 'ai-agents');
  assert.ok(small.paybackWeeks > 0);

  const enterprise = calculateAutomationRoi({
    teamSize: 15,
    weeklyManualHoursPerPerson: 10,
    hourlyRateUsd: 45,
  });
  assert.equal(enterprise.recommendedServiceId, 'etl-pipelines');
  assert.ok(enterprise.annualSavingsUsd >= 120000);
});

test('calculateAutomationRoi clamps out-of-range values safely', () => {
  const clamped = calculateAutomationRoi({
    teamSize: -5,
    weeklyManualHoursPerPerson: 200,
    hourlyRateUsd: 0,
  });
  assert.equal(clamped.monthlyManualHours, Math.round(1 * 40 * 4.33));
  assert.equal(clamped.monthlySavingsUsd, Math.round(clamped.monthlySavedHours * ROI_HOURLY_RATE_MIN));
});

test('filterCaseStudies returns matching subset or all items', () => {
  const sample = [
    { id: 'c1', category: 'ai' as const },
    { id: 'c2', category: 'bi' as const },
    { id: 'c3', category: 'etl' as const },
    { id: 'c4', category: 'ai' as const },
  ];
  assert.equal(filterCaseStudies(sample, 'all').length, 4);
  assert.equal(filterCaseStudies(sample, 'ai').length, 2);
  assert.equal(filterCaseStudies(sample, 'bi')[0].id, 'c2');
});

test('validateInquiryForm catches invalid fields and passes valid payload', () => {
  const invalidUk = validateInquiryForm(
    { name: 'A', email: 'not-an-email', serviceId: 'ai-agents', budget: 'starter', details: 'short' },
    'uk'
  );
  assert.ok(invalidUk.name);
  assert.ok(invalidUk.email);
  assert.ok(invalidUk.details);

  const validEn = validateInquiryForm(
    {
      name: 'Olena Koval',
      email: 'olena@company.ua',
      serviceId: 'bi-dashboards',
      budget: 'growth',
      details: 'Need an executive Power BI suite connected to PostgreSQL and HubSpot.',
    },
    'en'
  );
  assert.deepEqual(validEn, {});
});

test('formatCurrencyUsd and buildRoiInquiryDraft produce clean localized strings', () => {
  assert.equal(formatCurrencyUsd(48250), '$48,250');
  const input = { teamSize: 5, weeklyManualHoursPerPerson: 8, hourlyRateUsd: 30 };
  const roi = calculateAutomationRoi(input);
  const draftUk = buildRoiInquiryDraft(roi, input, 'uk');
  const draftEn = buildRoiInquiryDraft(roi, input, 'en');
  assert.match(draftUk, /команда 5 ос\./);
  assert.match(draftEn, /team of 5/);
});

test('computeNextBatchRecords increments cleanly and guards negative values', () => {
  assert.equal(computeNextBatchRecords(14820, 420), 15240);
  assert.equal(computeNextBatchRecords(-10, 0), 1);
});

test('every service has a complete 3-stage bilingual ETL/AI pipeline blueprint with node explanations', () => {
  for (const service of SERVICES_DATA) {
    const bp = PIPELINE_BLUEPRINTS[service.id];
    assert.ok(bp, `Missing blueprint for ${service.id}`);
    assert.equal(bp.sources.length, 3);
    assert.equal(bp.transforms.length, 2);
    assert.equal(bp.outputs.length, 2);
    assert.ok(bp.title.uk.length > 0 && bp.title.en.length > 0);
    const allNodes = [...bp.sources, ...bp.transforms, ...bp.outputs];
    for (const node of allNodes) {
      assert.ok(node.explanation.uk.length > 15, `Missing UK explanation on ${node.id}`);
      assert.ok(node.explanation.en.length > 15, `Missing EN explanation on ${node.id}`);
      assert.ok(node.protocol.uk.length > 3 && node.protocol.en.length > 3);
      assert.ok(node.conduitIndices.length >= 1);
    }
  }
});

test('resolveActivePipelineNode and togglePinnedNode prioritize hover over pin cleanly', () => {
  assert.equal(resolveActivePipelineNode('dbt', 'erp'), 'dbt');
  assert.equal(resolveActivePipelineNode(null, 'erp'), 'erp');
  assert.equal(resolveActivePipelineNode(null, null), null);
  assert.equal(togglePinnedNode(null, 'dbt'), 'dbt');
  assert.equal(togglePinnedNode('dbt', 'dbt'), null);
  assert.equal(togglePinnedNode('dbt', 'erp'), 'erp');
});

test('computeSixMonthPaybackCurve produces 6 monotonic months and flags break-even cleanly', () => {
  const roi = calculateAutomationRoi({
    teamSize: 6,
    weeklyManualHoursPerPerson: 8,
    hourlyRateUsd: 30,
  });
  const curve = computeSixMonthPaybackCurve(roi);
  assert.equal(curve.length, 6);
  assert.equal(curve[0].monthIndex, 1);
  assert.equal(curve[5].monthIndex, 6);
  assert.equal(curve[5].heightPct, 100);
  for (let i = 1; i < curve.length; i++) {
    assert.ok(curve[i].cumulativeSavingsUsd > curve[i - 1].cumulativeSavingsUsd);
  }
  assert.equal(curve.some((pt) => pt.isBreakEvenOrPositive), true);
});

test('DEFAULT_ROI_INPUT and ROI_RATE_PRESETS yield strictly increasing annual savings', () => {
  assert.deepEqual([...ROI_RATE_PRESETS], [10, 20, 40]);
  const savings = ROI_RATE_PRESETS.map((rate) =>
    calculateAutomationRoi({ ...DEFAULT_ROI_INPUT, hourlyRateUsd: rate }).annualSavingsUsd
  );
  assert.ok(savings[0] > 0 && savings[1] > savings[0] && savings[2] > savings[1]);
});

test('parseHourlyRateInput strips non-digits and clamps to valid hourly rate bounds', () => {
  assert.equal(parseHourlyRateInput('18', 15), 18);
  assert.equal(parseHourlyRateInput('$65', 15), 65);
  assert.equal(parseHourlyRateInput('2', 15), ROI_HOURLY_RATE_MIN);
  assert.equal(parseHourlyRateInput('999', 15), ROI_HOURLY_RATE_MAX);
  assert.equal(parseHourlyRateInput('', 15), 15);
});

test('computeSliderFillPct computes clamped fill percentages safely', () => {
  assert.equal(computeSliderFillPct(1, 1, 40), 0);
  assert.equal(computeSliderFillPct(40, 1, 40), 100);
  assert.equal(computeSliderFillPct(20, 10, 30), 50);
  assert.equal(computeSliderFillPct(-10, 1, 40), 0);
  assert.equal(computeSliderFillPct(999, 1, 40), 100);
  assert.equal(computeSliderFillPct(10, 10, 10), 0);
});

test('computeBiPointInspection computes MoM deltas and handles first period', () => {
  const series = [
    { revenue: 64, automatedShare: 48 },
    { revenue: 80, automatedShare: 56 },
    { revenue: 96, automatedShare: 76 },
  ];
  const first = computeBiPointInspection(series, 0);
  assert.ok(first);
  assert.equal(first.revenue, 64);
  assert.equal(first.deltaRevenue, null);
  assert.equal(first.deltaPct, null);

  const second = computeBiPointInspection(series, 1);
  assert.ok(second);
  assert.equal(second.deltaRevenue, 16);
  assert.equal(second.deltaPct, 25);

  const clamped = computeBiPointInspection(series, 99);
  assert.ok(clamped);
  assert.equal(clamped.index, 2);
  assert.equal(clamped.deltaPct, 20);
  assert.equal(computeBiPointInspection([], 0), null);
});

test('prefill summaries format localized ROI and case context cleanly', () => {
  const roi = calculateAutomationRoi(DEFAULT_ROI_INPUT);
  assert.match(buildRoiPrefillSummary(roi, 'uk'), /\$16,920\/рік/);
  assert.match(buildRoiPrefillSummary(roi, 'en'), /\$16,920\/yr/);
  assert.match(buildCasePrefillSummary('AI Triage', 'uk'), /AI Triage/);
  assert.match(buildCasePrefillSummary('AI Triage', 'en'), /AI Triage/);
});

test('filterFaqItems and toggleFaqItem handle category filtering and accordion state cleanly', () => {
  const sample = [
    { id: 'f1', category: 'process' as const },
    { id: 'f2', category: 'pricing' as const },
    { id: 'f3', category: 'security' as const },
    { id: 'f4', category: 'process' as const },
  ];
  assert.equal(filterFaqItems(sample, 'all').length, 4);
  assert.equal(filterFaqItems(sample, 'process').length, 2);
  assert.equal(filterFaqItems(sample, 'security')[0].id, 'f3');

  assert.equal(toggleFaqItem(null, 'f1'), 'f1');
  assert.equal(toggleFaqItem('f1', 'f2'), 'f2');
  assert.equal(toggleFaqItem('f2', 'f2'), null);
});

test('CASE_STUDIES_DATA features sanitized 15-node n8n Debt Control case study first', () => {
  assert.equal(CASE_STUDIES_DATA.length, 4);
  const featured = CASE_STUDIES_DATA[0];
  assert.equal(featured.id, 'debt-control-1c-n8n');
  assert.equal(featured.n8nPreset, 'debt-control-15');
  assert.equal(featured.category, 'ai');
  assert.ok(featured.title.uk.includes('1С'));
  assert.ok(featured.title.en.includes('1C'));
  const serialized = JSON.stringify(featured);
  const redactedClientMarker = Buffer.from('0JTQtdC80YfQtdC90LrQvg==', 'base64').toString('utf8');
  assert.ok(!serialized.includes(redactedClientMarker), 'Case study must remain privacy-sanitized');
  assert.equal(filterCaseStudies(CASE_STUDIES_DATA, 'ai').length, 2);
  assert.equal(filterCaseStudies(CASE_STUDIES_DATA, 'bi').length, 1);
  assert.equal(filterCaseStudies(CASE_STUDIES_DATA, 'etl').length, 1);
});
