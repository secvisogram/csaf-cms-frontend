import { useEffect } from 'react'
import { href, useFetcher } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Modal } from '~/components/Modal'
import type { clientLoader } from '~/routes/AboutData'

const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'development'

const FRONTEND_URL = 'https://github.com/secvisogram/csaf-cms-frontend'
const BACKEND_URL = 'https://github.com/secvisogram/csaf-cms-backend/'
const LICENSE_URL = `${FRONTEND_URL}/blob/main/LICENSE`
const AUTHOR_GUIDE_URL =
  'https://secvisogram.github.io/secvisogram-documentation/'

type AboutDialogProps = {
  onClose: () => void
}

const AboutLink: React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
> = (props) => <a className="underline" {...props} />

export const AboutDialog: React.FC<AboutDialogProps> = ({ onClose }) => {
  const { t } = useTranslation()
  const fetcher = useFetcher<typeof clientLoader>()

  // The dialog only mounts while open, so this fetches fresh data on every open.
  const { load } = fetcher
  useEffect(() => {
    void load(href('/data/about'))
  }, [load])

  const backendVersion = fetcher.data

  return (
    <Modal label={t('aboutModal.title')} onClose={onClose}>
      <div className="flex flex-col gap-2">
        <header className="flex items-center justify-between border-b pb-2">
          <h2 className="text-lg font-bold">{t('aboutModal.title')}</h2>
          <button
            type="button"
            aria-label={t('aboutModal.close')}
            onClick={onClose}
            className="rounded px-2 py-1 hover:bg-gray-100"
          >
            ×
          </button>
        </header>
        <div className="flex flex-col gap-2 pt-1">
          <p>
            {t('aboutModal.version')}:{' '}
            <AboutLink href={FRONTEND_URL}>{APP_VERSION}</AboutLink>
          </p>
          <p>
            {t('aboutModal.backendVersion')}:{' '}
            {!backendVersion ? (
              <span role="status">{t('aboutModal.loading')}</span>
            ) : !backendVersion.ok ? (
              <span role="alert">{t('aboutModal.loadFailed')}</span>
            ) : (
              <AboutLink href={BACKEND_URL}>{backendVersion.version}</AboutLink>
            )}
          </p>
          <p>
            {t('aboutModal.license')}:{' '}
            <AboutLink href={LICENSE_URL}>
              {t('aboutModal.licenseName')}
            </AboutLink>
          </p>
          <p>
            {t('aboutModal.usageInstructions')}{' '}
            <AboutLink href={AUTHOR_GUIDE_URL} target="_blank" rel="noreferrer">
              {t('aboutModal.authorGuide')}
            </AboutLink>
          </p>
        </div>
      </div>
    </Modal>
  )
}
