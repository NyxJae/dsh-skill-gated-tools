/** Skill-load recognition from durable session events. */
import { expect, it } from 'vitest'
import { loadedSkillsFrom, skillNameOf } from '../src/gate.ts'

it('reads a name from a normalized payload', () => {
  expect(skillNameOf({ name: 'office-docx' })).toBe('office-docx')
})

it('reads a name from the raw JSON the model produced', () => {
  expect(skillNameOf('{"name":"office-docx"}')).toBe('office-docx')
})

it('returns undefined for a payload with no name', () => {
  expect(skillNameOf('{}')).toBeUndefined()
  expect(skillNameOf(undefined)).toBeUndefined()
  expect(skillNameOf('not json')).toBeUndefined()
})

it('counts a skill-invocation user message', () => {
  const loaded = loadedSkillsFrom([
    { type: 'user/message', data: { source: { kind: 'skill-invocation', name: 'browser-skill' } } },
  ])
  expect([...loaded]).toEqual(['browser-skill'])
})

it('counts a skill call whose result did not fail', () => {
  const loaded = loadedSkillsFrom([
    { type: 'tool/call', data: { callId: 'c1', name: 'skill', arguments: { name: 'office-docx' } } },
    { type: 'tool/result', data: { message: { toolCallId: 'c1', isError: false } } },
  ])
  expect([...loaded]).toEqual(['office-docx'])
})

it('ignores a skill call whose result failed', () => {
  const loaded = loadedSkillsFrom([
    { type: 'tool/call', data: { callId: 'c1', name: 'skill', arguments: { name: 'office-docx' } } },
    { type: 'tool/result', data: { message: { toolCallId: 'c1', isError: true } } },
  ])
  expect(loaded.size).toBe(0)
})

it('ignores a call to a tool that is not skill', () => {
  const loaded = loadedSkillsFrom([
    { type: 'tool/call', data: { callId: 'c1', name: 'read', arguments: { name: 'office-docx' } } },
    { type: 'tool/result', data: { message: { toolCallId: 'c1', isError: false } } },
  ])
  expect(loaded.size).toBe(0)
})

it('ignores a skill call still awaiting its result', () => {
  const loaded = loadedSkillsFrom([
    { type: 'tool/call', data: { callId: 'c1', name: 'skill', arguments: { name: 'office-docx' } } },
  ])
  expect(loaded.size).toBe(0)
})

it('pairs results by call id rather than arrival order', () => {
  const loaded = loadedSkillsFrom([
    { type: 'tool/call', data: { callId: 'c1', name: 'skill', arguments: { name: 'a' } } },
    { type: 'tool/call', data: { callId: 'c2', name: 'skill', arguments: { name: 'b' } } },
    { type: 'tool/result', data: { message: { toolCallId: 'c2', isError: true } } },
    { type: 'tool/result', data: { message: { toolCallId: 'c1', isError: false } } },
  ])
  expect([...loaded]).toEqual(['a'])
})
