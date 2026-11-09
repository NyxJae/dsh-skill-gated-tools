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
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { Bindings } from './bindings.ts';
/**
 * Parse a `skill` tool argument payload, which arrives normalized (object) or
 * as the raw JSON string the model produced.
 * @param args - the normalized or raw argument value.
 * @returns the requested skill name, when the payload carries one.
 */
export declare function skillNameOf(args: unknown): string | undefined;
/** The session event shape this fold reads; other fields stay unread. */
interface LoadEvent {
    readonly type: string;
    readonly data: unknown;
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
export declare function loadedSkillsFrom(events: readonly LoadEvent[]): Set<string>;
/**
 * Owns the per-Agent masks and lifts them as skills load.
 *
 * Every mask is created on `agent.ctx`, so Agent disposal removes it even if
 * this plugin is never asked to. The plugin also keeps each disposer so
 * unloading lifts masks immediately instead of waiting for Agent teardown.
 */
export declare class SkillGate {
    private readonly store;
    private readonly gates;
    /**
     * Every tool name any Agent has ever been seen with. The settings page reads
     * this so it can offer tools before a session has ever started, and keep
     * offering them after the last session ends.
     */
    private readonly seen;
    constructor(store: {
        load(): Promise<Bindings>;
    });
    /**
     * Install the gate for one Agent: mask every bound tool that is currently
     * registered, then unlock whatever the Agent's own log already proves.
     * @param agent - the Agent whose creation triggered this.
     * @param knownTools - tool names visible in that Agent's scope right now.
     */
    arm(agent: Agent, knownTools: ReadonlySet<string>): Promise<void>;
    /**
     * Apply each live Agent's own tool set to its mask, so a tool that registers
     * after an Agent was armed is masked too.
     * @param knownToolsOf - resolves the tool names visible in one Agent's scope.
     */
    refresh(knownToolsOf: (agent: Agent) => ReadonlySet<string>): Promise<void>;
    /** Agents currently under the gate, in creation order. */
    agents(): readonly Agent[];
    /** Every tool name this gate has observed in any Agent scope. */
    observed(): ReadonlySet<string>;
    /**
     * Record one successful skill load and lift the tools it unlocks.
     * @param agent - the Agent that loaded the skill.
     * @param skill - the loaded skill name.
     */
    unlock(agent: Agent, skill: string): Promise<void>;
    /** Dispose the previous masks and install one for the current hidden set. */
    private reapply;
    /** Whether a loaded skill unlocks this tool. */
    private unlockedBy;
    /** Drop every live mask. */
    dispose(): void;
}
export {};
//# sourceMappingURL=gate.d.ts.map