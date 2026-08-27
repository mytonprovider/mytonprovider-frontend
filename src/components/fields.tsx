import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { formatRangeBound, parseDecimal } from "@/lib/format"
import styles from "./fields.module.css"
import { cx } from "@/lib/cx"

interface TextFieldProps {
  name: string
  label: string
  value: string
  onChange: (value: string) => void
}

export const TextField = ({ name, label, value, onChange }: TextFieldProps) => (
  <label className={styles.field}>
    <span className={styles.label}>{label}</span>
    <input
      className={styles.input}
      type="text"
      name={name}
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
)

interface SelectFieldProps {
  name: string
  label: string
  value: string
  placeholder: string
  options: string[]
  onChange: (value: string) => void
}

export const SelectField = ({ name, label, value, placeholder, options, onChange }: SelectFieldProps) => (
  <label className={styles.field}>
    <span className={styles.label}>{label}</span>
    <span className={styles.selectWrap}>
      <select
        className={cx(styles.input, styles.select)}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className={styles.selectIcon} aria-hidden="true" />
    </span>
  </label>
)

interface TriFieldProps {
  label: string
  value: boolean | undefined
  onChange: (value: boolean | undefined) => void
}

const TRI_OPTIONS: { key: string; option: boolean | undefined }[] = [
  { key: "any", option: undefined },
  { key: "yes", option: true },
  { key: "no", option: false },
]

export const TriField = ({ label, value, onChange }: TriFieldProps) => {
  const { t } = useTranslation()

  const activeIndex = TRI_OPTIONS.findIndex(({ option }) => option === value)

  return (
    <div className={styles.inline}>
      <span className={styles.label}>{label}</span>
      <span
        className={styles.segmented}
        role="radiogroup"
        aria-label={label}
        style={{ "--tri-index": activeIndex } as React.CSSProperties}
      >
        <span className={styles.indicator} aria-hidden="true" />
        {TRI_OPTIONS.map(({ key, option }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === option}
            className={cx(styles.segment, value === option && styles.segmentActive)}
            onClick={() => onChange(option)}
          >
            {t(`triState.${key}`)}
          </button>
        ))}
      </span>
    </div>
  )
}

interface FlagFieldProps {
  label: string
  value: boolean | undefined
  onChange: (value: boolean | undefined) => void
}

export const FlagField = ({ label, value, onChange }: FlagFieldProps) => {
  const on = value === true

  return (
    <div className={styles.inline}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={cx(styles.switch, on && styles.switchOn)}
        onClick={() => onChange(on ? undefined : true)}
      >
        <span className={styles.knob} />
      </button>
    </div>
  )
}

interface RangeFieldProps {
  fromName: string
  toName: string
  label: string
  min: number
  max: number
  step: number
  integer: boolean
  low: number
  high: number
  onChange: (low: number, high: number) => void
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const RangeField = ({ fromName, toName, label, min, max, step, integer, low, high, onChange }: RangeFieldProps) => {
  const { t } = useTranslation()
  const fromLabel = t("ui.rangeFrom", { label })
  const toLabel = t("ui.rangeTo", { label })
  const shown = {
    lowText: formatRangeBound(low, integer),
    highText: formatRangeBound(high, integer),
    low,
    high,
  }
  const [text, setText] = useState(shown)

  if (text.low !== low || text.high !== high) setText(shown)

  const span = max - min || 1
  const commit = (raw: string, edge: "low" | "high") => {
    const parsed = parseDecimal(raw)
    const next = clamp(parsed ?? (edge === "low" ? min : max), min, max)
    const [nextLow, nextHigh] = edge === "low" ? [next, next > high ? max : high] : [next < low ? min : low, next]

    setText({
      lowText: formatRangeBound(nextLow, integer),
      highText: formatRangeBound(nextHigh, integer),
      low: nextLow,
      high: nextHigh,
    })
    onChange(nextLow, nextHigh)
  }

  return (
    <div>
      <div className={styles.rangeHead}>
        <span className={styles.label}>{label}</span>
        <span className={styles.bounds}>
          <input
            className={styles.boundInput}
            type="text"
            inputMode="decimal"
            name={fromName}
            autoComplete="off"
            aria-label={fromLabel}
            value={text.lowText}
            onChange={(event) => setText({ ...text, lowText: event.target.value })}
            onBlur={(event) => commit(event.target.value, "low")}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
            }}
          />
          <span className={styles.dash}>–</span>
          <input
            className={styles.boundInput}
            type="text"
            inputMode="decimal"
            name={toName}
            autoComplete="off"
            aria-label={toLabel}
            value={text.highText}
            onChange={(event) => setText({ ...text, highText: event.target.value })}
            onBlur={(event) => commit(event.target.value, "high")}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
            }}
          />
        </span>
      </div>

      <div className={styles.track}>
        <span className={styles.rail} />
        <span
          className={styles.fill}
          style={
            {
              "--fill-start": `${((low - min) / span) * 100}%`,
              "--fill-end": `${100 - ((high - min) / span) * 100}%`,
            } as React.CSSProperties
          }
        />
        <input
          className={styles.thumb}
          type="range"
          name={`${fromName}-slider`}
          aria-label={fromLabel}
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(event) => onChange(Math.min(Number(event.target.value), high), high)}
        />
        <input
          className={styles.thumb}
          type="range"
          name={`${toName}-slider`}
          aria-label={toLabel}
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(event) => onChange(low, Math.max(Number(event.target.value), low))}
        />
      </div>
    </div>
  )
}
