import { describe, expect, it } from "vitest"
import { locales } from "@myton/ui/locale"
import { brokenPing, mostlyFailing, silent, stable, translate as t } from "./fixtures"
import { matchesQuery, toDetail, toRow } from "./model"

const NOW = 1785545100
const statusWord = locales.en.status

const sectionTitles = (provider: typeof stable) =>
  toDetail(provider, NOW, t, "en").sections.map((section) => section.id)

const fieldValue = (provider: typeof stable, label: string): string | undefined =>
  toDetail(provider, NOW, t, "en")
    .sections.flatMap((section) => section.fields)
    .find((field) => field.label === label)?.value

describe("toRow", () => {
  it("formats every column of a healthy provider", () => {
    const row = toRow(stable, "en")

    expect(row.keyShort).toBe("3a6523…b6b466")
    expect(row.status.label).toBe(statusWord.stable)
    expect(row.status.ratio).toBe("99%")
    expect(row.uptime).toBe("99.72%")
    expect(row.price).toBe("10")
    expect(row.rating).toBe("20.42")
    expect(row.freeSpace).toBe("163.59")
    expect(row.location).toBe("Russia")
    expect(row.workingTime).toBe("313 d 6 hr")
  })

  it("falls back when telemetry and location are missing", () => {
    const row = toRow(silent, "en")

    expect(row.freeSpace).toBe("—")
    expect(row.freeSpaceUnit).toBe("")
    expect(row.location).toBe("—")
  })

  it("hides the ratio for a provider that is not answering", () => {
    expect(toRow(silent, "en").status.ratio).toBeNull()
    expect(toRow(silent, "en").status.label).toBe(statusWord.unavailable)
  })
})

describe("toDetail", () => {
  it("names the check outcome that dominates, and the failure once passing checks lose a clear majority", () => {
    const sevenToThree = {
      ...stable,
      reasons: [
        { reason: 0, count: 7 },
        { reason: 301, count: 3 },
      ],
    }
    const detail = toDetail(stable, NOW, t, "en")

    expect(detail.description).toBe("ui:reason.0")
    expect(detail.status.ratio).toBe(0.9977)
    expect(toDetail(mostlyFailing, NOW, t, "en").description).toBe("ui:reason.301")
    expect(toDetail(sevenToThree, NOW, t, "en").description).toBe("ui:reason.301")
    expect(toDetail(silent, NOW, t, "en").reasons).toEqual([])
    expect(toDetail(silent, NOW, t, "en").description).toBe("ui:reason.none")
  })

  it("omits telemetry sections for a provider that does not report", () => {
    expect(sectionTitles(silent)).toEqual(["provider"])
    expect(sectionTitles(stable)).toEqual(["provider", "software", "benchmarks", "hardware", "network"])
  })

  it("keeps hardware in gigabytes, files on the full scale and a dash where the node measured nothing", () => {
    expect(fieldValue(stable, "ui:details.ram")).toBe("1.06 / 3.73 GB")
    expect(fieldValue(stable, "ui:details.space")).toBe("3656 / 3820 GB")
    expect(fieldValue(stable, "Max bag size")).toBe("80 GB")
    expect(fieldValue(stable, "ui:details.download")).toBe("1970 Mbit/s")
    expect(fieldValue(stable, "ui:details.diskRead")).toBe("63.9 MiB/s")
    expect(fieldValue(stable, "ui:details.diskWrite")).toBe("18.1 MiB/s")
    expect(fieldValue(stable, "ui:details.ping")).toBe("16 ms")
    expect(fieldValue(brokenPing, "ui:details.ping")).toBe("—")
    expect(fieldValue(brokenPing, "ui:details.download")).toBe("—")
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

