import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError, fetchProviders } from "./api"
import { apiStable, stable } from "./fixtures"

const signal = () => new AbortController().signal

const page = (count: number) => ({ providers: Array.from({ length: count }, () => apiStable) })

const respondWith = (bodies: unknown[]) => {
  const calls: string[] = []
  const fetchStub = vi.fn((_url: string, init: RequestInit) => {
    calls.push(typeof init.body === "string" ? init.body : "")
    const body = bodies[calls.length - 1] ?? { providers: [] }
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  })
  vi.stubGlobal("fetch", fetchStub)
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("fetchProviders", () => {
  it("stops after a page that is not full", async () => {
    const calls = respondWith([page(3)])

    await expect(fetchProviders(signal())).resolves.toHaveLength(3)
    expect(calls).toHaveLength(1)
  })

  it("walks pages until the catalog runs out, moving the offset", async () => {
    const calls = respondWith([page(200), page(200), page(7)])

    await expect(fetchProviders(signal())).resolves.toHaveLength(407)
    expect(calls.map((body) => (JSON.parse(body) as { offset: number }).offset)).toEqual([0, 200, 400])
  })

  it("stops walking once the cap is reached", async () => {
    const calls = respondWith(Array.from({ length: 40 }, () => page(200)))

    await expect(fetchProviders(signal())).resolves.toHaveLength(5000)
    expect(calls).toHaveLength(25)
  })

  it("treats an empty catalog as no providers", async () => {
    respondWith([{ providers: null }])

    await expect(fetchProviders(signal())).resolves.toEqual([])
  })

  it("keeps walking pages when the catalog mixes in entries it cannot use", async () => {
    const dirty = { providers: [...Array.from({ length: 197 }, () => apiStable), {}, {}, {}] }
    const calls = respondWith([dirty, page(50)])

    await expect(fetchProviders(signal())).resolves.toHaveLength(247)
    expect(calls.map((body) => (JSON.parse(body) as { offset: number }).offset)).toEqual([0, 200])
  })

  it("drops entries the catalog sends without a key", async () => {
    respondWith([{ providers: [apiStable, {}, { pubkey: 42 }] }])

    await expect(fetchProviders(signal())).resolves.toEqual([stable])
  })

  it("turns the units the catalog reports into bytes", async () => {
    respondWith([{ providers: [apiStable] }])

    const [provider] = await fetchProviders(signal())

    expect(provider.telemetry?.total_provider_space_bytes).toBe(4101693767680)
    expect(provider.telemetry?.used_provider_space_bytes).toBe(3926040342691.84)
    expect(provider.telemetry?.total_ram_bytes).toBe(4010000000)
    expect(provider.telemetry?.usage_ram_bytes).toBe(1140000000)
  })

  it("reports the status code when the catalog refuses", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("rate limited", { status: 429 })))

    await expect(fetchProviders(signal())).rejects.toBeInstanceOf(ApiError)
    await expect(fetchProviders(signal())).rejects.toMatchObject({ status: 429 })
  })

  it("refuses an answer that is not shaped like a catalog", async () => {
    respondWith([{ unexpected: true }])

    await expect(fetchProviders(signal())).rejects.toThrow("unexpected providers response shape")
  })
})
