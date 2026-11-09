import { configDefaults, defineConfig } from 'vitest/config'
import base from './vitest.config.ts'

export default defineConfig({
  ...base,
  test: { ...base.test, include: ['tests/artifact-scope.test.mjs'], exclude: configDefaults.exclude },
})
