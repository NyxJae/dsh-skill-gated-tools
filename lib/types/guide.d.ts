/**
 * The bundled configuration guide, published as a loadable skill.
 *
 * The guide is the only thing that tells a model how the gate is configured, so
 * it ships as a real Markdown asset next to the built entry (`skill/SKILL.md`,
 * listed in `package.json#files`) instead of a string buried in code, and its
 * frontmatter carries the same name and description the registration publishes.
 *
 * A composition without a skill registry, or a package that lost the asset,
 * must still boot: this module reports the problem and registers nothing.
 *
 * @module dsh-skill-gated-tools/guide
 */
import type { Context } from '@deepseek-ai/cordis';
/** Skill name the guide registers under; distinct from the maintenance skill `skill-gate`. */
export declare const GUIDE_SKILL_NAME = "skill-gated-tools";
/** Catalog text: what the skill is for, in both languages the user writes in. */
export declare const GUIDE_DESCRIPTION: string;
/** One parsed guide document. */
export interface GuideDocument {
    /** Frontmatter fields, trimmed; empty when the asset carries no frontmatter. */
    readonly fields: Readonly<Record<string, string>>;
    /** The guide text the model reads, without frontmatter. */
    readonly body: string;
}
/**
 * Split a Markdown asset into its frontmatter fields and its body.
 *
 * Only the flat `key: value` lines this asset uses are read; the block is
 * stripped from the body either way, so no frontmatter reaches the model.
 * @param markdown - the asset's text.
 * @returns frontmatter fields and the remaining body.
 */
export declare function parseGuide(markdown: string): GuideDocument;
/**
 * Read the guide asset.
 * @param file - the asset location; defaults to the packaged one.
 * @returns the parsed document.
 */
export declare function readGuide(file?: URL): GuideDocument;
/**
 * Publish the guide as a skill on a context whose `skills` service is live.
 *
 * Registered without a scope, so it lands in the global layer next to the
 * registry's own rank. Disposal follows the registration through Cordis.
 * @param ctx - context carrying a live `skills` registry.
 * @param load - guide loader, overridable so the failure path stays testable.
 * @returns the registration's disposer, or a no-op when nothing was registered.
 */
export declare function registerGuideSkill(ctx: Context, load?: () => GuideDocument): () => void;
//# sourceMappingURL=guide.d.ts.map