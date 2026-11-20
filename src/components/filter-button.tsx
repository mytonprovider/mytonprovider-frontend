import { SlidersHorizontal } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button, glyphClass, IconButton } from "@myton/ui"
import styles from "./filter-button.module.css"

interface FilterButtonProps {
  variant: "icon" | "labeled"
  active: boolean
  onClick: () => void
}

export const FilterButton = ({ variant, active, onClick }: FilterButtonProps) => {
  const { t } = useTranslation()
  const label = t("ui:filters.title")
  const look = active ? "primary" : "secondary"

  if (variant === "icon") {
    return (
      <IconButton size="xl" variant={look} label={label} onClick={onClick}>
        <SlidersHorizontal className={glyphClass("md")} />
      </IconButton>
    )
  }

  return (
    <Button variant={look} onClick={onClick} title={label} aria-label={label}>
      <SlidersHorizontal className={styles.glyph} />
      <span>{label}</span>
    </Button>
  )
}
