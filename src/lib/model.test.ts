import { describe, expect, it } from "vitest"
import { matchesQuery, sortProviders, toDetail, toRow } from "./model"
import { brokenPing, mostlyFailing, overfilled, providers, silent, stable, translate as t, veteran } from "./fixtures"

const NOW = 1785545100

const sectionTitles = (provider: typeof stable) => toDetail(provider, NOW, t).sections.map((section) => section.id)

const fieldValue = (provider: typeof stable, label: string): string | undefined =>
  toDetail(provider, NOW, t)
    .sections.flatMap((section) => section.fields)
    .find((field) => field.label === label)?.value

describe("toRow", () => {
  it("formats every column of a healthy provider", () => {
    const row = toRow(stable, t)

    expect(row.keyShort).toBe("3a6523…b6b466")
    expect(row.status.label).toBe("status.stable")
    expect(row.status.ratio).toBe("99%")
    expect(row.uptime).toBe("99.72%")
    expect(row.price).toBe("10")
    expect(row.rating).toBe("20.42")
    expect(row.freeSpace).toBe("163.59")
    expect(row.location).toBe("Russia")
    expect(row.workingTime).toBe("313days 6hr")
  })

  it("clamps free space when the node reports more used than it has", () => {
    expect(toRow(overfilled, t).freeSpace).toBe("0")
  })

  it("falls back when telemetry and location are missing", () => {
    const row = toRow(silent, t)

    expect(row.freeSpace).toBe("—")
    expect(row.freeSpaceUnit).toBe("")
    expect(row.location).toBe("unknown")
  })

  it("hides the ratio for a provider that is not answering", () => {
    expect(toRow(silent, t).status.ratio).toBeNull()
    expect(toRow(silent, t).status.label).toBe("status.unavailable")
  })
})

describe("agoField", () => {
  const at = 1785545100

  const field = (age: number) => {
    const provider = { ...stable, is_send_telemetry: true, telemetry: stable.telemetry && { ...stable.telemetry, updated_at: at - age } }
    return toDetail(provider, at, t)
      .sections.flatMap((section) => section.fields)
      .find((entry) => entry.label === "provider.lastTelemetry")
  }

  const value = (age: number) => field(age)?.value

  it("says just now instead of counting a zero", () => {
    expect(value(0)).toBe("provider.justNow")
    expect(value(59)).toBe("provider.justNow")
  })

  it("still counts once there is something to count", () => {
    expect(value(60)).toBe("provider.ago")
    expect(value(3600)).toBe("provider.ago")
  })

  it("says just now when the clock runs behind the node", () => {
    expect(value(-30)).toBe("provider.justNow")
  })

  it("raises the alert only once telemetry has gone stale", () => {
    expect(field(599)?.alert).toBe(false)
    expect(field(601)?.alert).toBe(true)
  })
})

describe("sortProviders by status", () => {
  const labels = (direction: "asc" | "desc") =>
    sortProviders(providers, "status", direction).map((provider) => toRow(provider, t).status.label)

  it("puts healthy providers before broken ones", () => {
    expect(labels("desc")).toEqual([
      "status.stable",
      "status.stable",
      "status.stable",
      "status.partial",
      "status.notStored",
      "status.unavailable",
    ])
  })

  it("reverses on the other direction", () => {
    expect(labels("asc")).toEqual([...labels("desc")].reverse())
  })

  it("orders equally broken providers by how many checks they still pass", () => {
    const failing = (passed: number, suffix: string) => ({
      ...mostlyFailing,
      pubkey: mostlyFailing.pubkey.slice(0, 58) + suffix,
      statuses_reason_stats: [
        { reason: 301, cnt: 100 - passed },
        { reason: 0, cnt: passed },
      ],
    })
    const none = failing(0, "111111")
    const some = failing(20, "222222")

    expect(sortProviders([none, some], "status", "desc").map((p) => p.pubkey)).toEqual([some.pubkey, none.pubkey])
    expect(sortProviders([some, none], "status", "desc").map((p) => p.pubkey)).toEqual([some.pubkey, none.pubkey])
  })

  it("orders equally healthy providers by how many checks they pass", () => {
    const ratios = sortProviders(providers, "status", "desc")
      .filter((provider) => provider.status === 0)
      .map((provider) => provider.status_ratio)

    expect(ratios).toEqual([...ratios].sort((a, b) => b - a))
  })
})

describe("toDetail", () => {
  it("survives a provider the catalog sent without an address", () => {
    const detail = toDetail({ ...stable, address: null }, NOW, t)

    expect(detail.sections.flatMap((section) => section.fields).find((f) => f.label === "provider.address")?.value).toBe(
      "—",
    )
  })

  it("ignores broken entries in the check statistics", () => {
    const broken = { ...stable, statuses_reason_stats: [null, { reason: 0, cnt: 5 }] as never }

    expect(toDetail(broken, NOW, t).checks).toEqual({ valid: 5, total: 5, tone: "green", percent: "100%" })
  })

  it("reports the dominant failure instead of the successful minority", () => {
    expect(toDetail(mostlyFailing, NOW, t).description).toBe("status.reason.301")
  })

  it("reports success when it clearly dominates", () => {
    const detail = toDetail(stable, NOW, t)

    expect(detail.description).toBe("status.reason.0")
    expect(detail.checks).toEqual({ valid: 432, total: 433, tone: "green", percent: "99.77%" })
  })

  it("drops the checks block when nothing was ever checked", () => {
    const detail = toDetail(silent, NOW, t)

    expect(detail.checks).toBeNull()
    expect(detail.breakdown).toEqual([])
    expect(detail.description).toBe("status.notChecked")
  })

  it("omits telemetry sections for a provider that does not report", () => {
    expect(sectionTitles(silent)).toEqual(["provider"])
    expect(sectionTitles(stable)).toEqual(["provider", "software", "benchmarks", "hardware", "network"])
  })

  it("keeps hardware in gigabytes and files on the full scale", () => {
    const telemetry = stable.telemetry && { ...stable.telemetry, total_ram_bytes: 17.18e9, usage_ram_bytes: 8.59e9 }

    expect(fieldValue({ ...stable, telemetry }, "provider.ram")).toBe("8 / 16 GB")
    expect(fieldValue(stable, "provider.totalProviderSpace")).toBe("3656 / 3820 GB")
    expect(fieldValue(stable, "provider.maxBagSize")).toBe("80 GB")

    const roomy = stable.telemetry && {
      ...stable.telemetry,
      total_provider_space_bytes: 14000 * 1024 ** 3,
      used_provider_space_bytes: 3689.28 * 1024 ** 3,
    }

    expect(fieldValue({ ...stable, telemetry: roomy }, "provider.totalProviderSpace")).toBe("3689 / 14000 GB")
    expect(fieldValue(stable, "provider.speedtestDownload")).toBe("1970 Mbit/s")
  })

  it("prints the disk speed in the unit the filter uses", () => {
    expect(fieldValue(stable, "provider.diskReadSpeed")).toBe("63.9 MiB/s")
    expect(fieldValue(stable, "provider.diskWriteSpeed")).toBe("18.1 MiB/s")
  })

  it("does not invent a zero when the node reports only the total", () => {
    const telemetry = stable.telemetry && { ...stable.telemetry, usage_ram_bytes: null }

    expect(fieldValue({ ...stable, telemetry }, "provider.ram")).toBe("3.73 GB")
  })

  it("keeps the whole pair in the unit of the larger value", () => {
    const telemetry = stable.telemetry && {
      ...stable.telemetry,
      total_ram_bytes: 4 * 1024 ** 3,
      usage_ram_bytes: 100 * 1024 ** 2,
    }

    expect(fieldValue({ ...stable, telemetry }, "provider.ram")).toBe("0.1 / 4 GB")
  })

  it("names the failure when passing checks stop being the clear majority", () => {
    const share = (passed: number, failed: number) => ({
      ...stable,
      statuses_reason_stats: [
        { reason: 0, cnt: passed },
        { reason: 301, cnt: failed },
      ],
    })

    expect(toDetail(share(9, 1), NOW, t).description).toBe("status.reason.0")
    expect(toDetail(share(7, 3), NOW, t).description).toBe("status.reason.301")
  })

  it("reads the check statistics in order of how often they happened", () => {
    const detail = toDetail(veteran, NOW, t)

    expect(detail.breakdown.map((item) => item.id)).toEqual(["0", "401"])
    expect(detail.checks?.percent).toBe("99.77%")
  })

  it("hides readings the node could not measure", () => {
    expect(fieldValue(brokenPing, "provider.speedtestPing")).toBe("—")
    expect(fieldValue(brokenPing, "provider.speedtestDownload")).toBe("—")
    expect(fieldValue(stable, "provider.speedtestPing")).toBe("16 ms")
  })
})

describe("sortProviders", () => {
  it("orders by rating in both directions", () => {
    expect(sortProviders(providers, "rating", "desc")[0]).toBe(stable)
    expect(sortProviders(providers, "rating", "asc")[0]).toBe(silent)
  })

  it("orders text by locale", () => {
    const byLocation = sortProviders([veteran, stable], "location", "asc")

    expect(byLocation.map((provider) => provider.location?.country)).toEqual(["Japan", "Russia"])
  })

  it("sends providers without free space to the bottom", () => {
    expect(sortProviders(providers, "freeSpace", "desc")[providers.length - 1]).toBe(silent)
  })

  it("leaves the input untouched", () => {
    const input = [...providers]
    sortProviders(input, "rating", "asc")

    expect(input).toEqual(providers)
  })
})

describe("matchesQuery", () => {
  it("matches any part of the key regardless of case", () => {
    expect(matchesQuery(stable, "")).toBe(true)
    expect(matchesQuery(stable, "  ")).toBe(true)
    expect(matchesQuery(stable, "3A6523")).toBe(true)
    expect(matchesQuery(stable, "B6B466")).toBe(true)
    expect(matchesQuery(stable, "zzzz")).toBe(false)
  })
})

