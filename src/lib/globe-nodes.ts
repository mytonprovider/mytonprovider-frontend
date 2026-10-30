import type { GlobeLink, GlobeNode, GlobePlaces, GlobeSummary } from "@/types/globe"
import type { Provider, ProviderLocation } from "@/types/provider"

const LINK_NEAR_DEGREES = 10
const LINK_FAR_DEGREES = 60
const LINK_WRAP_FROM = 2
const LINK_CAP = 62

export const normalizeName = (name: string): string =>
  name
    .normalize("NFKD")
    .replace(/[\u0080-￿]/g, "")
    .toLowerCase()
    .replace(/['`]/g, "")
    .replace(/\bst\b/g, "saint")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const nearest = (spots: number[], to: number[] | undefined): number[] => {
  const pairs = Array.from({ length: spots.length / 2 }, (_, i) => spots.slice(i * 2, i * 2 + 2))
  if (!to) return pairs[0]

  const distance = ([lat, lng]: number[]) => (lat - to[0]) ** 2 + (lng - to[1]) ** 2
  return pairs.reduce((best, pair) => (distance(pair) < distance(best) ? pair : best))
}

export const pointOf = (location: ProviderLocation, places: GlobePlaces): number[] | null => {
  const zone = places.zones[location.time_zone]
  const city = location.city ? places.cities[location.country_iso]?.[normalizeName(location.city)] : undefined
  if (city) return nearest(city, zone)
  return zone ?? null
}

export const toNodes = (providers: Provider[], places: GlobePlaces): GlobeNode[] => {
  const nodes = new Map<string, GlobeNode>()

  for (const provider of providers) {
    const location = provider.location
    const point = location && pointOf(location, places)
    if (!location || !point) continue

    const [lat, lng] = point
    const id = `${lat},${lng}`
    const node = nodes.get(id) ?? { id, lat, lng, spots: [] }
    nodes.set(id, node)

    const city = location.city || null
    const spot = node.spots.find((item) => item.city === city && item.country === location.country)
    if (spot) spot.providers.push(provider)
    else node.spots.push({ city, country: location.country, providers: [provider] })
  }

  return [...nodes.values()]
}

export const providersAt = (node: GlobeNode): number =>
  node.spots.reduce((sum, spot) => sum + spot.providers.length, 0)

export const summarize = (nodes: GlobeNode[]): GlobeSummary => {
  const spots = nodes.flatMap((node) => node.spots)

  return {
    providers: nodes.reduce((sum, node) => sum + providersAt(node), 0),
    countries: new Set(spots.map((spot) => spot.country)).size,
    cities: new Set(spots.filter((spot) => spot.city).map((spot) => `${spot.city}|${spot.country}`)).size,
  }
}

const toRad = (deg: number): number => (deg * Math.PI) / 180

const angularDistance = (a: GlobeNode, b: GlobeNode): number => {
  const cos =
    Math.sin(toRad(a.lat)) * Math.sin(toRad(b.lat)) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(a.lng - b.lng))
  return Math.acos(Math.min(1, Math.max(-1, cos)))
}

export const linkNodes = (unordered: GlobeNode[], random: () => number): GlobeLink[] => {
  const nodes = [...unordered].sort((a, b) => a.id.localeCompare(b.id))
  const linked = new Set<string>()
  const degree = new Map<GlobeNode, number>()
  const links: GlobeLink[] = []
  const link = (from: GlobeNode, to: GlobeNode, long: boolean) => {
    const key = `${[from.id, to.id].sort().join("|")}|${long}`
    if (linked.has(key)) return
    linked.add(key)
    degree.set(from, (degree.get(from) ?? 0) + 1)
    degree.set(to, (degree.get(to) ?? 0) + 1)
    links.push({ from, to, long })
  }

  const distances = new Map(
    nodes.map((node) => [
      node,
      nodes
        .filter((other) => other !== node)
        .map((other) => ({ other, distance: angularDistance(node, other) }))
        .sort((a, b) => a.distance - b.distance),
    ]),
  )
  const others = (node: GlobeNode) => distances.get(node) ?? []
  const near = (distance: number) => distance < toRad(LINK_NEAR_DEGREES)

  const joined = new Set(nodes.slice(0, 1))
  while (joined.size < nodes.length) {
    const [edge] = [...joined]
      .flatMap((node) => others(node).filter(({ other }) => !joined.has(other)).map((target) => ({ node, ...target })))
      .sort((a, b) => Number(near(a.distance)) - Number(near(b.distance)) || a.distance - b.distance)
    joined.add(edge.other)
    link(edge.node, edge.other, false)
  }

  const leastLinked = (node: GlobeNode) => {
    const far = others(node).filter(({ distance }) => distance >= toRad(LINK_FAR_DEGREES))
    const candidates = far.length > 0 ? far : others(node)
    const fewest = Math.min(...candidates.map(({ other }) => degree.get(other) ?? 0))
    const pool = candidates.filter(({ other }) => (degree.get(other) ?? 0) === fewest)
    return pool[Math.floor(random() * pool.length)]?.other
  }

  for (const node of nodes) {
    const reach = leastLinked(node)
    if (reach) link(node, reach, false)
  }
  for (const node of nodes) {
    const wrap = providersAt(node) >= LINK_WRAP_FROM ? leastLinked(node) : undefined
    if (wrap) link(node, wrap, true)
  }
  return links.slice(0, LINK_CAP)
}
