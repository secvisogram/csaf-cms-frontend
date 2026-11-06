import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { href, Link, useFetcher, useRevalidator } from 'react-router'
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
import {
  createNewVersionWithFreshRevision,
  deleteAdvisoryWithFreshRevision,
  listAdvisories,
  type AdvisoryListItem,
} from '~/auth/backend'
import { WorkflowStateDialog } from '~/components/WorkflowStateDialog'
import { useNotification } from '~/notifications/NotificationContext'
import type { Route } from './+types/AdvisoryDashboard'

export const clientLoader = async () => {
  const result = await listAdvisories()
  return result.ok
    ? { advisories: result.data, loadFailed: false }
    : { advisories: [], loadFailed: true }
}

export type DeleteAdvisoryActionResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Handles the dashboard's Delete action (currently the route's only action).
 * Expects POST form data with a string `advisoryId`; returns `{ ok: true }` or
 * `{ ok: false, error }`.
 */
export const clientAction = async ({
  request,
}: Route.ClientActionArgs): Promise<DeleteAdvisoryActionResult> => {
  const formData = await request.formData()
  const advisoryId = formData.get('advisoryId')
  if (typeof advisoryId !== 'string') {
    return { ok: false, error: 'Missing advisory ID' }
  }

  try {
    const result = await deleteAdvisoryWithFreshRevision(advisoryId)
    return result.ok ? { ok: true } : { ok: false, error: result.error.message }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
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
  const deleteFetcher = useFetcher<typeof clientAction>()
  const isDeleting = deleteFetcher.state !== 'idle'
  // Avoid showing the same toast again if an effect reruns for the same action result.
  const handledDeleteResult = useRef<DeleteAdvisoryActionResult | undefined>(
    undefined,
  )
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pendingVersionIds, setPendingVersionIds] = useState<string[]>([])
  const [stateDialogAdvisory, setStateDialogAdvisory] =
    useState<AdvisoryListItem | null>(null)
  const [stateOverrides, setStateOverrides] = useState<Record<string, string>>(
    {},
  )
  const revalidator = useRevalidator()

  // Fresh loader data already carries the changed states.
  useEffect(() => {
    setStateOverrides({})
  }, [loaderData.advisories])

  const advisories = useMemo(
    () =>
      loaderData.advisories.map((advisory) => ({
        ...advisory,
        workflowState:
          stateOverrides[advisory.advisoryId] ?? advisory.workflowState,
      })),
    [loaderData.advisories, stateOverrides],
  )

  const createVersion = useCallback(
    async (advisoryId: string) => {
      setPendingVersionIds((current) => [...current, advisoryId])
      const result = await createNewVersionWithFreshRevision(advisoryId).catch(
        () => undefined,
      )
      setPendingVersionIds((current) =>
        current.filter((id) => id !== advisoryId),
      )
      if (!result?.ok) {
        notify({ reason: 'dashboard.versionCreateFailed', variant: 'error' })
        return
      }
      notify({ reason: 'dashboard.versionCreated', variant: 'success' })
      void revalidator.revalidate()
    },
    [notify, revalidator],
  )

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
        columnHelper.display({
          id: 'actions',
          header: t('dashboard.columns.actions'),
          enableSorting: false,
          enableGlobalFilter: false,
          cell: ({ row }) =>
            row.original.changeable ||
            row.original.canCreateVersion ||
            row.original.allowedStateChanges.length > 0 ||
            row.original.deletable ? (
              <div className="flex gap-3">
                {row.original.changeable && (
                  <Link
                    className="relative z-10 underline"
                    to={href('/:advisoryId/edit', {
                      advisoryId: row.original.advisoryId,
                    })}
                  >
                    {t('dashboard.actions.edit')}
                  </Link>
                )}
                {row.original.canCreateVersion && (
                  <button
                    type="button"
                    disabled={pendingVersionIds.includes(
                      row.original.advisoryId,
                    )}
                    onClick={() => void createVersion(row.original.advisoryId)}
                    className="relative z-10 underline disabled:opacity-50"
                  >
                    {t('dashboard.actions.createVersion')}
                  </button>
                )}
                {row.original.allowedStateChanges.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStateDialogAdvisory(row.original)}
                    className="relative z-10 underline"
                  >
                    {t('dashboard.actions.changeState')}
                  </button>
                )}
                {row.original.deletable && (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      const confirmed = window.confirm(
                        t('dashboard.deleteConfirmation', {
                          title: row.original.title,
                        }),
                      )
                      if (confirmed) {
                        deleteFetcher.submit(
                          { advisoryId: row.original.advisoryId },
                          { method: 'post' },
                        )
                      }
                    }}
                    className="relative z-10 underline disabled:opacity-50"
                  >
                    {t('dashboard.actions.delete')}
                  </button>
                )}
              </div>
            ) : null,
        }),
      ]),
    [t, createVersion, pendingVersionIds, deleteFetcher.submit, isDeleting],
  )

  useEffect(() => {
    if (loaderData.loadFailed) {
      notify({ reason: 'dashboard.loadFailed', variant: 'error' })
    }
  }, [loaderData.loadFailed, notify])

  useEffect(() => {
    if (
      !deleteFetcher.data ||
      deleteFetcher.data === handledDeleteResult.current
    ) {
      return
    }
    handledDeleteResult.current = deleteFetcher.data
    if (!deleteFetcher.data.ok) {
      notify({ reason: 'dashboard.deleteFailed', variant: 'error' })
      return
    }
    notify({ reason: 'dashboard.deleted', variant: 'success' })
  }, [deleteFetcher.data, notify])

  const table = useTable({
    features,
    columns,
    data: advisories,
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
                  {header.isPlaceholder ? null : !header.column.getCanSort() ? (
                    <span className="font-semibold">
                      <table.FlexRender header={header} />
                    </span>
                  ) : (
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
      {stateDialogAdvisory && (
        <WorkflowStateDialog
          advisory={stateDialogAdvisory}
          onClose={() => setStateDialogAdvisory(null)}
          onChanged={(state) => {
            setStateOverrides((current) => ({
              ...current,
              [stateDialogAdvisory.advisoryId]: state,
            }))
            void revalidator.revalidate()
          }}
        />
      )}
    </div>
  )
}

export default AdvisoryDashboard
