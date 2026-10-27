import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page, userEvent } from 'vitest/browser'
import '~/i18n/i18n'
import { SaveFooter } from './SaveFooter'

async function openModal(
  onSave = vi.fn().mockResolvedValue(true),
  valid = true,
) {
  const screen = await render(
    <SaveFooter heading="Test page" valid={valid} onSave={onSave} />,
  )
  await screen.getByRole('button', { name: 'Save…' }).click()
  return { screen, onSave }
}

const submit = () => page.getByRole('button', { name: 'Save', exact: true })

describe('SaveFooter', () => {
  it('shows the validity and disables Save… while invalid', async () => {
    const screen = await render(
      <SaveFooter heading="Test page" valid={false} onSave={vi.fn()} />,
    )

    await expect.element(screen.getByText('Document is invalid')).toBeVisible()
    await expect
      .element(screen.getByRole('button', { name: 'Save…' }))
      .toBeDisabled()
  })

  it('shows the heading next to the validity when given', async () => {
    const screen = await render(
      <SaveFooter heading="Edit advisory abc" valid onSave={vi.fn()} />,
    )

    await expect
      .element(screen.getByRole('heading', { name: 'Edit advisory abc' }))
      .toBeVisible()
    await expect
      .element(screen.getByRole('contentinfo', { name: 'Edit advisory abc' }))
      .toBeInTheDocument()
    await expect
      .element(screen.getByRole('heading', { name: 'Edit advisory abc' }))
      .toHaveAttribute('title', 'Edit advisory abc')
    await expect.element(screen.getByText('Document is valid')).toBeVisible()
  })

  it.each(['', '   '])(
    'does not submit when the summary is %j',
    async (summary) => {
      const { onSave } = await openModal()
      if (summary) await page.getByLabelText('Summary').fill(summary)

      await submit().click()

      expect(onSave).not.toHaveBeenCalled()
      await expect.element(page.getByRole('dialog')).toBeVisible()
    },
  )

  it('passes the entered fields to onSave and closes on success', async () => {
    const { onSave } = await openModal()
    await page.getByLabelText('Summary').fill('A change')
    await page.getByLabelText('Legacy version').fill('v1')

    await submit().click()

    expect(onSave).toHaveBeenCalledWith({
      summary: 'A change',
      legacyVersion: 'v1',
    })
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the modal and the entered values when onSave resolves false', async () => {
    const { onSave } = await openModal(vi.fn().mockResolvedValue(false))
    await page.getByLabelText('Summary').fill('A change')

    await submit().click()

    expect(onSave).toHaveBeenCalledOnce()
    await expect.element(page.getByRole('dialog')).toBeVisible()
    await expect.element(page.getByLabelText('Summary')).toHaveValue('A change')
  })

  it('treats a rejecting onSave as a failed save', async () => {
    const error = new Error('boom')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await openModal(vi.fn().mockRejectedValue(error))
    await page.getByLabelText('Summary').fill('A change')

    await submit().click()

    await expect.poll(() => consoleError).toHaveBeenCalledWith(error)
    await expect.element(page.getByRole('dialog')).toBeVisible()
    await expect.element(page.getByLabelText('Summary')).toHaveValue('A change')
    await expect.element(submit()).toBeEnabled()
    consoleError.mockRestore()
  })

  it('starts blank after a successful save but keeps values after Cancel', async () => {
    const { screen } = await openModal()
    await page.getByLabelText('Summary').fill('Kept')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await screen.getByRole('button', { name: 'Save…' }).click()
    await expect.element(page.getByLabelText('Summary')).toHaveValue('Kept')

    await submit().click()
    await screen.getByRole('button', { name: 'Save…' }).click()

    await expect.element(page.getByLabelText('Summary')).toHaveValue('')
  })

  it('closes on Escape', async () => {
    await openModal()

    await userEvent.keyboard('{Escape}')

    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables the buttons and ignores Escape while a save is in flight', async () => {
    let resolveSave: (value: boolean) => void = () => {}
    const { onSave } = await openModal(
      vi.fn(() => new Promise<boolean>((resolve) => (resolveSave = resolve))),
    )
    await page.getByLabelText('Summary').fill('Slow')

    await submit().click()
    await expect.element(submit()).toBeDisabled()
    await expect
      .element(page.getByRole('button', { name: 'Cancel' }))
      .toBeDisabled()
    await userEvent.keyboard('{Escape}')
    await expect.element(page.getByRole('dialog')).toBeVisible()

    resolveSave(true)
    await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
    expect(onSave).toHaveBeenCalledOnce()
  })
})
