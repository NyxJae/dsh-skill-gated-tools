/**
 * Browser half: registers the Skill Gate settings page.
 *
 * The page talks to the Host over this plugin's own REST prefix, so the only
 * injected services are the slot registry and the locale dictionaries.
 */
import { SkillGateSection } from "./SkillGateSection.js";
import { en, NS, zh } from "./locales.js";
import { importLegacyBindings, loadSnapshot, saveBindings } from "./snapshot.js";
/** Services required by the browser plugin. */
export const inject = ['slots', 'locale'];
/** Register dictionaries and the settings page. */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skill-gate: dictionaries');
    const t = ctx.locale.bind(NS);
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'skill-gate',
        order: 80,
        locale: NS,
        label: () => t('title'),
        inject: () => ({ load: loadSnapshot, save: saveBindings, importLegacy: importLegacyBindings }),
    }, SkillGateSection));
}
//# sourceMappingURL=index.js.map