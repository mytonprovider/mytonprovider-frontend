export type Translate = (key: string, options?: Record<string, unknown>) => string

const SECONDS_IN_YEAR = 31536000
export const SECONDS_IN_DAY = 86400
const SECONDS_IN_HOUR = 3600
export const SECONDS_IN_MINUTE = 60
export const BYTES_IN_GIB = 1024 ** 3
export const BYTES_IN_GB = 1e9
export const PING_LIMIT = 100000
export const NANO = 1e9
export const BYTES_IN_KIB = 1024
export const BYTES_IN_MIB = 1024 ** 2

export const formatNumber = (value: number, digits: number): string =>
  Number.isFinite(value) ? String(Number(value.toFixed(digits))) : ""

export const formatPercent = (value: number, digits = 2): string => `${formatNumber(value, digits)}%`

export const shortenMiddle = (value: string, head: number, tail: number): string =>
  value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(value.length - tail)}`

export const formatDuration = (seconds: number, t: Translate): string => {
  if (!Number.isFinite(seconds) || seconds < SECONDS_IN_MINUTE) {
    return t("time.sec", { count: Math.max(0, Math.round(seconds || 0)) })
  }

  const minutes = Math.floor(seconds / SECONDS_IN_MINUTE) % 60
  const hours = Math.floor(seconds / SECONDS_IN_HOUR) % 24
  const days = Math.floor(seconds / SECONDS_IN_DAY) % 365
  const years = Math.floor(seconds / SECONDS_IN_YEAR)

  if (years > 0) {
    const head = t("time.year", { count: years })
    return days ? `${head} ${t("time.days", { count: days })}` : head
  }

  if (seconds < SECONDS_IN_HOUR) {
    return t("time.min", { count: minutes })
  }

  if (seconds < SECONDS_IN_DAY) {
    const head = t("time.hr", { count: hours })
    return minutes ? `${head} ${t("time.min", { count: minutes })}` : head
  }

  const head = t("time.days", { count: days })
  return hours ? `${head} ${t("time.hr", { count: hours })}` : head
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"]
const FILE_TOP = BYTE_UNITS.length - 1
const HARDWARE_TOP = BYTE_UNITS.indexOf("GB")
const WHOLE_FROM = 1000

const scaleFor = (bytes: number, top = FILE_TOP): { divisor: number; unit: string } => {
  let divisor = 1
  let index = 0

  while (bytes >= divisor * 1024 && index < top) {
    divisor *= 1024
    index += 1
  }

  return { divisor, unit: BYTE_UNITS[index] }
}

export const scaleForHardware = (bytes: number): { divisor: number; unit: string } => scaleFor(bytes, HARDWARE_TOP)

export const formatScaled = (bytes: number, divisor: number): string => {
  const value = bytes / divisor
  return formatNumber(value, value >= WHOLE_FROM ? 0 : 2)
}

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return ""
  const { divisor, unit } = scaleFor(bytes)
  return `${formatScaled(bytes, divisor)} ${unit}`
}

export const formatRangeBound = (value: number, integer: boolean): string =>
  integer ? String(Math.round(value)) : formatNumber(value, 2)

export const parseDecimal = (value: string): number | null => {
  const normalized = value.replace(",", ".").trim()
  if (normalized === "") return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const SPEED_UNITS: Record<string, number> = {
  B: 1,
  KB: 1e3,
  KIB: BYTES_IN_KIB,
  MB: 1e6,
  MIB: BYTES_IN_MIB,
  GB: 1e9,
  GIB: 1024 ** 3,
}

export const parseSpeed = (value: string | null | undefined): number | null => {
  const match = value === null || value === undefined ? null : /^([\d.]+)\s*(B|[KMG]iB|[KMG]B)(?:\/s|ps)?$/i.exec(value)
  if (match === null) return null
  const amount = Number(match[1])
  const factor = SPEED_UNITS[match[2].toUpperCase()]
  return factor !== undefined && Number.isFinite(amount) ? amount * factor : null
}

export const formatDiskSpeed = (value: string | null | undefined): string => {
  const speed = parseSpeed(value)
  return speed === null ? "" : `${formatNumber(speed / BYTES_IN_MIB, 2)} MiB/s`
}
