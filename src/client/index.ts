/**
 * Browser half: registers the Skill Gate settings page.
 *
 * The page talks to the Host over this plugin's own REST prefix, so the only
 * injected services are the slot registry and the locale dictionaries.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { SkillGateSection, type SkillGateInjected } from './SkillGateSection.tsx'
import { en, NS, zh, type SkillGateKey } from './locales.ts'
import { importLegacyBindings, loadSnapshot, saveBindings } from './snapshot.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    skillGate: SkillGateKey
  }
}

/** Services required by the browser plugin. */
export const inject = ['slots', 'locale']

/** Register dictionaries and the settings page. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skill-gate: dictionaries')
  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skill-gate',
    order: 80,
    locale: NS,
    label: () => t('title'),
    inject: (): SkillGateInjected => ({ load: loadSnapshot, save: saveBindings, importLegacy: importLegacyBindings }),
  }, SkillGateSection))
}
