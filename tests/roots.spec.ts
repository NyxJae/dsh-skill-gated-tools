/**
 * The three skill roots behind one real registry, and the gate that follows them.
 *
 * These tests mount the real agent registry, the real skill-filesystem providers
 * (a DSH root and an Agents root) plus the plugin's own Claude fallback, the real
 * model-facing `skill` loader and the real native tool executor. Loading a skill
 * therefore travels the production path end to end: the `skill` call is
 * dispatched through ToolRuntime, the loader reads the definition back from
 * whichever provider owns that name, and the pipeline's own
 * `tools/post-execute` event is the one the plugin listens to when it unmasks
 * the tools bound to the loaded skill.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import * as SkillFileSystem from '@deepseek-ai/dsh-skill-filesystem'
import * as toolSkill from '@deepseek-ai/dsh-tool-skill'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import ToolRuntime, { defineTool } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
import { Session, SessionId, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as skillGate from '../src/index.ts'

let root: string
let dshHome: string
let agentsHome: string
let claudeHome: string
let bindingPath: string
const contexts: Context[] = []

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'skill-gate-roots-'))
  dshHome = join(root, '.dsh')
  agentsHome = join(root, '.agents')
  claudeHome = join(root, 'claude')
  bindingPath = join(root, 'bindings.json')
  process.env.CLAUDE_CONFIG_DIR = claudeHome
})

afterEach(async () => {
  delete process.env.CLAUDE_CONFIG_DIR
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  await rm(root, { recursive: true, force: true })
})

/** Write one skill directory with a body marker that identifies its root. */
async function writeSkill(skillsDir: string, name: string, marker: string): Promise<void> {
  const dir = join(skillsDir, name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: fixture for ${marker}\n---\n\nBody from ${marker}.\n`)
}

/** Seed the same three skills in all three roots, plus one name shared by every root. */
async function seedRoots(): Promise<void> {
  await writeSkill(join(dshHome, 'skills'), 'dsh-root-skill', 'dsh-root')
  await writeSkill(join(dshHome, 'skills'), 'shared-skill', 'dsh-root')
  await writeSkill(join(agentsHome, 'skills'), 'agents-root-skill', 'agents-root')
  await writeSkill(join(agentsHome, 'skills'), 'shared-skill', 'agents-root')
  await writeSkill(join(claudeHome, 'skills'), 'claude-root-skill', 'claude-root')
  await writeSkill(join(claudeHome, 'skills'), 'shared-skill', 'claude-root')
}

/** Supply the working-directory collaborator the loader reads the Agent's cwd from. */
function provideDirectory(ctx: Context, cwd: string): void {
  const get = (session: Session): string => session.header.cwd ?? cwd
  ;(ctx as unknown as { provide(name: string, value: unknown): void }).provide('workingDirectory', {
    defaultDirectory: cwd,
    get,
    ensure: (agent: { session: Session }): Promise<string> => Promise.resolve(get(agent.session)),
  })
}

/** A host carrying the real registry, the real providers, the real loader and the real plugin. */
async function makeHost(): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  provideDirectory(ctx, root)
  await ctx.plugin(SystemPrompt, { personaPrefix: '', personaSuffix: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(SkillFileSystem, { dshHome, agentsHome, watch: false })
  await ctx.plugin(toolSkill)
  await ctx.plugin({ name: skillGate.name, inject: skillGate.inject as never, apply: skillGate.apply as never }, { bindingPath })
  return ctx
}

/** Register one fixture tool. */
function registerTool(ctx: Context, name: string): void {
  ctx.tools.register(defineTool({
    name,
    description: `fixture tool ${name}`,
    parameters: {},
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute: async () => `ran ${name}`,
  }))
}

/** A context that may mint Agent scopes, matching the real loop's layering. */
async function makeScopeHost(ctx: Context): Promise<Context> {
  const fiber = ctx.plugin({ name: 'test-scope-host', inject: ['tools'], apply: () => {} })
  await fiber
  return fiber.ctx
}

/** A minimal Agent-shaped object carrying its own scoped context. */
async function makeAgent(ctx: Context, id: string) {
  const sessionId = SessionId(id)
  const session = Session.create(sessionId, [], {
    version: SESSION_FORMAT_VERSION, id: sessionId, createdAt: 0, cwd: root, isSeeded: false,
  })
  const host = await makeScopeHost(ctx)
  const identity = { id: sessionId, session }
  const scope = createScope(host, identity as never)
  return { scope, agent: { ...identity, ctx: scope.ctx, options: {} } as never }
}

/** Tool names an Agent currently sees. */
function visible(ctx: Context, agent: unknown): string[] {
  return ctx.tools.schemas(scopeOf((agent as { ctx: Context }).ctx)).map(schema => schema.name).sort()
}

/**
 * Load one skill through the real loader: the model-facing batch entry selects the
 * native executor, which runs the `skill` tool and emits its real post-execute event.
 */
async function loadSkill(ctx: Context, agent: unknown, name: string, callId: string) {
  const batch = await ctx.tools.execute({
    calls: [{ type: 'tool-call', id: callId, name: 'skill', arguments: JSON.stringify({ name }) }],
    signal: new AbortController().signal,
    agent,
  } as never)
  const outcome = (batch as unknown as { results: { result: { isError: boolean; content: unknown } }[] }).results[0]
  if (outcome === undefined) throw new Error('the executor settled no result for the skill call')
  const blocks = outcome.result.content as { type: string; text?: string }[]
  return { result: outcome.result, text: blocks.map(block => block.text ?? '').join('\n') }
}

it('lists and loads skills from the DSH, Agents and Claude roots through one registry', async () => {
  await seedRoots()
  const ctx = await makeHost()

  const listed = await ctx.skills.list()
  const names = listed.map(skill => skill.name)
  expect(names).toContain('dsh-root-skill')
  expect(names).toContain('agents-root-skill')
  expect(names).toContain('claude-root-skill')
  expect(names).toContain('shared-skill')

  const providerOf = (name: string): string | undefined => listed.find(skill => skill.name === name)?.provider
  expect(providerOf('dsh-root-skill')).toBe('filesystem')
  expect(providerOf('agents-root-skill')).toBe('filesystem')
  expect(providerOf('claude-root-skill')).toBe('claude-skills')
  // The harness roots outrank the Claude fallback, so the shared name resolves there.
  expect(providerOf('shared-skill')).toBe('filesystem')

  for (const [name, marker] of [['dsh-root-skill', 'dsh-root'], ['agents-root-skill', 'agents-root'], ['claude-root-skill', 'claude-root'], ['shared-skill', 'dsh-root']] as const) {
    const skill = await ctx.skills.get(name)
    expect(skill?.content).toContain(`Body from ${marker}.`)
  }
})

it('still lists the remaining roots when one of them is absent', async () => {
  await writeSkill(join(dshHome, 'skills'), 'dsh-only-skill', 'dsh-root')
  await rm(agentsHome, { recursive: true, force: true })
  await writeSkill(join(claudeHome, 'skills'), 'claude-only-skill', 'claude-root')
  const ctx = await makeHost()

  const names = (await ctx.skills.list()).map(skill => skill.name)
  expect(names).toContain('dsh-only-skill')
  expect(names).toContain('claude-only-skill')
})

it('reveals each root tool only after the real loader reads that skill from its root', async () => {
  await seedRoots()
  const ctx = await makeHost()
  registerTool(ctx, 'dsh_tool')
  registerTool(ctx, 'agents_tool')
  registerTool(ctx, 'claude_tool')
  await writeFile(bindingPath, JSON.stringify({
    version: 1,
    bindings: [
      { skill: 'dsh-root-skill', tools: ['dsh_tool'] },
      { skill: 'agents-root-skill', tools: ['agents_tool'] },
      { skill: 'claude-root-skill', tools: ['claude_tool'] },
    ],
  }), 'utf8')

  const postExecuted: string[] = []
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    postExecuted.push(`${exec.name}:${String(result.isError)}`)
    return decision
  })

  const { agent } = await makeAgent(ctx, 'roots-agent')
  // The registry's own lifecycle: enter the Agent, then run its creation dispatch.
  await ctx.agents.register(agent)
  // Only the loader is visible; every bound tool is masked until its skill loads.
  expect(visible(ctx, agent)).toEqual(['skill'])

  const dsh = await loadSkill(ctx, agent, 'dsh-root-skill', 'c1')
  expect(dsh.result.isError).toBe(false)
  expect(dsh.text).toContain('Body from dsh-root.')
  expect(dsh.text).toContain('<skill_content name="dsh-root-skill">')
  expect(visible(ctx, agent)).toEqual(['dsh_tool', 'skill'])

  const agents = await loadSkill(ctx, agent, 'agents-root-skill', 'c2')
  expect(agents.text).toContain('Body from agents-root.')
  expect(visible(ctx, agent)).toEqual(['agents_tool', 'dsh_tool', 'skill'])

  const claude = await loadSkill(ctx, agent, 'claude-root-skill', 'c3')
  expect(claude.text).toContain('Body from claude-root.')
  expect(visible(ctx, agent)).toEqual(['agents_tool', 'claude_tool', 'dsh_tool', 'skill'])

  // Every unlock above came from a real pipeline event, not a hand-fired one.
  expect(postExecuted).toEqual(['skill:false', 'skill:false', 'skill:false'])
})
