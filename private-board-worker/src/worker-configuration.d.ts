import type { Bindings } from './types'

declare global {
  namespace Cloudflare {
    interface Env extends Bindings {}

    interface GlobalProps {
      mainModule: typeof import('./index')
    }
  }
}

export {}
