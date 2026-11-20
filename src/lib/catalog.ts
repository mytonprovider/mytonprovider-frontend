import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { readLocal, writeLocal } from "@myton/ui"
import {
  CATALOG_FRESH_MS,
  filterEdges,
  filterOptions,
  isStart,
  matchesFilters,
  nextSortDirection,
  PAGE_SIZE,
  rankByRating,
  sortProviders,
  type FilterEdges,
  type FilterValues,
  type ListId,
  type ListOption,
  type Provider,
} from "@myton/ui/domain"
import { pickLang } from "@myton/ui/i18n"
import type { ProviderDetail, SortDirection, SortField } from "@/types/model"
import { ApiError, fetchProviders } from "./api"
import { matchesQuery, toDetail, toRow } from "./model"
import { LIST_KEY } from "./storage"

interface ListShape {
  shown: number
  total: number
}

const COLD_LIST: ListShape = { shown: PAGE_SIZE, total: 0 }

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0

const storedList = (): ListShape => {
  const stored = readLocal(LIST_KEY)
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
  edges: FilterEdges
  options: Record<ListId, ListOption[]>
  fetchedAt: number
}

export const nextSnapshot = (providers: Provider[], now: number): Snapshot => ({
  providers,
  edges: filterEdges(providers, now),
  options: filterOptions(providers),
  fetchedAt: now,
})

export const NOTHING_LOADED: Snapshot = nextSnapshot([], 0)

// The search reaches past the filters: the provider looked for is often the one they hide
const shows = (provider: Provider, filters: FilterValues, query: string, now: number): boolean =>
  query.trim() === "" ? matchesFilters(provider, filters, now) : matchesQuery(provider, query)

export const countMatching = (providers: Provider[], filters: FilterValues, now: number): number =>
  providers.filter((provider) => matchesFilters(provider, filters, now)).length

export const useCatalog = (filters: FilterValues, favorites: string[]) => {
  const { t, i18n } = useTranslation()
  const lang = pickLang(i18n.language)

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
      if (Date.now() - loadedAt.current < CATALOG_FRESH_MS) return
      setReloadToken((current) => current + 1)
    }

    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  const sorted = useMemo(() => {
    const found = snapshot.providers.filter((provider) => shows(provider, filters, query, snapshot.fetchedAt))
    return sortProviders(found, sortField, sortDirection)
  }, [snapshot.providers, snapshot.fetchedAt, filters, query, sortField, sortDirection])

  // The place among what the filters keep, not the search: a key found by search keeps the number its row has
  const ranks = useMemo(
    () => rankByRating(snapshot.providers.filter((provider) => matchesFilters(provider, filters, snapshot.fetchedAt))),
    [snapshot.providers, snapshot.fetchedAt, filters],
  )

  const rows = useMemo(
    () => sorted.slice(0, limit).map((provider) => toRow(provider, lang, ranks)),
    [sorted, limit, lang, ranks],
  )

  const asOnLoad = isStart(filters) && query.trim() === ""

  useEffect(() => {
    if (snapshot.providers.length === 0 || !asOnLoad) return
    writeLocal(LIST_KEY, JSON.stringify({ shown: rows.length, total: sorted.length }))
  }, [snapshot.providers.length, rows.length, sorted.length, asOnLoad])

  const favoriteProviders = useMemo(
    () => sorted.filter((provider) => favorites.includes(provider.pubkey)),
    [sorted, favorites],
  )
  const favoriteRows = useMemo(
    () => favoriteProviders.map((provider) => toRow(provider, lang, ranks)),
    [favoriteProviders, lang, ranks],
  )

  const detailFor = useCallback(
    (pubkey: string): ProviderDetail | null => {
      const provider = snapshot.providers.find((item) => item.pubkey === pubkey)
      return provider ? toDetail(provider, snapshot.fetchedAt, t, lang) : null
    },
    [snapshot.providers, snapshot.fetchedAt, t, lang],
  )

  const countFor = useCallback(
    (draft: FilterValues) => countMatching(snapshot.providers, draft, snapshot.fetchedAt),
    [snapshot.providers, snapshot.fetchedAt],
  )

  const toggleSort = (field: SortField) => {
    setSortDirection(nextSortDirection(field, sortField, sortDirection))
    setSortField(field)
  }

  return {
    rows,
    matching: sorted,
    favoriteProviders,
    favoriteRows,
    placeholder,
    total: sorted.length,
    loading,
    showSkeleton: loading && snapshot.providers.length === 0,
    failure,
    edges: snapshot.edges,
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
