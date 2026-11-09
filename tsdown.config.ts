import { fileURLToPath } from 'node:url'
import { clientBundle } from './build/client-bundle.ts'

export default clientBundle('dsh-skill-gated-tools', ['lib/types/index.js'], {
  manifestPath: fileURLToPath(new URL('./package.json', import.meta.url)),
})
