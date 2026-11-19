import { useEffect, useId, useRef, useState } from 'react'
import { MoreIcon } from './icons'

export type RowActionsMenuItem = {
  key: string
  label: string
  onSelect: () => void
  disabled?: boolean
  destructive?: boolean
}

type RowActionsMenuProps = {
  /** Accessible name of the trigger and the menu. */
  label: string
  items: RowActionsMenuItem[]
}

const MENU_WIDTH = 224
const ITEM_HEIGHT = 36
const GAP = 4

/**
 * An overflow menu built on the native Popover API: the browser handles top-layer rendering,
 * light dismiss and Escape, so the menu is never clipped by the table.
 */
export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({
  label,
  items,
}) => {
  const menuId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  // The menu is positioned once on open, so it must not outlive a scroll or resize.
  useEffect(() => {
    if (!open) return
    const close = () => menuRef.current?.hidePopover()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const place = () => {
    const button = buttonRef.current
    const menu = menuRef.current
    if (!button || !menu) return
    const rect = button.getBoundingClientRect()
    const height = items.length * ITEM_HEIGHT + 12
    const fitsBelow = rect.bottom + GAP + height <= window.innerHeight
    menu.style.left = `${Math.max(GAP * 2, rect.right - MENU_WIDTH)}px`
    menu.style.top = fitsBelow
      ? `${rect.bottom + GAP}px`
      : `${Math.max(GAP * 2, rect.top - GAP - height)}px`
  }

  const menuItems = () =>
    Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    )

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      menuRef.current?.hidePopover()
      return
    }
    const entries = menuItems()
    const current = entries.indexOf(document.activeElement as HTMLButtonElement)
    const target =
      event.key === 'ArrowDown'
        ? entries[(current + 1) % entries.length]
        : event.key === 'ArrowUp'
          ? entries[(current - 1 + entries.length) % entries.length]
          : event.key === 'Home'
            ? entries[0]
            : event.key === 'End'
              ? entries[entries.length - 1]
              : undefined
    if (target) {
      event.preventDefault()
      target.focus()
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        popoverTarget={menuId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className="relative z-10 grid size-8 place-items-center rounded-md text-slate-600 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 aria-expanded:bg-slate-200"
      >
        <MoreIcon />
      </button>
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={label}
        onBeforeToggle={(event) => {
          if (event.newState === 'open') place()
        }}
        onToggle={(event) => {
          setOpen(event.newState === 'open')
          if (event.newState === 'open') {
            menuItems()[0]?.focus({ preventScroll: true })
          }
        }}
        onKeyDown={onKeyDown}
        className="m-0 w-56 inset-auto rounded-lg border border-slate-200 bg-white p-1 text-sm shadow-lg"
      >
        {items.map((item, index) => (
          <div key={item.key}>
            {item.destructive && index > 0 && (
              <div
                role="separator"
                className="my-1 border-t border-slate-200"
              />
            )}
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => {
                menuRef.current?.hidePopover()
                item.onSelect()
              }}
              className={`flex h-9 w-full items-center rounded-md px-3 text-left hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none disabled:opacity-50 ${item.destructive ? 'text-red-700' : 'text-slate-800'}`}
            >
              {item.label}
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
