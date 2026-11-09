/**
 * Skill-gated tool visibility.
 *
 * A tool listed in the binding document is hidden from every Agent until that
 * Agent loads a skill bound to it; blocked tools stay hidden. Tools absent from the document are never
 * touched, so the plugin is inert until the user opts a tool in.
 *
 * Visibility is masked per Agent with `ctx.tools.restrict({ deny })`, which
 * removes the tool from that Agent's schema set, lookups, and dispatch while
 * leaving every plugin's registration untouched.
 *
 * @module dsh-skill-gated-tools/gate
 */

import type {} from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Bindings } from './bindings.ts'

/** One Agent's gating state. */
interface AgentGate {
  /** Tools still masked for this Agent. */
  readonly masked: Set<string>
  /** Disposers that lift the current masks. */
  readonly lifts: (() => void)[]
  /** Skills this Agent has already loaded. */
  readonly unlocked: Set<string>
}

/**
 * Parse a `skill` tool argument payload, which arrives normalized (object) or
 * as the raw JSON string the model produced.
 * @param args - the normalized or raw argument value.
 * @returns the requested skill name, when the payload carries one.
 */
export function skillNameOf(args: unknown): string | undefined {
  if (typeof args === 'string') {
    try {
      return skillNameOf(JSON.parse(args))
    } catch {
      return undefined
    }
  }
  if (typeof args !== 'object' || args === null) return undefined
  const name = (args as { name?: unknown }).name
  return typeof name === 'string' ? name : undefined
}

/** The session event shape this fold reads; other fields stay unread. */
interface LoadEvent {
  readonly type: string
  readonly data: unknown
}

/**
 * Decide which skills a durable session log proves were loaded.
 *
 * Two shapes count: a `skill-invocation` user message (the `/name` gesture
 * path) and a `skill` tool call paired with a non-error result. The pairing
 * crosses two events, so the fold keeps the call open until its result arrives.
 * @param events - the Agent's durable session events, in order.
 * @returns skill names the log proves were loaded.
 */
export function loadedSkillsFrom(events: readonly LoadEvent[]): Set<string> {
  const loaded = new Set<string>()
  const pending = new Map<string, string>()
  for (const event of events) {
    if (event.type === 'user/message') {
      const source = (event.data as { source?: { kind?: unknown; name?: unknown } }).source
      if (source?.kind === 'skill-invocation' && typeof source.name === 'string') loaded.add(source.name)
      continue
    }
    if (event.type === 'tool/call') {
      const data = event.data as { callId?: unknown; name?: unknown; arguments?: unknown }
      if (data.name !== 'skill' || typeof data.callId !== 'string') continue
      const skill = skillNameOf(data.arguments)
      if (skill !== undefined) pending.set(data.callId, skill)
      continue
    }
    if (event.type === 'tool/result') {
      const data = event.data as { message?: { toolCallId?: unknown; isError?: unknown } }
      const callId = data.message?.toolCallId
      if (typeof callId !== 'string') continue
      const skill = pending.get(callId)
      if (skill === undefined) continue
      pending.delete(callId)
      if (data.message?.isError !== true) loaded.add(skill)
    }
  }
  return loaded
}

/**
 * Owns the per-Agent masks and lifts them as skills load.
 *
 * Every mask is created on `agent.ctx`, so Agent disposal removes it even if
 * this plugin is never asked to. The plugin also keeps each disposer so
 * unloading lifts masks immediately instead of waiting for Agent teardown.
 */
export class SkillGate {
  private readonly gates = new Map<Agent, AgentGate>()
  /**
   * Every tool name any Agent has ever been seen with. The settings page reads
   * this so it can offer tools before a session has ever started, and keep
   * offering them after the last session ends.
   */
  private readonly seen = new Set<string>()

  constructor(
    private readonly store: { load(): Promise<Bindings> },
  ) {}

  /**
   * Install the gate for one Agent: mask every bound tool that is currently
   * registered, then unlock whatever the Agent's own log already proves.
   * @param agent - the Agent whose creation triggered this.
   * @param knownTools - tool names visible in that Agent's scope right now.
   */
  async arm(agent: Agent, knownTools: ReadonlySet<string>): Promise<void> {
    for (const tool of knownTools) this.seen.add(tool)
    const gate: AgentGate = { masked: new Set(), lifts: [], unlocked: new Set() }
    this.gates.set(agent, gate)
    agent.ctx.effect(() => () => {
      this.gates.delete(agent)
    }, 'skill-gate.agent')

    const bindings = await this.store.load()
    if (bindings.gated.size === 0) return

    for (const skill of loadedSkillsFrom(agent.session.snapshotEvents())) gate.unlocked.add(skill)

    const toMask = new Set<string>()
    for (const tool of bindings.gated) {
      if (!knownTools.has(tool)) continue
      if (this.unlockedBy(bindings, gate.unlocked, tool)) continue
      toMask.add(tool)
    }
    for (const tool of toMask) gate.masked.add(tool)
    this.reapply(agent, gate)
  }

  /**
   * Apply each live Agent's own tool set to its mask, so a tool that registers
   * after an Agent was armed is masked too.
   * @param knownToolsOf - resolves the tool names visible in one Agent's scope.
   */
  async refresh(knownToolsOf: (agent: Agent) => ReadonlySet<string>): Promise<void> {
    for (const agent of this.gates.keys()) {
      for (const tool of knownToolsOf(agent)) this.seen.add(tool)
    }
    const bindings = await this.store.load()
    if (bindings.gated.size === 0) return
    for (const [agent, gate] of this.gates) {
      const knownTools = knownToolsOf(agent)
      const added = new Set<string>()
      for (const tool of bindings.gated) {
        if (!knownTools.has(tool) || gate.masked.has(tool)) continue
        if (this.unlockedBy(bindings, gate.unlocked, tool)) continue
        added.add(tool)
      }
      if (added.size === 0) continue
      for (const tool of added) gate.masked.add(tool)
      this.reapply(agent, gate)
    }
  }

  /** Agents currently under the gate, in creation order. */
  agents(): readonly Agent[] {
    return [...this.gates.keys()]
  }

  /** Every tool name this gate has observed in any Agent scope. */
  observed(): ReadonlySet<string> {
    return this.seen
  }

  /**
   * Record one successful skill load and lift the tools it unlocks.
   * @param agent - the Agent that loaded the skill.
   * @param skill - the loaded skill name.
   */
  async unlock(agent: Agent, skill: string): Promise<void> {
    const gate = this.gates.get(agent)
    if (gate === undefined || gate.unlocked.has(skill)) return
    gate.unlocked.add(skill)

    const bindings = await this.store.load()
    const tools = bindings.bySkill.get(skill)
    if (tools === undefined) return
    const release = tools.filter(tool => gate.masked.has(tool) && !bindings.blockedTools.has(tool))
    if (release.length === 0) return
    for (const tool of release) gate.masked.delete(tool)
    this.reapply(agent, gate)
  }

  /** Dispose the previous masks and install one for the current hidden set. */
  private reapply(agent: Agent, gate: AgentGate): void {
    for (const lift of gate.lifts.splice(0)) lift()
    if (gate.masked.size === 0) return
    gate.lifts.push(agent.ctx.tools.restrict({ deny: [...gate.masked] }))
  }

  /** Whether a loaded skill unlocks this tool. */
  private unlockedBy(bindings: Bindings, unlocked: ReadonlySet<string>, tool: string): boolean {
    if (bindings.blockedTools.has(tool)) return false
    for (const skill of unlocked) {
      if (bindings.bySkill.get(skill)?.includes(tool) === true) return true
    }
    return false
  }

  /** Drop every live mask. */
  dispose(): void {
    for (const gate of this.gates.values()) {
      for (const lift of gate.lifts.splice(0)) lift()
      gate.masked.clear()
    }
    this.gates.clear()
  }
}
