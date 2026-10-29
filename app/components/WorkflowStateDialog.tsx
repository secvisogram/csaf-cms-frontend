import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  changeWorkflowStateWithFreshRevision,
  type AdvisoryListItem,
} from '~/auth/backend'
import type { ApiResult } from '~/auth/session'
import { Modal } from '~/components/Modal'
import { useNotification } from '~/notifications/NotificationContext'

const TRACKING_STATUSES = ['Interim', 'Final']

type WorkflowStateDialogProps = {
  advisory: Pick<AdvisoryListItem, 'advisoryId' | 'allowedStateChanges'>
  onClose: () => void
  /** Called with the new state after the backend accepted the change. */
  onChanged: (state: string) => void
}

function failureReason(result: ApiResult<string> | undefined): string {
  if (result && !result.ok) {
    if (result.error.status === 422) return 'workflowDialog.invalidDocument'
    if (result.error.status === 503) {
      return 'workflowDialog.validationUnavailable'
    }
  }
  return 'workflowDialog.changeFailed'
}

export const WorkflowStateDialog: React.FC<WorkflowStateDialogProps> = ({
  advisory,
  onClose,
  onChanged,
}) => {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const [state, setState] = useState('')
  const [trackingStatus, setTrackingStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // The backend only accepts a publication together with a tracking status.
  const needsTrackingStatus = state === 'Published'

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    const result = await changeWorkflowStateWithFreshRevision(
      advisory.advisoryId,
      state,
      needsTrackingStatus ? { documentTrackingStatus: trackingStatus } : {},
    ).catch(() => undefined)
    if (result?.ok) {
      notify({ reason: 'workflowDialog.changed', variant: 'success' })
      onChanged(state)
      onClose()
      return
    }
    notify({ reason: failureReason(result), variant: 'error' })
    setSubmitting(false)
  }

  return (
    <Modal
      label={t('workflowDialog.title')}
      onClose={() => {
        if (!submitting) onClose()
      }}
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">
          {t('workflowDialog.newState')}
          <select
            required
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="rounded border px-2 py-1 font-normal"
          >
            <option value="">{t('workflowDialog.choose')}</option>
            {advisory.allowedStateChanges.map((allowed) => (
              <option key={allowed} value={allowed}>
                {allowed}
              </option>
            ))}
          </select>
        </label>
        {needsTrackingStatus && (
          <label className="flex flex-col gap-1 text-sm font-bold">
            {t('workflowDialog.trackingStatus')}
            <select
              required
              value={trackingStatus}
              onChange={(event) => setTrackingStatus(event.target.value)}
              className="rounded border px-2 py-1 font-normal"
            >
              <option value="">{t('workflowDialog.choose')}</option>
              {TRACKING_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded px-3 py-1 hover:bg-gray-100"
          >
            {t('workflowDialog.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-600 px-3 py-1 text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {t('workflowDialog.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
