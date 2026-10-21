import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '~/components/Modal'

export type SaveFields = { summary: string; legacyVersion: string }

type SaveFooterProps = {
  /** Page heading shown at the left of the bar. */
  heading?: React.ReactNode
  valid: boolean
  /**
   * Resolves true when the save succeeded, which closes the modal; false keeps it open with the entered values.
   * The owner reports failures to the user and resolves false, as the footer cannot; a rejection is treated as a failed save and logged.
   */
  onSave: (fields: SaveFields) => Promise<boolean>
}

export const SaveFooter: React.FC<SaveFooterProps> = ({
  heading,
  valid,
  onSave,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [summary, setSummary] = useState('')
  const [legacyVersion, setLegacyVersion] = useState('')

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      if (await onSave({ summary, legacyVersion })) {
        setOpen(false)
        setSummary('')
        setLegacyVersion('')
      }
    } catch (error) {
      console.error(error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div
        data-testid="save_footer"
        className="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-between bg-slate-600 px-5 py-2 text-sm font-bold text-gray-300"
      >
        <div className="flex min-w-0 items-center gap-6">
          {heading && <h2 className="truncate">{heading}</h2>}
          <span className="shrink-0">
            {valid ? t('saveFooter.valid') : t('saveFooter.invalid')}
          </span>
        </div>
        <button
          type="button"
          disabled={!valid}
          onClick={() => setOpen(true)}
          className="ml-4 shrink-0 rounded bg-slate-700 px-3 py-1 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('saveFooter.save')}
        </button>
      </div>
      {open && (
        <Modal
          label={t('saveFooter.save')}
          onClose={() => {
            if (!submitting) setOpen(false)
          }}
        >
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-bold">
              {t('saveFooter.summary')}
              <input
                required
                pattern=".*\S.*"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className="rounded border px-2 py-1 font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-bold">
              {t('saveFooter.legacyVersion')}
              <input
                value={legacyVersion}
                onChange={(event) => setLegacyVersion(event.target.value)}
                className="rounded border px-2 py-1 font-normal"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setOpen(false)}
                className="rounded px-3 py-1 hover:bg-gray-100"
              >
                {t('saveFooter.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-slate-600 px-3 py-1 text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {t('saveFooter.submit')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
