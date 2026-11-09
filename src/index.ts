/**
 * Plugin entry: wires the binding store, the gate, and the settings route onto
 * Harness events.
 *
 * The plugin observes Agent creation and `skill` tool results; it never
 * registers a tool of its own and never modifies another plugin's
 * registration.
 *
 * @module dsh-skill-gated-tools
 */

import type {} from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Context } from '@deepseek-ai/cordis'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import z from '@deepseek-ai/schemastery'
import { mountApi, type RequestFence, type RouteHost, type SkillCatalog, type SkillNames, type StorageLocations } from './api.ts'
import { BindingStore, defaultBindingPath, profileBindingPath } from './bindings.ts'
import { mountClaudeSkills } from './claude-skills.ts'
import { SkillGate, skillNameOf } from './gate.ts'
import { registerGuideSkill } from './guide.ts'

export const name = 'skill-gate'
export const inject = ['tools', 'agents']

/** Plugin configuration. */
export interface Config {
  /** Absolute path of the binding document; defaults to the active profile's own file. */
  bindingPath?: string
  /** Serve the settings REST surface; defaults to true. */
  settingsRoute?: boolean
}

/** Configuration schema. */
export const Config: z<Config> = z.object({
  bindingPath: z.string().description('Absolute path of the binding document.'),
  settingsRoute: z.boolean().default(true).description('Serve the settings REST surface.'),
})

/** The working-directory service, typed locally so skill discovery stays optional. */
interface WorkingDirectory {
  readonly defaultDirectory: string
  ensure(agent: Agent, signal?: AbortSignal): Promise<string>
}

/** The launcher-owned profile facts, typed locally so the plugin also loads outside a profile. */
interface ProfileContext {
  readonly name: string
  readonly dir: string
}

/** The preset registry, typed locally so skill discovery stays optional. */
interface PresetRegistry {
  acquireScope(id?: string): Promise<{ readonly key: unknown } & AsyncDisposable>
}

/** Tool names visible in one Agent's scope, as the gate needs them. */
function toolsOf(ctx: Context, agent: Agent): ReadonlySet<string> {
  return new Set(ctx.tools.schemas(scopeOf(agent.ctx)).map(schema => schema.name))
}

/**
 * Every skill name the settings page can offer.
 *
 * A bare `list()` reads the global layer with no `cwd`, which misses both
 * project roots and any provider mounted by an Agent preset — the standard
 * preset mounts `skill-filesystem` itself, so the global layer often holds
 * nothing at all. Three views are therefore merged:
 *
 * - the global layer, with the deployment's default directory as `cwd`;
 * - the default preset's scope, borrowed for the duration of this read so the
 *   page works before any session exists;
 * - each live Agent's own scope with its resolved working directory.
 * @param ctx - context supplying the skill registry, working directory, and preset registry.
 * @param agents - every live Agent, or a snapshot of them.
 * @returns the union of every view's skill names, name-sorted.
 */
async function skillPanorama(ctx: Context, agents: readonly Agent[]): Promise<readonly string[]> {
  const names = new Set<string>()
  const collect = async (view: { cwd?: string; scope?: unknown }): Promise<void> => {
    const skills = ctx.get('skills') as SkillCatalog | undefined
    if (skills === undefined) return
    for (const skill of await skills.list(view)) names.add(skill.name)
  }
  const workingDirectory = ctx.get('workingDirectory') as WorkingDirectory | undefined
  const defaultCwd = workingDirectory?.defaultDirectory
  await collect(defaultCwd === undefined ? {} : { cwd: defaultCwd })

  // A cold read of the default preset: `acquireScope` mounts the preset's
  // composition without creating an Agent, which is how a session-addressed
  // catalog serves a Session that is not open.
  const presets = ctx.get('agentPresets') as PresetRegistry | undefined
  if (presets !== undefined) {
    try {
      await using lease = await presets.acquireScope()
      await collect({ scope: lease.key, ...defaultCwd === undefined ? {} : { cwd: defaultCwd } })
    } catch (error) {
      ctx.logger.warn(`skill-gate: default preset skill view skipped: ${String(error)}`)
    }
  }

  for (const agent of agents) {
    try {
      const cwd = workingDirectory === undefined
        ? undefined
        : await workingDirectory.ensure(agent)
      await collect({ scope: scopeOf(agent.ctx), ...cwd === undefined ? {} : { cwd } })
    } catch (error) {
      ctx.logger.warn(`skill-gate: skill view for ${String(agent.id)} skipped: ${String(error)}`)
    }
  }
  return [...names].sort()
}

/** Read a cold default-preset catalog, independent of any live Agent or skill history. */
export async function startupToolNames(ctx: Context): Promise<ReadonlySet<string>> {
  const presets = ctx.get('agentPresets') as PresetRegistry | undefined
  if (presets === undefined) throw new Error('default preset service is unavailable')
  await using lease = await presets.acquireScope()
  return new Set(ctx.tools.schemas(lease.key as never).map(schema => schema.name))
}

/**
 * Install the gate.
 * @param ctx - plugin context supplying the tool registry and Agent registry.
 * @param config - optional binding-document override.
 */
export function apply(ctx: Context, config: Config = {}): void {
  // A process launched by `dsh` reports its profile, so two hosts on one
  // Harness home keep separate tables instead of overwriting each other. The
  // legacy global file is never rewritten here: it is offered for an explicit
  // import only.
  const profile = ctx.get('profileContext') as ProfileContext | undefined
  const legacyPath = defaultBindingPath()
  const store = new BindingStore(config.bindingPath
    ?? (profile === undefined ? legacyPath : profileBindingPath(profile.dir)))
  const locations: StorageLocations | undefined = profile === undefined
    ? undefined
    : {
        legacyPath,
        profileName: profile.name,
        ...store.file === legacyPath ? {} : { legacy: new BindingStore(legacyPath) },
      }
  const gate = new SkillGate(store)

  ctx.effect(() => () => {
    gate.dispose()
  }, 'skill-gate')

  /**
   * Every tool name the settings page can offer: the unscoped view, the
   * default preset's composition, every live Agent's scope, and everything the
   * gate has seen in a scope before. A composition that mounts a preset per
   * Agent registers its tools in the preset and Agent scopes, so the unscoped
   * view alone is empty before the first session.
   * @returns every visible tool name.
   */
  const toolPanorama = async (): Promise<ReadonlySet<string>> => {
    const names = new Set(ctx.tools.schemas().map(schema => schema.name))
    for (const name of gate.observed()) names.add(name)
    const presets = ctx.get('agentPresets') as PresetRegistry | undefined
    if (presets !== undefined) {
      try {
        await using lease = await presets.acquireScope()
        for (const schema of ctx.tools.schemas(lease.key as never)) names.add(schema.name)
      } catch (error) {
        ctx.logger.warn(`skill-gate: default preset tool view skipped: ${String(error)}`)
      }
    }
    for (const agent of gate.agents()) {
      for (const name of toolsOf(ctx, agent)) names.add(name)
    }
    return names
  }

  // The settings page needs a REST surface; a profile without a web server
  // (headless, ACP, SDK) never runs this block, so the plugin keeps gating
  // tools there instead of failing to boot. A scoped `inject` gives the block
  // its own context, which loads once `webServer` exists and unloads with it.
  if (config.settingsRoute !== false) {
    ctx.inject(['webServer'], (scope) => {
      const skillNames: SkillNames | undefined = scope.get('skills') === undefined
        ? undefined
        : () => skillPanorama(scope, [...gate.agents()])
      mountApi(
        scope,
        store,
        scope.get('webServer') as RouteHost,
        toolPanorama,
        skillNames,
        () => scope.get('connection') as RequestFence | undefined,
        () => startupToolNames(scope),
        locations,
      )
    })
  }

  // Contributions to global skill discovery: the Claude root as a last-ranked
  // fallback, and the bundled guide skill. A composition without a skill
  // registry (headless, ACP, SDK) still gates tools and skips both.
  ctx.inject(['skills'], (scope) => {
    mountClaudeSkills(scope)
    registerGuideSkill(scope)
  })

  // A malformed binding file must fail visibly without breaking Agent creation:
  // the gate reports the problem and leaves tools visible rather than taking
  // the whole session down over a typo in a visibility table.
  const report = (operation: string) => (error: unknown) => {
    ctx.logger.warn(`skill-gate: ${operation} failed, tools stay visible: ${String(error)}`)
  }

  ctx.on('agent/created', async ({ agent }) => {
    await gate.arm(agent, toolsOf(ctx, agent)).catch(report(`arming ${String(agent.id)}`))
  })

  // A tool that registers after an Agent was armed must still be masked.
  // The listener is synchronous by contract, so the work runs detached.
  ctx.on('tools/change', () => {
    void gate.refresh(agent => toolsOf(ctx, agent)).catch(report('refresh after tools/change'))
  })

  ctx.on('tools/post-execute', async (exec, result, next) => {
    const decision = await next()
    if (exec.name !== 'skill' || result.isError) return decision
    const agent = exec.agent
    if (agent === undefined) return decision
    const skill = skillNameOf(exec.arguments)
    if (skill === undefined) return decision
    await gate.unlock(agent, skill).catch(report(`unlocking ${skill}`))
    return decision
  })
}
