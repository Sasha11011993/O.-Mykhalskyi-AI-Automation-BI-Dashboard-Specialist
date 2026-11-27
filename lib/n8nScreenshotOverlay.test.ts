import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_DEBT_CONTROL_WORKFLOW } from './n8nWorkflowEngine';
import {
  DEBT_CONTROL_SCREENSHOT_SPEC,
  buildScreenshotExecutionPlan,
  getOverlayStepCaption,
} from './n8nScreenshotOverlay';

test('screenshot overlay spec maps 1:1 to all 15 production workflow nodes within 1191x547 bounds', () => {
  const workflowNodeIds = new Set(PRODUCTION_DEBT_CONTROL_WORKFLOW.nodes.map((n) => n.id));
  const specNodeIds = new Set(DEBT_CONTROL_SCREENSHOT_SPEC.nodes.map((n) => n.nodeId));

  assert.equal(DEBT_CONTROL_SCREENSHOT_SPEC.width, 1191);
  assert.equal(DEBT_CONTROL_SCREENSHOT_SPEC.height, 547);
  assert.equal(DEBT_CONTROL_SCREENSHOT_SPEC.nodes.length, 15);
  assert.deepEqual(specNodeIds, workflowNodeIds);

  for (const box of DEBT_CONTROL_SCREENSHOT_SPEC.nodes) {
    assert.ok(box.x >= 0 && box.x + box.w <= DEBT_CONTROL_SCREENSHOT_SPEC.width, `x out of bounds: ${box.nodeId}`);
    assert.ok(box.y >= 0 && box.y + box.h <= DEBT_CONTROL_SCREENSHOT_SPEC.height, `y out of bounds: ${box.nodeId}`);
    assert.ok(box.w >= 45 && box.h >= 45, `box too small: ${box.nodeId}`);
  }
});

test('all overlay wires reference valid nodes and have non-empty SVG path strings', () => {
  const specNodeIds = new Set(DEBT_CONTROL_SCREENSHOT_SPEC.nodes.map((n) => n.nodeId));
  assert.equal(DEBT_CONTROL_SCREENSHOT_SPEC.wires.length, 16);

  for (const wire of DEBT_CONTROL_SCREENSHOT_SPEC.wires) {
    assert.ok(specNodeIds.has(wire.fromNodeId), `unknown fromNodeId ${wire.fromNodeId}`);
    assert.ok(specNodeIds.has(wire.toNodeId), `unknown toNodeId ${wire.toNodeId}`);
    assert.ok(wire.d.startsWith('M '), `invalid SVG path on ${wire.id}`);
  }
});

test('anomaly branch runs 2 SplitInBatches iterations and routes through OpenAI Watchdog to Telegram', () => {
  const plan = buildScreenshotExecutionPlan('anomaly');
  assert.equal(plan.branch, 'anomaly');
  assert.ok(plan.executedNodeIds.includes('dc-openai-guard'));
  assert.ok(plan.executedNodeIds.includes('dc-merge-ai'));
  assert.ok(plan.executedNodeIds.includes('dc-telegram-send'));
  assert.equal(plan.skippedNodeIds.length, 0);

  const loopWriteSteps = plan.steps.filter(
    (s) => s.nodeId === 'dc-write-sheets' && s.kind === 'loop-out'
  );
  assert.equal(loopWriteSteps.length, 2);
  assert.deepEqual(
    loopWriteSteps.map((s) => s.loopIteration),
    [1, 2]
  );

  assert.ok(plan.activeWireIds.includes('w-if-openai'));
  assert.ok(plan.inactiveWireIds.includes('w-if-telegram'));
  assert.equal(plan.steps[plan.steps.length - 1]?.nodeId, 'dc-telegram-send');
});

test('normal branch runs 2 SplitInBatches iterations, bypasses OpenAI ($0 LLM), and routes straight to Telegram', () => {
  const plan = buildScreenshotExecutionPlan('normal');
  assert.equal(plan.branch, 'normal');
  assert.ok(!plan.executedNodeIds.includes('dc-openai-guard'));
  assert.ok(!plan.executedNodeIds.includes('dc-merge-ai'));
  assert.deepEqual(plan.skippedNodeIds, ['dc-openai-guard', 'dc-merge-ai']);
  assert.ok(plan.activeWireIds.includes('w-if-telegram'));
  assert.ok(plan.inactiveWireIds.includes('w-if-openai'));
  assert.equal(plan.steps[plan.steps.length - 1]?.nodeId, 'dc-telegram-send');
  assert.match(plan.llmCostLabelUk, /\$0/);
  assert.match(plan.llmCostLabelEn, /\$0/);

  const lastCaption = getOverlayStepCaption(plan.steps[plan.steps.length - 1], 'uk');
  assert.match(lastCaption, /\$0/);
});
