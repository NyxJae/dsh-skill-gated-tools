/** Tool policy projection and per-selection edits. */
import { expect, it } from 'vitest'
import { describeTools, replacePolicies } from '../src/policy.ts'

it('projects only supplied preset tools and lets blocking override skill gates', () => {
  const bindings = [{ skill: 's', tools: ['shared', 'gated', 'missing'] }]
  expect(describeTools(['read', 'gated', 'shared', 'read'], bindings, ['shared', 'missing'])).toEqual([
    { name: 'gated', policy: 'gated', skills: ['s'] },
    { name: 'read', policy: 'available', skills: [] },
    { name: 'shared', policy: 'blocked', skills: ['s'] },
  ])
})
it('lists every distinct unlocking skill for a tool', () => {
  expect(describeTools(['tool'], [{ skill: 'b', tools: ['tool'] }, { skill: 'a', tools: ['tool'] }, { skill: 'b', tools: ['tool'] }], [])[0]?.skills).toEqual(['a', 'b'])
})
it('replaces selected rules with a block while preserving unrelated rules', () => {
  expect(replacePolicies([{ skill: 's', tools: ['selected', 'keep'] }], ['existing'], ['selected', 'read'], 'blocked', [])).toEqual({
    bindings: [{ skill: 's', tools: ['keep'] }], blockedTools: ['existing', 'read', 'selected'],
  })
})
it('changes a blocked tool into a multi-skill gate in one save', () => {
  expect(replacePolicies([{ skill: 'a', tools: ['keep'] }], ['selected', 'keep-blocked'], ['selected'], 'gated', ['a', 'b'])).toEqual({
    bindings: [{ skill: 'a', tools: ['keep', 'selected'] }, { skill: 'b', tools: ['selected'] }], blockedTools: ['keep-blocked'],
  })
})
it('restores selected tools to available without leaving an unlocking binding', () => {
  expect(replacePolicies([{ skill: 's', tools: ['selected'] }], ['selected'], ['selected'], 'available', [])).toEqual({ bindings: [], blockedTools: [] })
})
