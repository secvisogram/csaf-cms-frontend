import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import '~/i18n/i18n'

export type Notification = {
  /** Stable key, not pre-rendered prose; resolveMessage renders it for display. */
  reason: string
  variant: 'success' | 'error'
}

type ActiveNotification = Notification & { id: number }

type NotificationContextValue = {
  notify: (notification: Notification) => void
}

const AUTO_DISMISS_MS = 5000

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error(
      'useNotification must be used within a NotificationProvider',
    )
  }
  return context
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<ActiveNotification[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const activeIds = useRef(new Map<string, number>())
  const containerRef = useRef<HTMLDivElement>(null)

  // A popover joins the top layer when shown, so re-showing it on every change keeps toasts above a modal opened after them.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    if (container.matches(':popover-open')) container.hidePopover()
    if (notifications.length > 0) container.showPopover()
  }, [notifications])

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    activeIds.current.forEach((activeId, key) => {
      if (activeId === id) activeIds.current.delete(key)
    })
    setNotifications((current) => current.filter((n) => n.id !== id))
  }, [])

  const notify = useCallback(
    (notification: Notification) => {
      // An identical toast that is still showing is not stacked again.
      const key = `${notification.variant}:${notification.reason}`
      if (activeIds.current.has(key)) return
      const id = nextId.current++
      activeIds.current.set(key, id)
      setNotifications((current) => [...current, { ...notification, id }])
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      )
    },
    [dismiss],
  )

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div
        ref={containerRef}
        popover="manual"
        className="fixed inset-auto bottom-16 right-4 m-0 flex flex-col gap-2 overflow-visible border-0 bg-transparent p-0"
      >
        {notifications.map((notification) => (
          <div
            key={notification.id}
            role="status"
            className={`flex items-center gap-3 rounded px-4 py-2 shadow-lg text-white ${
              notification.variant === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            <span>
              {t(notification.reason, { defaultValue: notification.reason })}
            </span>
            <button
              type="button"
              aria-label={t('notifications.dismiss')}
              onClick={() => dismiss(notification.id)}
              className="font-bold"
            >
              {t('notifications.dismiss')}
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}
