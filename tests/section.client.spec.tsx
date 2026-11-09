// @vitest-environment jsdom
/** Saved policy editing, draft adoption and missing-reference handling through the rendered workspace. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SkillGateSection, type SkillGateSectionProps, type SkillGateInjected } from '../src/client/SkillGateSection.tsx'
import type { Snapshot } from '../src/client/snapshot.ts'
import { en } from '../src/client/locales.ts'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const dictionary: Readonly<Record<string, string>> = en
const t: SkillGateSectionProps['t'] = (key, vars) => {
  const template = dictionary[key] ?? key
  return vars === undefined ? template : template.replace(/\{(\w+)\}/g, (_match: string, name: string) => String(vars[name] ?? name))
}
function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return { skills: ['my-skill', 'other-skill'], tools: ['free_tool', 'gated_tool', 'blocked_tool', 'live_only'],
    skillsResolved: true, startupTools: ['free_tool', 'gated_tool', 'blocked_tool'], bindings: [{ skill: 'my-skill', tools: ['gated_tool'] }],
    blockedTools: ['blocked_tool'], warnings: [], bindingPath: 'C:/home/profiles/web/skill-gate/bindings.json',
    profileName: 'web', legacyBindingPath: 'C:/home/skill-gate/bindings.json', legacyAvailable: false, ...overrides }
}
function view(
  state = snapshot(),
  save: SkillGateInjected['save'] = async rows => rows,
  importLegacy: SkillGateInjected['importLegacy'] = async () => ({ bindings: state.bindings, blockedTools: state.blockedTools }),
) {
  const load = vi.fn(async () => state)
  render(<SkillGateSection load={load} save={save} importLegacy={importLegacy} t={t} />)
  return { load }
}
async function edit(tool: string) { fireEvent.click(await screen.findByRole('button', { name: 'Edit ' + tool })) }
function choose(policy: string) { fireEvent.click(screen.getByRole('radio', { name: new RegExp('^' + policy) })) }
function saveRule() { fireEvent.click(screen.getByRole('button', { name: en['save.submit'] })) }

it('shows the effective binding file without offering an import', async () => {
  view()
  expect(await screen.findByText('C:/home/profiles/web/skill-gate/bindings.json')).toBeTruthy()
  expect(screen.queryByRole('button', { name: en['legacy.import'] })).toBeNull()
})
it('copies the legacy document only when the user asks for it', async () => {
  const importLegacy = vi.fn<SkillGateInjected['importLegacy']>(async () => ({
    bindings: [{ skill: 'ssh', tools: ['ssh_exec'] }], blockedTools: ['browser_click'],
  }))
  view(snapshot({ legacyAvailable: true }), async rows => rows, importLegacy)
  fireEvent.click(await screen.findByRole('button', { name: en['legacy.import'] }))
  await waitFor(() => expect(importLegacy).toHaveBeenCalled())
  expect(await screen.findByText(en['legacy.imported'])).toBeTruthy()
  expect(screen.queryByRole('button', { name: en['legacy.import'] })).toBeNull()
  expect(await screen.findByText('ssh_exec')).toBeTruthy()
})
it('shows compact tool rows and opens the existing rule for editing', async () => {
  view()
  await edit('gated_tool')
  expect((screen.getByRole('radio', { name: /^Skill-gated/ }) as HTMLInputElement).checked).toBe(true)
  expect((screen.getByRole('checkbox', { name: 'my-skill' }) as HTMLInputElement).checked).toBe(true)
})
it('saves an independent block and preserves unrelated skill bindings and blocks', async () => {
  const save = vi.fn<SkillGateInjected['save']>(async rows => rows)
  view(snapshot(), save)
  await edit('free_tool'); choose('Always blocked'); saveRule()
  await waitFor(() => expect(save).toHaveBeenCalledWith([{ skill: 'my-skill', tools: ['gated_tool'] }], ['blocked_tool', 'free_tool']))
})
it('assigns multiple unlocking skills while retaining other tools in those skills', async () => {
  const save = vi.fn<SkillGateInjected['save']>(async rows => rows)
  view(snapshot(), save)
  await edit('free_tool'); choose('Skill-gated')
  fireEvent.click(screen.getByRole('checkbox', { name: 'my-skill' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'other-skill' }))
  saveRule()
  await waitFor(() => expect(save).toHaveBeenCalledWith([
    { skill: 'my-skill', tools: ['free_tool', 'gated_tool'] }, { skill: 'other-skill', tools: ['free_tool'] },
  ], ['blocked_tool']))
})
it('restores a gated tool to available and removes its prior binding', async () => {
  const save = vi.fn<SkillGateInjected['save']>(async rows => rows)
  view(snapshot(), save)
  await edit('gated_tool'); choose('Available'); saveRule()
  await waitFor(() => expect(save).toHaveBeenCalledWith([], ['blocked_tool']))
})
it('requires an explicit policy before saving a batch selection', async () => {
  const save = vi.fn<SkillGateInjected['save']>(async rows => rows)
  view(snapshot(), save)
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Select free_tool' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select gated_tool' }))
  expect((screen.getByRole('button', { name: en['save.submit'] }) as HTMLButtonElement).disabled).toBe(true)
  choose('Always blocked'); saveRule()
  await waitFor(() => expect(save).toHaveBeenCalledWith([], ['blocked_tool', 'free_tool', 'gated_tool']))
})
it('retains selections and draft skills after a failed save, allowing a retry', async () => {
  const save = vi.fn<SkillGateInjected['save']>().mockRejectedValueOnce(new Error('disk full')).mockImplementation(async rows => rows)
  view(snapshot(), save)
  await edit('free_tool'); choose('Skill-gated')
  fireEvent.click(screen.getByRole('checkbox', { name: 'other-skill' })); saveRule()
  expect((await screen.findByRole('alert')).textContent).toContain('disk full')
  expect((screen.getByRole('checkbox', { name: 'other-skill' }) as HTMLInputElement).checked).toBe(true)
  saveRule()
  await screen.findByText(en['save.saved'])
  expect(save).toHaveBeenCalledTimes(2)
})

it('drops the edit draft when an import replaces the rules it came from', async () => {
  const importLegacy = vi.fn<SkillGateInjected['importLegacy']>(async () => ({ bindings: [], blockedTools: ['gated_tool'] }))
  view(snapshot({ legacyAvailable: true }), async rows => rows, importLegacy)
  await edit('gated_tool')
  expect((screen.getByRole('radio', { name: /^Skill-gated/ }) as HTMLInputElement).checked).toBe(true)

  fireEvent.click(screen.getByRole('button', { name: en['legacy.import'] }))
  await screen.findByText(en['legacy.imported'])
  // The imported rules block the tool the draft still held: nothing is selected.
  expect(screen.queryByRole('radio')).toBeNull()
  await edit('gated_tool')
  expect((screen.getByRole('radio', { name: /^Always blocked/ }) as HTMLInputElement).checked).toBe(true)
})
it('drops the draft when a refresh replaces the rules and keeps it when the read fails', async () => {
  const load = vi.fn<SkillGateInjected['load']>()
    .mockResolvedValueOnce(snapshot())
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(snapshot({ bindings: [], blockedTools: ['gated_tool'] }))
  render(<SkillGateSection load={load} save={async rows => rows} importLegacy={async () => ({ bindings: [], blockedTools: [] })} t={t} />)

  await edit('gated_tool')
  fireEvent.click(screen.getByRole('button', { name: en.refresh }))
  await screen.findByRole('alert')
  expect((screen.getByRole('radio', { name: /^Skill-gated/ }) as HTMLInputElement).checked).toBe(true)

  fireEvent.click(screen.getByRole('button', { name: en.refresh }))
  await waitFor(() => expect(screen.queryByRole('radio')).toBeNull())
  await edit('gated_tool')
  expect((screen.getByRole('radio', { name: /^Always blocked/ }) as HTMLInputElement).checked).toBe(true)
})
it('searches tool and skill names and filters by policy', async () => {
  view()
  fireEvent.change(await screen.findByPlaceholderText(en['table.search']), { target: { value: 'MY-SKILL' } })
  expect(screen.queryByRole('button', { name: 'Edit free_tool' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Edit gated_tool' })).toBeTruthy()
  fireEvent.change(screen.getByPlaceholderText(en['table.search']), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText(en['table.filter']), { target: { value: 'blocked' } })
  expect(screen.getByRole('button', { name: 'Edit blocked_tool' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Edit gated_tool' })).toBeNull()
})
it('paginates a large catalog and resets pagination after search', async () => {
  view(snapshot({ tools: Array.from({ length: 23 }, (_, i) => 'tool_' + String(i).padStart(2, '0')), bindings: [], blockedTools: [] }))
  await screen.findByRole('button', { name: 'Edit tool_00' })
  expect(screen.queryByRole('button', { name: 'Edit tool_20' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: en['table.next'] }))
  expect(screen.getByRole('button', { name: 'Edit tool_10' })).toBeTruthy()
  fireEvent.change(screen.getByPlaceholderText(en['table.search']), { target: { value: 'tool_22' } })
  expect(screen.getByRole('button', { name: 'Edit tool_22' })).toBeTruthy()
  expect((screen.getByRole('button', { name: en['table.previous'] }) as HTMLButtonElement).disabled).toBe(true)
})
it('keeps an unregistered tool listed and removable without touching other rules', async () => {
  const save = vi.fn<SkillGateInjected['save']>(async rows => rows)
  view(snapshot({ tools: ['free_tool'], blockedTools: ['blocked_tool', 'retired_tool'] }), save)
  const table = await screen.findByRole('table', { name: en['table.name'] })
  // Every row here is absent from the live catalog, so each one carries the marker.
  expect(within(table).getAllByText(en['table.unregistered'])).toHaveLength(3)
  await edit('retired_tool'); choose('Available'); saveRule()
  await waitFor(() => expect(save).toHaveBeenCalledWith([{ skill: 'my-skill', tools: ['gated_tool'] }], ['blocked_tool']))
})
it('flags a skill the catalog no longer lists without blocking unrelated saves', async () => {
  const save = vi.fn<SkillGateInjected['save']>(async rows => rows)
  view(snapshot({ skills: ['other-skill'] }), save)
  const table = await screen.findByRole('table', { name: en['table.name'] })
  expect(within(table).getByText(en['table.missingSkills'])).toBeTruthy()
  await screen.findByText(new RegExp('missing from the catalog: my-skill'))
  await edit('free_tool'); choose('Always blocked'); saveRule()
  await waitFor(() => expect(save).toHaveBeenCalledWith([{ skill: 'my-skill', tools: ['gated_tool'] }], ['blocked_tool', 'free_tool']))
})
it('keeps the unlisted skill editable so it can be removed by hand', async () => {
  view(snapshot({ skills: ['other-skill'] }))
  await edit('gated_tool')
  expect(screen.getByText(en['skills.missing'])).toBeTruthy()
  const checkbox = screen.getByRole('checkbox', { name: /^my-skill/ }) as HTMLInputElement
  expect(checkbox.checked).toBe(true)
  fireEvent.click(checkbox)
  expect(checkbox.checked).toBe(false)
})
it('reports an unreadable catalog as unresolved rather than as deletions', async () => {
  view(snapshot({ skills: [], skillsResolved: false }))
  expect(await screen.findByText(/Skill catalog unavailable: these unlocking skills are unresolved/)).toBeTruthy()
  expect(screen.queryByText(en['table.missingSkills'])).toBeNull()
})
it('does not retry failed initial reads until refresh is clicked', async () => {
  const load = vi.fn<SkillGateInjected['load']>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(snapshot())
  render(<SkillGateSection load={load} save={async rows => rows} importLegacy={async () => ({ bindings: [], blockedTools: [] })} t={t} />)
  expect((await screen.findByRole('alert')).textContent).toContain('offline')
  expect(load).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: en.refresh }))
  await screen.findByRole('button', { name: 'Edit free_tool' })
  expect(load).toHaveBeenCalledTimes(2)
})
