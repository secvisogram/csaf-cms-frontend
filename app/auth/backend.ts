import { fetchApiOrRedirect, type ApiResult } from './session'

export type AdvisoryListItem = {
  advisoryId: string
  workflowState: string
  documentTrackingId: string
  title: string
  owner: string
  changeable: boolean
  deletable: boolean
  canCreateVersion: boolean
  allowedStateChanges: string[]
  currentReleaseDate?: string
}

export type AdvisoryDetail = AdvisoryListItem & {
  revision: string
  csaf: unknown
}

export type TemplateSummary = {
  templateId: string
  templateDescription: string
}

export type AboutInfo = { version: string }

export type AdvisorySaveInput = {
  csaf: unknown
  summary: string
  legacyVersion?: string
}

export type WorkflowStateChangeOptions = {
  documentTrackingStatus?: string
  /** ISO-8601 UTC string. */
  proposedTime?: string
}

const API_BASE = '/api/v1'

function withQuery(path: string, params: Record<string, string>): string {
  return `${path}?${new URLSearchParams(params)}`
}

/** The backend answers these endpoints with the new revision as a plain-text body. */
async function asRevision(
  result: Promise<ApiResult<unknown>>,
): Promise<ApiResult<string>> {
  const resolved = await result
  return resolved.ok ? { ok: true, data: String(resolved.data) } : resolved
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export function listAdvisories(): Promise<ApiResult<AdvisoryListItem[]>> {
  return fetchApiOrRedirect(`${API_BASE}/advisories`)
}

export function getAdvisory(
  advisoryId: string,
): Promise<ApiResult<AdvisoryDetail>> {
  return fetchApiOrRedirect(
    `${API_BASE}/advisories/${encodeURIComponent(advisoryId)}`,
  )
}

export function createAdvisory(
  input: AdvisorySaveInput,
): Promise<ApiResult<{ id: string; revision: string }>> {
  return fetchApiOrRedirect(`${API_BASE}/advisories`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  })
}

export function updateAdvisory(
  advisoryId: string,
  revision: string,
  input: AdvisorySaveInput,
): Promise<ApiResult<{ revision: string }>> {
  return fetchApiOrRedirect(
    withQuery(`${API_BASE}/advisories/${encodeURIComponent(advisoryId)}`, {
      revision,
    }),
    {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify(input),
    },
  )
}

export function deleteAdvisory(
  advisoryId: string,
  revision: string,
): Promise<ApiResult<null>> {
  return fetchApiOrRedirect(
    withQuery(`${API_BASE}/advisories/${encodeURIComponent(advisoryId)}`, {
      revision,
    }),
    { method: 'DELETE' },
  )
}

/** Resolves the new revision. */
export function changeWorkflowState(
  advisoryId: string,
  state: string,
  revision: string,
  options: WorkflowStateChangeOptions = {},
): Promise<ApiResult<string>> {
  const params: Record<string, string> = { revision }
  if (options.documentTrackingStatus) {
    params.documentTrackingStatus = options.documentTrackingStatus
  }
  if (options.proposedTime) params.proposedTime = options.proposedTime

  return asRevision(
    fetchApiOrRedirect(
      withQuery(
        `${API_BASE}/advisories/${encodeURIComponent(advisoryId)}/workflowstate/${encodeURIComponent(state)}`,
        params,
      ),
      { method: 'PATCH' },
    ),
  )
}

/** Resolves the new revision. */
export function createNewVersion(
  advisoryId: string,
  revision: string,
): Promise<ApiResult<string>> {
  return asRevision(
    fetchApiOrRedirect(
      withQuery(
        `${API_BASE}/advisories/${encodeURIComponent(advisoryId)}/createNewVersion`,
        { revision },
      ),
      { method: 'PATCH' },
    ),
  )
}

/**
 * Re-fetches the advisory's revision immediately before creating the new
 * version, so a revision that went stale since the list was loaded is not used.
 * Resolves the new revision.
 */
export async function createNewVersionWithFreshRevision(
  advisoryId: string,
): Promise<ApiResult<string>> {
  const detail = await getAdvisory(advisoryId)
  if (!detail.ok) return detail
  return createNewVersion(advisoryId, detail.data.revision)
}

export function listTemplates(): Promise<ApiResult<TemplateSummary[]>> {
  return fetchApiOrRedirect(`${API_BASE}/advisories/templates`)
}

/** Resolves the template's CSAF document. */
export function getTemplate(templateId: string): Promise<ApiResult<unknown>> {
  return fetchApiOrRedirect(
    `${API_BASE}/advisories/templates/${encodeURIComponent(templateId)}`,
  )
}

export function getAbout(): Promise<ApiResult<AboutInfo>> {
  return fetchApiOrRedirect(`${API_BASE}/about`)
}
