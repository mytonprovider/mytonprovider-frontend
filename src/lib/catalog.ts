import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { FiltersData } from "@/types/filters"
import type { Provider } from "@/types/provider"
import type { ProviderDetail, SortDirection, SortField } from "@/types/model"
import { ApiError, fetchProviders } from "./api"
import { matchesQuery, sortProviders, toDetail, toRow } from "./model"
import { deriveBounds, matches, optionsFor, type FilterBounds, type FilterOptions } from "./filters"

export const PAGE_SIZE = 20
const FRESH_FOR_MS = 120_000

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

  const [query, setQueryValue] = useState("")
  const [sortField, setSortField] = useState<SortField>("rating")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [limit, setLimit] = useState(PAGE_SIZE)
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

  useEffect(() => {
    setLimit(PAGE_SIZE)
  }, [filters])

  const sorted = useMemo(() => {
    const found = snapshot.providers.filter(
      (provider) => matches(provider, filters, snapshot.fetchedAt) && matchesQuery(provider, query),
    )
    return sortProviders(found, sortField, sortDirection)
  }, [snapshot.providers, snapshot.fetchedAt, filters, query, sortField, sortDirection])

  const rows = useMemo(() => sorted.slice(0, limit).map((provider) => toRow(provider, t)), [sorted, limit, t])

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

  const setQuery = useCallback((next: string) => {
    setQueryValue(next)
    setLimit(PAGE_SIZE)
  }, [])

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
