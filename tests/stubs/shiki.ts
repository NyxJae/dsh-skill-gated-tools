// The settings page never renders markdown; the highlighter is inert here.
const instance = {
  codeToHtml: () => '',
  codeToTokens: () => ({ tokens: [] }),
  codeToHast: () => ({ children: [] }),
  getTheme: () => ({}) as never,
  loadTheme: async () => undefined,
  loadLanguage: async () => undefined,
}
export const createCssVariablesTheme = () => ({})
export const createHighlighterCoreSync = () => instance
export const createJavaScriptRegexEngine = () => ({})
export const defaultJavaScriptRegexConstructor = undefined
export default instance
