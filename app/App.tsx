import { useState } from 'react'
import { href, Link, Outlet } from 'react-router'

export const App: React.FC<{}> = () => {
  const [errors] = useState(2)
  const [warnings] = useState(10)
  const [infos] = useState(0)

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
              Dashboard
            </Link>
            <button
              data-testid="new_document_button"
              className="text-gray-300 hover:bg-slate-700 hover:text-white text-sm font-bold p-2 h-auto"
            >
              New
            </button>
            <button
              data-testid="new_export_document_button"
              className="text-gray-300 hover:bg-slate-700 hover:text-white text-sm font-bold p-2 h-auto"
            >
              Export
            </button>
          </div>
          <div className="text-gray-300 font-bold text-sm h-9"></div>
          <button
            data-testid="show_all_errors_button"
            type="button"
            className="text-gray-300 hover:bg-slate-700 hover:text-white text-sm font-bold p-2 mr-5 h-auto"
          >
            Document is {errors > 0 ? 'invalid' : 'valid'}:
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
              {errors} errors{' '}
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
              {warnings} warnings{' '}
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
              {infos} infos{' '}
            </span>
          </button>
        </div>
        <div className="row-span-2 overflow-auto relative h-full bg-white">
          <Outlet />
        </div>
      </div>
    </>
  )
}

export default App
