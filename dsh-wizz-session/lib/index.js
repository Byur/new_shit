/**
 * dsh-wizz-session — spawn an independent, workspace-attached session from an
 * agent tool.
 *
 * Why this exists: a scheduled automation (task A) needs to fan work out into
 * N research sessions that the person can see in the sidebar under the project
 * workspace, open, and continue. `dsh headless` creates sessions that are not
 * attached to any workspace (they land in "Ungrouped"), and the app's HTTP API
 * is gated by a per-process launch token that no separate process can read.
 * A host plugin runs inside the app process, so it can call the same session
 * controller the GUI uses and get a real workspace member.
 *
 * Two behaviours mirror New Session in the GUI:
 *  - an omitted `workspacePath` inherits the calling session's workspace, so
 *    the new session appears under the same sidebar group;
 *  - `permission` applies one of the host's permission presets (read-only /
 *    workspace-write / danger-full-access) before the first message runs.
 *
 * Design constraints, in order of importance:
 *  - zero runtime dependencies: only `node:` built-ins are imported, so the
 *    plugin loads under whatever harness build the profile runs, and a harness
 *    version bump does not invalidate a peer range;
 *  - no approval prompt: this is a tool for trusted local automation, and a
 *    prompt would stall an unattended run. The tool is registered only inside
 *    the profile it is installed into;
 *  - never leave a half-created session behind in the sidebar: when a later
 *    step fails, the session is archived and detached, and the error names the
 *    session id.
 *
 * @module dsh-wizz-session
 */

import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

/** Cordis plugin name. */
export const name = 'wizz-session'

/**
 * Host services this plugin needs. All are host-wide (profile root) services:
 * the agent factory publishes the session, `sessionController` is the exact
 * entry point the GUI uses to create one, `workspaceRegistry` owns membership,
 * and `sessionTitle` pins the title we choose.
 */
export const inject = ['tools', 'agents', 'sessionController', 'workspaceRegistry', 'sessionTitle']

/** Model-facing tool name. */
const TOOL_NAME = 'session_spawn'

/** Title derivation limits, matching the host's own fallback shape. */
const TITLE_MAX_WORDS = 6
const TITLE_MAX_BYTES = 40

/**
 * The permission presets this tool can grant, in the order the app's picker
 * shows them. Each name is a host-configured bundle of a sandbox mode and an
 * approval policy; the desktop profile configures exactly these three.
 */
export const PERMISSION_PRESETS = ['read-only', 'workspace-write', 'danger-full-access']

/** Human labels matching the Chinese UI's 仅可查看 / 工作区内修改 / 完全权限. */
const PERMISSION_LABELS = {
	'read-only': '仅可查看',
	'workspace-write': '工作区内修改',
	'danger-full-access': '完全权限'
}

/**
 * Spelling variants accepted for `permission` so a caller can pass the GUI
 * label or a short English word and still get the canonical preset name.
 */
const PERMISSION_ALIASES = new Map([
	['readonly', 'read-only'],
	['read', 'read-only'],
	['view', 'read-only'],
	['仅可查看', 'read-only'],
	['只读', 'read-only'],
	['workspace', 'workspace-write'],
	['write', 'workspace-write'],
	['workspacewrite', 'workspace-write'],
	['工作区内修改', 'workspace-write'],
	['工作区', 'workspace-write'],
	['full', 'danger-full-access'],
	['fullaccess', 'danger-full-access'],
	['danger', 'danger-full-access'],
	['dangerfullaccess', 'danger-full-access'],
	['完全权限', 'danger-full-access'],
	['全部权限', 'danger-full-access']
])

/**
 * Canonicalize a `permission` argument: an exact preset name, a known alias,
 * or undefined when nothing matches.
 *
 * @param value - the tool argument.
 * @returns a preset name from {@link PERMISSION_PRESETS}, or undefined.
 */
export function normalizePermission(value) {
	if (typeof value !== 'string') return undefined
	const trimmed = value.trim()
	if (trimmed === '') return undefined
	const lower = trimmed.toLowerCase()
	if (PERMISSION_PRESETS.includes(lower)) return lower
	return PERMISSION_ALIASES.get(lower) ?? PERMISSION_ALIASES.get(trimmed)
}

/**
 * Pick the preset a new session should start on: an explicit override, then
 * the caller's current preset, then the caller's creation-time preset. The
 * session controller resolves the profile default when nothing is passed.
 *
 * @param ctx - plugin context.
 * @param agent - the calling agent.
 * @param override - `preset` argument from the tool call, if any.
 * @returns a preset id, or undefined to let the host pick.
 */
export function resolvePresetId(ctx, agent, override) {
	if (typeof override === 'string' && override.trim() !== '') return override.trim()
	try {
		// Newer hosts expose the live preset as a Session projection; `stateOf` is
		// deprecated in favour of a registration handle, but it is still the
		// cheapest read that reflects a preset switched after creation.
		const projections = ctx.get?.('sessionProjections')
		const current = projections?.stateOf?.(agent?.session, 'agentPreset')
		if (typeof current === 'string' && current !== '') return current
	} catch {
		// A host without that projection simply falls through to the header.
	}
	const headerPreset = agent?.session?.header?.agentPreset
	return typeof headerPreset === 'string' && headerPreset !== '' ? headerPreset : undefined
}

/**
 * Resolve the workspace the calling session belongs to, so an omitted
 * `workspacePath` behaves like New Session in the GUI: the new session lands
 * under the caller's own workspace instead of "Ungrouped".
 *
 * The registry has no by-session lookup, so membership is read through
 * `list()` exactly as the host does. A caller whose recorded directory is a
 * registered workspace also attaches there even when it is not accounted to
 * that workspace yet (for example a session minted by `dsh headless` inside
 * the project directory), which is the closest host-side equivalent of the
 * GUI's "current session's workspace" default.
 *
 * @param ctx - plugin context providing the workspace registry.
 * @param agent - the calling agent.
 * @returns the caller's workspace entity, or undefined when it has none.
 */
export async function resolveCallerWorkspace(ctx, agent) {
	const callerIds = [...new Set([
		String(agent?.id ?? ''),
		String(agent?.session?.header?.id ?? '')
	].filter((id) => id !== ''))]
	const listed = ctx.workspaceRegistry.list?.() ?? []
	for (const workspace of listed) {
		const members = Array.isArray(workspace?.sessionIds) ? workspace.sessionIds : []
		if (callerIds.some((id) => members.includes(id))) return workspace
	}
	const cwd = agent?.session?.header?.cwd
	if (typeof cwd === 'string' && cwd !== '' && typeof ctx.workspaceRegistry.resolveByPath === 'function') {
		try {
			const byPath = await ctx.workspaceRegistry.resolveByPath(cwd)
			if (byPath !== undefined) return byPath
		} catch {
			// An unregistered or unreachable directory simply means no workspace.
		}
	}
	return undefined
}

/**
 * Validate one `permission` argument against the host's advertised presets
 * before any session is created, so a bad name never leaves a default
 * session behind. The host pins a new-session default at creation, so the
 * only supported way to override it is the permission-preset service's own
 * write path — never raw sandbox/approval events, which record no preset
 * identity and would show up as `custom` in the GUI.
 *
 * @param ctx - plugin context.
 * @param requested - the `permission` argument.
 * @returns the service and the canonical preset name to apply.
 */
export function resolvePermissionGrant(ctx, requested) {
	const name = normalizePermission(requested)
	if (name === undefined) {
		throw new Error(`${TOOL_NAME} does not know permission ${JSON.stringify(requested)}; use read-only (仅可查看), workspace-write (工作区内修改), or danger-full-access (完全权限)`)
	}
	const permissions = ctx.get?.('permissionPresets')
	if (permissions === undefined) {
		throw new Error(`${TOOL_NAME} cannot set permission ${JSON.stringify(name)}: this host composes no permissionPresets service. Omit permission to keep the host new-session default.`)
	}
	try {
		permissions.resolve(name)
	} catch (error) {
		const known = Array.isArray(permissions.names) && permissions.names.length > 0 ? ` (this host offers: ${permissions.names.join(', ')})` : ''
		throw new Error(`${TOOL_NAME} cannot set permission ${JSON.stringify(name)}: ${error instanceof Error ? error.message : String(error)}${known}`)
	}
	return { permissions, name }
}

/**
 * The permission the host currently reports for a session, or undefined when
 * this composition cannot answer (no service, no live session, or a failure).
 *
 * @param ctx - plugin context.
 * @param sessionId - the session to read.
 * @returns the effective preset name, possibly `custom`.
 */
export function currentPermissionOf(ctx, sessionId) {
	const permissions = ctx.get?.('permissionPresets')
	if (typeof permissions?.current !== 'function') return undefined
	const live = ctx.agents.get(sessionId)
	if (live?.session === undefined) return undefined
	try {
		const current = permissions.current(live.session)
		return typeof current === 'string' && current !== '' ? current : undefined
	} catch {
		return undefined
	}
}

/**
 * Take a half-created session back out of the sidebar without deleting
 * anything: archive it (the persistence seam has no deletion API, archiving
 * hides the row and is reversible), then detach it from its workspace when
 * that workspace made it a member. Both calls are best effort, so a host that
 * composes no workspace controller still gets the detach attempt.
 *
 * @param ctx - plugin context.
 * @param sessionId - the session to discard.
 * @param workspace - the workspace it was attached to, if any.
 */
async function discardSession(ctx, sessionId, workspace) {
	const controller = ctx.get?.('workspaceController')
	if (typeof controller?.archiveSession === 'function') {
		try { await controller.archiveSession({ sessionId, stopActivity: true }) } catch { /* best effort */ }
	}
	if (workspace !== undefined) {
		try { await workspace.detachSession(sessionId) } catch { /* best effort */ }
	}
}

/**
 * The id of a session a failed create left behind. The host creates the
 * session before it attaches it to the workspace, so an attach failure throws
 * with the already-minted id; reclaiming it is the difference between a clean
 * failure and an orphan row.
 *
 * @param error - the error `sessionController.create` threw.
 * @returns the leftover session id, or undefined when none is named.
 */
function discardableSessionId(error) {
	const details = error?.details
	if (details !== null && typeof details === 'object' && typeof details.sessionId === 'string' && details.sessionId !== '') {
		return details.sessionId
	}
	const message = error instanceof Error ? error.message : String(error ?? '')
	if (!/was created|created session/iu.test(message)) return undefined
	return /session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/u.exec(message)?.[0]
}

/**
 * Turn a prompt into a stable, short title. The host normalizes titles again,
 * so this only has to be close: the first few words, bounded in UTF-8 bytes so
 * a CJK prompt becomes a readable prefix instead of a rejected title.
 *
 * @param prompt - the session's first message.
 * @returns a non-empty title.
 */
export function deriveTitle(prompt) {
	const words = String(prompt ?? '').trim().split(/\s+/u).slice(0, TITLE_MAX_WORDS).join(' ')
	let out = ''
	for (const character of Array.from(words)) {
		if (Buffer.byteLength(out + character, 'utf8') > TITLE_MAX_BYTES) break
		out += character
	}
	const trimmed = out.trim()
	return trimmed === '' ? 'session' : trimmed
}

/** Join the text blocks of one message content array. */
function contentText(content) {
	if (!Array.isArray(content)) return ''
	const parts = []
	for (const block of content) {
		if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
	}
	return parts.join('\n').trim()
}

/**
 * The sequence number a live session will assign to its next event. Captured
 * before delivery and handed back as `sinceSeq`, so a later wait can tell which
 * turn the delivered message belongs to.
 *
 * @param ctx - plugin context.
 * @param sessionId - the session whose log offset to read.
 * @returns the next sequence number, or undefined when the session is not live.
 */
export function liveSessionSeq(ctx, sessionId) {
	const live = ctx.agents.get(sessionId)
	const seq = live?.session?.seq
	return typeof seq === 'number' && Number.isFinite(seq) ? seq : undefined
}

/**
 * Read one session's event log without resuming, prompting, or mutating it: the
 * live in-memory snapshot when the session is attached, otherwise a read-only
 * persistence handle (or a query fallback).
 *
 * @param ctx - plugin context.
 * @param sessionId - session to read.
 * @param signal - caller cancellation.
 * @returns the events and whether a live agent served them.
 */
export async function readSessionEvents(ctx, sessionId, signal) {
	const live = ctx.agents.get(sessionId)
	const snapshot = live?.session?.snapshotEvents
	if (typeof snapshot === 'function') {
		try {
			const events = snapshot.call(live.session)
			if (Array.isArray(events)) return { events, live: true }
		} catch {
			// A disposed session falls through to the durable log.
		}
	}
	const persistence = ctx.get?.('sessionPersistence')
	if (typeof persistence?.open === 'function') {
		let reader
		try {
			reader = await persistence.open(sessionId, 'read', { signal })
			const read = await reader.read(undefined, undefined, { signal })
			const events = Array.isArray(read) ? read : read?.events
			return { events: Array.isArray(events) ? events : [], live: false }
		} finally {
			try { await reader?.close?.() } catch { /* already closed */ }
		}
	}
	const query = ctx.get?.('sessionQuery')
	if (typeof query?.readSession === 'function') {
		const read = await query.readSession(sessionId)
		const events = Array.isArray(read) ? read : read?.events
		return { events: Array.isArray(events) ? events : [], live: false }
	}
	throw new Error(`session_wait cannot read ${JSON.stringify(sessionId)}: this host exposes neither a live session nor session persistence`)
}

/** The first sequence number not yet logged, for a wait that starts now. */
async function nextSeqOf(ctx, sessionId, signal) {
	const { events } = await readSessionEvents(ctx, sessionId, signal)
	const last = events.length === 0 ? undefined : events[events.length - 1]
	return typeof last?.seq === 'number' && Number.isFinite(last.seq) ? last.seq + 1 : 0
}

/** The final non-empty assistant text of one turn. */
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
 * Find the first turn that STARTED at or after `sinceSeq` and has already
 * ended. A turn that began before the caller's message is skipped on purpose:
 * that is the turn the message queued behind, not the one that answers it.
 *
 * @param events - ordered session events.
 * @param sinceSeq - the log offset captured before delivery.
 * @returns the answering turn, or undefined while it has not finished.
 */
export function findAnsweredTurn(events, sinceSeq) {
	let open
	for (const event of events) {
		if (event?.type === 'turn/start') {
			open = { turn: event.data?.turn, startSeq: event.seq }
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
 * Build the `session_spawn` tool definition.
 *
 * Exported separately from {@link apply} so the behaviour can be tested against
 * a fake context without loading the harness.
 *
 * @param ctx - plugin context providing the host services.
 * @returns the tool definition to register.
 */
export function createSessionSpawnTool(ctx) {
	return {
		name: TOOL_NAME,
		description: [
			'Create a new, independent DSH session that the person can see in the sidebar and continue on their own.',
			'An omitted workspacePath inherits the calling session\'s workspace, so the new session appears under the same workspace group as New Session in the GUI; pass ungrouped: true to keep it outside every workspace.',
			'permission selects the sandbox/approval bundle for the new session: read-only (仅可查看), workspace-write (工作区内修改), or danger-full-access (完全权限). Omit it to keep the host new-session default.',
			'The first message is delivered immediately and the call returns as soon as the session exists — it does not wait for the work to finish.',
			'Use this to fan work out into separate sessions; use a subagent when the work should stay inside this conversation.'
		].join(' '),
		parameters: {
			type: 'object',
			additionalProperties: false,
			properties: {
				prompt: {
					type: 'string',
					description: 'The new session\'s first task. Write it self-contained: the new session cannot see this conversation.'
				},
				workspacePath: {
					type: 'string',
					description: 'Absolute path of an already-registered workspace, e.g. "/path/to/my-project". This tool never creates a workspace; an unregistered path is an error. Omit to inherit the calling session\'s workspace.'
				},
				ungrouped: {
					type: 'boolean',
					description: 'Create the session outside every workspace (it appears under "Ungrouped"). Defaults to false: an omitted workspacePath inherits the calling session\'s workspace. An explicit workspacePath wins when both are given.'
				},
				permission: {
					type: 'string',
					enum: PERMISSION_PRESETS,
					description: 'Permission bundle for the first turn and later turns: "read-only" (仅可查看; reads only, approval may ask), "workspace-write" (工作区内修改; writes limited to the workspace, approval may ask), "danger-full-access" (完全权限; no sandbox and no approval prompts — use for unattended work). Omit to keep the host new-session default.'
				},
				title: {
					type: 'string',
					description: 'Optional fixed title. Defaults to a short prefix of the prompt.'
				},
				preset: {
					type: 'string',
					description: 'Optional agent preset id for the new session. Defaults to the calling session\'s preset.'
				}
			},
			required: ['prompt']
		},
		output: {
			schema: {
				type: 'object',
				additionalProperties: false,
				properties: {
					sessionId: { type: 'string' },
					title: { type: 'string' },
					workspacePath: { type: 'string' },
					workspaceId: { type: 'string' },
					workspaceTitle: { type: 'string' },
					cwd: { type: 'string' },
					preset: { type: 'string' },
					permission: { type: 'string' },
					permissionLabel: { type: 'string' },
					sinceSeq: { type: 'number' }
				},
				required: ['sessionId']
			},
			render: (_args, value) => [{
				type: 'text',
				text: [
					`Created session ${value.sessionId}${typeof value.title === 'string' ? ` (“${value.title}”)` : ''}.`,
					typeof value.workspacePath === 'string'
						? `It is attached to ${value.workspacePath}${typeof value.workspaceTitle === 'string' ? ` (“${value.workspaceTitle}”)` : ''} and appears under that workspace in the sidebar.`
						: 'It is ungrouped: no workspace was attached.',
					typeof value.permission === 'string'
						? `It runs under the ${typeof value.permissionLabel === 'string' ? `${value.permissionLabel} (${value.permission})` : value.permission} permission.`
						: '',
					'The first task was delivered; the session keeps working on its own.',
					typeof value.sinceSeq === 'number' ? `Log offset sinceSeq=${value.sinceSeq}: pass it to session_wait to wait for this task's answer.` : ''
				].filter((part) => part !== '').join(' ')
			}]
		},
		async execute(args, exec) {
			if (exec?.agent === undefined) throw new Error(`${TOOL_NAME} must run inside a session`)
			const prompt = typeof args?.prompt === 'string' ? args.prompt.trim() : ''
			if (prompt === '') throw new Error(`${TOOL_NAME} needs a non-empty prompt: it becomes the new session's first message`)
			// Raw registered tools are not argument-validated by the host, so a
			// wrongly typed field would otherwise read as "absent" and silently
			// change behaviour (workspacePath 123 would inherit instead of fail).
			if (args?.workspacePath !== undefined && typeof args.workspacePath !== 'string') throw new Error(`${TOOL_NAME} workspacePath must be a string`)
			if (args?.ungrouped !== undefined && typeof args.ungrouped !== 'boolean') throw new Error(`${TOOL_NAME} ungrouped must be a boolean`)
			if (args?.permission !== undefined && typeof args.permission !== 'string') throw new Error(`${TOOL_NAME} permission must be a string`)

			// Validate the permission before anything is created: a bad preset must
			// not leave a default-permission session behind. The host pins the
			// new-session default at creation, so the override is applied to the
			// live session right after it exists and before the first message.
			const requestedPermission = typeof args?.permission === 'string' && args.permission.trim() !== '' ? args.permission.trim() : undefined
			const grant = requestedPermission === undefined ? undefined : resolvePermissionGrant(ctx, requestedPermission)

			// Resolve the workspace next: a typo must fail before a session exists.
			let workspace
			const requestedPath = typeof args?.workspacePath === 'string' ? args.workspacePath.trim() : ''
			if (requestedPath !== '') {
				let canonical
				try {
					canonical = await ctx.workspaceRegistry.resolveByPath(requestedPath)
				} catch (error) {
					throw new Error(`${TOOL_NAME} cannot use ${JSON.stringify(requestedPath)}: ${error instanceof Error ? error.message : String(error)}`)
				}
				if (canonical === undefined) {
					const known = (ctx.workspaceRegistry.list?.() ?? []).map((item) => `${item.title} (${item.path})`).join('; ')
					throw new Error(`${TOOL_NAME} cannot use ${JSON.stringify(requestedPath)}: no registered workspace has that path. Existing workspaces: ${known === '' ? '(none)' : known}. Use one of those paths, or pass ungrouped: true for a session outside every workspace.`)
				}
				workspace = canonical
			} else if (args?.ungrouped !== true) {
				// GUI parity, first choice only: New Session targets the explicitly
				// selected workspace, then the current session's workspace, then the
				// most recently active one. The last two are client-local state a host
				// plugin cannot read, so the caller's membership is used first and its
				// recorded directory is the fallback (a session can live in a
				// registered directory without being accounted to it). Only a caller
				// outside every workspace directory ends up ungrouped.
				workspace = await resolveCallerWorkspace(ctx, exec.agent)
			}

			const fallbackCwd = exec.agent.session?.header?.cwd
			const cwd = workspace?.path ?? fallbackCwd
			if (typeof cwd !== 'string' || cwd === '') {
				throw new Error(`${TOOL_NAME} needs either a workspace or a calling session that records a working directory`)
			}

			const preset = resolvePresetId(ctx, exec.agent, args?.preset)
			let created
			try {
				created = await ctx.sessionController.create({
					...(workspace === undefined ? { cwd } : { workspaceId: String(workspace.id) }),
					...(preset === undefined ? {} : { agentPreset: preset })
				})
			} catch (error) {
				// The host mints the session before it attaches it to the workspace, so
				// an attach failure throws with the new id already published. Reclaim
				// that leftover instead of leaving an orphan row behind.
				const leftover = discardableSessionId(error)
				if (leftover !== undefined) await discardSession(ctx, leftover, workspace)
				throw error
			}
			const sessionId = String(created?.sessionId ?? '')
			if (sessionId === '') throw new Error(`${TOOL_NAME}: the host returned no session id`)

			// The session in the sidebar reads better with the title we chose than
			// with a raw id, but a title failure must not cost the whole spawn.
			const title = typeof args?.title === 'string' && args.title.trim() !== '' ? args.title.trim() : deriveTitle(prompt)
			let acceptedTitle = title
			try {
				const live = ctx.agents.get(sessionId)
				if (live?.session !== undefined) acceptedTitle = ctx.sessionTitle.rename(live.session, title)?.title ?? title
			} catch {
				// Cosmetic only: the session still works without a pinned title.
			}

			// Grant the requested permission before the first message so the first
			// turn runs under it. The permission-preset service is the only
			// supported write path: raw sandbox/approval events record no preset
			// identity, so the GUI would label the session "custom".
			let effectivePermission
			if (grant !== undefined) {
				try {
					const live = ctx.agents.get(sessionId)
					if (live?.session === undefined) throw new Error('the new session is not live in this host')
					grant.permissions.set(live.session, grant.name)
					const actual = typeof grant.permissions.current === 'function' ? grant.permissions.current(live.session) : undefined
					effectivePermission = typeof actual === 'string' && actual !== '' ? actual : grant.name
				} catch (error) {
					await discardSession(ctx, sessionId, workspace)
					throw new Error(`${TOOL_NAME} created ${sessionId} but could not grant permission ${JSON.stringify(grant.name)} (${error instanceof Error ? error.message : String(error)}); cleanup was attempted (archive when the host supports it, plus detach), so it should not stay in the sidebar`)
				}
			} else {
				// Report what the host actually pinned for a new session, which is the
				// permission GUI-created sessions would get.
				effectivePermission = currentPermissionOf(ctx, sessionId)
			}

			// Remember where the log stood before delivery: session_wait starts from
			// this offset to identify the turn this spawn starts.
			const sinceSeq = liveSessionSeq(ctx, sessionId)
			try {
				// The service surface (`sessionController.prompt`) takes a caller
				// signal as its second argument and builds the `user-rpc` message
				// source itself; the inner command layer is the one that takes a
				// source. Passing the wrong one fails with
				// "signal.throwIfAborted is not a function".
				const signal = exec.signal ?? new AbortController().signal
				await ctx.sessionController.prompt({
					requestId: randomUUID(),
					sessionId,
					mode: 'queue',
					content: [{ type: 'text', text: prompt }]
				}, signal)
			} catch (error) {
				// A session that never receives its task would sit in the sidebar as
				// an empty stranger. Take it back out and report what happened.
				await discardSession(ctx, sessionId, workspace)
				throw new Error(`${TOOL_NAME} created ${sessionId} but could not deliver its first message (${error instanceof Error ? error.message : String(error)}); cleanup was attempted (archive when the host supports it, plus detach), so it should not stay in the sidebar`)
			}

			return {
				sessionId,
				title: acceptedTitle,
				...(workspace === undefined ? {} : {
					workspacePath: String(workspace.path),
					workspaceId: String(workspace.id),
					workspaceTitle: String(workspace.title)
				}),
				cwd,
				...(preset === undefined ? {} : { preset }),
				...(effectivePermission === undefined ? {} : {
					permission: effectivePermission,
					...(PERMISSION_LABELS[effectivePermission] === undefined ? {} : { permissionLabel: PERMISSION_LABELS[effectivePermission] })
				}),
				...(sinceSeq === undefined ? {} : { sinceSeq })
			}
		}
	}
}

/**
 * Build the `session_send` tool definition.
 *
 * The target may be a sleeping session: the API controller's `resolveAgent`
 * resumes it (mounting its recorded preset and model) before the message is
 * admitted, so a follow-up reaches a research session that finished its first
 * turn and went idle. The call returns once the message is accepted; it does
 * not wait for the target to answer.
 *
 * @param ctx - plugin context providing the host services.
 * @returns the tool definition to register.
 */
export function createSessionSendTool(ctx) {
	return {
		name: 'session_send',
		description: [
			'Send a message to an existing DSH session so that session continues on its own.',
			'Use the sessionId returned by session_spawn. A session that is not currently running is resumed first; the call returns as soon as the message is accepted and does not wait for the answer.',
			'It cannot send to its own calling session.'
		].join(' '),
		parameters: {
			type: 'object',
			additionalProperties: false,
			properties: {
				sessionId: {
					type: 'string',
					description: 'Target session id, exactly as returned by session_spawn.'
				},
				message: {
					type: 'string',
					description: 'Message text. Write it self-contained: the target session cannot see this conversation.'
				}
			},
			required: ['sessionId', 'message']
		},
		output: {
			schema: {
				type: 'object',
				additionalProperties: false,
				properties: {
					sessionId: { type: 'string' },
					delivered: { type: 'boolean' },
					resumed: { type: 'boolean' },
					sinceSeq: { type: 'number' }
				},
				required: ['sessionId', 'delivered']
			},
			render: (_args, value) => [{
				type: 'text',
				text: `Delivered the message to ${value.sessionId}${value.resumed === true ? ' (the session was resumed first)' : ''}. It keeps working on its own.${typeof value.sinceSeq === 'number' ? ` Log offset sinceSeq=${value.sinceSeq}: pass it to session_wait to wait for this message's answer.` : ''}`
			}]
		},
		async execute(args, exec) {
			if (exec?.agent === undefined) throw new Error('session_send must run inside a session')
			const sessionId = typeof args?.sessionId === 'string' ? args.sessionId.trim() : ''
			if (sessionId === '') throw new Error('session_send needs a non-empty sessionId')
			const message = typeof args?.message === 'string' ? args.message.trim() : ''
			if (message === '') throw new Error('session_send needs a non-empty message')
			const ownIds = [String(exec.agent.id ?? ''), String(exec.agent.session?.header?.id ?? '')]
			if (ownIds.includes(sessionId)) throw new Error('session_send cannot send to its own session: use the current conversation instead')

			const wasLive = ctx.agents.get(sessionId) !== undefined
			// Resolve-or-resume through the same controller the GUI uses: it applies
			// the session's recorded preset and model, which a bare `agents.resume`
			// would skip, leaving the resumed agent without its tools.
			const resolved = await ctx.sessionController.resolveAgent(sessionId)
			if (resolved !== undefined && resolved !== null && typeof resolved === 'object' && 'error' in resolved) {
				const reason = resolved.error?.message ?? String(resolved.error)
				throw new Error(`session_send cannot reach ${JSON.stringify(sessionId)}: ${reason}`)
			}

			// The log offset the wait will start from, captured after the resume so a
			// dormant target's replayed history is not mistaken for new work.
			const sinceSeq = liveSessionSeq(ctx, sessionId)
			try {
				await ctx.sessionController.prompt({
					requestId: randomUUID(),
					sessionId,
					mode: 'queue',
					content: [{ type: 'text', text: message }]
				}, exec.signal ?? new AbortController().signal)
			} catch (error) {
				throw new Error(`session_send could not deliver the message to ${sessionId}: ${error instanceof Error ? error.message : String(error)}`)
			}

			return {
				sessionId,
				delivered: true,
				resumed: wasLive !== true,
				...(sinceSeq === undefined ? {} : { sinceSeq })
			}
		}
	}
}

const WAIT_DEFAULT_MS = 60_000
const WAIT_MAX_MS = 300_000
const WAIT_POLL_MS = 250

/**
 * Build the `session_wait` tool definition.
 *
 * It is read-only: it never resumes, resends, or interrupts the target. It
 * waits for the first turn that STARTS at or after `sinceSeq` to end, then
 * returns that turn's final assistant text — the answer to the message sent at
 * that log offset. A turn already running when the message was sent is skipped,
 * because the message cannot be in it.
 *
 * @param ctx - plugin context providing the host services.
 * @param options - test seam: polling interval override.
 * @returns the tool definition to register.
 */
export function createSessionWaitTool(ctx, options = {}) {
	const pollMs = typeof options.pollMs === 'number' && options.pollMs > 0 ? options.pollMs : WAIT_POLL_MS
	return {
		name: 'session_wait',
		description: [
			'Wait for the answer to one message you sent with session_spawn or session_send, and return it.',
			'Pass the sessionId and the sinceSeq those tools returned: the wait targets the first turn that started at or after that log offset.',
			'Read-only: it never resumes, resends, or interrupts the target. On timeout it reports that the session is still running instead of failing, so query again with the same sinceSeq.',
			'It cannot wait on its own calling session.'
		].join(' '),
		parameters: {
			type: 'object',
			additionalProperties: false,
			properties: {
				sessionId: { type: 'string', description: 'Target session id, exactly as returned by session_spawn.' },
				sinceSeq: { type: 'number', description: 'The sinceSeq returned by session_spawn or session_send. Omit only to wait for a turn that starts after this call.' },
				timeoutMs: { type: 'number', description: 'How long to wait, in milliseconds. Defaults to 60000, at most 300000.' }
			},
			required: ['sessionId']
		},
		output: {
			schema: {
				type: 'object',
				additionalProperties: false,
				properties: {
					sessionId: { type: 'string' },
					status: { type: 'string', enum: ['answered', 'timeout', 'idle'] },
					answer: { type: 'string' },
					turn: { type: 'number' },
					turnEndKind: { type: 'string' },
					seq: { type: 'number' },
					lastSeq: { type: 'number' },
					running: { type: 'boolean' },
					elapsedMs: { type: 'number' }
				},
				required: ['sessionId', 'status']
			},
			render: (_args, value) => [{
				type: 'text',
				text: value.status === 'answered'
					? `Answer from ${value.sessionId} (turn ${value.turn}${typeof value.turnEndKind === 'string' ? `, ${value.turnEndKind}` : ''}):\n${value.answer ?? '(the turn produced no text)'}`
					: value.status === 'idle'
						? `${value.sessionId} is not running and no turn after sinceSeq has ended yet.`
						: `Still waiting on ${value.sessionId} after ${Math.round((value.elapsedMs ?? 0) / 1000)}s; it is still running. Query again with the same sinceSeq.`
			}]
		},
		async execute(args, exec) {
			if (exec?.agent === undefined) throw new Error('session_wait must run inside a session')
			const sessionId = typeof args?.sessionId === 'string' ? args.sessionId.trim() : ''
			if (sessionId === '') throw new Error('session_wait needs a non-empty sessionId')
			const ownIds = [String(exec.agent.id ?? ''), String(exec.agent.session?.header?.id ?? '')]
			if (ownIds.includes(sessionId)) throw new Error('session_wait cannot wait on its own session: that would wait for the answer it is writing')
			const requested = typeof args?.timeoutMs === 'number' && Number.isFinite(args.timeoutMs) && args.timeoutMs > 0 ? args.timeoutMs : WAIT_DEFAULT_MS
			const timeoutMs = Math.max(1, Math.min(Math.trunc(requested), WAIT_MAX_MS))
			const signal = exec.signal
			const startedAt = Date.now()
			const sinceSeq = typeof args?.sinceSeq === 'number' && Number.isFinite(args.sinceSeq)
				? args.sinceSeq
				: await nextSeqOf(ctx, sessionId, signal)
			let lastSeq
			for (;;) {
				const { events, live } = await readSessionEvents(ctx, sessionId, signal)
				const last = events.length === 0 ? undefined : events[events.length - 1]
				lastSeq = typeof last?.seq === 'number' ? last.seq : undefined
				const hit = findAnsweredTurn(events, sinceSeq)
				if (hit !== undefined) {
					return {
						sessionId,
						status: 'answered',
						...(hit.answer === undefined ? {} : { answer: hit.answer }),
						turn: hit.turn,
						...(hit.endKind === undefined ? {} : { turnEndKind: String(hit.endKind) }),
						seq: hit.seq,
						running: false,
						elapsedMs: Date.now() - startedAt
					}
				}
				const elapsedMs = Date.now() - startedAt
				if (!live) {
					return {
						sessionId,
						status: 'idle',
						running: false,
						elapsedMs,
						...(lastSeq === undefined ? {} : { lastSeq })
					}
				}
				if (elapsedMs >= timeoutMs) {
					return {
						sessionId,
						status: 'timeout',
						running: true,
						elapsedMs,
						...(lastSeq === undefined ? {} : { lastSeq })
					}
				}
				await delay(pollMs, undefined, { signal })
			}
		}
	}
}

/**
 * Build the `session_archive` tool definition.
 *
 * Archiving is the supported way to take sessions out of the sidebar: it adds
 * them to the registry-global archive set (reversible from the app's archived
 * filter) and never deletes logs. The persistence seam deliberately has no
 * deletion API, so "reclaim" means archive here.
 *
 * @param ctx - plugin context providing the host services.
 * @returns the tool definition to register.
 */
export function createSessionArchiveTool(ctx) {
	return {
		name: 'session_archive',
		description: [
			'Archive one or more sessions so they leave the sidebar workspace groups without deleting anything.',
			'Archiving is reversible from the app archived filter; session logs, projections, and materials are untouched.',
			'Refuses the calling session; stops a running turn first unless stopActivity is false.'
		].join(' '),
		parameters: {
			type: 'object',
			additionalProperties: false,
			properties: {
				sessionIds: {
					type: 'array',
					items: { type: 'string' },
					description: 'Session ids to archive, for example the ids returned by session_spawn.'
				},
				stopActivity: {
					type: 'boolean',
					description: 'Stop a running turn before archiving. Defaults to true.'
				}
			},
			required: ['sessionIds']
		},
		output: {
			schema: {
				type: 'object',
				additionalProperties: false,
				properties: {
					archived: { type: 'array', items: { type: 'string' } },
					failed: {
						type: 'array',
						items: {
							type: 'object',
							additionalProperties: false,
							properties: {
								sessionId: { type: 'string' },
								error: { type: 'string' }
							},
							required: ['sessionId']
						}
					}
				},
				required: ['archived']
			},
			render: (_args, value) => [{
				type: 'text',
				text: [
					`Archived ${value.archived.length} session(s).`,
					value.failed.length === 0 ? '' : `Failed ${value.failed.length}: ${value.failed.map((item) => `${item.sessionId} (${item.error})`).join('; ')}.`,
					'They are hidden from the sidebar; logs are untouched and can be unarchived from the app.'
				].filter((part) => part !== '').join(' ')
			}]
		},
		async execute(args, exec) {
			const controller = ctx.get?.('workspaceController')
			if (typeof controller?.archiveSession !== 'function') throw new Error('session_archive needs the workspace controller on this host')
			const raw = Array.isArray(args?.sessionIds) ? args.sessionIds : []
			const ids = [...new Set(raw.map((value) => String(value ?? '').trim()).filter((value) => value !== ''))]
			if (ids.length === 0) throw new Error('session_archive needs at least one non-empty session id')
			const ownIds = [String(exec?.agent?.id ?? ''), String(exec?.agent?.session?.header?.id ?? '')]
			const stopActivity = args?.stopActivity !== false
			const archived = []
			const failed = []
			for (const sessionId of ids) {
				if (ownIds.includes(sessionId)) {
					failed.push({ sessionId, error: 'refused to archive the calling session' })
					continue
				}
				try {
					await controller.archiveSession({ sessionId, ...(stopActivity ? { stopActivity: true } : {}) })
					archived.push(sessionId)
				} catch (error) {
					failed.push({ sessionId, error: error instanceof Error ? error.message : String(error) })
				}
			}
			return { archived, failed }
		}
	}
}

/**
 * Register the plugin's tools. They are host-wide: they are not tied to one
 * agent preset, because the automation that calls them runs under whatever
 * preset its schedule row selects.
 *
 * @param ctx - plugin context.
 */
export function apply(ctx) {
	ctx.tools.register(createSessionSpawnTool(ctx))
	ctx.tools.register(createSessionSendTool(ctx))
	ctx.tools.register(createSessionWaitTool(ctx))
	ctx.tools.register(createSessionArchiveTool(ctx))
}
