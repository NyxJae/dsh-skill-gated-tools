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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
/** Skill name the guide registers under; distinct from the maintenance skill `skill-gate`. */
export const GUIDE_SKILL_NAME = 'skill-gated-tools';
/** Catalog text: what the skill is for, in both languages the user writes in. */
export const GUIDE_DESCRIPTION = '工具与技能门控配置指导：把工具绑定到技能、永久屏蔽工具、引用暂时缺失的技能或工具、排查被隐藏的工具为什么不出现。'
    + 'Use when configuring skill-gated tool visibility — binding tools to skills, blocking tools permanently,'
    + ' keeping rules that reference missing skills or tools, or diagnosing a gated tool that never shows up.';
/** The asset, addressed from the built entry in `lib/`. */
const GUIDE_FILE = new URL('../skill/SKILL.md', import.meta.url);
/** The asset's directory, published as the skill's resource base. */
const GUIDE_DIR = new URL('../skill/', import.meta.url);
/** Matches a leading YAML frontmatter block. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
/**
 * Split a Markdown asset into its frontmatter fields and its body.
 *
 * Only the flat `key: value` lines this asset uses are read; the block is
 * stripped from the body either way, so no frontmatter reaches the model.
 * @param markdown - the asset's text.
 * @returns frontmatter fields and the remaining body.
 */
export function parseGuide(markdown) {
    const match = FRONTMATTER.exec(markdown);
    if (match === null)
        return { fields: {}, body: markdown };
    const fields = {};
    for (const line of (match[1] ?? '').split(/\r?\n/)) {
        const at = line.indexOf(':');
        if (at <= 0)
            continue;
        fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
    // The blank line separating frontmatter from content is layout, not content.
    return { fields, body: markdown.slice(match[0].length).replace(/^[ \t]*\r?\n/, '') };
}
/**
 * Read the guide asset.
 * @param file - the asset location; defaults to the packaged one.
 * @returns the parsed document.
 */
export function readGuide(file = GUIDE_FILE) {
    return parseGuide(readFileSync(file, 'utf8'));
}
/**
 * Publish the guide as a skill on a context whose `skills` service is live.
 *
 * Registered without a scope, so it lands in the global layer next to the
 * registry's own rank. Disposal follows the registration through Cordis.
 * @param ctx - context carrying a live `skills` registry.
 * @param load - guide loader, overridable so the failure path stays testable.
 * @returns the registration's disposer, or a no-op when nothing was registered.
 */
export function registerGuideSkill(ctx, load = readGuide) {
    const skills = ctx.get('skills');
    if (skills === undefined)
        return () => { };
    let guide;
    try {
        guide = load();
    }
    catch (error) {
        ctx.logger.warn(`skill-gate: bundled guide skill unavailable: ${String(error)}`);
        return () => { };
    }
    if (guide.body.trim() === '') {
        ctx.logger.warn(`skill-gate: bundled guide skill at ${fileURLToPath(GUIDE_FILE)} is empty`);
        return () => { };
    }
    return skills.register({
        name: GUIDE_SKILL_NAME,
        description: GUIDE_DESCRIPTION,
        content: guide.body,
        source: 'bundled',
        resourceBase: { kind: 'directory', path: fileURLToPath(GUIDE_DIR) },
    });
}
//# sourceMappingURL=guide.js.map