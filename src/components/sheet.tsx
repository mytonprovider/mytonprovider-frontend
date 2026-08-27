import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSheetDrag } from "@/lib/sheet-drag"
import { IconButton } from "./icon-button"
import styles from "./sheet.module.css"

const LEAVE_GUARD_MS = 400

interface SheetProps {
  open: boolean
  label: string
  title?: string
  badge?: number
  footer?: ReactNode
  children: ReactNode
  onReset?: () => void
  onClose: () => void
}

export const Sheet = ({ open, label, title, badge, footer, children, onReset, onClose }: SheetProps) => {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const timer = useRef(0)
  const pressedBackdrop = useRef(false)
  const [leaving, setLeaving] = useState(false)

  const requestClose = useCallback(() => {
    setLeaving(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(onClose, LEAVE_GUARD_MS)
  }, [onClose])

  const drag = useSheetDrag(open, requestClose)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
      dialog.focus()
    }
    if (!open && dialog.open) dialog.close()
    setLeaving(false)
  }, [open])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    const cancel = (event: Event) => {
      event.preventDefault()
      requestClose()
    }

    dialog.addEventListener("cancel", cancel)
    return () => dialog.removeEventListener("cancel", cancel)
  }, [requestClose])

  return (
    <dialog
      ref={ref}
      className={styles.sheet}
      aria-label={label}
      tabIndex={-1}
      data-dragging={drag.dragging ? "" : undefined}
      data-leaving={leaving ? "" : undefined}
      style={drag.offset === null ? undefined : ({ "--sheet-y": `${drag.offset}px` } as CSSProperties)}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === ref.current
      }}
      onClick={(event) => {
        if (event.target === ref.current && pressedBackdrop.current) requestClose()
      }}
      onTransitionEnd={(event) => {
        if (!leaving || event.target !== ref.current) return
        window.clearTimeout(timer.current)
        onClose()
      }}
    >
      <div className={styles.header} onPointerDown={drag.onPointerDown}>
        <span className={styles.grabber} aria-hidden="true" />
        {title && <span className={styles.title}>{title}</span>}
        {badge !== undefined && badge > 0 && <span className={styles.badge}>{badge}</span>}
        <span className={styles.spacer} />
        {onReset && (
          <button type="button" className={styles.reset} onClick={onReset}>
            {t("buttons.reset")}
          </button>
        )}
        <IconButton label={t("ui.close")} onClick={requestClose}>
          <X className={styles.closeIcon} />
        </IconButton>
      </div>

      <div className={styles.body} ref={drag.bodyRef} onPointerDown={drag.onPointerDown}>
        {children}
      </div>

      {footer && <div className={styles.footer}>{footer}</div>}
    </dialog>
  )
}
