import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BLUEPRINT_LIMITS, createBlankCaseDraft, sanitizeCasePayloadForFirestore } from './lib/caseStudioTypes';

/**
 * Security Rules Structural & Dirty-Dozen Invariant Test Suite
 * Verifies that firestore.rules enforces every security gate defined in security_spec.md
 * and remains strictly synchronized with firebase-blueprint.json.
 */

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const rulesText = fs.readFileSync(rulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
  entities: Record<string, { required?: string[] }>;
  firestore: Record<string, unknown>;
};

test('firestore.rules uses rules_version 2 and default-deny catch-all first', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2';/);
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('every collection in firebase-blueprint.json has an explicit match block in firestore.rules', () => {
  for (const collectionPath of Object.keys(blueprint.firestore)) {
    assert.ok(
      rulesText.includes(`match ${collectionPath}`),
      `Missing match block for ${collectionPath}`
    );
  }
  assert.ok(rulesText.includes('match /admins/{uid}'), 'Missing /admins lock block');
});

test('Dirty Dozen #1 & #7: shadow field injection and immutable field tampering blocked', () => {
  assert.ok(rulesText.includes('data.keys().hasAll('));
  assert.ok(rulesText.includes('data.keys().hasOnly('));
  assert.ok(rulesText.includes('incoming().id == existing().id'));
  assert.ok(rulesText.includes('incoming().ownerId == existing().ownerId'));
  assert.ok(rulesText.includes('incoming().createdAt == existing().createdAt'));
  assert.ok(rulesText.includes('incoming().diff(existing()).affectedKeys().hasOnly('));
});

test('Dirty Dozen #2, #3, #12: email_verified enforced and admins collection locked down', () => {
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesText.includes("request.auth.token.email == 'mihal4ik11@gmail.com'"));
  assert.match(rulesText, /match \/admins\/\{uid\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('Dirty Dozen #4 & #5: draft/unlisted isolation on list and get queries', () => {
  assert.ok(rulesText.includes("allow list: if existing().status == 'published'"));
  // Pillar 8: allow list must NOT invoke get() or exists()
  const listBlocks = rulesText.match(/allow list:[^;]+;/g) ?? [];
  assert.ok(listBlocks.length >= 4);
  for (const block of listBlocks) {
    assert.equal(block.includes('exists('), false, `Forbidden exists() in list rule: ${block}`);
    assert.equal(block.includes('get('), false, `Forbidden get() in list rule: ${block}`);
  }
});

test('Dirty Dozen #6, #8, #9, #10, #11: identity, request.time, path ID, existsAfter, and media regex', () => {
  assert.ok(rulesText.includes('data.ownerId == request.auth.uid'));
  assert.ok(rulesText.includes('incoming().createdAt == request.time'));
  assert.ok(rulesText.includes('incoming().updatedAt == request.time'));
  assert.ok(rulesText.includes('isValidId(caseId)'));
  assert.ok(rulesText.includes('existsAfter(/databases/$(database)/documents/cases/$(incoming().caseId))'));
  assert.ok(rulesText.includes("^data:image/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$"));
  assert.ok(rulesText.includes('data.dataUrl.size() <= 650000'));
});

test('sanitized frontend PortfolioCase payload matches every required blueprint key', () => {
  const sample = sanitizeCasePayloadForFirestore(
    { ...createBlankCaseDraft(0, 'uid-owner'), id: 'demo-case', titleUk: 'Тестовий кейс' },
    'uid-owner'
  );
  const payloadWithTimestamps = { ...sample, createdAt: 'ts', updatedAt: 'ts' };
  const requiredKeys = blueprint.entities.PortfolioCase.required ?? [];
  for (const key of requiredKeys) {
    assert.ok(key in payloadWithTimestamps, `Missing required blueprint key: ${key}`);
  }
  assert.match(sample.id, BLUEPRINT_LIMITS.ID_PATTERN);
});

test('PortfolioSettings AI routing fields are strictly allowlisted, regex-validated, and secret-free', () => {
  assert.ok(rulesText.includes("listVal.hasOnly(['gemini', 'openai', 'anthropic', 'openrouter'])"));
  assert.ok(rulesText.includes('isValidAiModelId(data.aiOpenaiModel, 80)'));
  assert.ok(rulesText.includes('isValidAiModelId(data.aiAnthropicModel, 80)'));
  assert.ok(rulesText.includes('isValidAiModelId(data.aiOpenrouterModel, 120)'));
  // Ensure no API key field names are ever allowed in Firestore settings
  assert.equal(rulesText.toLowerCase().includes('apikey'), false);
  assert.equal(JSON.stringify(blueprint.entities.PortfolioSettings).toLowerCase().includes('apikey'), false);
});

