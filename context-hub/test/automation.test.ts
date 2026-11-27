import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {PassThrough} from 'node:stream';
import {
  FeishuNotifier,
  buildJson2Card,
  cardBytes,
  resolveFeishuChatId,
  resolveFeishuCredentials,
} from '../src/automation/notify-feishu.ts';
import {diffProtectedGitChanges, inspectJwtExpiry, runPreflightChecks, snapshotGitStatus} from '../src/automation/preflight.ts';
import {DshRunner, foldDshEvents} from '../src/automation/runner-dsh.ts';
import {resolveRuntime} from '../src/automation/runtime.ts';
import {AutomationScheduler, cronMatches, cronSlotWithin} from '../src/automation/scheduler.ts';
import {describeWorkspace, loadTaskDefinitions, resolveWorkspaceDir, syncTasksToDatabase} from '../src/automation/tasks.ts';
import {assembleUnitPrompt, loadTaskDocBody, parseResultContract} from '../src/automation/units.ts';
import {initDatabase, openDatabase} from '../src/lib.ts';
import {handleMcpRequest} from '../src/mcp.ts';
import {createDashboardServer} from '../src/server.ts';

const WIZZ_REPO_LOCAL = '/Volumes/BillionSteps/GitHub/wizzzzz-skillhub';

function createFakeChild({events = [], exitCode = 0, delayMs = 10, onStdin}: {events?: any[]; exitCode?: number; delayMs?: number; onStdin?: (text: string) => void} = {}) {
  const child = new EventEmitter() as any;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  let stdinText = '';
  child.stdin.on('data', (chunk: Buffer) => {
    stdinText += chunk.toString('utf8');
  });
  child.stdin.on('end', () => {
    onStdin?.(stdinText);
  });
  child.kill = () => {
    child.emit('close', null);
    return true;
  };
  setTimeout(() => {
    for (const evt of events) {
      child.stdout.write(`${JSON.stringify(evt)}\n`);
    }
    child.stdout.end();
    child.stderr.end();
    child.emit('close', exitCode);
  }, delayMs);
  return child;
}

test('default-disabled tasks carry no pause reason, so a manual run can still cascade', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-taskstate-'));
  const dbPath = path.join(tmp, 'context-hub.sqlite');
  await initDatabase(dbPath);
  const db = openDatabase(dbPath);
  try {
    const tasks = await loadTaskDefinitions();
    syncTasksToDatabase(db, tasks);
    const rows = db.prepare('SELECT task_id, enabled, paused_reason FROM automation_tasks ORDER BY task_id').all() as Array<{
      task_id: string;
      enabled: number;
      paused_reason: string | null;
    }>;
    assert.deepEqual(rows.map((row) => [row.task_id, row.enabled, row.paused_reason]), [
      ['wizz-a', 0, null],
      ['wizz-b', 0, null],
      ['wizz-c', 0, null],
    ]);

    // 旧版本会在默认未启用时写「P0 default manual-only」，这一条会在同步时被清掉。
    db.prepare("UPDATE automation_tasks SET paused_reason = 'P0 default manual-only' WHERE task_id = 'wizz-b'").run();
    syncTasksToDatabase(db, tasks);
    const reason = db.prepare("SELECT paused_reason FROM automation_tasks WHERE task_id = 'wizz-b'").get() as {paused_reason: string | null};
    assert.equal(reason.paused_reason, null);
  } finally {
    db.close();
    await rm(tmp, {recursive: true, force: true});
  }
});

test('parseResultContract parses fenced json block and fallback json object', () => {
  const fenced = 'done!\n```json\n{"status":"ok","summary":"all good","artifacts":["a.png"]}\n```\n';
  const r1 = parseResultContract(fenced);
  assert.equal(r1.contract?.status, 'ok');
  assert.equal(r1.contract?.summary, 'all good');

  const bare = 'finished: {"status":"partial","summary":"one failed","failed_nodes":[]}';
  const r2 = parseResultContract(bare);
  assert.equal(r2.contract?.status, 'partial');
});

test('inspectJwtExpiry detects expired and valid JWT payloads', () => {
  const mkJwt = (expSec: number) => {
    const header = Buffer.from(JSON.stringify({alg: 'none'})).toString('base64url');
    const payload = Buffer.from(JSON.stringify({exp: expSec})).toString('base64url');
    return `${header}.${payload}.sig`;
  };
  const nowSec = Math.floor(Date.now() / 1000);
  assert.equal(inspectJwtExpiry(mkJwt(nowSec + 3600)).ok, true);
  assert.equal(inspectJwtExpiry(mkJwt(nowSec - 60)).ok, false);
});

test('git guard is an allowlist: only ideas/ materials/ worlds/ works/ may change', () => {
  const before = new Set<string>(['docs/automic/服务端自动化方案.md']);
  const after = new Set<string>([
    'docs/automic/服务端自动化方案.md',
    'ideas/done/idea-1.md',
    'materials/20261124/demo/restraint.png',
    'worlds/baldurs-gate-modern/seed.md',
    'works/20261124/demo/restraint.png',
  ]);
  // 新增的改动都落在允许目录里；before 里已有的 docs 改动不算这一轮引入。
  assert.deepEqual(diffProtectedGitChanges(before, after), []);

  const dirty = new Set<string>([...after, 'skills/wizz-portrait-prompter/SKILL.md', 'README.md', 'docs/research/x.md', 'tools/wizz-queue.mjs']);
  assert.deepEqual(diffProtectedGitChanges(after, dirty), [
    'skills/wizz-portrait-prompter/SKILL.md',
    'README.md',
    'docs/research/x.md',
    'tools/wizz-queue.mjs',
  ]);
});

test('snapshotGitStatus reports rename destinations and keeps CJK paths unescaped', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ch-git-guard-'));
  const git = (...args: string[]) => execFileSync('git', args, {cwd: dir, encoding: 'utf8'});
  try {
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    await mkdir(path.join(dir, 'ideas'), {recursive: true});
    await writeFile(path.join(dir, 'ideas', '旧想法.md'), 'x\n', 'utf8');
    git('add', '.');
    git('commit', '-qm', 'init');
    // 已被跟踪的中文路径 + 跨允许/禁止目录的 rename。
    await mkdir(path.join(dir, 'docs'), {recursive: true});
    git('mv', 'ideas/旧想法.md', 'docs/新想法.md');
    await mkdir(path.join(dir, 'materials'), {recursive: true});
    await writeFile(path.join(dir, 'materials', 'restraint.png'), 'x\n', 'utf8');

    const snapshot = await snapshotGitStatus(dir);
    // rename 的新路径必须出现（旧实现只切 `R  old -> new` 一行，会漏掉它）。
    assert.ok(snapshot.has('docs/新想法.md'), [...snapshot].join('\n'));
    // 中文路径不能被转义成 `"\346..."`。
    assert.equal([...snapshot].filter((entry) => entry.includes('\\3')).length, 0);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('DshRunner invokes dsh headless with stdin (-), approval-policy never, and parses NDJSON contract', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-dsh-runner-'));
  let capturedArgs: string[] = [];
  let capturedStdin = '';
  let capturedDshHome = '';
  let capturedWizzMaterials = '';

  const runner = new DshRunner({
    cliPath: '/fake/dsh',
    dshHome: '/tmp/fake-dsh-home',
    spawn: ((_cmd: string, args: string[], opts: any) => {
      capturedArgs = args;
      capturedDshHome = opts.env.DSH_HOME;
      capturedWizzMaterials = opts.env.WIZZ_MATERIALS;
      return createFakeChild({
        onStdin: (text) => {
          capturedStdin = text;
        },
        events: [
          {type: 'session', sessionId: 'ses_test_123'},
          {type: 'tool_call', tool: 'bash'},
          {type: 'final', text: '完成\n```json\n{"status":"ok","summary":"done","batches":{"done":1,"failed":0}}\n```'},
          {type: 'status', phase: 'turn_end', reason: {kind: 'completed'}},
        ],
      });
    }) as any,
  });

  const res = await runner.runUnit({
    runId: 'wizz-b@manual-1',
    unitId: 'b-run-1',
    cwd: tmp,
    addDirs: ['/Volumes/BillionsBrilliance/materials'],
    extraEnv: {WIZZ_MATERIALS: '/Volumes/BillionsBrilliance/materials'},
    logDir: path.join(tmp, 'logs'),
    prompt: 'hello unit prompt',
    permissionMode: 'workspace-write',
    approvalPolicy: 'never',
    runtime: 'headless',
    timeoutMinutes: 1,
    stalledMinutes: 1,
  });

  assert.equal(res.ok, true);
  assert.equal(res.sessionId, 'ses_test_123');
  assert.equal(res.contract?.status, 'ok');
  assert.equal(capturedDshHome, '/tmp/fake-dsh-home');
  assert.equal(capturedWizzMaterials, '/Volumes/BillionsBrilliance/materials');
  assert.ok(capturedArgs.includes('--profile') && capturedArgs.includes('headless'));
  assert.ok(capturedArgs.includes('--approval-policy') && capturedArgs.includes('never'));
  assert.ok(capturedArgs.includes('--add-dir') && capturedArgs.includes('/Volumes/BillionsBrilliance/materials'));
  assert.equal(capturedArgs[capturedArgs.length - 1], '-');
  assert.equal(capturedStdin, 'hello unit prompt');

  const envelopeDisk = await readFile(path.join(tmp, 'logs', 'envelope.md'), 'utf8');
  assert.equal(envelopeDisk, 'hello unit prompt');
  const folded = foldDshEvents([{type: 'text', text: 'part1'}, {type: 'final', text: 'authoritative'}]);
  assert.equal(folded.text, 'authoritative');
});

test('FeishuNotifier uploads images into JSON 2.0 card and falls back gracefully when upload fails', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-feishu-'));
  const imgFile = path.join(tmp, 'restraint.png');
  await writeFile(imgFile, Buffer.from('fakepng'));

  const sentPayloads: any[] = [];
  const notifierOk = new FeishuNotifier({
    getCredentials: () => ({appId: 'cli_test', appSecret: 'sec_test'}),
    getChatId: async () => 'oc_test',
    clientFactory: () => ({
      im: {
        message: {
          create: async (p) => {
            sentPayloads.push(p);
            return {data: {message_id: 'om_123'}};
          },
        },
        v1: {
          image: {
            create: async () => ({image_key: 'img_v3_key'}),
          },
        },
      },
    }),
  });

  const okRes = await notifierOk.notifySuccess({
    runKey: 'wizz-c@test-1',
    dateLabel: '2026-11-24',
    durationMs: 120_000,
    batches: [{batch: '20261124-demo', style: '2.5D', status: 'done'}],
    images: [{path: imgFile, label: 'restraint'}],
  });
  assert.equal(okRes.sent, true);
  assert.equal(okRes.uploadedImages, 1);
  assert.equal(okRes.degradedImages, false);
  const card = JSON.parse(sentPayloads[0].data.content);
  assert.equal(card.schema, '2.0');
  assert.equal(card.body.elements[1].tag, 'img');
  assert.equal(card.body.elements[1].img_key, 'img_v3_key');
  assert.ok(cardBytes(buildJson2Card({title: 't', elements: []})) < 500);

  // Degraded path when im:resource fails
  const degradedPayloads: any[] = [];
  const notifierDegraded = new FeishuNotifier({
    getCredentials: () => ({appId: 'cli_test', appSecret: 'sec_test'}),
    getChatId: async () => 'oc_test',
    clientFactory: () => ({
      im: {
        message: {
          create: async (p) => {
            degradedPayloads.push(p);
            return {data: {message_id: 'om_456'}};
          },
        },
        v1: {
          image: {
            create: async () => {
              throw new Error('99991672 lack im:resource');
            },
          },
        },
      },
    }),
  });

  const degRes = await notifierDegraded.notifySuccess({
    runKey: 'wizz-c@test-2',
    dateLabel: '2026-11-24',
    durationMs: 60_000,
    batches: [{batch: '20261124-demo', style: '2.5D', status: 'done'}],
    images: [{path: imgFile, label: 'restraint'}],
  });
  assert.equal(degRes.sent, true);
  assert.equal(degRes.uploadedImages, 0);
  assert.equal(degRes.degradedImages, true);
  assert.match(degradedPayloads[0].data.content, /成品图路径（降级/);
});

test('Feishu credentials prefer FEISHU_AGENT_* and fall back to legacy names', () => {
  const keys = [
    'FEISHU_AGENT_APP_ID',
    'FEISHU_AGENT_APP_SECRET',
    'DSH_FEISHU_AGENT_APP_ID',
    'DSH_FEISHU_AGENT_APP_SECRET',
    'FEISHU_APP_ID',
    'FEISHU_APP_SECRET',
  ];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.FEISHU_AGENT_APP_ID = '  new_id  ';
    process.env.FEISHU_AGENT_APP_SECRET = ' new_secret ';
    process.env.DSH_FEISHU_AGENT_APP_ID = 'legacy_id';
    process.env.DSH_FEISHU_AGENT_APP_SECRET = 'legacy_secret';
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;
    assert.deepEqual(resolveFeishuCredentials(), {appId: 'new_id', appSecret: 'new_secret'});

    process.env.FEISHU_AGENT_APP_ID = '   ';
    delete process.env.FEISHU_AGENT_APP_SECRET;
    assert.deepEqual(resolveFeishuCredentials(), {appId: 'legacy_id', appSecret: 'legacy_secret'});

    delete process.env.DSH_FEISHU_AGENT_APP_ID;
    process.env.FEISHU_APP_ID = 'fallback_id';
    assert.equal(resolveFeishuCredentials().appId, 'fallback_id');
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('resolveFeishuChatId reads chatId from the current feishu-agent state shape', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ch-chat-'));
  const statePath = path.join(dir, 'state.json');
  const savedChatId = process.env.CONTEXT_HUB_FEISHU_CHAT_ID;
  delete process.env.CONTEXT_HUB_FEISHU_CHAT_ID;
  try {
    await writeFile(
      statePath,
      JSON.stringify({
        version: 2,
        bindings: {
          'cli_x:tenant:oc_from_key:-': {chatId: 'oc_from_value', chatType: 'p2p'},
        },
      }),
    );
    assert.equal(await resolveFeishuChatId(statePath), 'oc_from_value');

    // 旧 state 只有复合 key、没有 value.chatId 时，从 key 段里取。
    await writeFile(statePath, JSON.stringify({version: 1, bindings: {'cli_x:tenant:oc_from_key:-': {}}}));
    assert.equal(await resolveFeishuChatId(statePath), 'oc_from_key');

    // 没有 env、也没有本机 state 时没有收件人：源码里不再写死个人 chat_id。
    assert.equal(await resolveFeishuChatId(path.join(dir, 'missing.json')), '');
  } finally {
    if (savedChatId === undefined) delete process.env.CONTEXT_HUB_FEISHU_CHAT_ID;
    else process.env.CONTEXT_HUB_FEISHU_CHAT_ID = savedChatId;
    await rm(dir, {recursive: true, force: true});
  }
});

test('Dashboard server exposes /healthz and /api/automation/* on empty DB and enforces token on POST', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-server-'));
  const dbPath = path.join(tmp, 'context-hub.sqlite');
  await initDatabase(dbPath);
  const db = openDatabase(dbPath);

  const tasks = await loadTaskDefinitions();
  syncTasksToDatabase(db, tasks);
  const notifier = new FeishuNotifier({db, getCredentials: () => ({appId: '', appSecret: ''})});
  const runner = new DshRunner();
  const scheduler = new AutomationScheduler({db, runner, notifier, runsRootDir: path.join(tmp, 'runs')});
  await scheduler.init();

  const serverHandle = createDashboardServer({
    port: 0,
    dbPath,
    db,
    automation: {scheduler, getToken: () => 'secret-token'},
  });
  const port = await serverHandle.listen();

  try {
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200);

    const statusRes = await fetch(`http://127.0.0.1:${port}/api/automation/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = (await statusRes.json()) as any;
    assert.equal(statusBody.tasks.length, 3);
    assert.equal(statusBody.tasks.every((t: any) => t.enabled === false), true);

    // Report workspace API still returns 503 when empty, proving automation routes sit before guard
    const overviewRes = await fetch(`http://127.0.0.1:${port}/api/overview`);
    assert.equal(overviewRes.status, 503);

    // POST without token -> 401
    const unauth = await fetch(`http://127.0.0.1:${port}/api/automation/pause`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({task: 'wizz-a'}),
    });
    assert.equal(unauth.status, 401);

    // POST with valid token -> 200
    const authOk = await fetch(`http://127.0.0.1:${port}/api/automation/resume`, {
      method: 'POST',
      headers: {'content-type': 'application/json', 'x-automation-token': 'secret-token'},
      body: JSON.stringify({task: 'wizz-a'}),
    });
    assert.equal(authOk.status, 200);

    // Shared DB handle in MCP does not throw or close DB
    const mcpRes = (await handleMcpRequest({jsonrpc: '2.0', id: 1, method: 'tools/call', params: {name: 'context_hub_list_workspaces', arguments: {}}}, {dbPath, db})) as any;
    assert.equal(mcpRes.result.isError, undefined);
  } finally {
    scheduler.stop();
    await serverHandle.close();
    db.close();
  }
});

test('status snapshot reuses cached preflight within TTL', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-preflight-'));
  const dbPath = path.join(tmp, 'context-hub.sqlite');
  await initDatabase(dbPath);
  const db = openDatabase(dbPath);

  const tasks = await loadTaskDefinitions();
  syncTasksToDatabase(db, tasks);
  const notifier = new FeishuNotifier({db, getCredentials: () => ({appId: '', appSecret: ''})});
  let preflightCalls = 0;
  const report = {ok: true, checkedAt: new Date().toISOString(), checks: []};
  const scheduler = new AutomationScheduler({
    db,
    runner: new DshRunner(),
    notifier,
    runsRootDir: path.join(tmp, 'runs'),
    preflightRunner: async () => {
      preflightCalls += 1;
      return report;
    },
  });
  await scheduler.init();

  try {
    const first = (await scheduler.getStatusSnapshot()) as any;
    const second = (await scheduler.getStatusSnapshot()) as any;
    assert.equal(preflightCalls, 1);
    assert.deepEqual(first.preflight, report);
    assert.deepEqual(second.preflight, report);
  } finally {
    scheduler.stop();
    db.close();
  }
});

test('Scheduler crash recovery, retry pre-cleanup, and prompt assembly against wizz docs', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-sched-'));
  const dbPath = path.join(tmp, 'context-hub.sqlite');
  await initDatabase(dbPath);
  const db = openDatabase(dbPath);

  // Seed crash state: dead PID lease & stuck running run/unit
  db.prepare("INSERT INTO automation_leases (task_id, owner, pid, acquired_at, expires_at) VALUES ('wizz-b', 'old', 999999, '2026-11-24T00:00:00Z', '2099-01-01T00:00:00Z')").run();
  db.prepare("INSERT INTO automation_runs (run_key, task_id, trigger, status, started_at) VALUES ('wizz-b@crash-1', 'wizz-b', 'manual', 'running', '2026-11-24T00:00:00Z')").run();
  db.prepare("INSERT INTO automation_units (id, run_key, unit_type, status, started_at) VALUES ('u-1', 'wizz-b@crash-1', 'b-run', 'running', '2026-11-24T00:00:00Z')").run();

  const fakeWizz = path.join(tmp, 'wizz');
  await mkdir(path.join(fakeWizz, 'materials', '_queue', 'doing'), {recursive: true});
  await mkdir(path.join(fakeWizz, 'materials', '_queue', 'todo'), {recursive: true});
  await mkdir(path.join(fakeWizz, 'materials', '_queue', 'c'), {recursive: true});
  await mkdir(path.join(fakeWizz, 'tools'), {recursive: true});
  await writeFile(
    path.join(fakeWizz, 'materials', '_queue', 'doing', '20261124-demo-restraint.json'),
    JSON.stringify({jobKey: '20261124-demo-restraint', batch: '20261124-demo'}),
  );
  await writeFile(
    path.join(fakeWizz, 'materials', '_queue', 'c', '20261124-demo.json'),
    JSON.stringify({batch: '20261124-demo', status: 'running'}),
  );
  await writeFile(path.join(fakeWizz, 'tools', 'wizz-c-state.mjs'), '// stub\n');

  const toolCalls: string[] = [];
  const notifier = new FeishuNotifier({db, getCredentials: () => ({appId: '', appSecret: ''})});
  const runner = new DshRunner();
  const scheduler = new AutomationScheduler({
    db,
    runner,
    notifier,
    runsRootDir: path.join(tmp, 'runs'),
    execTool: async (_cmd, args) => {
      toolCalls.push(args.join(' '));
      return {stdout: '', stderr: ''};
    },
  });
  await scheduler.init();

  const leaseAfter = db.prepare("SELECT * FROM automation_leases WHERE task_id = 'wizz-b'").get();
  assert.equal(leaseAfter, undefined);
  const runAfter = db.prepare("SELECT status FROM automation_runs WHERE run_key = 'wizz-b@crash-1'").get() as any;
  assert.equal(runAfter.status, 'failed');

  await scheduler.cleanupBeforeRetry('wizz-b', fakeWizz, '20261124-demo');
  const movedCard = await readFile(path.join(fakeWizz, 'materials', '_queue', 'todo', '20261124-demo-restraint.json'), 'utf8');
  assert.match(movedCard, /20261124-demo-restraint/);

  await scheduler.cleanupBeforeRetry('wizz-c', fakeWizz, '20261124-demo');
  assert.ok(toolCalls.some((c) => c.includes('wizz-c-state.mjs release --batch 20261124-demo')));

  // Verify real Wizz task docs assemble cleanly if present on disk
  const tasks = await loadTaskDefinitions();
  const preflight = await runPreflightChecks({wizzRepoDir: WIZZ_REPO_LOCAL, checkCodexAuth: false, checkDshCli: false});
  if (preflight.ok) {
    for (const [id, task] of tasks.entries()) {
      const unitType = `${id.slice(-1)}-run` as const;
      const loaded = await loadTaskDocBody(task, WIZZ_REPO_LOCAL);
      const assembled = assembleUnitPrompt(loaded.body, {
        runId: `${id}@dry`,
        unitId: unitType,
        taskId: id,
        unitType,
        triggeredAt: '2026-11-24T10:00:00+08:00',
        workspaceDir: WIZZ_REPO_LOCAL,
        timeoutMinutes: task.timeoutMinutes,
        stalledMinutes: task.stalledMinutes,
      });
      assert.match(assembled, /严禁直接写入或修改 `materials\/_failures\.log`/);
    }
  }

  scheduler.stop();
  db.close();
});

test('workspace resolution is explicit: env, then task path, never a guessed fallback', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-workspace-'));
  const envDir = path.join(tmp, 'from-env');
  const taskDir = path.join(tmp, 'from-task');
  const nested = path.join(tmp, 'nested');
  await mkdir(envDir, {recursive: true});
  await mkdir(taskDir, {recursive: true});
  await mkdir(nested, {recursive: true});

  const saved = process.env.WIZZ_REPO_TEST;
  try {
    process.env.WIZZ_REPO_TEST = envDir;
    const withEnv = resolveWorkspaceDir(
      {id: 'wizz-a', name: 'a', enabled: true, promptDoc: 'x', workspaceEnv: 'WIZZ_REPO_TEST', workspaceDir: taskDir, permissionMode: 'workspace-write', approvalPolicy: 'never', timeoutMinutes: 1, unitConcurrency: 1, stalledMinutes: 1, trigger: {kind: 'cron'}, preflight: [], retry: {infra: {max: 1, backoffMinutes: 1}}, notify: {success: {images: false, maxImages: 0}, failure: {node: true}}},
      nested,
    );
    assert.equal(withEnv, envDir);

    delete process.env.WIZZ_REPO_TEST;
    const relative = describeWorkspace(
      {id: 'wizz-a', workspaceEnv: 'WIZZ_REPO_TEST', workspaceDir: '../from-task'},
      nested,
    );
    assert.equal(relative.dir, taskDir);
    assert.equal(relative.source, 'task');
    assert.equal(relative.exists, true);

    const absolute = describeWorkspace({id: 'wizz-a', workspaceEnv: 'WIZZ_REPO_TEST', workspaceDir: taskDir}, nested);
    assert.equal(absolute.dir, taskDir);
    assert.equal(absolute.error, null);

    const missingDir = describeWorkspace(
      {id: 'wizz-a', workspaceEnv: 'WIZZ_REPO_TEST', workspaceDir: path.join(tmp, 'absent')},
      nested,
    );
    assert.equal(missingDir.exists, false);
    assert.match(String(missingDir.error), /工作区不存在/);

    const unconfigured = describeWorkspace({id: 'wizz-a', workspaceEnv: 'WIZZ_REPO_TEST'}, nested);
    assert.equal(unconfigured.dir, null);
    assert.match(String(unconfigured.error), /未配置 workspaceDir/);
    assert.throws(
      () => resolveWorkspaceDir({id: 'wizz-a', workspaceEnv: 'WIZZ_REPO_TEST'} as any, nested),
      /未配置 workspaceDir/,
    );
  } finally {
    if (saved === undefined) delete process.env.WIZZ_REPO_TEST;
    else process.env.WIZZ_REPO_TEST = saved;
    await rm(tmp, {recursive: true, force: true});
  }
});

test('runtime preference resolves desktop only when the in-host bridge is available', () => {
  const running = () => ({running: true, pid: 4242, detail: '运行中（pid 4242）'});
  const stopped = () => ({running: false, pid: null, detail: '未运行'});
  const bridged = () => ({
    available: true,
    stateFile: '/fake/bridge.json',
    secretFile: '/fake/bridge.secret',
    port: 63433,
    pid: 4242,
    detail: '桥可用（pid 4242, port 63433）',
  });
  const noBridge = () => ({
    available: false,
    stateFile: '/fake/bridge.json',
    secretFile: '/fake/bridge.secret',
    port: null,
    pid: null,
    detail: '未找到 /fake/bridge.json（宿主未装 dsh-context-hub-bridge，或装后未重启）',
  });

  const autoBridged = resolveRuntime('auto', running, bridged);
  assert.equal(autoBridged.resolved, 'desktop');
  assert.equal(autoBridged.supported, true);
  assert.deepEqual(autoBridged.bridge, {stateFile: '/fake/bridge.json', port: 63433, pid: 4242});
  assert.match(autoBridged.detail, /auto → desktop/);

  const autoUnbridged = resolveRuntime('auto', running, noBridge);
  assert.equal(autoUnbridged.resolved, 'headless');
  assert.equal(autoUnbridged.supported, true);
  assert.match(autoUnbridged.detail, /auto → headless/);

  const forced = resolveRuntime('desktop', running, noBridge);
  assert.equal(forced.resolved, 'desktop');
  assert.equal(forced.supported, false);
  assert.match(forced.detail, /装好 dsh-context-hub-bridge/);

  const headless = resolveRuntime('headless', running, bridged);
  assert.equal(headless.resolved, 'headless');
  assert.equal(headless.supported, true);
  assert.equal(headless.desktopDetected, true);
});

test('DshRunner refuses desktop without a bridge and never spawns the CLI', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-runtime-'));
  const savedState = process.env.CONTEXT_HUB_BRIDGE_STATE;
  const savedSecret = process.env.CONTEXT_HUB_BRIDGE_SECRET;
  process.env.CONTEXT_HUB_BRIDGE_STATE = path.join(tmp, 'missing-bridge.json');
  process.env.CONTEXT_HUB_BRIDGE_SECRET = path.join(tmp, 'missing-bridge.secret');
  process.env.CONTEXT_HUB_BRIDGE_WAKE = '0';
  let spawned = false;
  const runner = new DshRunner({
    cliPath: '/fake/dsh',
    spawn: (() => {
      spawned = true;
      throw new Error('must not spawn for desktop runtime');
    }) as any,
  });

  try {
    const res = await runner.runUnit({
      runId: 'wizz-a@manual-runtime',
      unitId: 'a-run',
      cwd: tmp,
      logDir: path.join(tmp, 'logs'),
      prompt: 'hello',
      permissionMode: 'workspace-write',
      approvalPolicy: 'never',
      runtime: 'desktop',
      timeoutMinutes: 1,
      stalledMinutes: 1,
    });
    assert.equal(spawned, false);
    assert.equal(res.exitCode, null);
    assert.equal(res.ok, false);
    assert.match(res.error, /桥不可用/);
    const persisted = JSON.parse(await readFile(path.join(tmp, 'logs', 'result.json'), 'utf8'));
    assert.equal(persisted.runtime.preference, 'desktop');
    assert.equal(persisted.runtime.supported, false);
  } finally {
    if (savedState === undefined) delete process.env.CONTEXT_HUB_BRIDGE_STATE;
    else process.env.CONTEXT_HUB_BRIDGE_STATE = savedState;
    if (savedSecret === undefined) delete process.env.CONTEXT_HUB_BRIDGE_SECRET;
    else process.env.CONTEXT_HUB_BRIDGE_SECRET = savedSecret;
    await rm(tmp, {recursive: true, force: true});
  }
});

test('DshRunner desktop run submits, polls, and parses the contract from the host answer', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-host-'));
  const previous = {
    state: process.env.CONTEXT_HUB_BRIDGE_STATE,
    secret: process.env.CONTEXT_HUB_BRIDGE_SECRET,
    wake: process.env.CONTEXT_HUB_BRIDGE_WAKE,
  };
  const requests: Array<{method: string; url: string}> = [];
  const contract = JSON.stringify({status: 'ok', summary: 'host run', artifacts: ['a.md']});
  let polls = 0;
  const server = createServer((req, res) => {
    requests.push({method: req.method ?? '', url: req.url ?? ''});
    const reply = (value: unknown) => {
      const text = JSON.stringify(value);
      res.writeHead(200, {'content-type': 'application/json'});
      res.end(text);
    };
    if (req.url === '/context-hub/health') return reply({ok: true, pid: process.pid});
    if (req.method === 'POST' && req.url === '/context-hub/run') {
      return reply({sessionId: 'session-host', sinceSeq: 7, workspacePath: tmp});
    }
    if (req.method === 'POST' && req.url === '/context-hub/run/session-host/cancel') {
      return reply({cancelled: true});
    }
    if (req.method === 'GET' && req.url?.startsWith('/context-hub/run/session-host')) {
      polls += 1;
      if (polls < 2) return reply({sessionId: 'session-host', status: 'running', lastSeq: 7});
      return reply({
        sessionId: 'session-host',
        status: 'answered',
        answer: `done\n\`\`\`json\n${contract}\n\`\`\``,
        turn: 1,
        turnEndKind: 'completed',
        lastSeq: 20,
      });
    }
    res.writeHead(404).end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  await writeFile(path.join(tmp, 'bridge.json'), JSON.stringify({pid: process.pid, port}));
  await writeFile(path.join(tmp, 'bridge.secret'), 'test-secret\n');
  process.env.CONTEXT_HUB_BRIDGE_STATE = path.join(tmp, 'bridge.json');
  process.env.CONTEXT_HUB_BRIDGE_SECRET = path.join(tmp, 'bridge.secret');
  process.env.CONTEXT_HUB_BRIDGE_WAKE = '0';

  const runner = new DshRunner({cliPath: '/fake/dsh'});
  try {
    const res = await runner.runUnit({
      runId: 'wizz-b@manual-host',
      unitId: 'b-0-abcdef',
      cwd: tmp,
      logDir: path.join(tmp, 'logs'),
      prompt: 'do the thing',
      title: 'Wizz B · 测试',
      permissionMode: 'workspace-write',
      approvalPolicy: 'never',
      runtime: 'desktop',
      timeoutMinutes: 5,
      stalledMinutes: 5,
    });
    assert.equal(res.ok, true, res.error);
    assert.equal(res.sessionId, 'session-host');
    assert.equal(res.turnEndKind, 'completed');
    assert.equal(res.contract?.status, 'ok');
    assert.equal(res.contract?.summary, 'host run');
    assert.equal(res.runtime?.resolved, 'desktop');
    const submit = requests.find((r) => r.method === 'POST' && r.url === '/context-hub/run');
    assert.ok(submit);
    const log = await readFile(path.join(tmp, 'logs', 'stdout.jsonl'), 'utf8');
    assert.match(log, /"event":"submitted"/);
    assert.match(log, /"event":"answered"/);
    const persisted = JSON.parse(await readFile(path.join(tmp, 'logs', 'result.json'), 'utf8'));
    assert.equal(persisted.contract.status, 'ok');
  } finally {
    server.close();
    process.env.CONTEXT_HUB_BRIDGE_STATE = previous.state;
    process.env.CONTEXT_HUB_BRIDGE_SECRET = previous.secret;
    process.env.CONTEXT_HUB_BRIDGE_WAKE = previous.wake;
    if (previous.state === undefined) delete process.env.CONTEXT_HUB_BRIDGE_STATE;
    if (previous.secret === undefined) delete process.env.CONTEXT_HUB_BRIDGE_SECRET;
    if (previous.wake === undefined) delete process.env.CONTEXT_HUB_BRIDGE_WAKE;
    await rm(tmp, {recursive: true, force: true});
  }
});

test('cron trigger honors the expression in the task json (and never silently no-ops)', () => {
  const at = (iso: string) => new Date(iso);
  assert.equal(cronSlotWithin('0 10 * * *', at('2026-11-27T10:00:00+08:00'), 30), '2026-11-27T10:00');
  assert.equal(cronSlotWithin('0 10 * * *', at('2026-11-27T10:20:00+08:00'), 30), '2026-11-27T10:00');
  assert.equal(cronSlotWithin('0 10 * * *', at('2026-11-27T11:00:00+08:00'), 30), null);
  assert.equal(cronSlotWithin('*/15 * * * *', at('2026-11-27T10:31:00+08:00'), 2), '2026-11-27T10:30');
  // 周六 10:00 只在 weekday 字段允许时命中；0 和 7 都表示周日。
  const saturday = at('2026-11-28T10:00:00+08:00');
  assert.equal(cronSlotWithin('0 10 * * 6', saturday, 0), '2026-11-28T10:00');
  assert.equal(cronSlotWithin('0 10 * * 0', saturday, 0), null);
  assert.equal(cronSlotWithin('0 10 * * 7', at('2026-11-29T10:00:00+08:00'), 0), '2026-11-29T10:00');
  assert.throws(() => cronMatches('0 10 * *', {minutesOfDay: 600, dayOfMonth: 1, month: 1, weekday: 0}), /5 fields/);
});

test('lease is never stolen from a live pid, even after the TTL expires', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-lease-'));
  const dbPath = path.join(tmp, 'context-hub.sqlite');
  await initDatabase(dbPath);
  const db = openDatabase(dbPath);
  const notifier = new FeishuNotifier({db, getCredentials: () => ({appId: '', appSecret: ''})});
  const scheduler = new AutomationScheduler({
    db,
    runner: new DshRunner(),
    notifier,
    runsRootDir: path.join(tmp, 'runs'),
    leaseTtlMs: 1,
  });
  try {
    assert.equal(scheduler.acquireLease('wizz-a', 'owner-1'), true);
    // 把过期时间推到过去，模拟「长任务跑过了 TTL」。
    db.prepare('UPDATE automation_leases SET expires_at = ? WHERE task_id = ?').run('2000-01-01T00:00:00Z', 'wizz-a');
    // 本进程 pid 活着，所以第二个 owner 必须被拒。
    assert.equal(scheduler.acquireLease('wizz-a', 'owner-2'), false);
    const row = db.prepare('SELECT owner FROM automation_leases WHERE task_id = ?').get('wizz-a') as any;
    assert.equal(row.owner, 'owner-1');
    // 死 pid 才允许回收。
    db.prepare('UPDATE automation_leases SET pid = ? WHERE task_id = ?').run(999_999, 'wizz-a');
    assert.equal(scheduler.acquireLease('wizz-a', 'owner-3'), true);
  } finally {
    scheduler.stop();
    db.close();
    await rm(tmp, {recursive: true, force: true});
  }
});

test('a single failed host poll cancels the remote session before reporting failure', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'ch-host-poll-'));
  const previous = {
    state: process.env.CONTEXT_HUB_BRIDGE_STATE,
    secret: process.env.CONTEXT_HUB_BRIDGE_SECRET,
    wake: process.env.CONTEXT_HUB_BRIDGE_WAKE,
  };
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    const reply = (status: number, value: unknown) => {
      res.writeHead(status, {'content-type': 'application/json'});
      res.end(JSON.stringify(value));
    };
    if (req.url === '/context-hub/health') return reply(200, {ok: true, pid: process.pid});
    if (req.method === 'POST' && req.url === '/context-hub/run') {
      return reply(200, {sessionId: 'session-flaky', sinceSeq: 3});
    }
    if (req.method === 'POST' && req.url === '/context-hub/run/session-flaky/cancel') {
      return reply(200, {cancelled: true});
    }
    if (req.method === 'GET' && req.url?.startsWith('/context-hub/run/session-flaky')) {
      // 一次 ECONNRESET 级别的失败：绝不能再留下还在跑的会话。
      return reply(502, {error: 'bridge temporarily unavailable'});
    }
    res.writeHead(404).end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  await writeFile(path.join(tmp, 'bridge.json'), JSON.stringify({pid: process.pid, port, origin: `http://127.0.0.1:${port}`}));
  await writeFile(path.join(tmp, 'bridge.secret'), 'test-secret\n');
  process.env.CONTEXT_HUB_BRIDGE_STATE = path.join(tmp, 'bridge.json');
  process.env.CONTEXT_HUB_BRIDGE_SECRET = path.join(tmp, 'bridge.secret');
  process.env.CONTEXT_HUB_BRIDGE_WAKE = '0';

  try {
    const res = await new DshRunner({cliPath: '/fake/dsh'}).runUnit({
      runId: 'wizz-c@manual-host-poll',
      unitId: 'c-run-abcdef',
      cwd: tmp,
      logDir: path.join(tmp, 'logs'),
      prompt: 'do the thing',
      permissionMode: 'workspace-write',
      approvalPolicy: 'never',
      runtime: 'desktop',
      timeoutMinutes: 5,
      stalledMinutes: 5,
    });
    assert.equal(res.ok, false);
    assert.match(res.error, /轮询宿主失败（已请求取消该会话）/);
    assert.ok(requests.includes('POST /context-hub/run/session-flaky/cancel'), requests.join('\n'));
  } finally {
    server.close();
    process.env.CONTEXT_HUB_BRIDGE_STATE = previous.state;
    process.env.CONTEXT_HUB_BRIDGE_SECRET = previous.secret;
    process.env.CONTEXT_HUB_BRIDGE_WAKE = previous.wake;
    if (previous.state === undefined) delete process.env.CONTEXT_HUB_BRIDGE_STATE;
    if (previous.secret === undefined) delete process.env.CONTEXT_HUB_BRIDGE_SECRET;
    if (previous.wake === undefined) delete process.env.CONTEXT_HUB_BRIDGE_WAKE;
    await rm(tmp, {recursive: true, force: true});
  }
});
