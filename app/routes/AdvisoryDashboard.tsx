import { href, Link } from 'react-router'
import type { Route } from './+types/AdvisoryDashboard'

const data = [
  { advisoryId: crypto.randomUUID() },
  { advisoryId: crypto.randomUUID() },
]

export const clientLoader = () => {
  return data
}

const AdvisoryDashboard = ({ loaderData }: Route.ComponentProps) => {
  return (
    <div className="max-w-4xl mx-auto mt-2 px-4">
      <h2 className="text-lg font-bold">Advisory Dashboard</h2>
      <ul className="flex flex-col gap-y-2 mt-4">
        {loaderData.map((d) => (
          <li key={d.advisoryId}>
            <Link
              className="underline"
              to={href('/:advisoryId/edit', { advisoryId: d.advisoryId })}
            >
              Advisory: {d.advisoryId}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default AdvisoryDashboard
