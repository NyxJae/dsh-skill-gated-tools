/**
 * Binding-file selection, end to end.
 *
 * The store's own tests cover paths in isolation. These tests mount the real
 * plugin so the choice is observed where it matters: two profiles under one
 * Harness home keep separate visibility tables, the legacy global file is not
 * read behind a profile's back, and an explicit `bindingPath` still wins.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SessionStore, { Session, SessionId, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
import * as skillGate from '../src/index.ts'

let root: string
let previousHome: string | undefined
const contexts: Context[] = []

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'skill-gate-profile-'))
  previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = root
})

afterEach(async () => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  await rm(root, { recursive: true, force: true })
})

/** Write one binding document, creating its directory. */
async function writeBindings(path: string, document: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(document), 'utf8')
}

/** One binding row: the tools a skill reveals. */
function row(skill: string, tools: string[]): unknown {
  return { version: 1, bindings: [{ skill, tools }] }
}

/** A host with the real registry, the real plugin and optional profile facts. */
async function makeHost(options: { profileDir?: string; profileName?: string; bindingPath?: string } = {}): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SystemPrompt, { personaPrefix: '', personaSuffix: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  for (const name of ['tool_a', 'tool_b', 'tool_c', 'tool_d']) {
    ctx.tools.register(defineTool({
      name,
      description: `fixture tool ${name}`,
      parameters: {},
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
      execute: async () => `ran ${name}`,
    }))
  }
  if (options.profileDir !== undefined) {
    ;(ctx as unknown as { provide(name: string, value: unknown): void }).provide('profileContext', {
      name: options.profileName ?? 'fixture',
      dir: options.profileDir,
    })
  }
  await ctx.plugin({ name: skillGate.name, inject: skillGate.inject as never, apply: skillGate.apply as never }, options.bindingPath === undefined ? {} : { bindingPath: options.bindingPath })
  return ctx
}

/** Register an Agent-shaped object carrying its own scoped context. */
async function makeAgent(ctx: Context, id: string) {
  const fiber = ctx.plugin({ name: 'test-scope-host', inject: ['tools'], apply: () => {} })
  await fiber
  const sessionId = SessionId(id)
  const session = Session.create(sessionId, [], {
    version: SESSION_FORMAT_VERSION, id: sessionId, createdAt: 0, cwd: root, isSeeded: false,
  })
  const identity = { id: sessionId, session }
  const scope = createScope(fiber.ctx, identity as never)
  return { ...identity, ctx: scope.ctx, options: {} } as never
}

/** Tools one Agent currently sees, after the gate armed it. */
async function armedTools(ctx: Context, id: string): Promise<string[]> {
  const agent = await makeAgent(ctx, id)
  await ctx.serial('agent/created', { agent, source: { kind: 'startup' } } as never)
  return ctx.tools.schemas(scopeOf((agent as { ctx: Context }).ctx)).map(schema => schema.name).sort()
}

it('keeps two profiles on separate tables and never reads the legacy file behind them', async () => {
  const profileA = join(root, 'profiles', 'a')
  const profileB = join(root, 'profiles', 'b')
  await writeBindings(join(profileA, 'skill-gate', 'bindings.json'), row('skill-a', ['tool_a']))
  await writeBindings(join(profileB, 'skill-gate', 'bindings.json'), row('skill-b', ['tool_b']))
  // Only the legacy global file knows tool_c: a profile host must not apply it.
  await writeBindings(join(root, 'skill-gate', 'bindings.json'), { version: 1, bindings: [{ skill: 'skill-legacy', tools: ['tool_c'] }], blockedTools: ['tool_c'] })

  const hostA = await makeHost({ profileDir: profileA, profileName: 'a' })
  const hostB = await makeHost({ profileDir: profileB, profileName: 'b' })

  expect(await armedTools(hostA, 'agent-a')).toEqual(['tool_b', 'tool_c', 'tool_d'])
  expect(await armedTools(hostB, 'agent-b')).toEqual(['tool_a', 'tool_c', 'tool_d'])
})

it('applies an explicit bindingPath over the profile default', async () => {
  const profileDir = join(root, 'profiles', 'c')
  await writeBindings(join(profileDir, 'skill-gate', 'bindings.json'), row('skill-d', ['tool_d']))
  const override = join(root, 'override', 'bindings.json')
  await writeBindings(override, row('skill-c', ['tool_c']))

  const ctx = await makeHost({ profileDir, profileName: 'c', bindingPath: override })

  expect(await armedTools(ctx, 'agent-c')).toEqual(['tool_a', 'tool_b', 'tool_d'])
})

it('falls back to the legacy global file when the process reports no profile', async () => {
  await writeBindings(join(root, 'skill-gate', 'bindings.json'), row('skill-legacy', ['tool_c']))

  const ctx = await makeHost()

  expect(await armedTools(ctx, 'agent-headless')).toEqual(['tool_a', 'tool_b', 'tool_d'])
})