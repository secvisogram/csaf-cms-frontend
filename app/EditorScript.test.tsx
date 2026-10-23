import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'

import { EditorScript } from './EditorScript'

const EDITOR_SELECTOR =
  'script[src="/secvisogram-editor/secvisogram-editor.js"]'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('EditorScript', () => {
  it('emits the deferred classic editor script in production-editor builds', async () => {
    vi.stubEnv('VITE_EMBED_EDITOR', 'true')

    await render(<EditorScript />)

    const script = document.querySelector<HTMLScriptElement>(EDITOR_SELECTOR)
    expect(script).not.toBeNull()
    expect(script?.defer).toBe(true)
    expect(script?.type).not.toBe('module')
  })

  it('emits nothing when the build constant is not set', async () => {
    await render(<EditorScript />)

    expect(document.querySelector(EDITOR_SELECTOR)).toBeNull()
  })
})
