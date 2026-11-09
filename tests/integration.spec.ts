/**
 * Gate behavior against a real Cordis context and a real tool registry.
 *
 * These tests exercise the contract the unit tests cannot: that masking a
 * tool actually removes it from an Agent's visible schemas, and that a
 * successful skill load brings it back.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
import { createToolResultMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import { BindingStore } from '../src/bindings.ts'
import { SkillGate } from '../src/gate.ts'
import { startupToolNames } from '../src/index.ts'

let root: string
let bindingPath: string
const contexts: Context[] = []

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'skill-gate-int-'))
  bindingPath = join(root, 'bindings.json')
})

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  await rm(root, { recursive: true, force: true })
})

/** A Context with just the services the gate needs. */
async function makeContext(): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SystemPrompt, { personaPrefix: '', personaSuffix: '' })
  await ctx.plugin(ToolRuntime)
  return ctx
}

/**
 * A context that may mint Agent scopes.
 *
 * `createScope` resolves services through the parent chain, and a bare root
 * context ends that chain. Real Agents are scoped under the loop plugin's
 * context, which declares its injections; this stand-in reproduces that.
 * @param ctx - root context carrying the tool registry.
 * @returns the plugin fiber's context, which declares the `tools` injection.
 */
async function makeScopeHost(ctx: Context): Promise<Context> {
  const fiber = ctx.plugin({ name: 'test-scope-host', inject: ['tools'], apply: () => {} })
  await fiber
  return fiber.ctx
}

/** Register one trivial global tool. */
function registerTool(ctx: Context, name: string): void {
  ctx.tools.register(defineTool({
    name,
    description: `fixture tool ${name}`,
    parameters: {},
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute: async () => `ran ${name}`,
  }))
}

/** Session events that carry a surface operation; `tool/call` does not. */
const SURFACE_TYPES = new Set(['user/message', 'developer/message', 'system/message', 'assistant/message', 'tool/result'])

/** A minimal Agent-shaped object carrying its own scoped context. */
async function makeAgent(ctx: Context, id: string, events: { type: string; data: unknown }[] = []) {
  const sessionId = SessionId(id)
  const seeded = events.map((event, index) => ({
    ...event,
    seq: index,
    time: index,
    ...(SURFACE_TYPES.has(event.type) ? { surfaceOp: 'append' } : {}),
  }))
  const session = Session.create(sessionId, seeded as never, {
    version: SESSION_FORMAT_VERSION, id: sessionId, createdAt: 0, cwd: root, isSeeded: false,
  })
  const host = await makeScopeHost(ctx)
  // The Agent object itself is the scope key, matching `createScope(loopCtx, this)`
  // in the real loop: a restriction made through `agent.ctx` must apply to the
  // Agent a caller then queries.
  const identity = { id: sessionId, session }
  const scope = createScope(host, identity as never)
  const agent = { ...identity, ctx: scope.ctx, options: {} } as never
  return { scope, agent, identity }
}

async function writeBindings(skill: string, tools: string[]): Promise<void> {
  await writeFile(bindingPath, JSON.stringify({ version: 1, bindings: [{ skill, tools }] }), 'utf8')
}

/** Tool names an Agent currently sees. */
function visible(ctx: Context, agent: unknown): string[] {
  const key = scopeOf((agent as { ctx: Context }).ctx)
  return ctx.tools.schemas(key).map(schema => schema.name).sort()
}

it('hides a bound tool and leaves an unbound tool visible', async () => {
  const ctx = await makeContext()
  registerTool(ctx, 'gated_tool')
  registerTool(ctx, 'free_tool')
  await writeBindings('my-skill', ['gated_tool'])

  const { agent } = await makeAgent(ctx, 'a1')
  const gate = new SkillGate(new BindingStore(bindingPath))
  await gate.arm(agent as never, new Set(['gated_tool', 'free_tool']))

  expect(visible(ctx, agent)).toEqual(['free_tool'])
})

it('reveals the tool once its skill loads', async () => {
  const ctx = await makeContext()
  registerTool(ctx, 'gated_tool')
  await writeBindings('my-skill', ['gated_tool'])

  const { agent } = await makeAgent(ctx, 'a2')
  const gate = new SkillGate(new BindingStore(bindingPath))
  await gate.arm(agent as never, new Set(['gated_tool']))
  expect(visible(ctx, agent)).toEqual([])

  await gate.unlock(agent as never, 'my-skill')
  expect(visible(ctx, agent)).toEqual(['gated_tool'])
})

it('gates two Agents independently', async () => {
  const ctx = await makeContext()
  registerTool(ctx, 'gated_tool')
  await writeBindings('my-skill', ['gated_tool'])

  const first = await makeAgent(ctx, 'a3')
  const second = await makeAgent(ctx, 'a4')
  const gate = new SkillGate(new BindingStore(bindingPath))
  await gate.arm(first.agent as never, new Set(['gated_tool']))
  await gate.arm(second.agent as never, new Set(['gated_tool']))

  await gate.unlock(first.agent as never, 'my-skill')
  expect(visible(ctx, first.agent)).toEqual(['gated_tool'])
  expect(visible(ctx, second.agent)).toEqual([])
})

it('starts unlocked when the log already proves the skill loaded', async () => {
  const ctx = await makeContext()
  registerTool(ctx, 'gated_tool')
  await writeBindings('my-skill', ['gated_tool'])

  const { agent } = await makeAgent(ctx, 'a5', [
    { type: 'tool/call', data: { turn: 1, step: 1, callId: 'c1', name: 'skill', arguments: '{"name":"my-skill"}' } },
    {
      type: 'tool/result',
      data: {
        turn: 1,
        step: 1,
        message: createToolResultMessage({ callId: ToolCallId('c1'), content: [], isError: false }),
      },
    },
  ])
  const gate = new SkillGate(new BindingStore(bindingPath))
  await gate.arm(agent as never, new Set(['gated_tool']))

  expect(visible(ctx, agent)).toEqual(['gated_tool'])
})

it('masks a tool that registers after the Agent was armed', async () => {
  const ctx = await makeContext()
  await writeBindings('my-skill', ['late_tool'])

  const { agent } = await makeAgent(ctx, 'a6')
  const gate = new SkillGate(new BindingStore(bindingPath))
  await gate.arm(agent as never, new Set())

  registerTool(ctx, 'late_tool')
  await gate.refresh(() => new Set(['late_tool']))
  expect(visible(ctx, agent)).toEqual([])
})

it('unlocks a tool named by either of two skills', async () => {
  const ctx = await makeContext()
  registerTool(ctx, 'shared_tool')
  await writeFile(bindingPath, JSON.stringify({
    version: 1,
    bindings: [
      { skill: 'skill-a', tools: ['shared_tool'] },
      { skill: 'skill-b', tools: ['shared_tool'] },
    ],
  }), 'utf8')

  const { agent } = await makeAgent(ctx, 'a7')
  const gate = new SkillGate(new BindingStore(bindingPath))
  await gate.arm(agent as never, new Set(['shared_tool']))
  expect(visible(ctx, agent)).toEqual([])

  await gate.unlock(agent as never, 'skill-b')
  expect(visible(ctx, agent)).toEqual(['shared_tool'])
})

it('gates nothing when the binding file is absent', async () => {
  const ctx = await makeContext()
  registerTool(ctx, 'free_tool')

  const { agent } = await makeAgent(ctx, 'a8')
  const gate = new SkillGate(new BindingStore(join(root, 'missing.json')))
  await gate.arm(agent as never, new Set(['free_tool']))

  expect(visible(ctx, agent)).toEqual(['free_tool'])
})

it('lifts every mask on dispose', async () => {
  const ctx = await makeContext()
  registerTool(ctx, 'gated_tool')
  await writeBindings('my-skill', ['gated_tool'])

  const { agent } = await makeAgent(ctx, 'a9')
  const gate = new SkillGate(new BindingStore(bindingPath))
  await gate.arm(agent as never, new Set(['gated_tool']))
  expect(visible(ctx, agent)).toEqual([])

  gate.dispose()
  expect(visible(ctx, agent)).toEqual(['gated_tool'])
})

it('always blocks schemas and lookup even when a matching skill loads', async () => {
  const ctx = await makeContext()
  registerTool(ctx, 'blocked_tool')
  registerTool(ctx, 'free_tool')
  const store = new BindingStore(bindingPath)
  await store.save([{ skill: 'my-skill', tools: ['blocked_tool'] }], ['blocked_tool'])
  const { agent } = await makeAgent(ctx, 'blocked')
  const gate = new SkillGate(store)
  await gate.arm(agent as never, new Set(['blocked_tool', 'free_tool']))
  await gate.unlock(agent as never, 'my-skill')
  expect(visible(ctx, agent)).toEqual(['free_tool'])
  expect(ctx.tools.get('blocked_tool', scopeOf((agent as { ctx: Context }).ctx))).toBeUndefined()
  expect(ctx.tools.executable('blocked_tool', scopeOf((agent as { ctx: Context }).ctx))).toBeUndefined()
  expect(ctx.tools.get('blocked_tool')).toBeDefined()
  gate.dispose()
  expect(visible(ctx, agent)).toEqual(['blocked_tool', 'free_tool'])
})

it('keeps restored skill history and late registration from bypassing a block', async () => {
  const ctx = await makeContext()
  const store = new BindingStore(bindingPath)
  await store.save([{ skill: 'my-skill', tools: ['blocked_tool'] }], ['blocked_tool'])
  const { agent } = await makeAgent(ctx, 'blocked-restored', [
    { type: 'tool/call', data: { turn: 1, step: 1, callId: 'restore', name: 'skill', arguments: { name: 'my-skill' } } },
    { type: 'tool/result', data: { turn: 1, step: 1, message: createToolResultMessage({ callId: ToolCallId('restore'), content: [], isError: false }) } },
  ])
  const gate = new SkillGate(store)
  await gate.arm(agent as never, new Set())
  registerTool(ctx, 'blocked_tool')
  await gate.refresh(() => new Set(['blocked_tool']))
  expect(visible(ctx, agent)).toEqual([])
})

it('reads the default preset with real scoped tools and releases its lease', async () => {
  const ctx = await makeContext()
  registerTool(ctx, 'global_tool')
  const host = await makeScopeHost(ctx)
  const preset = createScope(host, { id: 'default-preset' } as never)
  const live = createScope(host, { id: 'unrelated-agent' } as never)
  registerTool(preset.ctx, 'preset_tool')
  registerTool(live.ctx, 'live_only')
  let released = false
  ctx.provide('agentPresets', {
    acquireScope: async () => ({ key: scopeOf(preset.ctx), [Symbol.asyncDispose]: async () => { released = true } }),
  })
  expect([...(await startupToolNames(ctx))].sort()).toEqual(['global_tool', 'preset_tool'])
  expect(released).toBe(true)
})
