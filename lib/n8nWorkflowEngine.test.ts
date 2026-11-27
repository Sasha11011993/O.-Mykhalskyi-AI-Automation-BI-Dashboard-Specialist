import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_N8N_WORKFLOW,
  N8N_VIEWBOX_H,
  N8N_VIEWBOX_W,
  classifyN8nNodeType,
  formatWorkflowSummary,
  getDefaultN8nWorkflow,
  parseAndLayoutN8nWorkflow,
} from './n8nWorkflowEngine';

test('parseAndLayoutN8nWorkflow parses DEFAULT_N8N_WORKFLOW with AI sub-links and IF branches', () => {
  const res = parseAndLayoutN8nWorkflow(DEFAULT_N8N_WORKFLOW);
  assert.equal(res.ok, true);
  if (!res.ok) return;

  const { graph } = res;
  assert.equal(graph.nodes.length, 7);
  assert.equal(graph.edges.length, 6);
  assert.equal(graph.totalWaves, 4);

  const aiLink = graph.edges.find((e) => e.isAiSubLink);
  assert.ok(aiLink, 'Expected ai_languageModel sub-link');
  assert.equal(aiLink.connectionType, 'ai_languageModel');

  const trueBranch = graph.edges.find((e) => e.branchLabel === 'true');
  const falseBranch = graph.edges.find((e) => e.branchLabel === 'false');
  assert.ok(trueBranch && falseBranch, 'Expected IF true/false branches');

  // Every node must stay strictly inside viewBox bounds
  for (const node of graph.nodes) {
    assert.ok(node.x >= 0 && node.x + node.width <= N8N_VIEWBOX_W, `Node ${node.name} X out of bounds`);
    assert.ok(node.y >= 0 && node.y + node.height <= N8N_VIEWBOX_H, `Node ${node.name} Y out of bounds`);
    assert.ok(node.protocol.uk.length > 0 && node.explanation.uk.length > 10);
    assert.ok(node.edgeIds.length >= 1, `Node ${node.name} should link to edges`);
  }

  assert.match(formatWorkflowSummary(graph, 'uk'), /7 вузлів · 6 зв’язків/);
  assert.match(formatWorkflowSummary(graph, 'en'), /7 nodes · 6 links/);
});

test('parseAndLayoutN8nWorkflow strips stickyNote nodes and normalizes extreme negative coordinates', () => {
  const customExport = JSON.stringify({
    name: 'Real Custom Export',
    nodes: [
      {
        id: 'note-1',
        name: 'Sticky Note',
        type: 'n8n-nodes-base.stickyNote',
        position: [-4000, -4000],
        parameters: { content: 'Docs' },
      },
      {
        id: 'n1',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        position: [-1200, 820],
        parameters: {},
      },
      {
        id: 'n2',
        name: 'Fetch ERP Orders',
        type: 'n8n-nodes-base.httpRequest',
        position: [400, 960],
        parameters: { method: 'GET', url: 'https://erp.example.com/orders' },
      },
      {
        id: 'n3',
        name: 'Insert Postgres',
        type: 'n8n-nodes-base.postgres',
        position: [1900, 1240],
        parameters: { operation: 'insert', table: 'fact_orders' },
      },
    ],
    connections: {
      'Schedule Trigger': {
        main: [[{ node: 'Fetch ERP Orders', type: 'main', index: 0 }]],
      },
      'Fetch ERP Orders': {
        main: [[{ node: 'Insert Postgres', type: 'main', index: 0 }]],
      },
    },
  });

  const res = parseAndLayoutN8nWorkflow(customExport);
  assert.equal(res.ok, true);
  if (!res.ok) return;

  assert.equal(res.graph.ignoredStickyNotes, 1);
  assert.equal(res.graph.nodes.length, 3);
  assert.equal(res.graph.edges.length, 2);
  assert.equal(res.graph.nodes[0].wave, 0);
  assert.equal(res.graph.nodes[1].wave, 1);
  assert.equal(res.graph.nodes[2].wave, 2);

  for (const n of res.graph.nodes) {
    assert.ok(n.x >= 0 && n.x + n.width <= N8N_VIEWBOX_W);
    assert.ok(n.y >= 0 && n.y + n.height <= N8N_VIEWBOX_H);
  }
});

test('parseAndLayoutN8nWorkflow returns localized errors on invalid inputs', () => {
  const badSyntax = parseAndLayoutN8nWorkflow('{ invalid json');
  assert.equal(badSyntax.ok, false);
  if (!badSyntax.ok) {
    assert.match(badSyntax.errorUk, /JSON/);
    assert.match(badSyntax.errorEn, /JSON/);
  }

  const noNodes = parseAndLayoutN8nWorkflow('{"name": "Empty"}');
  assert.equal(noNodes.ok, false);

  const onlySticky = parseAndLayoutN8nWorkflow(
    JSON.stringify({
      nodes: [{ name: 'Note', type: 'n8n-nodes-base.stickyNote', position: [0, 0] }],
    })
  );
  assert.equal(onlySticky.ok, false);
});

test('classifyN8nNodeType accurately categorizes trigger, ai, logic, and action types', () => {
  assert.equal(classifyN8nNodeType('n8n-nodes-base.webhook').category, 'trigger');
  assert.equal(classifyN8nNodeType('@n8n/n8n-nodes-langchain.agent').category, 'ai');
  assert.equal(classifyN8nNodeType('n8n-nodes-base.if').category, 'logic');
  assert.equal(classifyN8nNodeType('n8n-nodes-base.hubspot').category, 'action');
  assert.equal(classifyN8nNodeType('n8n-nodes-base.telegramTrigger').shortType, 'TG Trigger');
});

test('getDefaultN8nWorkflow returns clean localized EN & UK workflows without overflowing names', () => {
  const enRes = parseAndLayoutN8nWorkflow(getDefaultN8nWorkflow('en'));
  assert.equal(enRes.ok, true);
  if (!enRes.ok) return;
  assert.equal(enRes.graph.nodes.length, 7);
  assert.equal(enRes.graph.edges.length, 6);
  for (const node of enRes.graph.nodes) {
    assert.ok(node.name.length <= 19, `EN node name too long: ${node.name}`);
    assert.ok(node.shortType.length <= 15, `EN shortType too long: ${node.shortType}`);
    assert.ok(!/[А-Яа-яІіЇїЄє]/.test(node.name), `EN node should not contain Cyrillic: ${node.name}`);
  }
});

test('parseAndLayoutN8nWorkflow lays out 15-node real production workflow with zero overlap, cycle-safe waves, and smart API detection', async () => {
  const { PRODUCTION_DEBT_CONTROL_WORKFLOW } = await import('./n8nWorkflowEngine');

  for (const mode of ['compact', 'panorama'] as const) {
    const res = parseAndLayoutN8nWorkflow(PRODUCTION_DEBT_CONTROL_WORKFLOW, mode);
    assert.equal(res.ok, true);
    if (!res.ok) return;

    const { graph } = res;
    assert.equal(graph.nodes.length, 15);
    assert.equal(graph.edges.length, 16);
    assert.equal(graph.supportsPanorama, true);
    assert.equal(graph.layoutMode, mode);

    // Zero node bounding-box overlap in both modes
    for (let i = 0; i < graph.nodes.length; i++) {
      const a = graph.nodes[i];
      assert.ok(a.x >= 0 && a.x + a.width <= graph.viewBoxWidth, `${mode}: ${a.name} X out of bounds`);
      assert.ok(a.y >= 0 && a.y + a.height <= graph.viewBoxHeight, `${mode}: ${a.name} Y out of bounds`);
      for (let j = i + 1; j < graph.nodes.length; j++) {
        const b = graph.nodes[j];
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        assert.equal(overlapX && overlapY, false, `${mode}: Nodes "${a.name}" and "${b.name}" overlap`);
      }
    }

    // Cycle-safe monotonic waves: IF node must precede OpenAI Watchdog and Telegram
    const ifNode = graph.nodes.find((n) => n.name.includes('Є аномалії'));
    const aiNode = graph.nodes.find((n) => n.name.includes('ШІ Сторож'));
    const tgNode = graph.nodes.find((n) => n.name.includes('Звіт у Telegram'));
    assert.ok(ifNode && aiNode && tgNode);
    assert.ok(ifNode.wave < aiNode.wave, 'IF node must run before OpenAI watchdog');
    assert.ok(aiNode.wave < tgNode.wave, 'OpenAI watchdog must run before Telegram report');

    // Smart HTTP classification: OpenAI HTTP Request classified as AI, Google Sheets write as action
    assert.equal(aiNode.category, 'ai');
    assert.equal(aiNode.shortType, 'OpenAI API');
    const writeSheets = graph.nodes.find((n) => n.name.includes('Записати в Google Sheets'));
    assert.equal(writeSheets?.category, 'action');
    assert.equal(writeSheets?.shortType, 'Google Sheets');

    // SplitInBatches loop-back edge detected cleanly
    const loopBack = graph.edges.find((e) => e.isLoopBack);
    assert.ok(loopBack, 'Expected SplitInBatches loop-back edge');
    assert.equal(loopBack.branchLabel, '↺ loop');
  }
});
