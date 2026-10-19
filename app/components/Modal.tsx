import { useEffect, useRef } from 'react'

type ModalProps = {
  label: string
  /** Called on Escape; the modal stays open until the owner unmounts it. */
  onClose: () => void
  children: React.ReactNode
}

/** A native modal `<dialog>`; it is shown on mount, so owners render it only while open. */
export const Modal: React.FC<ModalProps> = ({ label, onClose, children }) => {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="m-auto w-96 rounded bg-white p-4 shadow-lg backdrop:bg-black/50"
    >
      {children}
    </dialog>
  )
}
