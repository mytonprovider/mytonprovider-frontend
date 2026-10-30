import { describe, expect, it } from "vitest"
import type { GlobeNode, GlobePlaces } from "@/types/globe"
import type { Provider, ProviderLocation } from "@/types/provider"
import { linkNodes, normalizeName, pointOf, summarize, toNodes } from "./globe-nodes"
import { stable } from "./fixtures"
import places from "./globe-places.json"

const table: GlobePlaces = {
  zones: { "Europe/Moscow": [55.75, 37.61], "America/New_York": [40.75, -73.98], "America/Los_Angeles": [34.05, -118.24] },
  cities: {
    RU: { moscow: [55.75, 37.61], kazan: [55.75, 49.13] },
    US: { portland: [45.52, -122.68, 43.67, -70.25] },
  },
}

const at = (country_iso: string, country: string, city: string, time_zone: string): ProviderLocation => ({
  country,
  country_iso,
  city,
  time_zone,
})

const provider = (pubkey: string, location: ProviderLocation | null): Provider => ({ ...stable, pubkey, location })

describe("normalizeName", () => {
  it("matches the spellings the geo database sends", () => {
    expect(normalizeName("St Petersburg")).toBe("saint petersburg")
    expect(normalizeName("Kazan'")).toBe("kazan")
    expect(normalizeName("Málaga")).toBe("malaga")
    expect(normalizeName("  Frankfurt am Main ")).toBe("frankfurt am main")
  })

  it("finds the cities of the live catalog in the shipped table", () => {
    const found = (iso: string, city: string) => Boolean((places as GlobePlaces).cities[iso]?.[normalizeName(city)])

    expect(found("RU", "St Petersburg")).toBe(true)
    expect(found("RU", "Kazan'")).toBe(true)
    expect(found("ES", "Málaga")).toBe(true)
    expect(found("DE", "Frankfurt am Main")).toBe(true)
    expect(found("CA", "Montreal")).toBe(true)
  })
})

describe("pointOf", () => {
  it("puts a known city on its own point", () => {
    expect(pointOf(at("RU", "Russia", "Kazan'", "Europe/Moscow"), table)).toEqual([55.75, 49.13])
  })

  it("picks the namesake closest to the time zone", () => {
    expect(pointOf(at("US", "United States", "Portland", "America/New_York"), table)).toEqual([43.67, -70.25])
    expect(pointOf(at("US", "United States", "Portland", "America/Los_Angeles"), table)).toEqual([45.52, -122.68])
  })

  it("falls back to the time zone when the city is missing or unknown", () => {
    expect(pointOf(at("RU", "Russia", "", "Europe/Moscow"), table)).toEqual([55.75, 37.61])
    expect(pointOf(at("RU", "Russia", "Tver", "Europe/Moscow"), table)).toEqual([55.75, 37.61])
  })

  it("gives no point when neither the city nor the zone is known", () => {
    expect(pointOf(at("RU", "Russia", "", "Mars/Olympus"), table)).toBeNull()
  })
})

describe("toNodes", () => {
  const providers = [
    provider("a", at("RU", "Russia", "Moscow", "Europe/Moscow")),
    provider("b", at("RU", "Russia", "", "Europe/Moscow")),
    provider("c", at("RU", "Russia", "", "Europe/Moscow")),
    provider("d", at("RU", "Russia", "Kazan'", "Europe/Moscow")),
    provider("e", null),
  ]

  it("joins a city and its country without a city on one point", () => {
    const nodes = toNodes(providers, table)

    expect(nodes.map((node) => node.id)).toEqual(["55.75,37.61", "55.75,49.13"])
    expect(nodes[0].spots.map((spot) => [spot.city, spot.providers.map((item) => item.pubkey)])).toEqual([
      ["Moscow", ["a"]],
      [null, ["b", "c"]],
    ])
  })

  it("does not depend on the order of providers", () => {
    const ids = (list: Provider[]) => toNodes(list, table).map((node) => node.id).sort()

    expect(ids([...providers].reverse())).toEqual(ids(providers))
  })

  it("summarizes only what lands on the globe", () => {
    expect(summarize(toNodes(providers, table))).toEqual({ providers: 4, countries: 1, cities: 2 })
  })
})

describe("linkNodes", () => {
  const node = (id: string, lat: number, lng: number, providers: number): GlobeNode => ({
    id,
    lat,
    lng,
    spots: [{ city: id, country: "", providers: Array.from({ length: providers }, (_, i) => provider(`${id}${i}`, null)) }],
  })
  const random = () => 0.5
  const pairs = (nodes: GlobeNode[]) =>
    linkNodes(nodes, random).map(({ from, to, long }) => `${[from.id, to.id].sort().join("-")}${long ? " long" : ""}`)

  it("links two nearby points both ways around the globe", () => {
    expect(pairs([node("frankfurt", 50.11, 8.68, 3), node("nuremberg", 49.45, 11.08, 1)])).toEqual([
      "frankfurt-nuremberg",
      "frankfurt-nuremberg long",
    ])
  })

  it("leaves a single point without links", () => {
    expect(pairs([node("frankfurt", 50.11, 8.68, 5)])).toEqual([])
  })

  it("reaches every point and prefers links longer than the near limit", () => {
    const nodes = [
      node("frankfurt", 50.11, 8.68, 1),
      node("nuremberg", 49.45, 11.08, 1),
      node("newyork", 40.71, -74.01, 1),
      node("singapore", 1.35, 103.82, 1),
    ]
    const tree = pairs(nodes).slice(0, nodes.length - 1)

    expect(new Set(tree.flatMap((pair) => pair.split("-")))).toEqual(new Set(nodes.map((item) => item.id)))
    expect(tree).not.toContain("frankfurt-nuremberg")
  })
})
