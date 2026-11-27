/**
 * context-hub 的宿主内桥。
 *
 * 装在**桌面宿主**（或任意 web 宿主）里，注册三条本地 HTTP 路由，让
 * context-hub 能在宿主进程内创建会话并投递任务。会话由宿主自己创建，所以
 * 它出现在侧栏、可以实时点开、可以手动插话或停止——这是把调度留在
 * context-hub、把执行放进桌面宿主的唯一受支持的接法。
 *
 * 为什么不走宿主的 /api：那条路由要求每次启动随机生成的 token，且只出现在
 * `dsh web` 打印的 URL 里。`@deepseek-ai/dsh-host-webserver` 的鉴权是**按路由**
 * 的，本插件注册的路由不受 `/api` 的 token 约束，只认自己配置的共享密钥。
 *
 * 路由：
 *   GET  /context-hub/health
 *   POST /context-hub/run                     { prompt, cwd? | workspacePath?, title?, sandbox?, approval?, addDirs? }
 *   GET  /context-hub/run/<sessionId>?sinceSeq=N
 *   POST /context-hub/run/<sessionId>/cancel
 *
 * 安全边界：桥只认共享密钥，**不按调用方做目录白名单**。任何拿到
 * `CONTEXT_HUB_BRIDGE_SECRET` 的本机进程，都能让宿主建出
 * `workspace-write + never` 的会话，并把任意目录登记成额外可写根。
 * 这在「同机同用户」威胁模型下可接受（能读密钥的人本来就能直接改文件），
 * 但它是有意识的取舍：不要把密钥放进共享脚本或多用户环境。
 *
 * @module dsh-context-hub-bridge
 */

import {randomUUID} from 'node:crypto'
import {readFileSync, writeFileSync} from 'node:fs'

export const name = 'context-hub-bridge'

/** 宿主必须先具备的服务：其余服务按可用性降级。 */
export const inject = ['webServer', 'sessionController', 'agents', 'workspaceRegistry', 'sessionTitle']

/** 路由前缀；前缀匹配同时覆盖 `/context-hub` 与 `/context-hub/...`。 */
const ROUTE_PREFIX = '/context-hub'

/** 请求体上限：任务 prompt 最长也就几十 KB，2 MiB 足够且能挡住误发的大包。 */
const MAX_BODY_BYTES = 2 * 1024 * 1024

/** prompt 字符上限，避免把一整份日志塞进会话。 */
const MAX_PROMPT_CHARS = 200_000

/**
 * 读取请求体。
 *
 * @param req Node 请求对象
 * @returns 文本；超过上限时抛错
 */
function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = []
		let size = 0
		req.on('data', (chunk) => {
			size += chunk.length
			if (size > MAX_BODY_BYTES) {
				reject(Object.assign(new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`), {status: 413}))
				req.destroy()
				return
			}
			chunks.push(chunk)
		})
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
		req.on('error', reject)
	})
}

/**
 * 写一个 JSON 响应。
 *
 * @param res Node 响应对象
 * @param status HTTP 状态码
 * @param value 可序列化对象
 */
function sendJson(res, status, value) {
	const text = JSON.stringify(value)
	res.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text)})
	res.end(text)
}

/** 从事件里取最后一条的 seq。 */
function lastSeqOf(events) {
	const last = events.length === 0 ? undefined : events[events.length - 1]
	return typeof last?.seq === 'number' && Number.isFinite(last.seq) ? last.seq : undefined
}

/** 把一条 message 的 content 折成文本。 */
function contentText(content) {
	if (!Array.isArray(content)) return ''
	const parts = []
	for (const block of content) {
		if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
	}
	return parts.join('\n').trim()
}

/** 某一轮最后一条非空 assistant 文本。 */
function answerForTurn(events, turn) {
	const texts = []
	for (const event of events) {
		if (event?.type !== 'assistant/message') continue
		if (event.data?.turn !== turn) continue
		const text = contentText(event.data?.message?.content)
		if (text !== '') texts.push(text)
	}
	return texts.length === 0 ? undefined : texts[texts.length - 1]
}

/**
 * 找到第一条「在 sinceSeq 之后开始、并且已经结束」的轮次。
 *
 * 早于 sinceSeq 开始的轮次会被跳过：那是这条消息排在后面的上一轮，不是它的
 * 答案。这段逻辑与 dsh-wizz-session 的 session_wait 同源，刻意保持一致。
 *
 * @param events 有序会话事件
 * @param sinceSeq 投递前捕获的日志偏移
 * @returns 该轮的结果，尚未结束则 undefined
 */
export function findAnsweredTurn(events, sinceSeq) {
	let open
	for (const event of events) {
		if (event?.type === 'turn/start') {
			open = {turn: event.data?.turn, startSeq: event.seq}
			continue
		}
		if (event?.type !== 'turn/end') continue
		const turn = event.data?.turn
		const started = open !== undefined && open.turn === turn ? open.startSeq : undefined
		open = undefined
		if (typeof started !== 'number' || started < sinceSeq) continue
		return {
			turn,
			seq: event.seq,
			endKind: event.data?.reason?.kind,
			answer: answerForTurn(events, turn)
		}
	}
	return undefined
}

/**
 * 读一个会话的事件日志：活着就读内存快照，否则走持久化句柄。
 *
 * @param ctx 插件上下文
 * @param sessionId 会话 id
 * @param signal 取消信号
 * @returns `{ events, live }`
 */
export async function readSessionEvents(ctx, sessionId, signal) {
	const live = ctx.agents.get(sessionId)
	const snapshot = live?.session?.snapshotEvents
	if (typeof snapshot === 'function') {
		try {
			const events = snapshot.call(live.session)
			if (Array.isArray(events)) return {events, live: true}
		} catch {
			// 已释放的会话退回持久化日志。
		}
	}
	const persistence = ctx.get?.('sessionPersistence')
	if (typeof persistence?.open === 'function') {
		let reader
		try {
			reader = await persistence.open(sessionId, 'read', {signal})
			const read = await reader.read(undefined, undefined, {signal})
			const events = Array.isArray(read) ? read : read?.events
			return {events: Array.isArray(events) ? events : [], live: false}
		} finally {
			try { await reader?.close?.() } catch { /* 已经关了 */ }
		}
	}
	const query = ctx.get?.('sessionQuery')
	if (typeof query?.readSession === 'function') {
		const read = await query.readSession(sessionId)
		const events = Array.isArray(read) ? read : read?.events
		return {events: Array.isArray(events) ? events : [], live: false}
	}
	throw new Error(`cannot read ${JSON.stringify(sessionId)}: the host exposes neither a live session nor session persistence`)
}

/**
 * 从 `?sinceSeq=` 里取偏移；缺省时返回 undefined，由调用方决定语义。
 *
 * @param url 解析后的 URL
 * @returns 数字或 undefined
 */
function sinceSeqOf(url) {
	const raw = url.searchParams.get('sinceSeq')
	if (raw === null || raw === '') return undefined
	const value = Number(raw)
	return Number.isFinite(value) && value >= 0 ? value : undefined
}

/**
 * 挂载桥。
 *
 * @param ctx 插件上下文
 * @param config 插件配置：`{ stateFile?, secret?, secretFile?, pollIntervalMs? }`
 */
export function apply(ctx, config = {}) {
	const secret = (() => {
		if (typeof config.secret === 'string' && config.secret !== '') return config.secret
		if (typeof config.secretFile === 'string' && config.secretFile !== '') {
			try { return readFileSync(config.secretFile, 'utf8').trim() } catch { /* 下面按未配置处理 */ }
		}
		return ''
	})()

	const logger = (() => {
		try { return ctx.logger('context-hub-bridge') } catch { return undefined }
	})()

	/** 会话 → sandbox 额外根的 disposer。轮次结束时释放，避免宿主常驻时越攒越多。 */
	const grants = new Map()

	/** 释放某个会话的额外可写根；重复调用安全。 */
	const releaseGrants = (sessionId) => {
		const disposers = grants.get(sessionId)
		if (disposers === undefined) return
		grants.delete(sessionId)
		for (const dispose of disposers) {
			try { dispose() } catch { /* 已释放 */ }
		}
	}

	if (secret === '') {
		logger?.warn?.('no secret configured; every request will be refused')
	}

	/** 把监听端口写进发现文件，供 context-hub 读取。 */
	const publish = () => {
		if (typeof config.stateFile !== 'string' || config.stateFile === '') return
		let port
		try { port = ctx.webServer.port } catch { return }
		if (typeof port !== 'number' || port <= 0) return
		let origin
		try { origin = ctx.webServer.getOrigin() } catch { origin = `http://127.0.0.1:${port}` }
		try {
			writeFileSync(config.stateFile, JSON.stringify({
				pid: process.pid,
				port,
				origin,
				basePath: ROUTE_PREFIX,
				updatedAt: new Date().toISOString()
			}, null, 2), {mode: 0o600})
		} catch (error) {
			logger?.warn?.(`cannot write ${config.stateFile}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	// 监听发生在 webserver 自己的激活里，可能晚于本插件；先试一次再短轮询。
	publish()
	let attempts = 0
	const timer = setInterval(() => {
		publish()
		if (++attempts >= 40 || (() => { try { return typeof ctx.webServer.port === 'number' } catch { return false } })()) clearInterval(timer)
	}, 250)
	timer.unref?.()

	const authorized = (req) => secret !== '' && req.headers['x-context-hub-secret'] === secret

	/**
	 * 创建会话并投递第一条消息。
	 *
	 * @param body 请求体对象
	 * @returns 给调用方的描述
	 */
	const submit = async (body) => {
		const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
		if (prompt === '') throw Object.assign(new Error('prompt must be a non-empty string'), {status: 400})
		if (prompt.length > MAX_PROMPT_CHARS) throw Object.assign(new Error(`prompt exceeds ${MAX_PROMPT_CHARS} characters`), {status: 400})

		const workspacePath = typeof body?.workspacePath === 'string' && body.workspacePath.trim() !== '' ? body.workspacePath.trim() : undefined
		const cwd = typeof body?.cwd === 'string' && body.cwd.trim() !== '' ? body.cwd.trim() : undefined
		if (workspacePath === undefined && cwd === undefined) throw Object.assign(new Error('pass cwd or workspacePath'), {status: 400})

		// 先按目录找已注册工作区：这样会话落在侧栏对应分组里，而不是未分组。
		let workspace
		if (workspacePath !== undefined && cwd === undefined) {
			try { workspace = await ctx.workspaceRegistry.resolveByPath(workspacePath) } catch { workspace = undefined }
		} else if (cwd !== undefined) {
			try { workspace = await ctx.workspaceRegistry.resolveByPath(cwd) } catch { workspace = undefined }
		}

		const created = await ctx.sessionController.create(workspace === undefined ? {cwd: cwd ?? workspacePath} : {workspaceId: String(workspace.id)})
		const sessionId = String(created?.sessionId ?? '')
		if (sessionId === '') throw new Error('the host returned no session id')

		const title = typeof body?.title === 'string' && body.title.trim() !== '' ? body.title.trim().slice(0, 120) : undefined
		if (title !== undefined) {
			try {
				const live = ctx.agents.get(sessionId)
				if (live?.session !== undefined) ctx.sessionTitle.rename(live.session, title)
			} catch {
				// 标题只是展示，失败不该让任务失败。
			}
		}

		const permission = typeof body?.permission === 'string' && body.permission.trim() !== '' ? body.permission.trim() : undefined
		const sandbox = typeof body?.sandbox === 'string' && body.sandbox.trim() !== '' ? body.sandbox.trim() : undefined
		const approval = typeof body?.approval === 'string' && body.approval.trim() !== '' ? body.approval.trim() : undefined
		if (permission !== undefined || sandbox !== undefined || approval !== undefined) {
			const presets = ctx.get?.('permissionPresets')
			if (presets === undefined) throw new Error('host composes no permissionPresets service; cannot apply a permission preset')

			// 预设是部署侧配置的「sandbox + approval」捆绑。调用方给的是两个独立开关，
			// 这里按值反查名字，于是上下文不需要知道本机预设表里有哪几个名字。
			let name = permission
			if (name === undefined) {
				name = presets.names.find((candidate) => {
					const spec = presets.resolve(candidate)
					return spec.sandbox === sandbox && spec.approval === approval
				})
				if (name === undefined) {
					const available = presets.names
						.map((candidate) => {
							const spec = presets.resolve(candidate)
							return `${candidate}(${spec.sandbox}+${spec.approval})`
						})
						.join(', ')
					throw Object.assign(new Error(`no preset matches sandbox=${sandbox} approval=${approval}; configured: ${available}`), {status: 400})
				}
			}

			presets.resolve(name)
			const live = ctx.agents.get(sessionId)
			if (live?.session === undefined) throw new Error(`session ${sessionId} is not live; cannot apply ${JSON.stringify(name)}`)
			presets.set(live.session, name)
		}

		// 额外可写目录按会话注册。sandbox 的 workspace-write 边界是会话 cwd，
		// materials 这类外置目录必须显式登记，否则写操作会被拒。
		const addDirs = Array.isArray(body?.addDirs) ? body.addDirs.filter((dir) => typeof dir === 'string' && dir.trim() !== '') : []
		if (addDirs.length > 0) {
			const sandboxPolicy = ctx.get?.('sandboxPolicy')
			if (sandboxPolicy === undefined) {
				throw new Error('host composes no sandboxPolicy service; cannot grant addDirs')
			}
			const live = ctx.agents.get(sessionId)
			if (live?.session === undefined) throw new Error(`session ${sessionId} is not live; cannot grant addDirs`)
			const disposers = []
			for (const dir of addDirs) disposers.push(sandboxPolicy.registerWritableRoot(live.session, dir))
			grants.set(sessionId, [...(grants.get(sessionId) ?? []), ...disposers])
		}

		// sinceSeq 必须总有值：缺了它，调用方无法区分「这条任务的轮次」和上一轮，
		// 会把历史答案当成这次的结果。
		const sinceSeq = (() => {
			const seq = ctx.agents.get(sessionId)?.session?.seq
			if (typeof seq === 'number' && Number.isFinite(seq)) return seq
			try {
				const events = ctx.agents.get(sessionId)?.session?.snapshotEvents?.()
				const last = Array.isArray(events) && events.length > 0 ? events[events.length - 1] : undefined
				if (typeof last?.seq === 'number' && Number.isFinite(last.seq)) return last.seq
			} catch {
				// 落到 0：至少保证语义是「从头开始找这一轮」。
			}
			return 0
		})()

		await ctx.sessionController.prompt({
			requestId: randomUUID(),
			sessionId,
			mode: 'queue',
			content: [{type: 'text', text: prompt}]
		}, new AbortController().signal)

		return {
			sessionId,
			sinceSeq,
			...(title === undefined ? {} : {title}),
			...(workspace === undefined ? {cwd: cwd ?? workspacePath} : {
				workspaceId: String(workspace.id),
				workspacePath: String(workspace.path),
				workspaceTitle: String(workspace.title)
			})
		}
	}

	/**
	 * 读一次任务状态。
	 *
	 * @param sessionId 会话 id
	 * @param sinceSeq 投递前捕获的日志偏移；缺省时按「从现在开始」处理
	 * @returns 状态描述
	 */
	const status = async (sessionId, sinceSeq) => {
		const {events, live} = await readSessionEvents(ctx, sessionId, new AbortController().signal)
		const lastSeq = lastSeqOf(events)
		const offset = sinceSeq ?? (typeof lastSeq === 'number' ? lastSeq + 1 : 0)
		const hit = findAnsweredTurn(events, offset)
		if (hit !== undefined) {
			releaseGrants(sessionId)
			return {
				sessionId,
				status: 'answered',
				running: false,
				runningKnown: live,
				...(hit.answer === undefined ? {} : {answer: hit.answer}),
				turn: hit.turn,
				...(hit.endKind === undefined ? {} : {turnEndKind: String(hit.endKind)}),
				seq: hit.seq,
				...(lastSeq === undefined ? {} : {lastSeq})
			}
		}
		return {
			sessionId,
			status: live ? 'running' : 'idle',
			running: live,
			runningKnown: true,
			...(lastSeq === undefined ? {} : {lastSeq})
		}
	}

	/**
	 * 取消当前轮次。
	 *
	 * @param sessionId 会话 id
	 * @returns `{ cancelled }`
	 */
	const cancel = async (sessionId) => {
		// 不是「发了 cancel 就一定取消了」：会话可能早就结束，也可能从没活过。
		// 如实回报，调用方才能区分「取消成功」和「本来就不需要取消」。
		const live = ctx.agents.get(sessionId)
		if (live === undefined) return {sessionId, cancelled: false, reason: 'session is not live'}
		await ctx.sessionController.cancel({sessionId})
		releaseGrants(sessionId)
		return {sessionId, cancelled: true}
	}

	const route = async (req, res) => {
		publish()
		if (!authorized(req)) {
			sendJson(res, 403, {error: 'missing or wrong x-context-hub-secret'})
			return
		}
		const url = new URL(req.url ?? '', 'http://127.0.0.1')
		const rest = url.pathname.slice(ROUTE_PREFIX.length).replace(/^\/+/, '')
		const parts = rest === '' ? [] : rest.split('/').filter((part) => part !== '')

		try {
			if (parts.length === 1 && parts[0] === 'health' && req.method === 'GET') {
				let port
				try { port = ctx.webServer.port } catch { port = undefined }
				sendJson(res, 200, {ok: true, pid: process.pid, ...(port === undefined ? {} : {port})})
				return
			}
			if (parts.length === 1 && parts[0] === 'run' && req.method === 'POST') {
				const raw = await readBody(req)
				let body
				try {
					body = JSON.parse(raw || '{}')
				} catch (error) {
					throw Object.assign(new Error(`invalid JSON body: ${error instanceof Error ? error.message : String(error)}`), {status: 400})
				}
				sendJson(res, 200, await submit(body))
				return
			}
			if (parts.length === 2 && parts[0] === 'run' && req.method === 'GET') {
				sendJson(res, 200, await status(decodeURIComponent(parts[1]), sinceSeqOf(url)))
				return
			}
			if (parts.length === 3 && parts[0] === 'run' && parts[2] === 'cancel' && req.method === 'POST') {
				sendJson(res, 200, await cancel(decodeURIComponent(parts[1])))
				return
			}
			sendJson(res, 404, {error: `no route for ${req.method} ${url.pathname}`})
		} catch (error) {
			const statusCode = typeof error?.status === 'number' ? error.status : 500
			logger?.warn?.(`${req.method} ${url.pathname} failed: ${error instanceof Error ? error.message : String(error)}`)
			sendJson(res, statusCode, {error: error instanceof Error ? error.message : String(error)})
		}
	}

	ctx.webServer.register({kind: 'prefix', path: ROUTE_PREFIX, handler: route})
}
