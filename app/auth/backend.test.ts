import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeStorage } from '~/testing/fakeStorage'
import { resetAppConfigCache } from './appConfig'
import {
  changeWorkflowState,
  createAdvisory,
  createNewVersion,
  deleteAdvisory,
  getAbout,
  getAdvisory,
  getTemplate,
  listAdvisories,
  listTemplates,
  updateAdvisory,
} from './backend'

function mockFetchResolving(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () => new Response(JSON.stringify(body), { status }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function mockFetchResolvingText(status: number, body: string) {
  const fetchMock = vi.fn(
    async () =>
      new Response(body, {
        status,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('typed backend client', () => {
  beforeEach(() => {
    resetAppConfigCache()
    vi.stubGlobal('sessionStorage', fakeStorage())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('listAdvisories GETs /api/v1/advisories', async () => {
    const fetchMock = mockFetchResolving(200, [{ advisoryId: '1' }])

    const result = await listAdvisories()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/advisories', undefined)
    expect(result).toEqual({ ok: true, data: [{ advisoryId: '1' }] })
  })

  it('getAdvisory GETs /api/v1/advisories/{id}', async () => {
    const fetchMock = mockFetchResolving(200, {
      advisoryId: '1',
      revision: 'rev-1',
    })

    await getAdvisory('1')

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/advisories/1', undefined)
  })

  it('createAdvisory POSTs the csaf/summary/legacyVersion payload', async () => {
    const fetchMock = mockFetchResolving(200, { id: '1', revision: 'rev-1' })

    const result = await createAdvisory({
      csaf: { title: 'doc' },
      summary: 'first',
      legacyVersion: '1.0',
    })

    expect(result).toEqual({ ok: true, data: { id: '1', revision: 'rev-1' } })
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/advisories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csaf: { title: 'doc' },
        summary: 'first',
        legacyVersion: '1.0',
      }),
    })
  })

  it('updateAdvisory PATCHes with the revision threaded as a query param', async () => {
    const fetchMock = mockFetchResolving(200, { revision: 'rev-2' })

    await updateAdvisory('1', 'rev-1', {
      csaf: { title: 'doc' },
      summary: 'update',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/advisories/1?revision=rev-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csaf: { title: 'doc' }, summary: 'update' }),
      },
    )
  })

  it('deleteAdvisory DELETEs with the revision as a query param', async () => {
    const fetchMock = mockFetchResolving(200, null)

    await deleteAdvisory('1', 'rev-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/advisories/1?revision=rev-1',
      {
        method: 'DELETE',
      },
    )
  })

  it('changeWorkflowState PATCHes with options as query params and resolves the new revision', async () => {
    const fetchMock = mockFetchResolvingText(200, '2-def')

    const result = await changeWorkflowState('1', 'Published', 'rev-1', {
      documentTrackingStatus: 'Final',
      proposedTime: '2026-01-01T00:00:00Z',
    })

    expect(result).toEqual({ ok: true, data: '2-def' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/advisories/1/workflowstate/Published?revision=rev-1&documentTrackingStatus=Final&proposedTime=2026-01-01T00%3A00%3A00Z',
      { method: 'PATCH' },
    )
  })

  it('changeWorkflowState sends only the revision when no options are given', async () => {
    const fetchMock = mockFetchResolvingText(200, '2-def')

    await changeWorkflowState('1', 'Review', 'rev-1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/advisories/1/workflowstate/Review?revision=rev-1',
      { method: 'PATCH' },
    )
  })

  it('createNewVersion PATCHes with the revision as a query param and resolves the new revision', async () => {
    const fetchMock = mockFetchResolvingText(200, '3-ghi')

    const result = await createNewVersion('1', 'rev-1')

    expect(result).toEqual({ ok: true, data: '3-ghi' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/advisories/1/createNewVersion?revision=rev-1',
      {
        method: 'PATCH',
      },
    )
  })

  it('listTemplates GETs /api/v1/advisories/templates', async () => {
    const fetchMock = mockFetchResolving(200, [{ templateId: 't1' }])

    await listTemplates()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/advisories/templates',
      undefined,
    )
  })

  it('getTemplate GETs /api/v1/advisories/templates/{id}', async () => {
    const fetchMock = mockFetchResolving(200, { csaf: {} })

    await getTemplate('t1')

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/advisories/templates/t1',
      undefined,
    )
  })

  it('getAbout GETs /api/v1/about', async () => {
    const fetchMock = mockFetchResolving(200, { version: '1.0.0' })

    await getAbout()

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/about', undefined)
  })

  it('surfaces a non-2xx response as a typed { ok: false, error } result', async () => {
    mockFetchResolving(409, { message: 'stale revision' })

    const result = await updateAdvisory('1', 'rev-1', {
      csaf: {},
      summary: 'x',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        status: 409,
        message: 'stale revision',
        body: { message: 'stale revision' },
      },
    })
  })
})
