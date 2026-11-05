import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'
import { useTranslation } from 'react-i18next'

export function isDocumentDirty(doc: unknown, savedDoc: unknown) {
  return JSON.stringify(doc) !== JSON.stringify(savedDoc)
}

export function useUnsavedChangesGuard(isDirty: boolean) {
  const { t } = useTranslation()
  const bypassNavigationTo = useRef<string | undefined>(undefined)
  const blocker = useBlocker(({ nextLocation }) => {
    const nextUrl =
      nextLocation.pathname + nextLocation.search + nextLocation.hash
    if (bypassNavigationTo.current === nextUrl) {
      bypassNavigationTo.current = undefined
      return false
    }
    return isDirty
  })

  useEffect(() => {
    if (blocker.state !== 'blocked') return

    if (window.confirm(t('unsavedChanges.confirm'))) {
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker, t])

  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  return {
    bypassNavigationTo: (url: string) => {
      bypassNavigationTo.current = url
    },
  }
}
