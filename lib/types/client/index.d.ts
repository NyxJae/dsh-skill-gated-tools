/**
 * Browser half: registers the Skill Gate settings page.
 *
 * The page talks to the Host over this plugin's own REST prefix, so the only
 * injected services are the slot registry and the locale dictionaries.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type SkillGateKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        skillGate: SkillGateKey;
    }
}
/** Services required by the browser plugin. */
export declare const inject: string[];
/** Register dictionaries and the settings page. */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map