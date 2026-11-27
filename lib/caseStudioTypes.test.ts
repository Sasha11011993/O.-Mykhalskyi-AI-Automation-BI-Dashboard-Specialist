import test from 'node:test';
import assert from 'node:assert/strict';
import { CASE_STUDIES_DATA } from './portfolioData';
import { PRODUCTION_DEBT_CONTROL_WORKFLOW, parseAndLayoutN8nWorkflow } from './n8nWorkflowEngine';
import {
  BLUEPRINT_LIMITS,
  clampHotspotCoord,
  createBlankCaseDraft,
  formatScenesBadgeSummary,
  mergePublicCases,
  reconstructN8nWorkflowFromFirestore,
  sanitizeCasePayloadForFirestore,
  serializeN8nWorkflowForFirestore,
  slugifyCaseId,
  validateCaseDraftForSave,
} from './caseStudioTypes';

test('slugifyCaseId transliterates Ukrainian titles to valid blueprint IDs', () => {
  const slug = slugifyCaseId('Дебет-контроль: 1С → Telegram (2026)!');
  assert.match(slug, BLUEPRINT_LIMITS.ID_PATTERN);
  assert.ok(slug.includes('debet-kontrol'));
  assert.ok(slug.length >= 2 && slug.length <= BLUEPRINT_LIMITS.MAX_ID_LEN);
});

test('clampHotspotCoord keeps coordinates strictly inside 3..97% visual safe area', () => {
  assert.equal(clampHotspotCoord(-15), 3);
  assert.equal(clampHotspotCoord(120), 97);
  assert.equal(clampHotspotCoord(42.34), 42.3);
  assert.equal(clampHotspotCoord(Number.NaN), 50);
});

test('serializeN8nWorkflowForFirestore flattens nested arrays and round-trips cleanly', () => {
  const serialized = serializeN8nWorkflowForFirestore(PRODUCTION_DEBT_CONTROL_WORKFLOW);
  assert.equal(serialized.ok, true);
  if (!serialized.ok) return;

  assert.equal(serialized.nodes.length, 15);
  assert.ok(serialized.links.length >= 14);
  assert.ok(serialized.uniqueTechStack.length > 0);

  // Verify zero nested arrays inside serialized nodes/links (Firestore safety)
  for (const node of serialized.nodes) {
    for (const val of Object.values(node)) {
      assert.equal(Array.isArray(val), false);
    }
  }
  for (const link of serialized.links) {
    for (const val of Object.values(link)) {
      assert.equal(Array.isArray(val), false);
    }
  }

  // Round-trip reconstruction must parse into a 15-node valid graph
  const reconstructed = reconstructN8nWorkflowFromFirestore({
    workflowName: serialized.workflowName,
    nodes: serialized.nodes,
    links: serialized.links,
  });
  const reparsed = parseAndLayoutN8nWorkflow(reconstructed, 'compact');
  assert.equal(reparsed.ok, true);
  if (!reparsed.ok) return;
  assert.equal(reparsed.graph.nodes.length, 15);
  assert.ok(reparsed.graph.edges.length >= 14);
});

test('validateCaseDraftForSave rejects empty title and invalid slug/year', () => {
  const blank = createBlankCaseDraft(0, 'uid-1');
  blank.id = 'bad slug!!';
  blank.year = '26';
  const result = validateCaseDraftForSave(blank, 'uk');
  assert.equal(result.valid, false);
  assert.ok(result.errors.titleUk);
  assert.ok(result.errors.id);
  assert.ok(result.errors.year);
});

test('sanitizeCasePayloadForFirestore enforces blueprint array and string bounds', () => {
  const draft = createBlankCaseDraft(5, 'owner-1');
  draft.id = 'crm-agent-pro';
  draft.titleUk = 'A'.repeat(250);
  draft.stack = Array.from({ length: 25 }, (_, i) => `Tool-${i}`);
  draft.scenes = Array.from({ length: 14 }, (_, i) => ({
    id: `scene-${i}`,
    kind: 'ui-telegram',
    titleUk: `Екран ${i}`,
    titleEn: `Screen ${i}`,
    captionUk: '',
    captionEn: '',
    mediaId: `media-${i}`,
    n8nWorkflowId: '',
    hotspots: Array.from({ length: 12 }, (_, h) => ({
      id: `hs-${h}`,
      xPct: h * 20,
      yPct: -5,
      titleUk: `Точка ${h}`,
      titleEn: '',
      noteUk: '',
      noteEn: '',
    })),
  }));

  const sanitized = sanitizeCasePayloadForFirestore(draft, 'owner-1');
  assert.equal(sanitized.titleUk.length, BLUEPRINT_LIMITS.MAX_TITLE_LEN);
  assert.equal(sanitized.stack.length, BLUEPRINT_LIMITS.MAX_STACK_ITEMS);
  assert.equal(sanitized.scenes.length, BLUEPRINT_LIMITS.MAX_SCENES);
  assert.equal(sanitized.scenes[0].hotspots.length, BLUEPRINT_LIMITS.MAX_HOTSPOTS_PER_SCENE);
  assert.equal(sanitized.scenes[0].hotspots[0].yPct, 3);
  assert.equal(sanitized.coverMediaId, 'media-0');
});

test('mergePublicCases excludes drafts/unlisted and respects hiddenStaticCaseIds + sortOrder', () => {
  const published = sanitizeCasePayloadForFirestore(
    {
      ...createBlankCaseDraft(1, 'owner-1'),
      id: 'new-tg-case',
      status: 'published',
      titleUk: 'Новий Telegram-бот',
      scenes: [
        {
          id: 's1',
          kind: 'n8n-json',
          titleUk: 'Воркфлоу',
          titleEn: 'Workflow',
          captionUk: '',
          captionEn: '',
          mediaId: '',
          n8nWorkflowId: 'wf-1',
          hotspots: [],
        },
        {
          id: 's2',
          kind: 'ui-telegram',
          titleUk: 'Бот',
          titleEn: 'Bot',
          captionUk: '',
          captionEn: '',
          mediaId: 'm-1',
          n8nWorkflowId: '',
          hotspots: [],
        },
      ],
    },
    'owner-1'
  );
  const draft = sanitizeCasePayloadForFirestore(
    { ...createBlankCaseDraft(0, 'owner-1'), id: 'secret-draft', status: 'draft', titleUk: 'Чернетка' },
    'owner-1'
  );
  const unlisted = sanitizeCasePayloadForFirestore(
    { ...createBlankCaseDraft(2, 'owner-1'), id: 'nda-case', status: 'unlisted', titleUk: 'NDA кейс' },
    'owner-1'
  );

  const merged = mergePublicCases(CASE_STUDIES_DATA, [draft, unlisted, published], {
    heroCaseId: 'new-tg-case',
    hiddenStaticCaseIds: ['retail-powerbi-suite'],
  });

  assert.equal(merged[0].id, 'new-tg-case');
  assert.equal(merged.some((c) => c.id === 'secret-draft'), false);
  assert.equal(merged.some((c) => c.id === 'nda-case'), false);
  assert.equal(merged.some((c) => c.id === 'retail-powerbi-suite'), false);
  assert.equal(formatScenesBadgeSummary(published.scenes, 'uk'), '1 n8n · Telegram');
});
