import { describe, expect, it } from "vitest"
import { countMatching, nextSnapshot } from "./catalog"
import { providers, stable } from "./fixtures"

const NOW = 1785545100

describe("nextSnapshot", () => {
  it("stamps the catalog it was given and measures its scales and lists", () => {
    const snapshot = nextSnapshot([stable], NOW)

    expect(snapshot.fetchedAt).toBe(NOW)
    expect(snapshot.edges.rating.min).toBeLessThanOrEqual(stable.rating ?? Number.NaN)
    expect(snapshot.edges.rating.max).toBeGreaterThanOrEqual(stable.rating ?? Number.NaN)
    expect(snapshot.options.storageHash.map((option) => option.value)).toEqual(["ba05e00"])
  })
})

describe("countMatching", () => {
  it("narrows by a range bound", () => {
    expect(countMatching(providers, { rating: { from: 16.3 } }, NOW)).toBe(2)
  })
})
