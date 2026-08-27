import { describe, expect, it } from "vitest"
import { NOTHING_LOADED, countMatching, nextSnapshot } from "./catalog"
import { providers, stable, veteran } from "./fixtures"

const NOW = 1785545100

describe("nextSnapshot", () => {
  it("reads the thresholds straight from the catalog it was given", () => {
    const all = nextSnapshot(providers, NOW)
    const one = nextSnapshot([stable], NOW)

    expect(all.bounds.rating_gt?.max).toBeCloseTo(20.415426)
    expect(one.bounds.rating_gt?.max).toBeCloseTo(stable.rating)
  })

  it("offers every distinct value a select can pick", () => {
    const snapshot = nextSnapshot(providers, NOW)

    expect(snapshot.options.location).toEqual(["Japan (JP)", "Russia (RU)"])
    expect(snapshot.options.storage_git_hash).toEqual(["ba05e00"])
  })

  it("falls back when the catalog measures nothing", () => {
    expect(nextSnapshot([], NOW).bounds.rating_gt).toEqual({ min: 0, max: 50 })
  })

  it("stamps when the catalog arrived", () => {
    expect(nextSnapshot(providers, NOW).fetchedAt).toBe(NOW)
  })

  it("starts out empty", () => {
    expect(NOTHING_LOADED.providers).toEqual([])
    expect(NOTHING_LOADED.bounds).toEqual({})
  })
})

describe("countMatching", () => {
  it("counts everything when nothing is asked", () => {
    expect(countMatching(providers, {}, "", NOW)).toBe(providers.length)
  })

  it("narrows by a range bound", () => {
    expect(countMatching(providers, { rating_gt: 16.3 }, "", NOW)).toBe(2)
  })

  it("narrows by the search on top of the filters", () => {
    expect(countMatching(providers, {}, veteran.pubkey.slice(-6), NOW)).toBe(1)
  })
})
