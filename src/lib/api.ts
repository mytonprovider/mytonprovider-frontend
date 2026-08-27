import type { ApiProvider, ApiTelemetry, Provider, Telemetry } from "@/types/provider"
import { BYTES_IN_GB, BYTES_IN_GIB } from "./format"

const API_URL = import.meta.env.VITE_API_URL || "https://mytonprovider.org/api/v1"
const PAGE_LIMIT = 200
const MAX_PROVIDERS = 5000

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, path: string) {
    super(`${path} failed with ${status}`)
    this.name = "ApiError"
    this.status = status
  }
}

const request = async (path: string, init: RequestInit): Promise<unknown> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
  })

  if (!response.ok) {
    throw new ApiError(response.status, `${init.method ?? "GET"} ${path}`)
  }

  return response.json()
}

const SHAPE_ERROR = "unexpected providers response shape"

const pageOf = (data: unknown): unknown[] => {
  if (typeof data !== "object" || data === null || !("providers" in data)) {
    throw new Error(SHAPE_ERROR)
  }

  const list = data.providers
  if (list === null) return []
  if (!Array.isArray(list)) {
    throw new Error(SHAPE_ERROR)
  }

  return list
}

const isProvider = (item: unknown): item is ApiProvider =>
  typeof item === "object" && item !== null && typeof (item as { pubkey?: unknown }).pubkey === "string"

const bytesOf = (value: number | null | undefined, factor: number): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value * factor : null

const toTelemetry = ({
  total_provider_space,
  used_provider_space,
  total_ram,
  usage_ram,
  ...telemetry
}: ApiTelemetry): Telemetry => ({
  ...telemetry,
  total_provider_space_bytes: bytesOf(total_provider_space, BYTES_IN_GIB),
  used_provider_space_bytes: bytesOf(used_provider_space, BYTES_IN_GIB),
  total_ram_bytes: bytesOf(total_ram, BYTES_IN_GB),
  usage_ram_bytes: bytesOf(usage_ram, BYTES_IN_GB),
})

export const toProvider = ({ telemetry, ...provider }: ApiProvider): Provider => ({
  ...provider,
  telemetry: telemetry ? toTelemetry(telemetry) : null,
})

export const fetchProviders = async (signal: AbortSignal): Promise<Provider[]> => {
  const providers: Provider[] = []
  let offset = 0

  for (;;) {
    const data = await request("/providers/search", {
      method: "POST",
      signal,
      body: JSON.stringify({ filters: {}, exact: [], limit: PAGE_LIMIT, offset }),
    })

    const page = pageOf(data)
    offset += page.length
    providers.push(...page.filter(isProvider).map(toProvider))

    if (page.length < PAGE_LIMIT || offset >= MAX_PROVIDERS) {
      return providers
    }
  }
}
