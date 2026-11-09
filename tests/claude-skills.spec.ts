/**
 * Claude-root skill contribution: the scanned path, the published rank, and the
 * registry behavior that rank produces against the real skill registry.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry, {
  type SkillCandidate,
  type SkillDefinition,
  type SkillLookupOptions,
  type SkillProvider,
  type SkillProviderObservation,
} from '@deepseek-ai/dsh-skill'
import {
  CLAUDE_PROVIDER_NAME,
  CLAUDE_SKILL_RANK,
  RankedSkillProvider,
  claudeSkillsDir,
  mountClaudeSkills,
} from '../src/claude-skills.ts'

/** A candidate shaped as the registry expects, with an explicit rank. */
function candidate(name: string, rank: number, provider = 'fixture'): SkillCandidate {
  return {
    name,
    description: `${name} description`,
    invocation: { modelInvocable: true, userInvocable: true },
    provider,
    source: provider,
    rank,
    locator: { path: name },
  }
}

/** A provider answering from memory, recording what it was handed. */
class FixtureProvider implements SkillProvider {
  listOptions: SkillLookupOptions | undefined
  getCalls: { candidate: SkillCandidate; options: SkillLookupOptions }[] = []

  constructor(readonly name: string, private readonly answer: SkillCandidate[] | SkillProviderObservation) {}

  async list(options: SkillLookupOptions): Promise<SkillCandidate[] | SkillProviderObservation> {
    this.listOptions = options
    return this.answer
  }

  async get(candidate: SkillCandidate, options: SkillLookupOptions): Promise<SkillDefinition | undefined> {
    this.getCalls.push({ candidate, options })
    return { ...candidate, content: `body of ${candidate.name}` }
  }
}

/** A skill bundle the official provider can parse. */
async function writeSkill(root: string, name: string, body: string): Promise<void> {
  await mkdir(join(root, name), { recursive: true })
  await writeFile(
    join(root, name, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${name} description\n---\n${body}\n`,
    'utf8',
  )
}

describe('claudeSkillsDir', () => {
  it('defaults to the home directory and honours an override', () => {
    expect(claudeSkillsDir({})).toBe(join(homedir(), '.claude', 'skills'))
    expect(claudeSkillsDir({ CLAUDE_CONFIG_DIR: join('C:', 'claude-config') }))
      .toBe(join('C:', 'claude-config', 'skills'))
  })

  it('falls back to the home directory for blank and whitespace overrides', () => {
    expect(claudeSkillsDir({ CLAUDE_CONFIG_DIR: '' })).toBe(join(homedir(), '.claude', 'skills'))
    expect(claudeSkillsDir({ CLAUDE_CONFIG_DIR: '   ' })).toBe(join(homedir(), '.claude', 'skills'))
  })
})

describe('RankedSkillProvider', () => {
  it('republishes array candidates at one rank and forwards lookup options', async () => {
    const inner = new FixtureProvider('inner', [candidate('alpha', 100), candidate('beta', 400)])
    const ranked = new RankedSkillProvider(inner, CLAUDE_SKILL_RANK)
    const options: SkillLookupOptions = {}
    const listed = await ranked.list(options)

    expect(ranked.name).toBe('inner')
    expect(inner.listOptions).toBe(options)
    expect(listed).toEqual([candidate('alpha', CLAUDE_SKILL_RANK), candidate('beta', CLAUDE_SKILL_RANK)])
  })

  it('rewrites candidates inside an incomplete observation', async () => {
    const inner = new FixtureProvider('inner', { candidates: [candidate('gamma', 300)], complete: false })
    const listed = await new RankedSkillProvider(inner, CLAUDE_SKILL_RANK).list({})

    expect(listed).toEqual({ candidates: [candidate('gamma', CLAUDE_SKILL_RANK)], complete: false })
  })

  it('loads bodies through the inner provider unchanged', async () => {
    const inner = new FixtureProvider('inner', [candidate('delta', 100)])
    const ranked = new RankedSkillProvider(inner, CLAUDE_SKILL_RANK)
    const winner = candidate('delta', 100)
    const options: SkillLookupOptions = {}

    expect(await ranked.get(winner, options)).toEqual({ ...winner, content: 'body of delta' })
    expect(inner.getCalls).toEqual([{ candidate: winner, options }])
  })
})

describe('mountClaudeSkills', () => {
  let root: string
  let claudeConfig: string
  const contexts: Context[] = []
  const saved: Record<string, string | undefined> = {}

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'skill-gated-claude-'))
    claudeConfig = join(root, 'claude-config')
    await writeSkill(join(claudeConfig, 'skills'), 'demo-claude', 'Demo body.')
    // Decoys in the roots the official provider would scan on its own; the
    // Claude contribution must not duplicate or re-rank them.
    await writeSkill(join(root, 'dsh-home', 'skills'), 'dsh-decoy', 'Decoy body.')
    await writeSkill(join(root, 'agents-home', 'skills'), 'agents-decoy', 'Decoy body.')

    for (const key of ['CLAUDE_CONFIG_DIR', 'DSH_HOME', 'DSH_AGENTS_HOME']) {
      saved[key] = process.env[key]
    }
    process.env.CLAUDE_CONFIG_DIR = claudeConfig
    process.env.DSH_HOME = join(root, 'dsh-home')
    process.env.DSH_AGENTS_HOME = join(root, 'agents-home')
  })

  afterEach(async () => {
    for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await rm(root, { recursive: true, force: true })
  })

  /** A registry-bearing context already carrying the Claude contribution. */
  async function makeContext(): Promise<Context> {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SkillRegistry)
    mountClaudeSkills(ctx)
    return ctx
  }

  it('serves the Claude root through the real registry and skips the default roots', async () => {
    const ctx = await makeContext()
    const listed = await ctx.skills.list()

    expect(listed.map(skill => skill.name)).toEqual(['demo-claude'])
    expect(listed[0]?.provider).toBe(CLAUDE_PROVIDER_NAME)

    const loaded = await ctx.skills.get('demo-claude')
    expect(loaded?.provider).toBe(CLAUDE_PROVIDER_NAME)
    expect(loaded?.content).toContain('Demo body.')
  })

  it('stays a fallback for same-name skills from the roots already in place', async () => {
    const losing = await makeContext()
    losing.skills.registerProvider(() => new FixtureProvider('built-in', [candidate('demo-claude', 100, 'built-in')]))
    expect((await losing.skills.get('demo-claude'))?.provider).toBe('built-in')

    const winning = await makeContext()
    winning.skills.registerProvider(() => new FixtureProvider('lower', [candidate('demo-claude', 800, 'lower')]))
    expect((await winning.skills.get('demo-claude'))?.provider).toBe(CLAUDE_PROVIDER_NAME)
  })
});
