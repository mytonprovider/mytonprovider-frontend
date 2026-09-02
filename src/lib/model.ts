import type { Provider, StatusReasonStat, Telemetry } from "@/types/provider"
import type {
  BreakdownItem,
  DetailField,
  DetailSection,
  ProviderDetail,
  ProviderRow,
  SortDirection,
  SortField,
  StatusTone,
  StatusView,
} from "@/types/model"
import {
  formatBytes,
  formatDiskSpeed,
  formatDuration,
  formatNumber,
  formatPercent,
  formatScaled,
  scaleForHardware,
  shortenMiddle,
  type Translate,
  NANO,
  PING_LIMIT,
  SECONDS_IN_MINUTE,
} from "./format"
import { toNonBounceable } from "./ton-address"

const BITS_IN_MEGABIT = 1e6
const MBIT_PER_SECOND = "Mbit/s"
const MILLISECONDS = "ms"
const GRAM = "GRAM"
const STALE_SECONDS = 600
const EMPTY = "—"

const UNAVAILABLE = [101, 102, 103, 201, 202]
const NOT_STORED = [301, 302]
const NO_PROOFS = [401, 402, 403]
const KNOWN_REASONS = [0, ...UNAVAILABLE, ...NOT_STORED, ...NO_PROOFS]

export const STATUS_KEYS = [
  "noData",
  "unstable",
  "partial",
  "stable",
  "unavailable",
  "notStored",
  "noProofs",
  "unknown",
] as const

type StatusKey = (typeof STATUS_KEYS)[number]

const STATUS_ORDER: Record<StatusKey, number> = {
  noData: 0,
  unknown: 1,
  unavailable: 2,
  notStored: 3,
  noProofs: 4,
  unstable: 5,
  partial: 6,
  stable: 7,
}

const checkStats = (provider: Provider): StatusReasonStat[] =>
  (provider.statuses_reason_stats ?? [])
    .filter((stat) => Number.isFinite(stat?.cnt) && Number.isFinite(stat.reason))
    .sort((a, b) => b.cnt - a.cnt)

const passedOf = (stats: StatusReasonStat[]): { valid: number; total: number } => ({
  valid: stats.find((stat) => stat.reason === 0)?.cnt ?? 0,
  total: stats.reduce((sum, stat) => sum + stat.cnt, 0),
})

const shareOf = (provider: Provider): number => {
  const { valid, total } = passedOf(checkStats(provider))
  return total === 0 ? provider.status_ratio : valid / total
}

const classify = (status: number | null, ratio: number): { tone: StatusTone; key: StatusKey } => {
  if (status === null) return { tone: "gray", key: "noData" }

  if (status === 0) {
    if (ratio < 0.8) return { tone: "red", key: "unstable" }
    if (ratio < 0.99) return { tone: "yellow", key: "partial" }
    return { tone: "green", key: "stable" }
  }

  if (UNAVAILABLE.includes(status)) return { tone: "gray", key: "unavailable" }
  if (NOT_STORED.includes(status)) return { tone: "red", key: "notStored" }
  if (NO_PROOFS.includes(status)) return { tone: "orange", key: "noProofs" }
  return { tone: "gray", key: "unknown" }
}

const reasonLabel = (reason: number, t: Translate): string =>
  KNOWN_REASONS.includes(reason) ? t(`status.reason.${reason}`) : t("status.unknownReason", { reason })

const toStatusView = (status: number | null, ratio: number, t: Translate): StatusView => {
  const { tone, key } = classify(status, ratio)
  return {
    tone,
    label: t(`status.${key}`),
    ratio: status === 0 ? formatPercent(Math.floor(ratio * 100), 0) : null,
  }
}

export const freeSpaceOf = (provider: Provider): number | null => {
  const total = provider.telemetry?.total_provider_space_bytes
  const used = provider.telemetry?.used_provider_space_bytes
  if (total === null || total === undefined || used === null || used === undefined) return null
  return Math.max(0, total - used)
}

const splitSpace = (bytes: number | null): { value: string; unit: string } => {
  if (bytes === null) return { value: EMPTY, unit: "" }

  const { divisor, unit } = scaleForHardware(bytes)
  return { value: formatScaled(bytes, divisor), unit }
}

const pair = (used: number | null | undefined, total: number): string => {
  const { divisor, unit } = scaleForHardware(total)
  const whole = `${formatScaled(total, divisor)} ${unit}`
  return used === null || used === undefined ? whole : `${formatScaled(used, divisor)} / ${whole}`
}

export const toRow = (provider: Provider, t: Translate): ProviderRow => {
  const free = splitSpace(freeSpaceOf(provider))

  return {
    pubkey: provider.pubkey,
    keyShort: shortenMiddle(provider.pubkey, 6, 6),
    status: toStatusView(provider.status, shareOf(provider), t),
    uptime: formatPercent(provider.uptime),
    price: formatNumber(provider.price / NANO, 2),
    priceUnit: GRAM,
    rating: formatNumber(provider.rating, 2),
    freeSpace: free.value,
    freeSpaceUnit: free.unit,
    location: provider.location?.country ?? t("unknown"),
    workingTime: formatDuration(provider.working_time, t),
  }
}

const sortValue = (provider: Provider, field: SortField): string | number => {
  switch (field) {
    case "pubkey":
      return provider.pubkey
    case "location":
      return provider.location?.country ?? ""
    case "uptime":
      return provider.uptime
    case "workingTime":
      return provider.working_time
    case "price":
      return provider.price
    case "rating":
      return provider.rating
    case "status": {
      const share = shareOf(provider)
      return STATUS_ORDER[classify(provider.status, share).key] + share
    }
    case "freeSpace":
      return freeSpaceOf(provider) ?? -1
  }
}

export const sortProviders = (
  providers: Provider[],
  field: SortField,
  direction: SortDirection,
): Provider[] => {
  const sign = direction === "asc" ? 1 : -1

  return [...providers].sort((a, b) => {
    const left = sortValue(a, field)
    const right = sortValue(b, field)

    return typeof left === "string" && typeof right === "string"
      ? left.localeCompare(right) * sign
      : (Number(left) - Number(right)) * sign
  })
}

export const matchesQuery = (provider: Provider, query: string): boolean => {
  const needle = query.trim().toLowerCase()
  return needle === "" || provider.pubkey.toLowerCase().includes(needle)
}

const textField = (label: string, value: string | number | null | undefined): DetailField => ({
  label,
  value: value === null || value === undefined || value === "" ? EMPTY : String(value),
})

const truncatedField = (label: string, value: string | null | undefined, copy = false): DetailField => {
  if (!value) return textField(label, null)
  const short = shortenMiddle(value, 14, 6)
  return { label, value: short, title: value, ...(copy ? { copy: value } : {}) }
}

const hardwareSection = (telemetry: Telemetry, t: Translate): DetailSection => ({
  id: "hardware",
  title: t("provider.hardware"),
  fields: [
    truncatedField(t("provider.cpuName"), telemetry.cpu_name),
    textField(t("provider.cpuNumber"), telemetry.cpu_number),
    textField(
      t("provider.cpuIsVirtual"),
      telemetry.cpu_is_virtual === null || telemetry.cpu_is_virtual === undefined
        ? null
        : t(telemetry.cpu_is_virtual ? "triState.yes" : "triState.no"),
    ),
    textField(
      t("provider.ram"),
      telemetry.total_ram_bytes ? pair(telemetry.usage_ram_bytes, telemetry.total_ram_bytes) : null,
    ),
    textField(
      t("provider.totalProviderSpace"),
      telemetry.total_provider_space_bytes
        ? pair(telemetry.used_provider_space_bytes, telemetry.total_provider_space_bytes)
        : null,
    ),
  ],
})

const networkSection = (telemetry: Telemetry, t: Translate): DetailSection => ({
  id: "network",
  title: t("provider.network"),
  fields: [
    textField(
      t("provider.speedtestDownload"),
      telemetry.speedtest_download
        ? `${formatNumber(telemetry.speedtest_download / BITS_IN_MEGABIT, 0)} ${MBIT_PER_SECOND}`
        : null,
    ),
    textField(
      t("provider.speedtestUpload"),
      telemetry.speedtest_upload
        ? `${formatNumber(telemetry.speedtest_upload / BITS_IN_MEGABIT, 0)} ${MBIT_PER_SECOND}`
        : null,
    ),
    textField(
      t("provider.speedtestPing"),
      telemetry.speedtest_ping && telemetry.speedtest_ping < PING_LIMIT
        ? `${formatNumber(telemetry.speedtest_ping, 1)} ${MILLISECONDS}`
        : null,
    ),
    textField(t("provider.country"), telemetry.country),
    truncatedField(t("provider.isp"), telemetry.isp),
  ],
})

const telemetrySections = (telemetry: Telemetry, t: Translate): DetailSection[] => [
  {
    id: "software",
    title: t("provider.software"),
    fields: [
      truncatedField(t("provider.storageGitHash"), telemetry.storage_git_hash, true),
      truncatedField(t("provider.providerGitHash"), telemetry.provider_git_hash, true),
    ],
  },
  {
    id: "benchmarks",
    title: t("provider.benchmarks"),
    fields: [
      textField(t("provider.diskReadSpeed"), formatDiskSpeed(telemetry.qd64_disk_read_speed)),
      textField(t("provider.diskWriteSpeed"), formatDiskSpeed(telemetry.qd64_disk_write_speed)),
    ],
  },
  hardwareSection(telemetry, t),
  networkSection(telemetry, t),
]

const dominantReason = (stats: StatusReasonStat[], total: number): number | null => {
  const top = stats[0]
  if (!top) return null
  if (top.reason !== 0) return top.reason
  return top.cnt >= total * 0.8 || stats.length === 1 ? 0 : stats[1].reason
}

const buildBreakdown = (stats: StatusReasonStat[], total: number, t: Translate): BreakdownItem[] =>
  stats
    .filter((stat) => stat.cnt > 0)
    .map((stat) => ({
      id: String(stat.reason),
      tone: stat.reason === 0 ? "green" : classify(stat.reason, 0).tone,
      label: stat.reason === 0 ? t("status.allChecksPassed") : reasonLabel(stat.reason, t),
      count: stat.cnt,
      percent: formatPercent((stat.cnt / total) * 100, 1),
    }))

const agoField = (label: string, age: number | null, t: Translate): DetailField =>
  age === null
    ? textField(label, null)
    : {
        label,
        value: age < SECONDS_IN_MINUTE ? t("provider.justNow") : t("provider.ago", { time: formatDuration(age, t) }),
        alert: age > STALE_SECONDS,
      }

export const toDetail = (provider: Provider, fetchedAt: number, t: Translate): ProviderDetail => {
  const stats = checkStats(provider)
  const { valid, total } = passedOf(stats)
  const reason = dominantReason(stats, total)
  const city = provider.location?.city
  const country = provider.location?.country
  const onlineAge = provider.last_online_check_time ? fetchedAt - provider.last_online_check_time : null
  const telemetryAge = provider.telemetry?.updated_at ? fetchedAt - provider.telemetry.updated_at : null
  const address = provider.address ? toNonBounceable(provider.address) : null

  const sections: DetailSection[] = [
    {
      id: "provider",
      title: t("provider.providerTitle"),
      fields: [
        {
          label: t("table.publicKey"),
          value: shortenMiddle(provider.pubkey, 6, 6),
          title: provider.pubkey,
          copy: provider.pubkey,
          uppercase: true,
          mono: true,
        },
        address
          ? {
              label: t("provider.address"),
              value: shortenMiddle(address, 6, 6),
              title: address,
              href: `https://tonscan.org/address/${encodeURIComponent(address)}`,
              copy: address,
              mono: true,
            }
          : textField(t("provider.address"), null),
        textField(t("provider.span"), `${formatDuration(provider.min_span, t)} – ${formatDuration(provider.max_span, t)}`),
        textField(t("provider.maxBagSize"), formatBytes(provider.max_bag_size_bytes)),
        textField(t("provider.workingTime"), formatDuration(provider.working_time, t)),
        agoField(t("provider.lastOnline"), onlineAge, t),
        agoField(t("provider.lastTelemetry"), provider.is_send_telemetry ? telemetryAge : null, t),
        textField(t("provider.location"), country ? [country, city].filter(Boolean).join(", ") : t("unknown")),
        textField(t("provider.uptime"), formatPercent(provider.uptime)),
        textField(t("provider.rating"), formatNumber(provider.rating, 2)),
        textField(t("provider.price"), `${formatNumber(provider.price / NANO, 2)} ${GRAM}`),
      ],
    },
  ]

  if (provider.is_send_telemetry && provider.telemetry) {
    sections.push(...telemetrySections(provider.telemetry, t))
  }

  const share = total === 0 ? provider.status_ratio : valid / total

  return {
    status: toStatusView(provider.status, share, t),
    description: reason === null ? t("status.notChecked") : reasonLabel(reason, t),
    checks:
      total > 0
        ? {
            valid,
            total,
            tone: classify(provider.status, share).tone,
            percent: formatPercent(share * 100),
          }
        : null,
    breakdown: total > 0 ? buildBreakdown(stats, total, t) : [],
    sections,
  }
}
