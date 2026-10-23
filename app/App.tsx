import { useState } from 'react'
import { href, Link, Outlet, useRouteLoaderData } from 'react-router'
import { useTranslation } from 'react-i18next'
import { canCreateDocuments } from '~/auth/userInfo'
import { NewDocumentDialog } from '~/components/NewDocumentDialog'
import type { clientLoader as rootLoader } from '~/root'

export const App: React.FC<{}> = () => {
  const { t } = useTranslation()
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const rootData = useRouteLoaderData<typeof rootLoader>('root')
  const canCreate = rootData ? canCreateDocuments(rootData.userInfo) : false

  return (
    <>
      <div className="mx-auto w-full h-screen grid grid-cols-[1fr] grid-rows-[36px_minmax(0,1fr)]">
        <div className="col-span-2 bg-slate-600 flex items-center justify-between">
          <div className="pl-5">
            <Link
              data-testid="dashboard_link"
              className="text-gray-300 hover:bg-slate-700 hover:text-white text-sm font-bold p-2 h-auto"
              to={href('/')}
            >
              {t('nav.dashboard')}
            </Link>
            {canCreate && (
              <button
                type="button"
                data-testid="new_document_button"
                onClick={() => setNewDialogOpen(true)}
                className="text-gray-300 hover:bg-slate-700 hover:text-white text-sm font-bold p-2 h-auto"
              >
                {t('nav.new')}
              </button>
            )}
          </div>
          <div className="flex items-center pr-5">
            {rootData && (
              <a
                data-testid="logout_button"
                className="text-gray-300 hover:bg-slate-700 hover:text-white text-sm font-bold p-2 h-auto"
                href={rootData.appConfig.logoutUrl}
              >
                {t('nav.logout')}
              </a>
            )}
          </div>
        </div>
        <div className="row-span-2 overflow-auto relative h-full bg-white">
          <Outlet />
        </div>
      </div>
      {newDialogOpen && (
        <NewDocumentDialog onClose={() => setNewDialogOpen(false)} />
      )}
    </>
  )
}

export default App
