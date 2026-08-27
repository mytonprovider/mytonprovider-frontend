import type { FiltersData } from "@/types/filters"
import type { SectionId } from "@/types/model"
import type { Provider } from "@/types/provider"
import { FILTER_GROUPS, type Bounds, type FilterField, type RangeFilterField } from "./filter-fields"

export const DEFAULT_FILTERS: FiltersData = { has_free_space: true, uptime_gt_percent: 20 }

export type FilterBounds = Record<string, Bounds>
export type FilterOptions = Record<string, string[]>

interface CommonView {
  name: string
  label: string
}

export type FieldView =
  | (CommonView & {
      kind: "select"
      value: string
      placeholder: string
      options: string[]
      set: (next: string) => FiltersData
    })
  | (CommonView & { kind: "text"; value: string; set: (next: string) => FiltersData })
  | (CommonView & { kind: "tri"; value: boolean | undefined; set: (next: boolean | undefined) => FiltersData })
  | (CommonView & { kind: "flag"; value: boolean | undefined; set: (next: boolean | undefined) => FiltersData })
  | (CommonView & {
      kind: "range"
      toName: string
      min: number
      max: number
      step: number
      integer: boolean
      low: number
      high: number
      set: (low: number, high: number) => FiltersData
    })

interface GroupView {
  id: SectionId
  active: number
  fields: FieldView[]
}

const ALL_FIELDS = FILTER_GROUPS.flatMap((group) => group.fields)

const limitsOf = (field: RangeFilterField, bounds: FilterBounds | null) => {
  const scale = field.scale ?? 1
  const edge = bounds?.[field.from] ?? field.fallback
  return { min: Math.floor(edge.min / scale), max: Math.ceil(edge.max / scale), scale }
}

const toStored = (field: RangeFilterField, value: number): number => {
  const raw = value * (field.scale ?? 1)
  return field.integer ? Math.round(raw) : Number(raw.toFixed(6))
}

const isSet = (value: FiltersData[keyof FiltersData]): boolean => value !== undefined && value !== ""

export const deriveBounds = (providers: Provider[], now: number): FilterBounds => {
  const bounds: FilterBounds = {}

  for (const field of ALL_FIELDS) {
    if (field.kind !== "range") continue

    if (field.fixed) {
      bounds[field.from] = field.fixed
      continue
    }

    let min = Infinity
    let max = -Infinity
    for (const provider of providers) {
      const value = field.read(provider, now)
      if (value === null) continue
      if (value < min) min = value
      if (value > max) max = value
    }

    bounds[field.from] = min <= max ? { min, max } : field.fallback
  }

  return bounds
}

export const optionsFor = (providers: Provider[]): FilterOptions => {
  const options: FilterOptions = {}

  for (const field of ALL_FIELDS) {
    if (field.kind !== "select") continue

    const seen = new Set<string>()
    for (const provider of providers) {
      const value = field.read(provider)
      if (value !== null) seen.add(value)
    }
    options[field.key] = [...seen].sort()
  }

  return options
}

const fieldMatches = (field: FilterField, provider: Provider, filters: FiltersData, now: number): boolean => {
  if (field.kind === "range") {
    const from = filters[field.from]
    const to = filters[field.to]
    if (from === undefined && to === undefined) return true

    const value = field.read(provider, now)
    if (value === null) return false
    if (typeof from === "number" && value < from) return false
    if (typeof to === "number" && value > to) return false
    return true
  }

  const wanted = filters[field.key]
  if (!isSet(wanted)) return true

  if (field.kind === "text") {
    const value = field.read(provider)
    return value !== null && typeof wanted === "string" && value.toLowerCase().includes(wanted.toLowerCase())
  }

  return field.read(provider) === wanted
}

export const matches = (provider: Provider, filters: FiltersData, now: number): boolean =>
  ALL_FIELDS.every((field) => fieldMatches(field, provider, filters, now))

const activeIn = (fields: FilterField[], filters: FiltersData): number => {
  let active = 0

  for (const field of fields) {
    if (field.kind === "range") {
      if (filters[field.from] !== undefined || filters[field.to] !== undefined) active += 1
      continue
    }

    if (isSet(filters[field.key])) active += 1
  }

  return active
}

const withBound = (draft: FiltersData, key: keyof FiltersData, value: number, edge: number): void => {
  if (value === edge) delete draft[key]
  else Object.assign(draft, { [key]: value })
}

const withValue = (filters: FiltersData, key: keyof FiltersData, next: string | boolean | undefined): FiltersData => {
  const draft: FiltersData = { ...filters }
  if (isSet(next)) Object.assign(draft, { [key]: next })
  else delete draft[key]
  return draft
}

const textOf = (filters: FiltersData, key: keyof FiltersData): string => {
  const current = filters[key]
  return typeof current === "string" ? current : ""
}

const flagOf = (filters: FiltersData, key: keyof FiltersData): boolean | undefined => {
  const current = filters[key]
  return typeof current === "boolean" ? current : undefined
}

const numberOf = (filters: FiltersData, key: keyof FiltersData, fallback: number): number => {
  const current = filters[key]
  return typeof current === "number" ? current : fallback
}

const toFieldView = (
  field: FilterField,
  filters: FiltersData,
  bounds: FilterBounds | null,
  options: FilterOptions,
): FieldView => {
  if (field.kind === "range") {
    const { min, max, scale } = limitsOf(field, bounds)

    return {
      kind: "range",
      name: field.from,
      toName: field.to,
      label: field.label,
      min,
      max,
      step: field.step,
      integer: field.integer,
      low: numberOf(filters, field.from, toStored(field, min)) / scale,
      high: numberOf(filters, field.to, toStored(field, max)) / scale,
      set: (low, high) => {
        const draft: FiltersData = { ...filters }
        withBound(draft, field.from, toStored(field, low), toStored(field, min))
        withBound(draft, field.to, toStored(field, high), toStored(field, max))
        return draft
      },
    }
  }

  const common = { name: field.key, label: field.label }

  if (field.kind === "select") {
    return {
      ...common,
      kind: "select",
      value: textOf(filters, field.key),
      placeholder: field.placeholder,
      options: options[field.key] ?? [],
      set: (next) => withValue(filters, field.key, next),
    }
  }

  if (field.kind === "text") {
    return { ...common, kind: "text", value: textOf(filters, field.key), set: (next) => withValue(filters, field.key, next) }
  }

  return {
    ...common,
    kind: field.kind,
    value: flagOf(filters, field.key),
    set: (next) => withValue(filters, field.key, next),
  }
}

export const toGroupViews = (filters: FiltersData, bounds: FilterBounds | null, options: FilterOptions): GroupView[] =>
  FILTER_GROUPS.map((group) => ({
    id: group.id,
    active: activeIn(group.fields, filters),
    fields: group.fields.map((field) => toFieldView(field, filters, bounds, options)),
  }))

export const countActiveFilters = (filters: FiltersData): number =>
  FILTER_GROUPS.reduce((total, group) => total + activeIn(group.fields, filters), 0)

export const isPristine = (filters: FiltersData): boolean => {
  const keys = new Set([...Object.keys(filters), ...Object.keys(DEFAULT_FILTERS)]) as Set<keyof FiltersData>
  return [...keys].every((key) => filters[key] === DEFAULT_FILTERS[key])
}
