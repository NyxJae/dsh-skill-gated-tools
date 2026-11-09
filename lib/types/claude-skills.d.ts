/**
 * Claude skill root: one more official filesystem provider, ranked last.
 *
 * The desktop composition mounts `@deepseek-ai/dsh-skill-filesystem` inside the
 * Agent presets, and that provider scans the DSH and Agents roots only, so
 * `~/.claude/skills` stays invisible to `ctx.skills` unless somebody
 * contributes a provider for it. This module contributes one instance of that
 * same official provider, restricted to the Claude root: discovery, frontmatter
 * parsing, body loading, and watching stay in the shipped implementation.
 *
 * Claude candidates are republished at {@link CLAUDE_SKILL_RANK}, below every
 * built-in root (project 100/200, custom 300, DSH 400, Agents 500, bundled 600),
 * so a Claude skill cannot displace a same-named skill from the roots a
 * deployment already had. Layers still decide first: a preset- or Agent-scoped
 * skill keeps overriding this global contribution exactly as before.
 *
 * @module dsh-skill-gated-tools/claude-skills
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SkillCandidate, SkillDefinition, SkillLookupOptions, SkillProvider, SkillProviderObservation } from '@deepseek-ai/dsh-skill';
/** Provider name, distinct from the preset's `filesystem` provider so both can share the global layer. */
export declare const CLAUDE_PROVIDER_NAME = "claude-skills";
/** Candidate rank below every built-in root (bundled is 600), so Claude skills win no same-name tie. */
export declare const CLAUDE_SKILL_RANK = 700;
/**
 * The root scanned for Claude skills.
 * @param env - environment carrying the optional `CLAUDE_CONFIG_DIR` override; a blank value falls back to the home directory.
 * @returns absolute path of the Claude skills directory.
 */
export declare function claudeSkillsDir(env?: NodeJS.ProcessEnv): string;
/**
 * Provider wrapper that delegates every operation but one fixed candidate rank.
 *
 * The official provider publishes the rank of the root it read, which is the
 * root order that suits a provider owning several roots. A contribution that
 * owns exactly one root instead publishes that root's place in the global
 * order, which the inner provider cannot know.
 */
export declare class RankedSkillProvider implements SkillProvider {
    private readonly inner;
    private readonly rank;
    /**
     * @param inner - provider whose discovery and loading are reused unchanged.
     * @param rank - candidate rank to publish, replacing the inner provider's own.
     */
    constructor(inner: SkillProvider, rank: number);
    /** Provider name, forwarded so one source keeps one identity in the registry. */
    get name(): string;
    /**
     * @param options - lookup options forwarded untouched.
     * @returns the inner candidates with this provider's rank.
     */
    list(options: SkillLookupOptions): Promise<readonly SkillCandidate[] | SkillProviderObservation>;
    /**
     * @param candidate - the winning candidate this provider had listed.
     * @param options - lookup options forwarded untouched.
     * @returns the inner skill body.
     */
    get(candidate: SkillCandidate, options: SkillLookupOptions): Promise<SkillDefinition | undefined>;
}
/**
 * Attach the Claude root to a context whose `skills` service is live.
 *
 * The provider is registered without a scope, so it lands in the global layer
 * and every Agent view inherits it; a missing directory lists as empty until the
 * user creates it. Disposal follows the registration through Cordis, so no
 * explicit teardown is needed here.
 * @param ctx - context carrying a live `skills` registry.
 */
export declare function mountClaudeSkills(ctx: Context): void;
//# sourceMappingURL=claude-skills.d.ts.map