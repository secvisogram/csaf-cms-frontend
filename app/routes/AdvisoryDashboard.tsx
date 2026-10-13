import { useEffect, useMemo, useRef, useState } from 'react'
import { href, Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from '@tanstack/react-table'
import { listAdvisories, type AdvisoryListItem } from '~/auth/backend'
import { useNotification } from '~/notifications/NotificationContext'
import type { Route } from './+types/AdvisoryDashboard'

export const clientLoader = async () => {
  const result = await listAdvisories()
  return result.ok
    ? { advisories: result.data, loadFailed: false }
    : { advisories: [], loadFailed: true }
}

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
})

const columnHelper = createColumnHelper<typeof features, AdvisoryListItem>()

const AdvisoryDashboard = ({ loaderData }: Route.ComponentProps) => {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('title', {
          header: t('dashboard.columns.title'),
        }),
        columnHelper.accessor('documentTrackingId', {
          header: t('dashboard.columns.trackingId'),
        }),
        columnHelper.accessor('workflowState', {
          header: t('dashboard.columns.workflowState'),
        }),
        columnHelper.accessor('owner', {
          header: t('dashboard.columns.owner'),
        }),
        columnHelper.accessor('currentReleaseDate', {
          header: t('dashboard.columns.currentReleaseDate'),
        }),
      ]),
    [t],
  )

  // Survives StrictMode's dev-only effect re-run, which would notify twice.
  const notifiedFor = useRef<typeof loaderData | null>(null)
  useEffect(() => {
    if (loaderData.loadFailed && notifiedFor.current !== loaderData) {
      notifiedFor.current = loaderData
      notify({ reason: 'dashboard.loadFailed', variant: 'error' })
    }
  }, [loaderData, notify])

  const table = useTable({
    features,
    columns,
    data: loaderData.advisories,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
  })

  return (
    <div className="max-w-4xl mx-auto mt-2 px-4">
      <h2 className="text-lg font-bold">{t('dashboard.heading')}</h2>
      <input
        type="text"
        aria-label={t('dashboard.filterLabel')}
        placeholder={t('dashboard.filterLabel')}
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="mt-4 border rounded px-2 py-1"
      />
      <table className="w-full mt-4">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} scope="col" className="text-left px-4 py-2">
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      className="font-semibold w-full text-left"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <table.FlexRender header={header} />
                      {header.column.getIsSorted() === 'asc' && ' \u25b2'}
                      {header.column.getIsSorted() === 'desc' && ' \u25bc'}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="relative hover:bg-gray-50">
              {row.getAllCells().map((cell, index) => (
                <td key={cell.id} className="px-4 py-2">
                  {index === 0 && (
                    <Link
                      className="absolute inset-0"
                      aria-label={row.original.title}
                      to={href('/:advisoryId/edit', {
                        advisoryId: row.original.advisoryId,
                      })}
                    />
                  )}
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AdvisoryDashboard
