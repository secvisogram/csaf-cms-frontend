import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '~/components/Modal'

type StaleRevisionBannerProps = {
  /** Resolves once the reload has finished; the owner reports failures and removes the banner on success. */
  onReload: () => Promise<void>
}

export const StaleRevisionBanner: React.FC<StaleRevisionBannerProps> = ({
  onReload,
}) => {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [reloading, setReloading] = useState(false)

  const reload = async () => {
    setReloading(true)
    try {
      await onReload()
    } catch (error) {
      console.error(error)
    } finally {
      setReloading(false)
      setConfirming(false)
    }
  }

  return (
    <>
      <div
        role="alert"
        data-testid="stale_revision_banner"
        className="flex items-center justify-between gap-4 bg-amber-100 px-5 py-2 text-sm text-amber-900"
      >
        <span>{t('staleRevision.message')}</span>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="shrink-0 rounded bg-amber-700 px-3 py-1 font-bold text-white hover:bg-amber-800"
        >
          {t('staleRevision.reload')}
        </button>
      </div>
      {confirming && (
        <Modal
          label={t('staleRevision.confirmTitle')}
          onClose={() => {
            if (!reloading) setConfirming(false)
          }}
        >
          <div className="flex flex-col gap-3">
            <h2 className="font-bold">{t('staleRevision.confirmTitle')}</h2>
            <p className="text-sm">{t('staleRevision.confirmBody')}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                disabled={reloading}
                onClick={() => setConfirming(false)}
                className="rounded px-3 py-1 hover:bg-gray-100"
              >
                {t('staleRevision.cancel')}
              </button>
              <button
                type="button"
                disabled={reloading}
                onClick={reload}
                className="rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t('staleRevision.reload')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
