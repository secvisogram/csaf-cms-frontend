import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'

// Infra proof, not route coverage: route logic is covered by Playwright E2E specs instead.
describe('vitest browser project', () => {
  it('renders a component in a real browser and queries it via the locator API', async () => {
    const screen = await render(<button>Click me</button>)

    await expect
      .element(screen.getByRole('button', { name: 'Click me' }))
      .toBeVisible()
  })
})
