import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply, createSessionArchiveTool, createSessionSendTool, createSessionSpawnTool, createSessionWaitTool, deriveTitle, resolvePresetId } from '../lib/index.js'

const SESSION_ID = 'session-11111111-2222-3333-4444-555555555555'
// 假工作区路径只作为字符串参与断言，用系统临时目录保证换机器也成立。
const WORKSPACE_PATH = join(tmpdir(), 'dsh-wizz-session-workspace')

/**
 * A fake host context: only the surface the tool touches, with every call
 * recorded so the tests can assert on ordering and arguments.
 */
function makeCtx(options = {}) {
  const calls = { create: [], prompt: [], rename: [], detach: [], resolveAgent: [], archive: [], registered: [], permissionResolve: [], permissionSet: [], permissionCurrent: [], order: [] }
  const workspace = {
    id: 'ws-1',
    title: 'skillhub',
    path: WORKSPACE_PATH,
    // Membership is how the tool finds the calling session's workspace first;
    // a caller outside it can still attach through its recorded directory.
    sessionIds: options.callerMember === false ? [] : ['session-caller'],
    detachSession: async (id) => { calls.detach.push(id); calls.order.push('detach') }
  }
  const services = {
    sessionProjections: {
      stateOf: () => options.callerPreset ?? undefined
    }
  }
  if (options.workspaceController !== false) {
    services.workspaceController = {
      archiveSession: async (request) => {
        calls.archive.push(request)
        calls.order.push('archive')
        if (options.archiveFailsFor !== undefined && request.sessionId === options.archiveFailsFor) throw new Error('session is not known')
        return { archivedSessionIds: [request.sessionId] }
      }
    }
  }
  if (options.permissionService !== false) {
    const names = options.permissionNames ?? ['read-only', 'workspace-write', 'danger-full-access']
    services.permissionPresets = {
      names,
      resolve: (name) => {
        calls.permissionResolve.push(name)
        if (!names.includes(name)) throw new Error(`permission: unknown preset "${name}" (known: ${names.join(', ')})`)
        return { sandbox: name, approval: 'ask' }
      },
      set: (session, name) => {
        calls.order.push('permission-set')
        calls.permissionSet.push({ session, name })
        if (options.permissionSetFails === true) throw new Error('switch refused')
      },
      current: (session) => {
        calls.permissionCurrent.push(session)
        if (options.permissionCurrent !== undefined) return options.permissionCurrent
        return calls.permissionSet.at(-1)?.name ?? 'workspace-write'
      }
    }
  }
  if (options.persistenceEvents !== undefined) {
    services.sessionPersistence = {
      open: async () => ({
        read: async () => ({ events: options.persistenceEvents }),
        close: async () => {}
      })
    }
  }
  const liveOf = (id) => {
    const session = {
      header: { cwd: WORKSPACE_PATH, id },
      ...(typeof options.agentEvents === 'function' ? { snapshotEvents: () => options.agentEvents() } : {})
    }
    // A property getter records when the tool reads the next sequence number,
    // so a test can prove the permission switch happened before sinceSeq.
    if (options.trackSeq === true) {
      Object.defineProperty(session, 'seq', {
        enumerable: true,
        get() {
          calls.order.push('seq-read')
          return options.agentSeq ?? 0
        }
      })
    } else {
      session.seq = options.agentSeq ?? 0
    }
    return { session }
  }
  const ctx = {
    get: (serviceName) => services[serviceName],
    agents: {
      get: (id) => (options.noLiveAgent === true ? undefined : liveOf(id))
    },
    workspaceRegistry: {
      resolveByPath: async () => (options.unregisteredWorkspace === true || options.resolveByPathMiss === true ? undefined : workspace),
      list: () => [workspace]
    },
    sessionController: {
      resolveAgent: async (sessionId) => {
        calls.resolveAgent.push(sessionId)
        if (options.unreachableSession === true) return { error: { message: 'no saved session has that id' } }
        return { agent: { id: sessionId } }
      },
      create: async (request) => {
        calls.create.push(request)
        calls.order.push('create')
        if (options.createFails === true) throw new Error('create refused')
        if (options.createLeaveBehind === true) {
          const error = new Error(`session "${SESSION_ID}" was created but could not attach to workspace "ws-1"`)
          error.details = { sessionId: SESSION_ID, workspaceId: 'ws-1' }
          throw error
        }
        return { sessionId: SESSION_ID }
      },
      prompt: async (request, signal) => {
        // The host calls signal.throwIfAborted() first: a non-signal second
        // argument must fail here exactly as it does in the app.
        signal.throwIfAborted()
        calls.prompt.push({ request, signal })
        calls.order.push('prompt')
        if (options.promptFails === true) throw new Error('delivery refused')
        return { accepted: true }
      }
    },
    sessionTitle: {
      rename: (session, title) => {
        calls.rename.push({ session, title })
        calls.order.push('rename')
        if (options.renameFails === true) throw new Error('title refused')
        return { title }
      }
    },
    tools: {
      register: (definition) => { calls.registered.push(definition) }
    }
  }
  return { ctx, calls, workspace }
}

/** Three events that model one completed turn. */
function turnEvents({ turn = 1, startSeq = 10, answer = '346', endSeq, endKind = 'completed' }) {
  return [
    { seq: startSeq, type: 'turn/start', data: { turn } },
    { seq: startSeq + 1, type: 'assistant/message', data: { turn, message: { content: [{ type: 'text', text: answer }] } } },
    { seq: endSeq ?? startSeq + 2, type: 'turn/end', data: { turn, reason: { kind: endKind } } }
  ]
}

function makeExec(options = {}) {
  return {
    signal: options.signal ?? new AbortController().signal,
    agent: {
      session: {
        header: { id: 'session-caller', cwd: options.callerCwd ?? WORKSPACE_PATH, agentPreset: options.callerHeaderPreset }
      }
    }
  }
}

test('apply registers every tool', () => {
  const { ctx, calls } = makeCtx()
  apply(ctx)
  assert.deepEqual(calls.registered.map((definition) => definition.name).sort(), ['session_archive', 'session_send', 'session_spawn', 'session_wait'])
  for (const definition of calls.registered) {
    assert.equal(typeof definition.execute, 'function')
    assert.equal(typeof definition.output.render, 'function')
  }
})

test('spawns a session attached to the named workspace and delivers the prompt', async () => {
  const { ctx, calls } = makeCtx({ callerPreset: 'standard' })
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'research the topic', workspacePath: WORKSPACE_PATH }, makeExec())

  assert.equal(result.sessionId, SESSION_ID)
  assert.equal(result.workspaceId, 'ws-1')
  assert.equal(result.workspacePath, WORKSPACE_PATH)
  assert.equal(result.workspaceTitle, 'skillhub')
  // No permission argument: report what the host pinned for a new session.
  assert.equal(result.permission, 'workspace-write')
  assert.equal(result.permissionLabel, '工作区内修改')
  assert.equal(calls.create.length, 1)
  // Attached by workspace id, never by cwd: that is what makes it a member.
  assert.deepEqual(calls.create[0], { workspaceId: 'ws-1', agentPreset: 'standard' })
  // The service surface takes a caller signal as the second argument (the
  // inner command layer is the one that takes a message source).
  assert.equal(typeof calls.prompt[0].signal.throwIfAborted, 'function')
  assert.equal(calls.prompt[0].request.sessionId, SESSION_ID)
  assert.equal(calls.prompt[0].request.mode, 'queue')
  assert.deepEqual(calls.prompt[0].request.content, [{ type: 'text', text: 'research the topic' }])
  assert.equal(calls.rename.length, 1)
  assert.deepEqual(calls.order, ['create', 'rename', 'prompt'])
})

test('an omitted workspacePath inherits the calling session workspace', async () => {
  const { ctx, calls } = makeCtx()
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'standalone task' }, makeExec())

  // GUI parity: New Session under the current session's workspace.
  assert.equal(result.workspacePath, WORKSPACE_PATH)
  assert.equal(result.workspaceId, 'ws-1')
  assert.deepEqual(calls.create[0], { workspaceId: 'ws-1' })
})

test('an ungrouped caller outside every workspace directory keeps its cwd', async () => {
  const { ctx, calls } = makeCtx({ callerMember: false, resolveByPathMiss: true })
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'standalone task' }, makeExec({ callerCwd: '/tmp' }))

  assert.equal(result.workspacePath, undefined)
  assert.deepEqual(calls.create[0], { cwd: '/tmp' })
})

test('a caller outside membership but inside a registered directory attaches by cwd', async () => {
  const { ctx, calls } = makeCtx({ callerMember: false })
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'standalone task' }, makeExec({ callerCwd: WORKSPACE_PATH }))

  assert.equal(result.workspacePath, WORKSPACE_PATH)
  assert.deepEqual(calls.create[0], { workspaceId: 'ws-1' })
})

test('ungrouped: true opts out of the caller workspace', async () => {
  const { ctx, calls } = makeCtx()
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'standalone task', ungrouped: true }, makeExec({ callerCwd: '/tmp' }))

  assert.equal(result.workspacePath, undefined)
  assert.deepEqual(calls.create[0], { cwd: '/tmp' })
})

test('a caller without any working directory and no workspace is refused', async () => {
  const { ctx, calls } = makeCtx({ callerMember: false, resolveByPathMiss: true })
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(
    tool.execute({ prompt: 'x' }, makeExec({ callerCwd: '' })),
    /needs either a workspace or a calling session/u
  )
  assert.equal(calls.create.length, 0)
})

test('wrongly typed arguments are refused instead of read as absent', async () => {
  const { ctx } = makeCtx()
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(tool.execute({ prompt: 'x', workspacePath: 123 }, makeExec()), /workspacePath must be a string/u)
  await assert.rejects(tool.execute({ prompt: 'x', ungrouped: 'true' }, makeExec()), /ungrouped must be a boolean/u)
  await assert.rejects(tool.execute({ prompt: 'x', permission: 1 }, makeExec()), /permission must be a string/u)
})

test('an unregistered workspace fails before any session is created', async () => {
  const { ctx, calls } = makeCtx({ unregisteredWorkspace: true })
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(
    tool.execute({ prompt: 'x', workspacePath: '/nope' }, makeExec()),
    /no registered workspace has that path/u
  )
  assert.equal(calls.create.length, 0)
})

test('an empty prompt is refused', async () => {
  const { ctx } = makeCtx()
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(tool.execute({ prompt: '   ' }, makeExec()), /non-empty prompt/u)
})

test('a failed first delivery detaches and archives the session again', async () => {
  const { ctx, calls } = makeCtx({ promptFails: true })
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(
    tool.execute({ prompt: 'x', workspacePath: WORKSPACE_PATH }, makeExec()),
    new RegExp(`created ${SESSION_ID} but could not deliver`, 'u')
  )
  assert.deepEqual(calls.detach, [SESSION_ID])
  assert.deepEqual(calls.archive, [{ sessionId: SESSION_ID, stopActivity: true }])
})

test('permission grants the requested preset before the first message', async () => {
  const { ctx, calls } = makeCtx()
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'read the docs', workspacePath: WORKSPACE_PATH, permission: 'read-only' }, makeExec())

  assert.equal(result.permission, 'read-only')
  assert.equal(result.permissionLabel, '仅可查看')
  assert.deepEqual(calls.permissionResolve, ['read-only'])
  assert.equal(calls.permissionSet.length, 1)
  assert.equal(calls.permissionSet[0].name, 'read-only')
  // The switch must land before the prompt so the first turn runs under it.
  assert.ok(calls.order.indexOf('permission-set') < calls.order.indexOf('prompt'))
  assert.ok(calls.order.indexOf('permission-set') > calls.order.indexOf('create'))
})

test('permission accepts the GUI label and short aliases', async () => {
  for (const [value, expected] of [['仅可查看', 'read-only'], ['工作区内修改', 'workspace-write'], ['完全权限', 'danger-full-access'], ['full', 'danger-full-access'], ['view', 'read-only']]) {
    const { ctx, calls } = makeCtx()
    const tool = createSessionSpawnTool(ctx)
    const result = await tool.execute({ prompt: 'x', workspacePath: WORKSPACE_PATH, permission: value }, makeExec())
    assert.equal(result.permission, expected)
    assert.deepEqual(calls.permissionSet.map((entry) => entry.name), [expected])
  }
})

test('an unknown permission fails before any session is created', async () => {
  const { ctx, calls } = makeCtx()
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(
    tool.execute({ prompt: 'x', permission: 'superuser' }, makeExec()),
    /does not know permission/u
  )
  assert.equal(calls.create.length, 0)
  assert.equal(calls.permissionResolve.length, 0)
})

test('a permission the host does not offer fails before any session is created', async () => {
  const { ctx, calls } = makeCtx({ permissionNames: ['workspace-write', 'danger-full-access'] })
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(
    tool.execute({ prompt: 'x', permission: 'read-only' }, makeExec()),
    /this host offers: workspace-write, danger-full-access/u
  )
  assert.equal(calls.create.length, 0)
})

test('a host without the permission service refuses an explicit permission', async () => {
  const { ctx, calls } = makeCtx({ permissionService: false })
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(
    tool.execute({ prompt: 'x', permission: 'read-only' }, makeExec()),
    /composes no permissionPresets service/u
  )
  assert.equal(calls.create.length, 0)
})

test('a host without the permission service still spawns with its default', async () => {
  const { ctx } = makeCtx({ permissionService: false })
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'x', workspacePath: WORKSPACE_PATH }, makeExec())
  assert.equal(result.permission, undefined)
  assert.equal(result.sessionId, SESSION_ID)
})

test('a failed permission switch takes the session back out of the sidebar', async () => {
  const { ctx, calls } = makeCtx({ permissionSetFails: true })
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(
    tool.execute({ prompt: 'x', workspacePath: WORKSPACE_PATH, permission: 'read-only' }, makeExec()),
    new RegExp(`created ${SESSION_ID} but could not grant permission`, 'u')
  )
  assert.equal(calls.prompt.length, 0)
  assert.deepEqual(calls.detach, [SESSION_ID])
  assert.deepEqual(calls.archive, [{ sessionId: SESSION_ID, stopActivity: true }])
})

test('permission reports the host current value when it differs from the request', async () => {
  // A host readback that disagrees (a shared-bundle tie, or knobs changed in
  // the same session) must be reported as-is: never invent a success value.
  // `custom` itself is unlikely right after set(); the point is the readback.
  const { ctx } = makeCtx({ permissionCurrent: 'custom' })
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'x', workspacePath: WORKSPACE_PATH, permission: 'workspace-write' }, makeExec())
  assert.equal(result.permission, 'custom')
  assert.equal(result.permissionLabel, undefined)
})

test('the permission switch happens before sinceSeq is captured', async () => {
  const { ctx, calls } = makeCtx({ trackSeq: true, agentSeq: 9 })
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'x', workspacePath: WORKSPACE_PATH, permission: 'read-only' }, makeExec())

  // sinceSeq must cover the permission events, or session_wait would look for
  // the answer in the wrong turn window.
  assert.equal(result.sinceSeq, 9)
  const seqAt = calls.order.indexOf('seq-read')
  assert.ok(calls.order.indexOf('permission-set') < seqAt)
  assert.ok(seqAt < calls.order.indexOf('prompt'))
})

test('a title failure does not cost the spawn', async () => {
  const { ctx } = makeCtx({ renameFails: true })
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'x', workspacePath: WORKSPACE_PATH }, makeExec())
  assert.equal(result.sessionId, SESSION_ID)
  assert.equal(typeof result.title, 'string')
})

test('a delivery failure on an ungrouped session still archives it', async () => {
  const { ctx, calls } = makeCtx({ promptFails: true })
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(
    tool.execute({ prompt: 'x', ungrouped: true }, makeExec({ callerCwd: '/tmp' })),
    /could not deliver/u
  )
  assert.deepEqual(calls.detach, [])
  assert.deepEqual(calls.archive, [{ sessionId: SESSION_ID, stopActivity: true }])
})

test('a host without a workspace controller still reports the failure', async () => {
  const { ctx, calls } = makeCtx({ promptFails: true, workspaceController: false })
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(
    tool.execute({ prompt: 'x', workspacePath: WORKSPACE_PATH }, makeExec()),
    /could not deliver/u
  )
  // No archive service: the detach attempt is the only cleanup and must not mask
  // the delivery error.
  assert.deepEqual(calls.detach, [SESSION_ID])
})

test('a create that mints a session then fails to attach it is reclaimed', async () => {
  const { ctx, calls } = makeCtx({ createLeaveBehind: true })
  const tool = createSessionSpawnTool(ctx)
  await assert.rejects(
    tool.execute({ prompt: 'x', workspacePath: WORKSPACE_PATH }, makeExec()),
    /could not attach/u
  )
  assert.deepEqual(calls.archive, [{ sessionId: SESSION_ID, stopActivity: true }])
  assert.equal(calls.prompt.length, 0)
})

test('session_send delivers to a live session without resuming it', async () => {
  const { ctx, calls } = makeCtx()
  const tool = createSessionSendTool(ctx)
  const result = await tool.execute({ sessionId: SESSION_ID, message: 'add the export notes' }, makeExec())

  assert.equal(result.sessionId, SESSION_ID)
  assert.equal(result.delivered, true)
  assert.equal(result.resumed, false)
  assert.deepEqual(calls.resolveAgent, [SESSION_ID])
  assert.equal(calls.prompt.length, 1)
  assert.equal(calls.prompt[0].request.sessionId, SESSION_ID)
  assert.deepEqual(calls.prompt[0].request.content, [{ type: 'text', text: 'add the export notes' }])
  assert.equal(typeof calls.prompt[0].signal.throwIfAborted, 'function')
})

test('session_send resumes a sleeping session before delivering', async () => {
  const { ctx, calls } = makeCtx({ noLiveAgent: true })
  const tool = createSessionSendTool(ctx)
  const result = await tool.execute({ sessionId: SESSION_ID, message: 'continue' }, makeExec())
  assert.equal(result.resumed, true)
  assert.deepEqual(calls.resolveAgent, [SESSION_ID])
  assert.equal(calls.prompt.length, 1)
})

test('session_send refuses to address its own session', async () => {
  const { ctx, calls } = makeCtx()
  const tool = createSessionSendTool(ctx)
  await assert.rejects(
    tool.execute({ sessionId: 'session-caller', message: 'hi' }, makeExec()),
    /own session/u
  )
  assert.equal(calls.prompt.length, 0)
})

test('session_send surfaces an unreachable target without delivering', async () => {
  const { ctx, calls } = makeCtx({ unreachableSession: true })
  const tool = createSessionSendTool(ctx)
  await assert.rejects(
    tool.execute({ sessionId: SESSION_ID, message: 'hi' }, makeExec()),
    /cannot reach/u
  )
  assert.equal(calls.prompt.length, 0)
})

test('session_send refuses an empty message', async () => {
  const { ctx } = makeCtx()
  const tool = createSessionSendTool(ctx)
  await assert.rejects(tool.execute({ sessionId: SESSION_ID, message: '  ' }, makeExec()), /non-empty message/u)
})

test('accepts an explicit title and preset override', async () => {
  const { ctx, calls } = makeCtx({ callerPreset: 'standard' })
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute(
    { prompt: 'x', workspacePath: WORKSPACE_PATH, title: '自定义标题', preset: 'research' },
    makeExec()
  )
  assert.equal(result.title, '自定义标题')
  assert.equal(result.preset, 'research')
  assert.equal(calls.create[0].agentPreset, 'research')
  assert.equal(calls.rename[0].title, '自定义标题')
})

test('session_spawn returns the log offset before delivery', async () => {
  const { ctx } = makeCtx({ agentSeq: 7 })
  const tool = createSessionSpawnTool(ctx)
  const result = await tool.execute({ prompt: 'solve it', workspacePath: WORKSPACE_PATH }, makeExec())
  assert.equal(result.sinceSeq, 7)
})

test('session_send returns the log offset before delivery', async () => {
  const { ctx } = makeCtx({ agentSeq: 9 })
  const tool = createSessionSendTool(ctx)
  const result = await tool.execute({ sessionId: SESSION_ID, message: 'solve it' }, makeExec())
  assert.equal(result.sinceSeq, 9)
})

test('session_wait returns the answer of the first turn that started after sinceSeq', async () => {
  const events = turnEvents({ startSeq: 11, endSeq: 13, answer: '346' })
  const { ctx } = makeCtx({ agentSeq: 20, agentEvents: () => events })
  const tool = createSessionWaitTool(ctx, { pollMs: 1 })
  const result = await tool.execute({ sessionId: SESSION_ID, sinceSeq: 10 }, makeExec())
  assert.equal(result.status, 'answered')
  assert.equal(result.answer, '346')
  assert.equal(result.turn, 1)
  assert.equal(result.turnEndKind, 'completed')
  assert.equal(result.seq, 13)
})

test('session_wait skips a turn that began before the message', async () => {
  const oldTurn = turnEvents({ turn: 1, startSeq: 1, endSeq: 3, answer: 'stale' })
  const newTurn = turnEvents({ turn: 2, startSeq: 6, endSeq: 8, answer: 'fresh' })
  const events = [...oldTurn]
  let reads = 0
  const { ctx } = makeCtx({
    agentSeq: 30,
    agentEvents: () => {
      reads += 1
      if (reads === 2) events.push(...newTurn)
      return [...events]
    }
  })
  const tool = createSessionWaitTool(ctx, { pollMs: 1 })
  const result = await tool.execute({ sessionId: SESSION_ID, sinceSeq: 5 }, makeExec())
  assert.equal(result.status, 'answered')
  assert.equal(result.answer, 'fresh')
  assert.equal(result.turn, 2)
})

test('session_wait reports a timeout while the target is still running', async () => {
  const events = turnEvents({ startSeq: 1, endSeq: 3 })
  const { ctx } = makeCtx({ agentSeq: 9, agentEvents: () => events })
  const tool = createSessionWaitTool(ctx, { pollMs: 1 })
  const result = await tool.execute({ sessionId: SESSION_ID, sinceSeq: 5, timeoutMs: 10 }, makeExec())
  assert.equal(result.status, 'timeout')
  assert.equal(result.running, true)
  assert.equal(result.lastSeq, 3)
})

test('session_wait returns idle for a dormant session with no matching turn', async () => {
  const events = turnEvents({ startSeq: 1, endSeq: 3 })
  const { ctx } = makeCtx({ noLiveAgent: true, persistenceEvents: events })
  const tool = createSessionWaitTool(ctx)
  const result = await tool.execute({ sessionId: SESSION_ID, sinceSeq: 5 }, makeExec())
  assert.equal(result.status, 'idle')
  assert.equal(result.running, false)
  assert.equal(result.lastSeq, 3)
})

test('session_wait without sinceSeq waits for a turn that starts after the call', async () => {
  const events = [{ seq: 3, type: 'session' }]
  const laterTurn = turnEvents({ turn: 1, startSeq: 4, endSeq: 6, answer: '42' })
  let reads = 0
  const { ctx } = makeCtx({
    agentSeq: 4,
    agentEvents: () => {
      reads += 1
      if (reads === 2) events.push(...laterTurn)
      return [...events]
    }
  })
  const tool = createSessionWaitTool(ctx, { pollMs: 1 })
  const result = await tool.execute({ sessionId: SESSION_ID }, makeExec())
  assert.equal(result.status, 'answered')
  assert.equal(result.answer, '42')
})

test('session_wait refuses to wait on its own session', async () => {
  const { ctx } = makeCtx()
  const tool = createSessionWaitTool(ctx)
  await assert.rejects(
    tool.execute({ sessionId: 'session-caller' }, makeExec()),
    /own session/u
  )
})

test('session_archive archives every id and stops running work', async () => {
  const { ctx, calls } = makeCtx()
  const tool = createSessionArchiveTool(ctx)
  const result = await tool.execute({ sessionIds: ['session-a', 'session-b', 'session-a'] }, makeExec())
  assert.deepEqual(result.archived, ['session-a', 'session-b'])
  assert.deepEqual(result.failed, [])
  assert.deepEqual(calls.archive, [
    { sessionId: 'session-a', stopActivity: true },
    { sessionId: 'session-b', stopActivity: true }
  ])
})

test('session_archive keeps going after one id fails', async () => {
  const { ctx, calls } = makeCtx({ archiveFailsFor: 'session-bad' })
  const tool = createSessionArchiveTool(ctx)
  const result = await tool.execute({ sessionIds: ['session-bad', 'session-ok'], stopActivity: false }, makeExec())
  assert.deepEqual(result.archived, ['session-ok'])
  assert.equal(result.failed.length, 1)
  assert.equal(result.failed[0].sessionId, 'session-bad')
  assert.equal(calls.archive[0].stopActivity, undefined)
})

test('session_archive refuses the calling session and an empty list', async () => {
  const { ctx, calls } = makeCtx()
  const tool = createSessionArchiveTool(ctx)
  await assert.rejects(tool.execute({ sessionIds: [] }, makeExec()), /at least one/u)
  const refused = await tool.execute({ sessionIds: ['session-caller'] }, makeExec())
  assert.deepEqual(refused.archived, [])
  assert.equal(refused.failed[0].error, 'refused to archive the calling session')
  assert.equal(calls.archive.length, 0)
})

test('deriveTitle bounds CJK prompts by UTF-8 bytes', () => {
  const title = deriveTitle('这是一个非常非常长的中文研究任务标题需要被截断到四十字节以内才行')
  assert.ok(Buffer.byteLength(title, 'utf8') <= 40)
  assert.ok(title.length > 0)
  assert.notEqual(title, 'session')
})

test('deriveTitle keeps the first words of a Latin prompt', () => {
  assert.equal(deriveTitle('compare sqlite and postgres for a local ledger app'), 'compare sqlite and postgres for a')
})

test('resolvePresetId prefers the override, then the projection, then the header', () => {
  const exec = makeExec({ callerPreset: 'standard', callerHeaderPreset: 'from-header' })
  const { ctx } = makeCtx({ callerPreset: 'standard' })
  assert.equal(resolvePresetId(ctx, exec.agent, 'explicit'), 'explicit')
  assert.equal(resolvePresetId(ctx, exec.agent, undefined), 'standard')
  // A host without the projection falls back to the creation-time header.
  const bare = { get: () => undefined }
  assert.equal(resolvePresetId(bare, exec.agent, undefined), 'from-header')
})
