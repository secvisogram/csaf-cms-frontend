import { getAbout } from '~/auth/backend'

const loadFailed = { ok: false as const }

export const clientLoader = async () => {
  try {
    const result = await getAbout()
    return result.ok
      ? { ok: true as const, version: result.data.version }
      : loadFailed
  } catch {
    return loadFailed
  }
}
