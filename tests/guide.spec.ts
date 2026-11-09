/**
 * The bundled configuration guide: the asset it ships as, the metadata the
 * registration publishes, and what happens when the registry or the asset is
 * missing.
 */
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import {
  GUIDE_DESCRIPTION,
  GUIDE_SKILL_NAME,
  parseGuide,
  readGuide,
  registerGuideSkill,
  type GuideDocument,
} from '../src/guide.ts'

const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
})

/** A registry-bearing context awaiting the guide registration. */
async function makeContext(): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SkillRegistry)
  return ctx
}

describe('parseGuide', () => {
  it('splits frontmatter fields from the body', () => {
    const parsed = parseGuide('---\nname: demo\ndescription: What: it does\n---\n# Body\ntext\n')
    expect(parsed.fields).toEqual({ name: 'demo', description: 'What: it does' })
    expect(parsed.body).toBe('# Body\ntext\n')
  })

  it('returns the text unchanged when there is no frontmatter', () => {
    expect(parseGuide('# Body\n')).toEqual({ fields: {}, body: '# Body\n' })
  })

  it('accepts CRLF frontmatter', () => {
    const parsed = parseGuide('---\r\nname: demo\r\n---\r\n# Body\r\n')
    expect(parsed.fields['name']).toBe('demo')
    expect(parsed.body).toBe('# Body\r\n')
  })
})

describe('the packaged guide asset', () => {
  it('publishes the name and description its frontmatter carries', () => {
    const guide = readGuide()
    expect(guide.fields['name']).toBe(GUIDE_SKILL_NAME)
    expect(guide.fields['description']).toBe(GUIDE_DESCRIPTION)
    expect(guide.body.startsWith('# ')).toBe(true)
    expect(guide.body).not.toContain('description:')
  })

  it('documents the binding document, both rules, and the reopen hint', () => {
    const body = readGuide().body
    expect(body).toContain('skill-gate/bindings.json')
    expect(body).toContain('blockedTools')
    expect(body).toContain('重新打开会话')
  })
})

describe('registerGuideSkill', () => {
  it('serves the guide through the real skill registry', async () => {
    const ctx = await makeContext()
    registerGuideSkill(ctx)

    const listed = await ctx.skills.list()
    const entry = listed.find(skill => skill.name === GUIDE_SKILL_NAME)
    expect(entry?.source).toBe('bundled')

    const loaded = await ctx.skills.get(GUIDE_SKILL_NAME)
    expect(loaded?.content).toContain('skill-gate/bindings.json')
    const base = loaded?.resourceBase
    expect(base?.kind).toBe('directory')
    const file = join((base as { path: string }).path, 'SKILL.md')
    expect(statSync(file).isFile()).toBe(true)
    expect(readFileSync(file, 'utf8')).toContain(GUIDE_SKILL_NAME)
  })

  it('unregisters when its disposer runs', async () => {
    const ctx = await makeContext()
    const dispose = registerGuideSkill(ctx)
    expect((await ctx.skills.list()).map(skill => skill.name)).toContain(GUIDE_SKILL_NAME)

    dispose()
    expect((await ctx.skills.list()).map(skill => skill.name)).not.toContain(GUIDE_SKILL_NAME)
  })

  it('stays quiet without a skill registry', () => {
    const ctx = new Context()
    contexts.push(ctx)
    expect(typeof registerGuideSkill(ctx)).toBe('function')
  })

  it('reports a missing or empty asset instead of failing to boot', async () => {
    const ctx = await makeContext()
    const missing = registerGuideSkill(ctx, () => { throw new Error('missing asset') })
    const empty: GuideDocument = { fields: {}, body: '   \n' }
    const blank = registerGuideSkill(ctx, () => empty)

    expect(typeof missing).toBe('function')
    expect(typeof blank).toBe('function')
    expect((await ctx.skills.list()).map(skill => skill.name)).not.toContain(GUIDE_SKILL_NAME)
  })
})
