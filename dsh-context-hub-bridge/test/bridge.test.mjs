/** context-hub 桥的单元测试：用假宿主验证鉴权、投递、状态与取消。 */

import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {apply, findAnsweredTurn} from '../lib/index.js'

/**
 * 造一个假请求。
 *
 * @param options 请求参数
 * @returns 带 method/url/headers 的 EventEmitter
 */
function fakeReq({method = 'GET', url = '/context-hub/health', headers = {}, body = ''} = {}) {
	const req = new EventEmitter()
	req.method = method
	req.url = url
	req.headers = headers
	req.destroy = () => {}
	queueMicrotask(() => {
		if (body !== '') req.emit('data', Buffer.from(body))
		req.emit('end')
	})
	return req
}

/** 造一个假响应，记下状态码与正文。 */
function fakeRes() {
	return {
		statusCode: 0,
		headers: {},
		body: '',
		writeHead(status, headers) {
			this.statusCode = status
			this.headers = headers ?? {}
		},
		end(text) {
			this.body = text ?? ''
		}
	}
}

/**
 * 造一个假宿主并挂上桥。
 *
 * @param options 覆盖项：事件日志、工作区、权限预设
 * @returns `{ route, calls }`
 */
function mount({events = [], workspace, presets, grants} = {}) {
	const calls = {create: [], prompt: [], cancel: [], rename: [], writableRoot: [], disposed: []}
	const dir = mkdtempSync(path.join(tmpdir(), 'ch-bridge-'))
	const routes = []
	const presetService = presets ?? {
		names: ['workspace-write', 'unattended', 'danger-full-access'],
		resolve(name) {
			const table = {
				'workspace-write': {sandbox: 'workspace-write', approval: 'ask'},
				unattended: {sandbox: 'workspace-write', approval: 'never'},
				'danger-full-access': {sandbox: 'danger-full-access', approval: 'never'}
			}
			const spec = table[name]
			if (spec === undefined) throw new Error(`unknown preset ${name}`)
			return spec
		},
		set() {},
		current() {}
	}
	const service = (name) => {
		if (name === 'permissionPresets') return presetService
		if (name === 'sandboxPolicy' && grants === true) {
			return {
				registerWritableRoot(_session, dir) {
					calls.writableRoot.push(dir)
					return () => calls.disposed.push(dir)
				}
			}
		}
		return undefined
	}
	const ctx = {
		webServer: {
			register(route) {
				routes.push(route)
				return () => {}
			},
			get port() {
				return 54321
			},
			getOrigin() {
				return 'http://127.0.0.1:54321'
			}
		},
		sessionController: {
			async create(options) {
				calls.create.push(options)
				return {sessionId: 'session-test'}
			},
			async prompt(options) {
				calls.prompt.push(options)
				return {accepted: true}
			},
			async cancel(options) {
				calls.cancel.push(options)
				return {}
			}
		},
		agents: {
			get() {
				return {session: {seq: 4, snapshotEvents: () => events}}
			}
		},
		workspaceRegistry: {
			async resolveByPath() {
				return workspace
			},
			list() {
				return workspace === undefined ? [] : [workspace]
			}
		},
		sessionTitle: {
			rename(_session, title) {
				calls.rename.push(title)
				return {title}
			}
		},
		get: service,
		logger: () => ({warn() {}, info() {}})
	}
	apply(ctx, {secret: 's3cret', stateFile: path.join(dir, 'bridge.json')})
	assert.equal(routes.length, 1)
	assert.equal(routes[0].kind, 'prefix')
	assert.equal(routes[0].path, '/context-hub')
	return {route: routes[0].handler, calls, dir, cleanup: () => rmSync(dir, {recursive: true, force: true})}
}

const AUTH = {'x-context-hub-secret': 's3cret'}

test('缺少或错误的密钥一律 403', async () => {
	const {route, cleanup} = mount()
	try {
		for (const headers of [{}, {'x-context-hub-secret': 'wrong'}]) {
			const res = fakeRes()
			await route(fakeReq({headers}), res)
			assert.equal(res.statusCode, 403)
			assert.match(JSON.parse(res.body).error, /secret/)
		}
	} finally {
		cleanup()
	}
})

test('提交任务：创建会话、设标题、投递 prompt', async () => {
	const workspace = {id: 'ws-1', path: '/tmp/repo', title: 'repo'}
	const {route, calls, cleanup} = mount({workspace})
	try {
		const res = fakeRes()
		await route(fakeReq({
			method: 'POST',
			url: '/context-hub/run',
			headers: AUTH,
			body: JSON.stringify({prompt: 'hello', title: '自检', workspacePath: '/tmp/repo', permission: 'workspace-write'})
		}), res)

		assert.equal(res.statusCode, 200)
		const value = JSON.parse(res.body)
		assert.equal(value.sessionId, 'session-test')
		assert.equal(value.sinceSeq, 4)
		assert.equal(value.workspaceId, 'ws-1')
		assert.deepEqual(calls.create, [{workspaceId: 'ws-1'}])
		assert.deepEqual(calls.rename, ['自检'])
		assert.equal(calls.prompt.length, 1)
		assert.equal(calls.prompt[0].content[0].text, 'hello')
		assert.equal(calls.prompt[0].mode, 'queue')
		assert.equal(typeof calls.prompt[0].requestId, 'string')
	} finally {
		cleanup()
	}
})

test('按 sandbox+approval 反查预设名，未知组合 400', async () => {
	const calls = {set: []}
	const presets = {
		names: ['workspace-write', 'unattended', 'danger-full-access'],
		resolve(name) {
			const table = {
				'workspace-write': {sandbox: 'workspace-write', approval: 'ask'},
				unattended: {sandbox: 'workspace-write', approval: 'never'},
				'danger-full-access': {sandbox: 'danger-full-access', approval: 'never'}
			}
			if (table[name] === undefined) throw new Error('unknown')
			return table[name]
		},
		set(_session, name) {
			calls.set.push(name)
		},
		current() {}
	}
	const {route, cleanup} = mount({presets})
	try {
		const ok = fakeRes()
		await route(fakeReq({
			method: 'POST',
			url: '/context-hub/run',
			headers: AUTH,
			body: JSON.stringify({prompt: 'go', cwd: '/tmp', sandbox: 'workspace-write', approval: 'never'})
		}), ok)
		assert.equal(ok.statusCode, 200)
		assert.deepEqual(calls.set, ['unattended'])

		const bad = fakeRes()
		await route(fakeReq({
			method: 'POST',
			url: '/context-hub/run',
			headers: AUTH,
			body: JSON.stringify({prompt: 'go', cwd: '/tmp', sandbox: 'read-only', approval: 'never'})
		}), bad)
		assert.equal(bad.statusCode, 400)
		assert.match(JSON.parse(bad.body).error, /no preset matches/)
	} finally {
		cleanup()
	}
})

test('没有注册工作区时退回 cwd 建会话', async () => {
	const {route, calls, cleanup} = mount()
	try {
		const res = fakeRes()
		await route(fakeReq({
			method: 'POST',
			url: '/context-hub/run',
			headers: AUTH,
			body: JSON.stringify({prompt: 'hi', cwd: '/tmp/loose'})
		}), res)
		assert.equal(res.statusCode, 200)
		assert.deepEqual(calls.create, [{cwd: '/tmp/loose'}])
		assert.equal(JSON.parse(res.body).cwd, '/tmp/loose')
	} finally {
		cleanup()
	}
})

test('缺少 prompt 或目录时 400', async () => {
	const {route, calls, cleanup} = mount()
	try {
		const empty = fakeRes()
		await route(fakeReq({method: 'POST', url: '/context-hub/run', headers: AUTH, body: JSON.stringify({cwd: '/tmp'})}), empty)
		assert.equal(empty.statusCode, 400)

		const noDir = fakeRes()
		await route(fakeReq({method: 'POST', url: '/context-hub/run', headers: AUTH, body: JSON.stringify({prompt: 'x'})}), noDir)
		assert.equal(noDir.statusCode, 400)

		assert.equal(calls.create.length, 0)
	} finally {
		cleanup()
	}
})

test('addDirs 按会话注册成额外可写根，轮次结束释放', async () => {
	const events = [
		{type: 'turn/start', seq: 5, data: {turn: 1}},
		{type: 'turn/end', seq: 9, data: {turn: 1, reason: {kind: 'completed'}}}
	]
	const {route, calls, cleanup} = mount({events, grants: true})
	try {
		const submit = fakeRes()
		await route(fakeReq({
			method: 'POST',
			url: '/context-hub/run',
			headers: AUTH,
			body: JSON.stringify({prompt: 'go', cwd: '/tmp', addDirs: ['/tmp/materials']})
		}), submit)
		assert.equal(submit.statusCode, 200)
		assert.deepEqual(calls.writableRoot, ['/tmp/materials'])
		assert.deepEqual(calls.disposed, [])

		const status = fakeRes()
		await route(fakeReq({url: '/context-hub/run/session-test?sinceSeq=4', headers: AUTH}), status)
		assert.equal(JSON.parse(status.body).status, 'answered')
		assert.deepEqual(calls.disposed, ['/tmp/materials'])
	} finally {
		cleanup()
	}
})

test('请求 addDirs 但宿主没有 sandboxPolicy 时失败而不是静默少给权限', async () => {
	const {route, calls, cleanup} = mount()
	try {
		const res = fakeRes()
		await route(fakeReq({
			method: 'POST',
			url: '/context-hub/run',
			headers: AUTH,
			body: JSON.stringify({prompt: 'go', cwd: '/tmp', addDirs: ['/tmp/materials']})
		}), res)
		assert.equal(res.statusCode, 500)
		assert.match(JSON.parse(res.body).error, /sandboxPolicy/)
		assert.equal(calls.prompt.length, 0)
	} finally {
		cleanup()
	}
})

test('状态：轮次结束后返回该轮答案', async () => {
	const events = [
		{type: 'turn/start', seq: 5, data: {turn: 1}},
		{type: 'assistant/message', seq: 7, data: {turn: 1, message: {content: [{type: 'text', text: '收到'}]}}},
		{type: 'turn/end', seq: 9, data: {turn: 1, reason: {kind: 'completed'}}}
	]
	const {route, cleanup} = mount({events})
	try {
		const res = fakeRes()
		await route(fakeReq({url: '/context-hub/run/session-test?sinceSeq=4', headers: AUTH}), res)
		assert.equal(res.statusCode, 200)
		const value = JSON.parse(res.body)
		assert.equal(value.status, 'answered')
		assert.equal(value.answer, '收到')
		assert.equal(value.turnEndKind, 'completed')
		assert.equal(value.lastSeq, 9)
	} finally {
		cleanup()
	}
})

test('状态：投递前的上一轮不算答案', async () => {
	const events = [
		{type: 'turn/start', seq: 1, data: {turn: 1}},
		{type: 'assistant/message', seq: 2, data: {turn: 1, message: {content: [{type: 'text', text: '旧答案'}]}}},
		{type: 'turn/end', seq: 3, data: {turn: 1, reason: {kind: 'completed'}}},
		{type: 'turn/start', seq: 5, data: {turn: 2}}
	]
	const {route, cleanup} = mount({events})
	try {
		const res = fakeRes()
		await route(fakeReq({url: '/context-hub/run/session-test?sinceSeq=4', headers: AUTH}), res)
		const value = JSON.parse(res.body)
		assert.equal(value.status, 'running')
		assert.equal(value.turn, undefined)
	} finally {
		cleanup()
	}
})

test('取消转发到 sessionController.cancel', async () => {
	const {route, calls, cleanup} = mount()
	try {
		const res = fakeRes()
		await route(fakeReq({method: 'POST', url: '/context-hub/run/session-test/cancel', headers: AUTH}), res)
		assert.equal(res.statusCode, 200)
		assert.deepEqual(calls.cancel, [{sessionId: 'session-test'}])
	} finally {
		cleanup()
	}
})

test('findAnsweredTurn 越过后再开一轮就取新轮', () => {
	const events = [
		{type: 'turn/start', seq: 1, data: {turn: 1}},
		{type: 'turn/end', seq: 3, data: {turn: 1, reason: {kind: 'aborted'}}},
		{type: 'turn/start', seq: 5, data: {turn: 2}},
		{type: 'turn/end', seq: 8, data: {turn: 2, reason: {kind: 'completed'}}}
	]
	const hit = findAnsweredTurn(events, 4)
	assert.equal(hit?.turn, 2)
	assert.equal(hit?.endKind, 'completed')
})
