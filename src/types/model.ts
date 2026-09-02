export type StatusTone = "gray" | "green" | "yellow" | "red" | "orange"

export type SortField =
  | "pubkey"
  | "uptime"
  | "price"
  | "rating"
  | "status"
  | "freeSpace"
  | "workingTime"
  | "location"

export type SortDirection = "asc" | "desc"

export interface StatusView {
  tone: StatusTone
  label: string
  ratio: string | null
}

export interface ProviderRow {
  pubkey: string
  keyShort: string
  status: StatusView
  uptime: string
  price: string
  priceUnit: string
  rating: string
  freeSpace: string
  freeSpaceUnit: string
  location: string
  workingTime: string
}

export interface DetailField {
  label: string
  value: string
  title?: string
  href?: string
  copy?: string
  uppercase?: boolean
  alert?: boolean
  mono?: boolean
}

export type SectionId = "provider" | "benchmarks" | "hardware" | "network" | "software"

export interface DetailSection {
  id: SectionId
  title: string
  fields: DetailField[]
}

export interface BreakdownItem {
  id: string
  tone: StatusTone
  label: string
  count: number
  percent: string
}

export interface ProviderDetail {
  status: StatusView
  description: string
  checks: { valid: number; total: number; tone: StatusTone; percent: string } | null
  breakdown: BreakdownItem[]
  sections: DetailSection[]
}
