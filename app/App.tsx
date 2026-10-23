import { useState } from 'react'
import { href, Link, Outlet, useRouteLoaderData } from 'react-router'
import { useTranslation } from 'react-i18next'
import { canCreateDocuments } from '~/auth/userInfo'
import { NewDocumentDialog } from '~/components/NewDocumentDialog'
import type { clientLoader as rootLoader } from '~/root'

export const App: React.FC<{}> = () => {
  const { t } = useTranslation()
  const [errors] = useState(2)
  const [warnings] = useState(10)
  const [infos] = useState(0)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const rootData = useRouteLoaderData<typeof rootLoader>('root')
  const canCreate = rootData ? canCreateDocuments(rootData.userInfo) : false

  return (
    <>
      <div className="mx-auto w-full h-screen grid grid-cols-[1fr] grid-rows-[36px_minmax(0,1fr)]">
        <div className="col-span-2 bg-slate-600 flex items-center justify-between">
          <div className="pl-5">
            <Link
              data-testid="new_document_button"
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
            <button
              data-testid="new_export_document_button"
              className="text-gray-300 hover:bg-slate-700 hover:text-white text-sm font-bold p-2 h-auto"
            >
              {t('nav.export')}
            </button>
          </div>
          <div className="text-gray-300 font-bold text-sm h-9"></div>
          <button
            data-testid="show_all_errors_button"
            type="button"
            className="text-gray-300 hover:bg-slate-700 hover:text-white text-sm font-bold p-2 mr-5 h-auto"
          >
            {errors > 0
              ? t('statusBar.documentInvalid')
              : t('statusBar.documentValid')}
            <span className="px-1">
              <svg
                aria-hidden="true"
                focusable="false"
                data-prefix="fas"
                data-icon="circle"
                className="svg-inline--fa fa-circle fa-xs text-red-600"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
              >
                <path
                  fill="currentColor"
                  d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z"
                ></path>
              </svg>{' '}
              {errors} {t('statusBar.errors')}{' '}
            </span>
            <span className="px-1">
              <svg
                aria-hidden="true"
                focusable="false"
                data-prefix="fas"
                data-icon="circle"
                className="svg-inline--fa fa-circle fa-xs text-yellow-600"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
              >
                <path
                  fill="currentColor"
                  d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z"
                ></path>
              </svg>{' '}
              {warnings} {t('statusBar.warnings')}{' '}
            </span>
            <span className="px-1">
              <svg
                aria-hidden="true"
                focusable="false"
                data-prefix="fas"
                data-icon="circle"
                className="svg-inline--fa fa-circle fa-xs text-blue-600"
                role="img"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 512 512"
              >
                <path
                  fill="currentColor"
                  d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512z"
                ></path>
              </svg>{' '}
              {infos} {t('statusBar.infos')}{' '}
            </span>
          </button>
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
