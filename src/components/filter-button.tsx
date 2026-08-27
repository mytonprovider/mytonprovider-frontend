import { SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import styles from "./filter-button.module.css"
import { cx } from "@/lib/cx"

interface FilterButtonProps {
  variant: "icon" | "labeled"
  active: boolean
  onClick: () => void
}

export const FilterButton = ({ variant, active, onClick }: FilterButtonProps) => {
  const { t } = useTranslation()
  const label = t("filters.title")

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cx(styles.button, styles[variant], active && styles.active)}
    >
      <SlidersHorizontal className={styles.glyph} />
      {variant === "labeled" && <span>{label}</span>}
    </button>
  )
}
