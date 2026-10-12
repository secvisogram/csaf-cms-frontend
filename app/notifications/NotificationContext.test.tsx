import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { NotificationProvider, useNotification } from './NotificationContext'

function TriggerButton({
  reason,
  variant,
}: {
  reason: string
  variant: 'success' | 'error'
}) {
  const { notify } = useNotification()
  return <button onClick={() => notify({ reason, variant })}>Trigger</button>
}

describe('NotificationContext', () => {
  it('shows a visible toast when a component calls notify with a success variant', async () => {
    const screen = await render(
      <NotificationProvider>
        <TriggerButton reason="Saved successfully" variant="success" />
      </NotificationProvider>,
    )

    await screen.getByRole('button', { name: 'Trigger' }).click()

    await expect.element(screen.getByText('Saved successfully')).toBeVisible()
  })

  it('shows a visible toast when a component calls notify with an error variant', async () => {
    const screen = await render(
      <NotificationProvider>
        <TriggerButton reason="Something went wrong" variant="error" />
      </NotificationProvider>,
    )

    await screen.getByRole('button', { name: 'Trigger' }).click()

    await expect.element(screen.getByText('Something went wrong')).toBeVisible()
  })

  it('can be manually dismissed', async () => {
    const screen = await render(
      <NotificationProvider>
        <TriggerButton reason="Saved successfully" variant="success" />
      </NotificationProvider>,
    )

    await screen.getByRole('button', { name: 'Trigger' }).click()
    await expect.element(screen.getByText('Saved successfully')).toBeVisible()

    await screen.getByRole('button', { name: 'Dismiss' }).click()

    await expect
      .element(screen.getByText('Saved successfully'))
      .not.toBeInTheDocument()
  })

  it('auto-dismisses after a few seconds', async () => {
    const screen = await render(
      <NotificationProvider>
        <TriggerButton reason="Saved successfully" variant="success" />
      </NotificationProvider>,
    )

    await screen.getByRole('button', { name: 'Trigger' }).click()
    await expect.element(screen.getByText('Saved successfully')).toBeVisible()

    await expect
      .element(screen.getByText('Saved successfully'), { timeout: 7000 })
      .not.toBeInTheDocument()
  })
})
