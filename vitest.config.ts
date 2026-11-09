import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { configDefaults, defineConfig } from 'vitest/config'

/**
 * Worker arguments that keep process-wide Web Storage from shadowing jsdom storage.
 * Node lists the positive spelling in `allowedNodeEnvironmentFlags` for this negatable flag.
 */
const vitestExecArgv = process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : []

const decoratorSyntax = /^\s*@[A-Za-z_$][\w$]*/m

/**
 * Transform standard TypeScript decorators before Vite's default parser sees source files.
 *
 * Inlined from the DeepSeek Harness shared test preset (MIT, Copyright (c) 2026
 * DeepSeek) so a clone of this package runs without a neighbouring checkout;
 * see THIRD_PARTY_NOTICES.md.
 * @returns a pre-transform Vite plugin.
 */
function standardDecoratorPlugin() {
  return {
    name: 'dsh-standard-decorators',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const file = id.split('?', 1)[0]!
      if (!/\.[cm]?tsx?$/.test(file) || !decoratorSyntax.test(code)) return
      const result = ts.transpileModule(code, {
        fileName: file,
        compilerOptions: {
          target: ts.ScriptTarget.ES2024,
          module: ts.ModuleKind.ESNext,
          jsx: file.endsWith('x') ? ts.JsxEmit.ReactJSX : undefined,
          sourceMap: true,
        },
      })
      return {
        code: result.outputText
          .replace(
            /^(\s*)(__esDecorate\()/gmu,
            '$1/* v8 ignore next -- compiler-synthetic decorator accessors have no source behavior */ $2',
          )
          .replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'),
        map: result.sourceMapText,
      }
    },
  }
}

// The client packages this plugin renders against resolve `zustand` and
// `immer` from their own dependency tree, and the primitives barrel drags in
// the markdown stack (shiki, KaTeX) that this settings page never renders.
// Pointing those specifiers at this package's copies and stubs keeps the
// component specs runnable on a plain install.
const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url))
const vendorAlias = [
  { find: /^zustand\/vanilla$/, replacement: here('./node_modules/zustand/vanilla.js') },
  { find: /^zustand\/middleware$/, replacement: here('./node_modules/zustand/middleware.js') },
  { find: /^zustand\/shallow$/, replacement: here('./node_modules/zustand/shallow.js') },
  { find: /^zustand\/react$/, replacement: here('./node_modules/zustand/react.js') },
  { find: /^zustand$/, replacement: here('./node_modules/zustand/index.js') },
  { find: /^shiki\/core$/, replacement: here('./tests/stubs/shiki.ts') },
  { find: /^shiki\/engine\/javascript$/, replacement: here('./tests/stubs/shiki.ts') },
  { find: /^@shikijs\/langs\/.*$/, replacement: here('./tests/stubs/shikilangs.ts') },
  // The primitives barrel drags in that same markdown stack plus KaTeX
  // stylesheets; the page only uses Button and Input from it.
  { find: /^@deepseek-ai\/dsh-client-ui-primitives$/, replacement: here('./tests/stubs/primitives.tsx') },
]

export default defineConfig({
  plugins: [standardDecoratorPlugin()],
  resolve: { alias: vendorAlias },
  test: { pool: 'forks', execArgv: vitestExecArgv, exclude: [...configDefaults.exclude, '**/artifact-scope.test.mjs'] },
})
