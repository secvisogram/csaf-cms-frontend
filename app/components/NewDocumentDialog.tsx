import { useEffect, useState } from 'react'
import { href, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Modal } from '~/components/Modal'
import { listTemplates, type TemplateSummary } from '~/auth/backend'

type Templates =
  | { status: 'loading' }
  | { status: 'ready'; templates: TemplateSummary[] }
  | { status: 'unavailable' }

export const NewDocumentDialog: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<Templates>({ status: 'loading' })
  const [mode, setMode] = useState<'blank' | 'template'>('blank')
  const [templateId, setTemplateId] = useState('')

  // The dialog only mounts while open, so this fetches the list on every open.
  useEffect(() => {
    let cancelled = false
    listTemplates()
      .then((result) => {
        if (cancelled) return
        const list = result.ok ? result.data : []
        if (list[0]) {
          setTemplates({ status: 'ready', templates: list })
          setTemplateId(list[0].templateId)
        } else {
          setTemplates({ status: 'unavailable' })
        }
      })
      .catch(() => {
        if (!cancelled) setTemplates({ status: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const templatesReady = templates.status === 'ready'
  const effectiveMode = templatesReady ? mode : 'blank'

  const create = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (effectiveMode === 'template') {
      const search = new URLSearchParams({ template: templateId })
      void navigate(`${href('/new')}?${search}`)
    } else {
      void navigate(href('/new'))
    }
    onClose()
  }

  return (
    <Modal label={t('newDialog.title')} onClose={onClose}>
      <form onSubmit={create} className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="new-document-mode"
            checked={effectiveMode === 'blank'}
            onChange={() => setMode('blank')}
          />
          {t('newDialog.blank')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="new-document-mode"
            disabled={!templatesReady}
            checked={effectiveMode === 'template'}
            onChange={() => setMode('template')}
          />
          {t('newDialog.useTemplate')}
        </label>
        {templates.status === 'loading' && (
          <p className="text-sm text-gray-600">
            {t('newDialog.loadingTemplates')}
          </p>
        )}
        {templates.status === 'unavailable' && (
          <p role="alert" className="text-sm text-red-700">
            {t('newDialog.templatesUnavailable')}
          </p>
        )}
        {templates.status === 'ready' && (
          <select
            aria-label={t('newDialog.template')}
            disabled={effectiveMode !== 'template'}
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="rounded border px-2 py-1 text-sm"
          >
            {templates.templates.map((template) => (
              <option key={template.templateId} value={template.templateId}>
                {template.templateDescription || template.templateId}
              </option>
            ))}
          </select>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1 hover:bg-gray-100"
          >
            {t('newDialog.cancel')}
          </button>
          <button
            type="submit"
            className="rounded bg-slate-600 px-3 py-1 text-white hover:bg-slate-700"
          >
            {t('newDialog.create')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
