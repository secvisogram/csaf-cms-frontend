import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import '~/i18n/i18n'
import { NotificationProvider } from '~/notifications/NotificationContext'
import { WorkflowStateDialog } from './WorkflowStateDialog'

const advisory = {
  advisoryId: 'advisory-1',
  allowedStateChanges: ['Review', 'Published'],
}

function mockBackend(patchResponse: Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method === 'PATCH'
      ? patchResponse
      : new Response(JSON.stringify({ revision: 'rev-2' }), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const okResponse = () =>
  new Response('3-abc', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })

async function renderDialog() {
  const onClose = vi.fn()
  const onChanged = vi.fn()
  await render(
    <NotificationProvider>
      <WorkflowStateDialog
        advisory={advisory}
        onClose={onClose}
        onChanged={onChanged}
      />
    </NotificationProvider>,
  )
  return { onClose, onChanged }
}

const submit = () => page.getByRole('button', { name: 'Change', exact: true })

describe('WorkflowStateDialog', () => {
  // Mutations read this double-submit cookie; without it the client would probe /about first.
  beforeEach(() => {
    document.cookie = 'XSRF-TOKEN=token'
  })

  afterEach(() => {
    document.cookie = 'XSRF-TOKEN=; max-age=0'
    vi.unstubAllGlobals()
  })

  it('offers only the advisory’s allowed state changes', async () => {
    await renderDialog()

    const state = page.getByRole('combobox', { name: 'New workflow state' })

    await expect.element(state).toBeVisible()
    const options = state.element().querySelectorAll('option')
    expect([...options].map((option) => option.value)).toEqual([
      '',
      'Review',
      'Published',
    ])
  })

  it('asks for the tracking status only when publishing', async () => {
    await renderDialog()
    const state = page.getByRole('combobox', { name: 'New workflow state' })

    await expect
      .element(page.getByRole('combobox', { name: 'Document tracking status' }))
      .not.toBeInTheDocument()

    await state.selectOptions('Published')
    await expect
      .element(page.getByRole('combobox', { name: 'Document tracking status' }))
      .toBeVisible()

    await state.selectOptions('Review')
    await expect
      .element(page.getByRole('combobox', { name: 'Document tracking status' }))
      .not.toBeInTheDocument()
  })

  it('changes the state with a fresh revision, reports it and closes', async () => {
    const fetchMock = mockBackend(okResponse())
    const { onChanged, onClose } = await renderDialog()
    await page
      .getByRole('combobox', { name: 'New workflow state' })
      .selectOptions('Review')

    await submit().click()

    await expect.poll(() => onChanged).toHaveBeenCalledWith('Review')
    expect(onClose).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/advisories/advisory-1',
      '/api/v1/advisories/advisory-1/workflowstate/Review?revision=rev-2',
    ])
    await expect
      .element(page.getByText('Workflow state changed.'))
      .toBeVisible()
  })

  it('sends the tracking status when publishing', async () => {
    const fetchMock = mockBackend(okResponse())
    const { onChanged } = await renderDialog()
    await page
      .getByRole('combobox', { name: 'New workflow state' })
      .selectOptions('Published')
    await page
      .getByRole('combobox', { name: 'Document tracking status' })
      .selectOptions('Final')

    await submit().click()

    await expect.poll(() => onChanged).toHaveBeenCalledWith('Published')
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/v1/advisories/advisory-1/workflowstate/Published?revision=rev-2&documentTrackingStatus=Final',
    )
  })

  it('does not submit without a chosen state', async () => {
    const fetchMock = mockBackend(okResponse())
    await renderDialog()

    await submit().click()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows an error toast and stays open when the backend refuses', async () => {
    mockBackend(
      new Response(JSON.stringify({ message: 'nope' }), { status: 422 }),
    )
    const { onChanged, onClose } = await renderDialog()
    await page
      .getByRole('combobox', { name: 'New workflow state' })
      .selectOptions('Review')

    await submit().click()

    await expect
      .element(page.getByText(/document is invalid and cannot be published/))
      .toBeVisible()
    expect(onChanged).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    await expect.element(page.getByRole('dialog')).toBeVisible()
    await expect.element(submit()).toBeEnabled()
  })

  it('shows an error toast when the request itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network')
      }),
    )
    const { onChanged } = await renderDialog()
    await page
      .getByRole('combobox', { name: 'New workflow state' })
      .selectOptions('Review')

    await submit().click()

    await expect
      .element(page.getByText('The workflow state could not be changed.'))
      .toBeVisible()
    expect(onChanged).not.toHaveBeenCalled()
  })
})
