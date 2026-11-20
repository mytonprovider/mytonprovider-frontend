import { toProviders, type Provider } from "@myton/ui/domain"

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

export const fetchProviders = async (signal: AbortSignal): Promise<Provider[]> => {
  const providers: Provider[] = []
  let offset = 0

  for (;;) {
    const data = await request("/providers/search", {
      method: "POST",
      signal,
      body: JSON.stringify({ filters: {}, exact: [], limit: PAGE_LIMIT, offset }),
    })

    const page = toProviders(data)
    if (page === null) throw new Error(SHAPE_ERROR)
    if (page.skipped > 0) console.warn(`catalog page at offset ${offset}: skipped ${page.skipped} entries`)

    const received = page.providers.length + page.skipped
    offset += received
    providers.push(...page.providers)

    if (received < PAGE_LIMIT || offset >= MAX_PROVIDERS) {
      return providers
    }
  }
}
