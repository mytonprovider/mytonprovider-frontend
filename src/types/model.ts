import type { ReasonCount, StaleSignal } from "@myton/ui/domain"
import type { StatusView } from "@myton/ui/locale"

export type { SortDirection, SortField } from "@myton/ui/domain"

export type Translate = (key: string, options?: Record<string, unknown>) => string

// A row prints the share of passed checks as text; the card's status keeps it a number for its own scale
export interface RowStatus extends Omit<StatusView, "ratio"> {
  ratio: string | null
}

export interface ProviderRow {
  pubkey: string
  keyShort: string
  status: RowStatus
  uptime: string
  price: string
  priceUnit: string
  rating: string
  rank: number | null
  freeSpace: string
  freePercent: number | null
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

type SectionId = "provider" | "benchmarks" | "hardware" | "network" | "software"

export interface DetailSection {
  id: SectionId
  title: string
  fields: DetailField[]
}

export interface ProviderDetail {
  status: StatusView
  reasons: ReasonCount[]
  description: string
  stale: StaleSignal[]
  sections: DetailSection[]
}
