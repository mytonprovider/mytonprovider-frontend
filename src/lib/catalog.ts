import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { FiltersData } from "@/types/filters"
import type { Provider } from "@/types/provider"
import type { ProviderDetail, SortDirection, SortField } from "@/types/model"
import { ApiError, fetchProviders } from "./api"
import { matchesQuery, sortProviders, toDetail, toRow } from "./model"
import { deriveBounds, matches, optionsFor, type FilterBounds, type FilterOptions } from "./filters"
import { LIST_KEY, readStored, writeStored } from "./storage"

export const PAGE_SIZE = 20
const FRESH_FOR_MS = 120_000

interface ListShape {
  shown: number
  total: number
}

const COLD_LIST: ListShape = { shown: PAGE_SIZE, total: 0 }

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0

const storedList = (): ListShape => {
  const stored = readStored(LIST_KEY)
  if (!stored) return COLD_LIST

  try {
    const parsed: unknown = JSON.parse(stored)
    const { shown, total } = (parsed ?? {}) as { shown?: unknown; total?: unknown }
    return isCount(shown) && shown > 0 && isCount(total) && total >= shown ? { shown, total } : COLD_LIST
  } catch {
    return COLD_LIST
  }
}

const pageFor = (shown: number): number => Math.max(PAGE_SIZE, Math.ceil(shown / PAGE_SIZE) * PAGE_SIZE)

interface Snapshot {
  providers: Provider[]
  bounds: FilterBounds
  options: FilterOptions
  fetchedAt: number
}

export const NOTHING_LOADED: Snapshot = {
  providers: [],
  bounds: {},
  options: {},
  fetchedAt: 0,
}

export const nextSnapshot = (providers: Provider[], now: number): Snapshot => ({
  providers,
  bounds: deriveBounds(providers, now),
  options: optionsFor(providers),
  fetchedAt: now,
})

export const countMatching = (providers: Provider[], filters: FiltersData, query: string, now: number): number =>
  providers.filter((provider) => matches(provider, filters, now) && matchesQuery(provider, query)).length

export const useCatalog = (filters: FiltersData, favorites: string[]) => {
  const { t } = useTranslation()

  const [snapshot, setSnapshot] = useState<Snapshot>(NOTHING_LOADED)
  const [loading, setLoading] = useState(true)
  const [failure, setFailure] = useState<{ status: number | null } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [query, setQuery] = useState("")
  const [sortField, setSortField] = useState<SortField>("rating")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [placeholder] = useState(storedList)
  const [limit, setLimit] = useState(() => pageFor(placeholder.shown))
  const loadedAt = useRef(0)

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    setFailure(null)

    fetchProviders(controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return
        const at = Date.now()
        loadedAt.current = at
        setSnapshot(nextSnapshot(loaded, Math.floor(at / 1000)))
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setFailure({ status: error instanceof ApiError ? error.status : null })
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [reloadToken])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      if (Date.now() - loadedAt.current < FRESH_FOR_MS) return
      setReloadToken((current) => current + 1)
    }

    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  const sorted = useMemo(() => {
    const found = snapshot.providers.filter(
      (provider) => matches(provider, filters, snapshot.fetchedAt) && matchesQuery(provider, query),
    )
    return sortProviders(found, sortField, sortDirection)
  }, [snapshot.providers, snapshot.fetchedAt, filters, query, sortField, sortDirection])

  const rows = useMemo(() => sorted.slice(0, limit).map((provider) => toRow(provider, t)), [sorted, limit, t])

  useEffect(() => {
    if (snapshot.providers.length === 0) return
    writeStored(LIST_KEY, JSON.stringify({ shown: rows.length, total: sorted.length }))
  }, [snapshot.providers.length, rows.length, sorted.length])

  const pinned = useMemo(
    () => sorted.filter((provider) => favorites.includes(provider.pubkey)).map((provider) => toRow(provider, t)),
    [sorted, favorites, t],
  )

  const detailFor = useCallback(
    (pubkey: string): ProviderDetail | null => {
      const provider = snapshot.providers.find((item) => item.pubkey === pubkey)
      return provider ? toDetail(provider, snapshot.fetchedAt, t) : null
    },
    [snapshot.providers, snapshot.fetchedAt, t],
  )

  const countFor = useCallback(
    (draft: FiltersData) => countMatching(snapshot.providers, draft, query, snapshot.fetchedAt),
    [snapshot.providers, snapshot.fetchedAt, query],
  )

  const toggleSort = (field: SortField) => {
    if (field !== sortField) {
      setSortField(field)
      setSortDirection("desc")
      return
    }
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
  }

  return {
    rows,
    pinned,
    placeholder,
    total: sorted.length,
    loading,
    showSkeleton: loading && snapshot.providers.length === 0,
    failure,
    bounds: snapshot.bounds,
    options: snapshot.options,
    query,
    setQuery,
    sortField,
    sortDirection,
    toggleSort,
    loadMore: () => setLimit((current) => current + PAGE_SIZE),
    retry: () => setReloadToken((current) => current + 1),
    detailFor,
    countFor,
  }
}
