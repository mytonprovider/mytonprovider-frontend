import type { ApiProvider, Provider } from "@/types/provider"
import { toProvider } from "./api"
import type { Translate } from "./format"

export const translate: Translate = (key, options) =>
  options && "count" in options ? `${String(options.count)}${key.slice(key.indexOf(".") + 1)}` : key

const base: ApiProvider = {
  pubkey: "3a65231e59031a3a0c6f363030712730b11562a3c77556184c05d58adeb6b466",
  address: "EQAjRhPNqC9mY2muFNsYwYI5eqb-lsq-sD5xk3SLfrDljMwB",
  status: 0,
  status_ratio: 0.9977,
  location: { country: "Russia", country_iso: "RU", city: "Moscow" },
  uptime: 99.717606,
  working_time: 27064916,
  rating: 20.415426,
  price: 10002432000,
  min_span: 604800,
  max_span: 6635520,
  max_bag_size_bytes: 85899345920,
  reg_time: 1758480100,
  last_online_check_time: 1785545007,
  is_send_telemetry: true,
  telemetry: {
    storage_git_hash: "ba05e00",
    provider_git_hash: "8c7ca5b",
    total_provider_space: 3820,
    used_provider_space: 3656.41,
    updated_at: 1785544962,
    cpu_name: "Intel(R) Xeon(R) CPU E5-2620 v2 @ 2.10GHz",
    cpu_number: 2,
    cpu_is_virtual: true,
    total_ram: 4.01,
    usage_ram: 1.14,
    qd64_disk_read_speed: "63.9MiB/s",
    qd64_disk_write_speed: "18.1MiB/s",
    speedtest_download: 1970199300,
    speedtest_upload: 1177201500,
    speedtest_ping: 15.970891,
    country: "RU",
    isp: "JSC IOT",
  },
  statuses_reason_stats: [
    { reason: 0, cnt: 432 },
    { reason: 401, cnt: 1 },
  ],
}

const withPubkey = (provider: ApiProvider, suffix: string): Provider =>
  toProvider({ ...provider, pubkey: provider.pubkey.slice(0, 58) + suffix })

export const apiStable = base

export const stable = toProvider(base)

export const overfilled = withPubkey(
  {
    ...base,
    rating: 16.33,
    telemetry: { ...base.telemetry, total_provider_space: 4660, used_provider_space: 4662.18 },
  },
  "aaaaaa",
)

export const brokenPing = withPubkey(
  {
    ...base,
    rating: 16.21,
    status_ratio: 0.983,
    statuses_reason_stats: [
      { reason: 0, cnt: 58 },
      { reason: 401, cnt: 1 },
    ],
    telemetry: { ...base.telemetry, speedtest_ping: 1800000, speedtest_download: 0, speedtest_upload: 0 },
  },
  "bbbbbb",
)

export const silent = withPubkey(
  {
    ...base,
    rating: 0,
    status: 101,
    status_ratio: 0,
    working_time: 45,
    location: null,
    is_send_telemetry: false,
    telemetry: null,
    statuses_reason_stats: [],
  },
  "cccccc",
)

export const mostlyFailing = withPubkey(
  {
    ...base,
    rating: 5.5,
    status: 301,
    status_ratio: 0.4,
    uptime: 12.4,
    location: { country: "Japan", country_iso: "JP", city: "Tokyo" },
    statuses_reason_stats: [
      { reason: 301, cnt: 6 },
      { reason: 0, cnt: 4 },
    ],
  },
  "dddddd",
)

export const veteran = withPubkey(
  {
    ...base,
    rating: 12.5,
    working_time: 32486400,
    price: 4000000000,
    max_span: 2592000,
    location: { country: "Japan", country_iso: "JP", city: "Osaka" },
    statuses_reason_stats: [
      { reason: 401, cnt: 1 },
      { reason: 0, cnt: 432 },
    ],
    telemetry: { ...base.telemetry, total_provider_space: 15000, used_provider_space: 2491.6, total_ram: 33.7 },
  },
  "eeeeee",
)

export const providers: Provider[] = [stable, overfilled, brokenPing, silent, mostlyFailing, veteran]
