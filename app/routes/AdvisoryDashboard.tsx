import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { href, Link, useFetcher, useRevalidator } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  columnFacetingFeature,
  columnFilteringFeature,
  createColumnHelper,
  createFacetedRowModel,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type FilterFn,
  type SortFn,
  type SortingState,
} from '@tanstack/react-table'
import {
  createNewVersionWithFreshRevision,
  deleteAdvisoryWithFreshRevision,
  listAdvisories,
  type AdvisoryListItem,
} from '~/auth/backend'
import {
  CloseIcon,
  LockIcon,
  SearchIcon,
  SortIcon,
  UnlockIcon,
} from '~/components/icons'
import {
  RowActionsMenu,
  type RowActionsMenuItem,
} from '~/components/RowActionsMenu'
import {
  WORKFLOW_STATES,
  WorkflowStateBadge,
  workflowStateRank,
} from '~/components/WorkflowStateBadge'
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
  columnFacetingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  facetedRowModel: createFacetedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
})

type Features = typeof features

const columnHelper = createColumnHelper<Features, AdvisoryListItem>()

const WORKFLOW_STATE_COLUMN = 'workflowState'

const matchesWorkflowState: FilterFn<Features, AdvisoryListItem> = (
  row,
  _columnId,
  filterValue,
) => row.original.workflowState === filterValue

const compareWorkflowState: SortFn<Features, AdvisoryListItem> = (a, b) =>
  workflowStateRank(a.original.workflowState) -
  workflowStateRank(b.original.workflowState)

const releaseTime = (value: string | undefined) => {
  const time = value ? Date.parse(value) : Number.NaN
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

const compareReleaseDate: SortFn<Features, AdvisoryListItem> = (a, b) => {
  const left = releaseTime(a.original.currentReleaseDate)
  const right = releaseTime(b.original.currentReleaseDate)
  return left === right ? 0 : left > right ? 1 : -1
}

/** Date-only values are shown in UTC so the calendar day never shifts with the time zone. */
const formatReleaseDate = (value: string, locale: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(
    locale,
    value.includes('T')
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium', timeZone: 'UTC' },
  ).format(date)
}

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

const AdvisoryDashboard = ({ loaderData }: Route.ComponentProps) => {
  const { t, i18n } = useTranslation()
  const { notify } = useNotification()
  const deleteFetcher = useFetcher<typeof clientAction>()
  const isDeleting = deleteFetcher.state !== 'idle'
  // Avoid showing the same toast again if an effect reruns for the same action result.
  const handledDeleteResult = useRef<DeleteAdvisoryActionResult | undefined>(
    undefined,
  )
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
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

  const stateLabel = useCallback(
    (state: string) =>
      t(`dashboard.workflowStates.${state}`, { defaultValue: state }),
    [t],
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
          cell: ({ row }) => (
            <Link
              title={row.original.title}
              className={`line-clamp-2 min-w-0 font-medium text-slate-900 after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-blue-600`}
              to={href('/:advisoryId/edit', {
                advisoryId: row.original.advisoryId,
              })}
            >
              {row.original.title}
            </Link>
          ),
        }),
        columnHelper.accessor('documentTrackingId', {
          header: t('dashboard.columns.trackingId'),
          cell: ({ row }) => (
            <span className="font-mono text-[13px] whitespace-nowrap text-slate-700">
              {row.original.documentTrackingId}
            </span>
          ),
        }),
        columnHelper.accessor(
          (advisory) => stateLabel(advisory.workflowState),
          {
            id: WORKFLOW_STATE_COLUMN,
            header: t('dashboard.columns.workflowState'),
            filterFn: matchesWorkflowState,
            sortFn: compareWorkflowState,
            cell: ({ row }) => (
              <WorkflowStateBadge
                state={row.original.workflowState}
                label={stateLabel(row.original.workflowState)}
              />
            ),
          },
        ),
        columnHelper.accessor(
          (advisory) =>
            advisory.changeable
              ? t('dashboard.access.editable')
              : t('dashboard.access.readOnly'),
          {
            id: 'access',
            header: t('dashboard.columns.access'),
            cell: ({ row }) =>
              row.original.changeable ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-700">
                  <UnlockIcon className="text-slate-500" />
                  {t('dashboard.access.editable')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-amber-800">
                  <LockIcon />
                  {t('dashboard.access.readOnly')}
                </span>
              ),
          },
        ),
        columnHelper.accessor('owner', {
          header: t('dashboard.columns.owner'),
          cell: ({ row }) => (
            <span className="text-sm text-slate-700">{row.original.owner}</span>
          ),
        }),
        columnHelper.accessor('currentReleaseDate', {
          header: t('dashboard.columns.currentReleaseDate'),
          sortFn: compareReleaseDate,
          cell: ({ row }) => {
            const value = row.original.currentReleaseDate
            return value ? (
              <time
                dateTime={value}
                title={value}
                className="text-sm whitespace-nowrap text-slate-700"
              >
                {formatReleaseDate(value, i18n.language)}
              </time>
            ) : (
              <span className="text-slate-400">
                {t('dashboard.noReleaseDate')}
              </span>
            )
          },
        }),
        columnHelper.display({
          id: 'actions',
          header: t('dashboard.columns.actions'),
          enableSorting: false,
          enableGlobalFilter: false,
          cell: ({ row }) => {
            const advisory = row.original
            const items: RowActionsMenuItem[] = []
            if (advisory.canCreateVersion) {
              items.push({
                key: 'createVersion',
                label: t('dashboard.actions.createVersion'),
                disabled: pendingVersionIds.includes(advisory.advisoryId),
                onSelect: () => void createVersion(advisory.advisoryId),
              })
            }
            if (advisory.allowedStateChanges.length > 0) {
              items.push({
                key: 'changeState',
                label: t('dashboard.actions.changeState'),
                onSelect: () => setStateDialogAdvisory(advisory),
              })
            }
            if (advisory.deletable) {
              items.push({
                key: 'delete',
                label: t('dashboard.actions.delete'),
                destructive: true,
                disabled: isDeleting,
                onSelect: () => {
                  const confirmed = window.confirm(
                    t('dashboard.deleteConfirmation', {
                      title: advisory.title,
                    }),
                  )
                  if (confirmed) {
                    deleteFetcher.submit(
                      { advisoryId: advisory.advisoryId },
                      { method: 'post' },
                    )
                  }
                },
              })
            }

            return (
              <div className="flex items-center gap-1 md:justify-end">
                {advisory.changeable && (
                  <Link
                    className={`relative z-10 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-100 ${focusRing}`}
                    to={href('/:advisoryId/edit', {
                      advisoryId: advisory.advisoryId,
                    })}
                  >
                    {t('dashboard.actions.edit')}
                  </Link>
                )}
                {items.length > 0 && (
                  <RowActionsMenu
                    label={t('dashboard.rowActions', { title: advisory.title })}
                    items={items}
                  />
                )}
              </div>
            )
          },
        }),
      ]),
    [
      t,
      i18n.language,
      stateLabel,
      createVersion,
      pendingVersionIds,
      deleteFetcher.submit,
      isDeleting,
    ],
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
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: 'includesString',
  })

  const stateColumn = table.getColumn(WORKFLOW_STATE_COLUMN)
  const activeState = stateColumn?.getFilterValue() as string | undefined

  // The faceted model applies the search text but not the state filter, so each chip shows what it would reveal.
  const stateCounts = new Map<string, number>()
  for (const row of stateColumn?.getFacetedRowModel().rows ?? []) {
    const state = row.original.workflowState
    stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1)
  }
  const totalCount = [...stateCounts.values()].reduce((a, b) => a + b, 0)
  const chipStates = [
    ...WORKFLOW_STATES,
    ...[
      ...new Set(advisories.map((advisory) => advisory.workflowState)),
    ].filter(
      (state) =>
        Boolean(state) &&
        !(WORKFLOW_STATES as readonly string[]).includes(state),
    ),
  ]

  const rows = table.getRowModel().rows
  const isFiltering = globalFilter !== '' || activeState !== undefined

  const resetFilters = () => {
    setGlobalFilter('')
    stateColumn?.setFilterValue(undefined)
  }

  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors motion-reduce:transition-none disabled:cursor-default disabled:opacity-45 ${focusRing} ${
      active
        ? 'border-slate-800 bg-slate-800 text-white'
        : 'border-slate-300 bg-white text-slate-700 enabled:hover:border-slate-400 enabled:hover:bg-slate-100'
    }`

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto w-full max-w-[96rem]">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t('dashboard.heading')}
        </h2>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="relative w-full max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              aria-label={t('dashboard.filterLabel')}
              placeholder={t('dashboard.filterLabel')}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className={`w-full rounded-md border border-slate-300 bg-white py-2 pr-9 pl-9 text-sm placeholder:text-slate-500 ${focusRing}`}
            />
            {globalFilter !== '' && (
              <button
                type="button"
                aria-label={t('dashboard.clearFilter')}
                onClick={() => setGlobalFilter('')}
                className={`absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-slate-600 hover:bg-slate-200 ${focusRing}`}
              >
                <CloseIcon />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label={t('dashboard.stateFilterLabel')}
            className="flex flex-wrap gap-2"
          >
            <button
              type="button"
              aria-pressed={activeState === undefined}
              onClick={() => stateColumn?.setFilterValue(undefined)}
              className={chipClass(activeState === undefined)}
            >
              {t('dashboard.allStates')}
              <span className="tabular-nums opacity-70">{totalCount}</span>
            </button>
            {chipStates.map((state) => {
              const count = stateCounts.get(state) ?? 0
              const active = activeState === state
              return (
                <button
                  key={state}
                  type="button"
                  aria-pressed={active}
                  disabled={count === 0 && !active}
                  onClick={() =>
                    stateColumn?.setFilterValue(active ? undefined : state)
                  }
                  className={chipClass(active)}
                >
                  {stateLabel(state)}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <table className="mt-5 w-full rounded-lg border border-slate-200 bg-white max-md:block">
          <thead className="max-md:sr-only">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                      className="sticky top-0 z-20 bg-slate-100 px-4 py-2 text-left text-sm font-semibold text-slate-700 first:rounded-tl-lg last:rounded-tr-lg"
                    >
                      {header.isPlaceholder ? null : !header.column.getCanSort() ? (
                        <span>
                          <table.FlexRender header={header} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`flex w-full items-center gap-1 rounded text-left font-semibold ${focusRing}`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          <SortIcon direction={sorted} />
                        </button>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="max-md:block">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="relative border-t border-slate-200 first:border-t-0 hover:bg-slate-50 max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-4 max-md:gap-y-1.5 max-md:p-4"
              >
                {row.getAllCells().map((cell) => {
                  const header = cell.column.columnDef.header
                  const isTitle = cell.column.id === 'title'
                  const isActions = cell.column.id === 'actions'
                  return (
                    <td
                      key={cell.id}
                      data-label={
                        typeof header === 'string' && !isTitle && !isActions
                          ? header
                          : undefined
                      }
                      className={`max-md:p-0 md:px-4 md:py-3 md:align-middle ${
                        isTitle || isActions
                          ? ''
                          : 'max-md:before:mr-1.5 max-md:before:text-xs max-md:before:text-slate-500 max-md:before:content-[attr(data-label)]'
                      } ${
                        isTitle
                          ? 'max-md:w-full md:max-w-md'
                          : isActions
                            ? 'max-md:mt-1 max-md:w-full md:w-px md:whitespace-nowrap'
                            : ''
                      }`}
                    >
                      <table.FlexRender cell={cell} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && !loaderData.loadFailed && (
          <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-600">
            <p>
              {isFiltering ? t('dashboard.noMatches') : t('dashboard.empty')}
            </p>
            {isFiltering && (
              <button
                type="button"
                onClick={resetFilters}
                className={`mt-3 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-800 hover:bg-slate-100 ${focusRing}`}
              >
                {t('dashboard.resetFilters')}
              </button>
            )}
          </div>
        )}

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
    </div>
  )
}

export default AdvisoryDashboard
