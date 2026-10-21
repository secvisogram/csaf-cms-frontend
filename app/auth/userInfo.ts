import { getAppConfig } from './appConfig'
import { fetchApiOrRedirect } from './session'

export type UserInfo = {
  groups: string[]
}

let inflight: Promise<UserInfo> | undefined

async function loadUserInfo(): Promise<UserInfo> {
  const appConfig = await getAppConfig()
  const result = await fetchApiOrRedirect<UserInfo>(appConfig.userInfoUrl)
  if (!result.ok) {
    throw new Error(`Failed to load user info: ${result.error.message}`)
  }
  return result.data
}

/**
 * Concurrent callers (the root loader and a child route's loader run in
 * parallel) share one request; nothing is cached once it settles.
 */
export function getUserInfo(): Promise<UserInfo> {
  inflight ??= loadUserInfo().finally(() => {
    inflight = undefined
  })
  return inflight
}

export function canCreateDocuments(userInfo: UserInfo): boolean {
  return userInfo.groups.includes('author')
}
