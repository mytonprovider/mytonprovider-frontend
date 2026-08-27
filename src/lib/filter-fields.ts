import type { FiltersData } from "@/types/filters"
import type { SectionId } from "@/types/model"
import type { Provider } from "@/types/provider"
import { BYTES_IN_GB, BYTES_IN_GIB, BYTES_IN_KIB, NANO, PING_LIMIT, SECONDS_IN_DAY, parseSpeed } from "./format"
import { freeSpaceOf } from "./model"

const KIB_IN_MIB = 1024

export interface Bounds {
  min: number
  max: number
}

export interface RangeFilterField {
  kind: "range"
  from: keyof FiltersData
  to: keyof FiltersData
  label: string
  step: number
  integer: boolean
  scale?: number
  fixed?: Bounds
  fallback: Bounds
  read: (provider: Provider, now: number) => number | null
}

interface SelectFilterField {
  kind: "select"
  key: keyof FiltersData
  label: string
  placeholder: string
  read: (provider: Provider) => string | null
}

interface TextFilterField {
  kind: "text"
  key: keyof FiltersData
  label: string
  read: (provider: Provider) => string | null
}

interface TriFilterField {
  kind: "tri"
  key: keyof FiltersData
  label: string
  read: (provider: Provider) => boolean | null
}

interface FlagFilterField {
  kind: "flag"
  key: keyof FiltersData
  label: string
  read: (provider: Provider) => boolean | null
}

export type FilterField = RangeFilterField | SelectFilterField | TextFilterField | TriFilterField | FlagFilterField

interface FilterGroup {
  id: SectionId
  fields: FilterField[]
}

const number = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null

const text = (value: string | null | undefined): string | null => (value ? value : null)

const toUnits = (bytes: number | null | undefined, factor: number): number | null => {
  const value = number(bytes)
  return value === null ? null : value / factor
}

const countryOf = (provider: Provider): string | null => {
  const place = provider.location
  return place?.country && place.country_iso ? `${place.country} (${place.country_iso})` : null
}

const pingOf = (provider: Provider): number | null => {
  const value = number(provider.telemetry?.speedtest_ping)
  return value !== null && value < PING_LIMIT ? value : null
}

export const FILTER_GROUPS: FilterGroup[] = [
  {
    id: "provider",
    fields: [
      {
        kind: "select",
        key: "location",
        label: "filters.location",
        placeholder: "filters.locationPlaceholder",
        read: countryOf,
      },
      {
        kind: "flag",
        key: "has_free_space",
        label: "filters.onlyWithFreeSpace",
        read: (provider) => {
          const free = freeSpaceOf(provider)
          return free === null ? null : free > 0
        },
      },
      {
        kind: "range",
        from: "rating_gt",
        to: "rating_lt",
        label: "filters.rating",
        step: 0.01,
        integer: false,
        fallback: { min: 0, max: 50 },
        read: (provider) => number(provider.rating),
      },
      {
        kind: "range",
        from: "reg_time_days_gt",
        to: "reg_time_days_lt",
        label: "filters.registrationTime",
        step: 1,
        integer: true,
        fallback: { min: 0, max: 1095 },
        read: (provider, now) => number((now - provider.reg_time) / SECONDS_IN_DAY),
      },
      {
        kind: "range",
        from: "uptime_gt_percent",
        to: "uptime_lt_percent",
        label: "filters.uptime",
        step: 0.1,
        integer: false,
        fixed: { min: 0, max: 100 },
        fallback: { min: 0, max: 100 },
        read: (provider) => number(provider.uptime),
      },
      {
        kind: "range",
        from: "price_gt",
        to: "price_lt",
        label: "filters.price",
        step: 0.1,
        integer: false,
        fallback: { min: 0, max: 100 },
        read: (provider) => number(provider.price / NANO),
      },
      {
        kind: "range",
        from: "min_span_gt",
        to: "min_span_lt",
        label: "filters.minSpan",
        step: 3600,
        integer: true,
        fallback: { min: 0, max: 2592000 },
        read: (provider) => number(provider.min_span),
      },
      {
        kind: "range",
        from: "max_span_gt",
        to: "max_span_lt",
        label: "filters.maxSpan",
        step: 1,
        integer: true,
        scale: SECONDS_IN_DAY,
        fallback: { min: 0, max: 2592000 },
        read: (provider) => number(provider.max_span),
      },
      {
        kind: "range",
        from: "max_bag_size_mb_gt",
        to: "max_bag_size_mb_lt",
        label: "filters.maxBagSize",
        step: 1,
        integer: true,
        fallback: { min: 0, max: 40000 },
        read: (provider) => number(provider.max_bag_size_bytes / 1024 ** 2),
      },
    ],
  },
  {
    id: "benchmarks",
    fields: [
      {
        kind: "range",
        from: "benchmark_disk_read_speed_gt",
        to: "benchmark_disk_read_speed_lt",
        label: "filters.diskReadSpeed",
        step: 1,
        integer: true,
        scale: KIB_IN_MIB,
        fallback: { min: 0, max: 1e6 },
        read: (provider) => {
          const speed = parseSpeed(provider.telemetry?.qd64_disk_read_speed)
          return speed === null ? null : speed / BYTES_IN_KIB
        },
      },
      {
        kind: "range",
        from: "benchmark_disk_write_speed_gt",
        to: "benchmark_disk_write_speed_lt",
        label: "filters.diskWriteSpeed",
        step: 1,
        integer: true,
        scale: KIB_IN_MIB,
        fallback: { min: 0, max: 1e6 },
        read: (provider) => {
          const speed = parseSpeed(provider.telemetry?.qd64_disk_write_speed)
          return speed === null ? null : speed / BYTES_IN_KIB
        },
      },
    ],
  },
  {
    id: "hardware",
    fields: [
      {
        kind: "range",
        from: "total_provider_space_gt",
        to: "total_provider_space_lt",
        label: "filters.totalProviderSpace",
        step: 10,
        integer: true,
        fallback: { min: 0, max: 40000 },
        read: (provider) => toUnits(provider.telemetry?.total_provider_space_bytes, BYTES_IN_GIB),
      },
      {
        kind: "range",
        from: "used_provider_space_gt",
        to: "used_provider_space_lt",
        label: "filters.usedProviderSpace",
        step: 10,
        integer: true,
        fallback: { min: 0, max: 40000 },
        read: (provider) => toUnits(provider.telemetry?.used_provider_space_bytes, BYTES_IN_GIB),
      },
      {
        kind: "range",
        from: "cpu_number_gt",
        to: "cpu_number_lt",
        label: "filters.cpuNumber",
        step: 1,
        integer: true,
        fallback: { min: 1, max: 128 },
        read: (provider) => number(provider.telemetry?.cpu_number),
      },
      {
        kind: "text",
        key: "cpu_name",
        label: "filters.cpuName",
        read: (provider) => text(provider.telemetry?.cpu_name),
      },
      {
        kind: "tri",
        key: "cpu_is_virtual",
        label: "filters.cpuIsVirtual",
        read: (provider) => provider.telemetry?.cpu_is_virtual ?? null,
      },
      {
        kind: "range",
        from: "total_ram_gt",
        to: "total_ram_lt",
        label: "filters.totalRam",
        step: 1,
        integer: false,
        scale: BYTES_IN_GIB / BYTES_IN_GB,
        fallback: { min: 0, max: 512 },
        read: (provider) => toUnits(provider.telemetry?.total_ram_bytes, BYTES_IN_GB),
      },
      {
        kind: "range",
        from: "usage_ram_percent_gt",
        to: "usage_ram_percent_lt",
        label: "filters.usedRamPercent",
        step: 1,
        integer: true,
        fixed: { min: 0, max: 100 },
        fallback: { min: 0, max: 100 },
        read: (provider) => number(provider.telemetry?.ram_usage_percent),
      },
    ],
  },
  {
    id: "network",
    fields: [
      {
        kind: "range",
        from: "speedtest_download_gt",
        to: "speedtest_download_lt",
        label: "filters.downloadSpeed",
        step: 1,
        integer: true,
        scale: 1e6,
        fallback: { min: 0, max: 1e9 },
        read: (provider) => number(provider.telemetry?.speedtest_download),
      },
      {
        kind: "range",
        from: "speedtest_upload_gt",
        to: "speedtest_upload_lt",
        label: "filters.uploadSpeed",
        step: 1,
        integer: true,
        scale: 1e6,
        fallback: { min: 0, max: 1e9 },
        read: (provider) => number(provider.telemetry?.speedtest_upload),
      },
      {
        kind: "range",
        from: "speedtest_ping_gt",
        to: "speedtest_ping_lt",
        label: "filters.ping",
        step: 1,
        integer: true,
        fallback: { min: 0, max: 300 },
        read: pingOf,
      },
      {
        kind: "text",
        key: "country",
        label: "filters.country",
        read: (provider) => text(provider.telemetry?.country),
      },
      {
        kind: "text",
        key: "isp",
        label: "filters.isp",
        read: (provider) => text(provider.telemetry?.isp),
      },
    ],
  },
  {
    id: "software",
    fields: [
      {
        kind: "select",
        key: "storage_git_hash",
        label: "filters.storageGitHash",
        placeholder: "filters.anyHash",
        read: (provider) => text(provider.telemetry?.storage_git_hash),
      },
      {
        kind: "select",
        key: "provider_git_hash",
        label: "filters.providerGitHash",
        placeholder: "filters.anyHash",
        read: (provider) => text(provider.telemetry?.provider_git_hash),
      },
      {
        kind: "tri",
        key: "is_send_telemetry",
        label: "filters.isSendTelemetry",
        read: (provider) => provider.is_send_telemetry,
      },
    ],
  },
]
