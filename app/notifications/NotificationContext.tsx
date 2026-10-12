import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

export type Notification = {
  /** Stable key, not pre-rendered prose; resolveMessage renders it for display. */
  reason: string
  variant: 'success' | 'error'
}

/** Placeholder until ticket 11's i18n dictionary replaces this lookup. */
function resolveMessage(reason: string): string {
  return reason
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
  const [notifications, setNotifications] = useState<ActiveNotification[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

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
    setNotifications((current) => current.filter((n) => n.id !== id))
  }, [])

  const notify = useCallback(
    (notification: Notification) => {
      const id = nextId.current++
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
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            role="status"
            className={`flex items-center gap-3 rounded px-4 py-2 shadow-lg text-white ${
              notification.variant === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            <span>{resolveMessage(notification.reason)}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(notification.id)}
              className="font-bold"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}
