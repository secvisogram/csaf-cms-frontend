import { describe, expect, it } from 'vitest'

// Infra proof, not route coverage: route logic is covered by Playwright E2E specs instead.
describe('vitest node project', () => {
  it('runs in a plain node environment with no DOM/browser boot', () => {
    expect(typeof window).toBe('undefined')
  })
})
