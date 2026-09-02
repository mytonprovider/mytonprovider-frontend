import { describe, expect, it } from "vitest"
import {
  DEFAULT_FILTERS,
  countActiveFilters,
  deriveBounds,
  isPristine,
  matches,
  optionsFor,
  toGroupViews,
  type FieldView,
} from "./filters"
import type { FiltersData } from "@/types/filters"
import { toProvider } from "./api"
import { apiStable, brokenPing, overfilled, providers, silent, stable, veteran } from "./fixtures"

const NO_FILTERS: FiltersData = {}
const NOW = 1785545100
const bounds = deriveBounds(providers, NOW)
const options = optionsFor(providers)

const view = (filters = NO_FILTERS) => toGroupViews(filters, bounds, options)

const field = (label: string, filters = NO_FILTERS): FieldView => {
  const found = view(filters)
    .flatMap((group) => group.fields)
    .find((candidate) => candidate.label === label)
  if (!found) throw new Error(`no field labelled ${label}`)
  return found
}

const range_ = (label: string, filters = NO_FILTERS) => {
  const found = field(label, filters)
  if (found.kind !== "range") throw new Error(`${label} is not a range`)
  return found
}

describe("toGroupViews", () => {
  it("covers every group and hands each field a name", () => {
    const groups = view()

    expect(groups.map((group) => group.id)).toEqual(["provider", "benchmarks", "hardware", "network", "software"])
    expect(groups.flatMap((group) => group.fields).every((f) => f.name.length > 0)).toBe(true)
  })

  it("feeds the location list into the select", () => {
    const location = field("filters.location")

    expect(location.kind).toBe("select")
    if (location.kind === "select") expect(location.options).toEqual(["Japan (JP)", "Russia (RU)"])
  })

  it("opens a range on whole steps of its own bounds", () => {
    expect(range_("filters.rating")).toMatchObject({ min: 0, max: 21, low: 0, high: 21 })
  })

  it("shows scaled ranges in the unit the label promises", () => {
    expect(range_("filters.maxSpan")).toMatchObject({ min: 30, max: 77 })
    expect(range_("filters.totalProviderSpace")).toMatchObject({ min: 3820, max: 15000 })
    expect(range_("filters.maxBagSize")).toMatchObject({ min: 81920, max: 81920 })
    expect(range_("filters.totalRam")).toMatchObject({ min: 3, max: 32 })
    expect(range_("filters.diskReadSpeed")).toMatchObject({ min: 63, max: 64 })
    expect(range_("filters.uptime")).toMatchObject({ min: 0, max: 100 })
  })

  it("stores a moved range in the unit the endpoint compares against", () => {
    const ram = range_("filters.totalRam")

    expect(ram.set(16, ram.high).total_ram_gt).toBe(17.179869)
  })
})

describe("activity", () => {
  it("counts nothing before anything is touched", () => {
    expect(countActiveFilters(NO_FILTERS)).toBe(0)
    expect(view().every((group) => group.active === 0)).toBe(true)
  })

  it("counts nothing when a range is put back on its bounds", () => {
    const rating = range_("filters.rating")
    const settled = rating.set(rating.low, rating.high)

    expect(countActiveFilters(settled)).toBe(0)
  })

  it("counts a moved range once, not once per bound", () => {
    const rating = range_("filters.rating")
    const moved = rating.set(0.05, rating.high - 1)

    expect(Object.keys(moved)).toHaveLength(2)
    expect(countActiveFilters(moved)).toBe(1)
    expect(view(moved)[0].active).toBe(1)
  })

  it("counts a switch only while it is on", () => {
    const free = field("filters.onlyWithFreeSpace")
    if (free.kind !== "flag") throw new Error("expected a flag")

    expect(countActiveFilters(free.set(true))).toBe(1)
    expect(countActiveFilters(free.set(undefined))).toBe(0)
  })
})

describe("setting a value", () => {
  it("keeps fractional steps a whole-number rounding would destroy", () => {
    const rating = range_("filters.rating")

    expect(rating.set(0.05, rating.high).rating_gt).toBe(0.05)
  })

  it("sends internet speed under the key the catalog answers to, in bits per second", () => {
    const download = range_("filters.downloadSpeed")
    const upload = range_("filters.uploadSpeed")

    expect(download.set(100, download.high).speedtest_download_gt).toBe(100_000_000)
    expect(upload.set(50, upload.high).speedtest_upload_gt).toBe(50_000_000)
  })

  it("stores scaled ranges in the units the catalog expects", () => {
    const maxSpan = range_("filters.maxSpan")

    expect(maxSpan.set(5, maxSpan.high).max_span_gt).toBe(432000)
  })

  it("reads a stored range back into display units", () => {
    const maxSpan = range_("filters.maxSpan")
    const stored = maxSpan.set(5, maxSpan.high)

    expect(range_("filters.maxSpan", stored).low).toBe(5)
  })

  it("drops a text filter instead of storing an empty one", () => {
    const isp = field("filters.isp")
    if (isp.kind !== "text") throw new Error("expected a text field")

    expect(isp.set("JSC")).toEqual({ isp: "JSC" })
    expect(isp.set("")).toEqual({})
  })

  it("leaves the filters it was given untouched", () => {
    const before = { isp: "JSC" }
    const isp = field("filters.isp", before)
    if (isp.kind !== "text") throw new Error("expected a text field")

    isp.set("other")
    expect(before).toEqual({ isp: "JSC" })
  })
})

describe("isPristine", () => {
  it("is true only while the defaults are untouched", () => {
    const rating = range_("filters.rating", DEFAULT_FILTERS)

    expect(isPristine(DEFAULT_FILTERS)).toBe(true)
    expect(isPristine(NO_FILTERS)).toBe(false)
    expect(isPristine(rating.set(0.05, rating.high))).toBe(false)
  })

  it("comes back once a range is dragged onto its own bounds again", () => {
    const rating = range_("filters.rating", DEFAULT_FILTERS)
    const moved = rating.set(0.05, rating.high)
    const back = range_("filters.rating", moved).set(rating.low, rating.high)

    expect(back).toEqual(DEFAULT_FILTERS)
    expect(isPristine(back)).toBe(true)
  })
})

describe("DEFAULT_FILTERS", () => {
  it("keeps only providers that are up and have room, as the catalog opens", () => {
    const kept = providers.filter((provider) => matches(provider, DEFAULT_FILTERS, NOW))

    expect(DEFAULT_FILTERS).toEqual({ has_free_space: true, uptime_gt_percent: 20 })
    expect(kept.length).toBeLessThan(providers.length)
    for (const provider of kept) {
      expect(provider.uptime).toBeGreaterThan(20)
    }
  })
})

describe("matches", () => {
  const kept = (filters: Parameters<typeof matches>[1]) =>
    providers.filter((provider) => matches(provider, filters, NOW)).length

  it("keeps everyone while nothing is asked", () => {
    expect(kept(NO_FILTERS)).toBe(providers.length)
  })

  it("keeps a value sitting exactly on the bound", () => {
    expect(matches(stable, { rating_gt: stable.rating }, NOW)).toBe(true)
    expect(matches(stable, { rating_lt: stable.rating }, NOW)).toBe(true)
  })

  it("drops a provider that cannot answer the question", () => {
    expect(matches(silent, { total_ram_gt: 1 }, NOW)).toBe(false)
    expect(matches(silent, NO_FILTERS, NOW)).toBe(true)
  })

  it("compares a scaled range in the units it stores", () => {
    expect(matches(veteran, { max_span_gt: veteran.max_span }, NOW)).toBe(true)
    expect(matches(veteran, { max_span_gt: veteran.max_span + 1 }, NOW)).toBe(false)
  })

  it("matches a select on the whole value", () => {
    expect(kept({ location: "Japan (JP)" })).toBe(2)
    expect(kept({ location: "Japan" })).toBe(0)
  })

  it("matches text anywhere, ignoring case", () => {
    expect(matches(stable, { isp: "jsc" }, NOW)).toBe(true)
    expect(matches(stable, { isp: "IOT" }, NOW)).toBe(true)
    expect(matches(stable, { isp: "nope" }, NOW)).toBe(false)
  })

  it("counts free space only above 4 GiB", () => {
    const nearlyFull = toProvider({ ...apiStable, telemetry: { ...apiStable.telemetry, used_provider_space: 3817.5 } })
    expect(matches(stable, { has_free_space: true }, NOW)).toBe(true)
    expect(matches(nearlyFull, { has_free_space: true }, NOW)).toBe(false)
    expect(matches(overfilled, { has_free_space: true }, NOW)).toBe(false)
  })

  it("ignores a ping the node could not measure, exactly like the card does", () => {
    expect(matches(brokenPing, { speedtest_ping_gt: 0 }, NOW)).toBe(false)
    expect(matches(stable, { speedtest_ping_gt: 0 }, NOW)).toBe(true)
  })

  it("answers a switch by the value it stores", () => {
    expect(kept({ is_send_telemetry: true })).toBe(providers.length - 1)
    expect(kept({ is_send_telemetry: false })).toBe(1)
  })

  it("counts an unknown cpu as physical, like the backend does", () => {
    expect(matches(silent, { cpu_is_virtual: false }, NOW)).toBe(true)
    expect(matches(silent, { cpu_is_virtual: true }, NOW)).toBe(false)
    expect(matches(stable, { cpu_is_virtual: true }, NOW)).toBe(true)
  })
})
