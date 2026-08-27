import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FiltersData } from "@/types/filters"
import type { SectionId } from "@/types/model"
import { toGroupViews, type FieldView, type FilterBounds, type FilterOptions } from "@/lib/filters"
import { FlagField, RangeField, SelectField, TextField, TriField } from "./fields"
import { SECTION_ICONS } from "./section-icons"
import styles from "./filters.module.css"

interface FiltersProps {
  value: FiltersData
  bounds: FilterBounds
  options: FilterOptions
  onChange: (filters: FiltersData) => void
}

export const Filters = ({ value, bounds, options, onChange }: FiltersProps) => {
  const { t } = useTranslation()
  const groups = toGroupViews(value, bounds, options)
  const [openGroup, setOpenGroup] = useState<SectionId | null>(groups[0].id)

  const renderField = (field: FieldView) => {
    if (field.kind === "select") {
      return (
        <SelectField
          key={field.name}
          name={field.name}
          label={t(field.label)}
          value={field.value}
          placeholder={t(field.placeholder)}
          options={field.options}
          onChange={(next) => onChange(field.set(next))}
        />
      )
    }

    if (field.kind === "text") {
      return (
        <TextField
          key={field.name}
          name={field.name}
          label={t(field.label)}
          value={field.value}
          onChange={(next) => onChange(field.set(next))}
        />
      )
    }

    if (field.kind === "flag") {
      return (
        <FlagField
          key={field.name}
          label={t(field.label)}
          value={field.value}
          onChange={(next) => onChange(field.set(next))}
        />
      )
    }

    if (field.kind === "tri") {
      return (
        <TriField
          key={field.name}
          label={t(field.label)}
          value={field.value}
          onChange={(next) => onChange(field.set(next))}
        />
      )
    }

    return (
      <RangeField
        key={field.name}
        fromName={field.name}
        toName={field.toName}
        label={t(field.label)}
        min={field.min}
        max={field.max}
        step={field.step}
        integer={field.integer}
        low={field.low}
        high={field.high}
        onChange={(low, high) => onChange(field.set(low, high))}
      />
    )
  }

  return (
    <div className={styles.panel}>
      {groups.map((group) => {
        const Icon = SECTION_ICONS[group.id]

        return (
          <details
            key={group.id}
            className={styles.group}
            open={openGroup === group.id}
            onToggle={(event) => {
              if (event.currentTarget.open) setOpenGroup(group.id)
              else if (openGroup === group.id) setOpenGroup(null)
            }}
          >
            <summary className={styles.summary}>
              <Icon className={styles.groupIcon} aria-hidden="true" />
              <span className={styles.groupTitle}>{t(`filters.${group.id}`)}</span>
              {group.active > 0 && <span className={styles.badge}>{group.active}</span>}
              <span className={styles.spacer} />
              <ChevronDown className={styles.chevron} aria-hidden="true" />
            </summary>
            <div className={styles.fields}>{group.fields.map(renderField)}</div>
          </details>
        )
      })}
    </div>
  )
}
