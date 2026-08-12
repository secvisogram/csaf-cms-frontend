import {
  type RouteConfig,
  index,
  layout,
  route,
} from '@react-router/dev/routes'

export default [
  layout('App.tsx', [
    index('routes/AdvisoryDashboard.tsx'),
    route(':advisoryId/edit', 'routes/EditPage.tsx'),
  ]),
] satisfies RouteConfig
