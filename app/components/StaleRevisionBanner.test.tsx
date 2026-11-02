import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import '~/i18n/i18n'
import { StaleRevisionBanner } from './StaleRevisionBanner'

async function renderBanner(onReload = vi.fn().mockResolvedValue(undefined)) {
  const screen = await render(<StaleRevisionBanner onReload={onReload} />)
  return { screen, onReload }
}

const openConfirm = () =>
  page.getByRole('button', { name: 'Reload latest version' }).click()

describe('StaleRevisionBanner', () => {
  it('shows a persistent alert without a dismiss control', async () => {
    await renderBanner()

    await expect
      .element(
        page
          .getByRole('alert')
          .getByText(
            "This document was changed by someone else. You can't save until you reload.",
          ),
      )
      .toBeVisible()
    expect(page.getByRole('button').elements()).toHaveLength(1)
  })

  it('asks for confirmation naming the lost edits before reloading', async () => {
    const { onReload } = await renderBanner()

    await openConfirm()

    await expect
      .element(page.getByRole('dialog').getByText(/discards all local edits/))
      .toBeVisible()
    expect(onReload).not.toHaveBeenCalled()
  })

  it('focuses Cancel by default', async () => {
    await renderBanner()

    await openConfirm()

    await expect
      .element(page.getByRole('dialog').getByRole('button', { name: 'Cancel' }))
      .toHaveFocus()
  })

  it('keeps the banner and does not reload on Cancel', async () => {
    const { onReload } = await renderBanner()
    await openConfirm()

    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
    await expect.element(page.getByRole('alert')).toBeVisible()
    expect(onReload).not.toHaveBeenCalled()
  })

  it('does not reload when the modal is dismissed with Escape', async () => {
    const { onReload } = await renderBanner()
    await openConfirm()

    await userEvent.keyboard('{Escape}')

    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
    expect(onReload).not.toHaveBeenCalled()
  })

  it('reloads once on confirm', async () => {
    const { onReload } = await renderBanner()
    await openConfirm()

    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Reload latest version' })
      .click()

    expect(onReload).toHaveBeenCalledOnce()
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
  })
})
