/** Lifecycle stages of an advisory, in order (see the glossary in docs/spec.md). */
export const WORKFLOW_STATES = [
  'Draft',
  'Review',
  'Approved',
  'RfPublication',
  'AutoPublish',
  'Published',
] as const

/** Position in the lifecycle; unknown states sort after all known ones. */
export const workflowStateRank = (state: string): number => {
  const index = (WORKFLOW_STATES as readonly string[]).indexOf(state)
  return index === -1 ? WORKFLOW_STATES.length : index
}

type WorkflowStateBadgeProps = {
  state: string
  label: string
}

/** The label always carries the meaning; the segments only show the position. */
export const WorkflowStateBadge: React.FC<WorkflowStateBadgeProps> = ({
  state,
  label,
}) => {
  const rank = workflowStateRank(state)
  const filledClass = state === 'Published' ? 'bg-emerald-600' : 'bg-blue-600'

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
      {rank < WORKFLOW_STATES.length && (
        <span aria-hidden="true" className="flex gap-0.5">
          {WORKFLOW_STATES.map((step, index) => (
            <span
              key={step}
              className={`h-1.5 w-3 rounded-full ${index <= rank ? filledClass : 'bg-slate-200'}`}
            />
          ))}
        </span>
      )}
      <span className="text-sm font-medium text-slate-800">{label}</span>
    </span>
  )
}
