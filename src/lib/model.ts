import {
  DAY,
  EMPTY,
  explorerUrl,
  fmt,
  freeBytes,
  freePercent,
  GIB,
  GRAM,
  PROVIDER_SAMPLE,
  countryLabel,
  dominantReason,
  providerStatus,
  ratioPercent,
  staleSignals,
  toFriendly,
  type Provider,
  type ProviderStatus,
  type ReasonCount,
  type Telemetry,
} from "@myton/ui/domain"
import { providerFields, reasonKey, statusView, words, type Lang } from "@myton/ui/locale"
import type { DetailField, DetailSection, ProviderDetail, ProviderRow, RowStatus, Translate } from "@/types/model"

const checkStats = (provider: Provider): ReasonCount[] => [...provider.reasons].sort((a, b) => b.count - a.count)

const statusOf = (provider: Provider): ProviderStatus =>
  providerStatus({
    status: provider.status,
    statusRatio: provider.statusRatio,
    reasons: checkStats(provider),
  })

export const reasonLabel = (reason: number | null, t: Translate): string =>
  t(`ui:reason.${reasonKey(reason)}`, { code: reason })

const rowStatus = (status: ProviderStatus, lang: Lang): RowStatus => {
  const view = statusView(status, lang)
  return { ...view, ratio: view.ratio === null ? null : fmt.percent(ratioPercent(view.ratio), 0) }
}

export const toRow = (provider: Provider, lang: Lang, ranks: Record<string, number> = {}): ProviderRow => {
  const free = fmt.splitSpace(freeBytes(provider))

  return {
    pubkey: provider.pubkey,
    keyShort: fmt.shortKey(provider.pubkey),
    status: rowStatus(statusOf(provider), lang),
    uptime: fmt.percent(provider.uptime),
    price: fmt.price(provider.price),
    priceUnit: GRAM,
    rating: fmt.number(provider.rating, 2),
    rank: ranks[provider.pubkey] ?? null,
    freeSpace: free.value,
    freePercent: freePercent(provider),
    freeSpaceUnit: free.unit,
    location: countryLabel(provider.location) ?? EMPTY,
    workingTime: fmt.duration(provider.workingTime, words[lang].duration),
  }
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
  return { label, value: fmt.shortText(value), title: value, ...(copy ? { copy: value } : {}) }
}

const hardwareSection = (telemetry: Telemetry, t: Translate): DetailSection => ({
  id: "hardware",
  title: t("ui:filters.group.hardware"),
  fields: [
    truncatedField(t("ui:details.cpuName"), telemetry.cpuName),
    textField(t("ui:details.cpuCount"), telemetry.cpuCount),
    textField(
      t("ui:details.cpuVirtual"),
      telemetry.cpuVirtual === null || telemetry.cpuVirtual === undefined
        ? null
        : t(telemetry.cpuVirtual ? "ui:filters.yes" : "ui:filters.no"),
    ),
    textField(t("ui:details.ram"), fmt.spacePair(telemetry.usageRamBytes, telemetry.totalRamBytes)),
    textField(t("ui:details.space"), fmt.spacePair(telemetry.usedSpaceBytes, telemetry.totalSpaceBytes)),
  ],
})

const networkSection = (telemetry: Telemetry, t: Translate): DetailSection => ({
  id: "network",
  title: t("ui:filters.group.network"),
  fields: [
    textField(t("ui:details.download"), fmt.mbits(telemetry.downloadBits)),
    textField(t("ui:details.upload"), fmt.mbits(telemetry.uploadBits)),
    textField(t("ui:details.ping"), fmt.ping(telemetry.pingMs)),
    textField(t("ui:details.country"), telemetry.country),
    truncatedField(t("ui:details.isp"), telemetry.isp),
  ],
})

const telemetrySections = (telemetry: Telemetry, t: Translate): DetailSection[] => [
  {
    id: "software",
    title: t("ui:filters.group.software"),
    fields: [
      truncatedField(t("ui:details.storageHash"), telemetry.storageGitHash, true),
      truncatedField(t("ui:details.providerHash"), telemetry.providerGitHash, true),
    ],
  },
  {
    id: "benchmarks",
    title: t("ui:filters.group.benchmarks"),
    fields: [
      textField(t("ui:details.diskRead"), fmt.diskSpeed(telemetry.diskRead)),
      textField(t("ui:details.diskWrite"), fmt.diskSpeed(telemetry.diskWrite)),
    ],
  },
  hardwareSection(telemetry, t),
  networkSection(telemetry, t),
]

export const toDetail = (provider: Provider, fetchedAt: number, t: Translate, lang: Lang): ProviderDetail => {
  const stats = checkStats(provider)
  const reason = dominantReason(stats)
  const address = provider.address ? (toFriendly(provider.address) ?? provider.address) : null

  const sections: DetailSection[] = [
    {
      id: "provider",
      title: t("ui:filters.group.provider"),
      fields: [
        {
          label: t("ui:columns.pubkey"),
          value: fmt.shortKey(provider.pubkey),
          title: provider.pubkey,
          copy: provider.pubkey,
          uppercase: true,
          mono: true,
        },
        address
          ? {
              label: t("ui:details.address"),
              value: fmt.shortKey(address),
              title: address,
              href: explorerUrl(address),
              copy: address,
              mono: true,
            }
          : textField(t("ui:details.address"), null),
        ...providerFields(provider, fetchedAt, lang).map(({ label, value, stale }) => ({ label, value, alert: stale })),
      ],
    },
  ]

  if (provider.sendsTelemetry && provider.telemetry) {
    sections.push(...telemetrySections(provider.telemetry, t))
  }

  const status = statusOf(provider)

  return {
    status: statusView(status, lang),
    reasons: stats,
    description: reasonLabel(reason, t),
    stale: staleSignals(provider, fetchedAt),
    sections,
  }
}

// The card's placeholder goes through toDetail like any provider, so each row ghosts the width its value takes
const sampleProvider = (now: number): Provider => ({
  pubkey: "3a65231e59031a3a0c6f363030712730b11562a3c77556184c05d58adeb6b466",
  address: "EQAjRhPNqC9mY2muFNsYwYI5eqb-lsq-sD5xk3SLfrDljMwB",
  status: 0,
  statusRatio: 1,
  reasons: [{ reason: 0, count: 999 }],
  location: { country: PROVIDER_SAMPLE.country, countryIso: "RU", city: "Moscow", timeZone: "Europe/Moscow" },
  uptime: PROVIDER_SAMPLE.uptime,
  workingTime: PROVIDER_SAMPLE.workingTime,
  rating: PROVIDER_SAMPLE.rating,
  price: PROVIDER_SAMPLE.price,
  minSpan: 7 * DAY,
  maxSpan: 128 * DAY,
  maxBagBytes: 200 * GIB,
  regTime: now - PROVIDER_SAMPLE.workingTime,
  lastOnlineAt: now - 60,
  sendsTelemetry: true,
  telemetry: {
    storageGitHash: "ba05e00",
    providerGitHash: "8c7ca5b",
    updatedAt: now - 60,
    cpuName: "AMD Ryzen 7 3700X 8-Core Processor",
    cpuCount: 4,
    cpuVirtual: false,
    totalSpaceBytes: 2 * PROVIDER_SAMPLE.freeBytes,
    usedSpaceBytes: PROVIDER_SAMPLE.freeBytes,
    totalRamBytes: 4e9,
    usageRamBytes: 0.52e9,
    ramUsagePercent: 13,
    diskRead: "63.9MiB/s",
    diskWrite: "18.1MiB/s",
    downloadBits: 609e6,
    uploadBits: 932e6,
    pingMs: 15.97,
    country: "RU",
    isp: "JSC IOT",
  },
})

export const sampleDetail = (now: number, t: Translate, lang: Lang): ProviderDetail =>
  toDetail(sampleProvider(now), now, t, lang)
