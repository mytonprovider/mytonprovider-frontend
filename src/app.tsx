import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ArrowUp, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { FiltersData } from "@/types/filters"
import { PAGE_SIZE, useCatalog } from "@/lib/catalog"
import { DEFAULT_FILTERS, countActiveFilters, isPristine } from "@/lib/filters"
import { FAVORITES_KEY, readStoredStrings, removeStored, writeStored } from "@/lib/storage"
import { copyText, scrollToTop } from "@/lib/dom"
import { providerUrl, useOpenProvider } from "@/lib/route"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Filters } from "@/components/filters"
import { FilterButton } from "@/components/filter-button"
import { IconButton } from "@/components/icon-button"
import { ProviderDetails, ProviderDetailsSkeleton } from "@/components/provider-details"
import { ProviderList } from "@/components/provider-list"
import { Sheet } from "@/components/sheet"
import styles from "./app.module.css"

const COPIED_RESET_MS = 1200

interface LoadFailureProps {
  status: number | null
  compact: boolean
  onRetry: () => void
}

const LoadFailure = ({ status, compact, onRetry }: LoadFailureProps) => {
  const { t } = useTranslation()

  return (
    <div className={styles.state} role="status" data-compact={compact}>
      <p>{t("errors.failedToLoadProviders")}</p>
      {status !== null && <p className={styles.errorCode}>{t("errors.statusCode", { status })}</p>}
      <button type="button" className={styles.linkButton} onClick={onRetry}>
        {t("buttons.retry")}
      </button>
    </div>
  )
}

export const App = () => {
  const { t } = useTranslation()

  const [filters, setFilters] = useState<FiltersData>(DEFAULT_FILTERS)
  const [draft, setDraft] = useState<FiltersData>(DEFAULT_FILTERS)
  const [favorites, setFavorites] = useState<string[]>(() => readStoredStrings(FAVORITES_KEY))

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [detailKey, openProvider] = useOpenProvider()
  const [viewedKey, setViewedKey] = useState<string | null>(detailKey)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [scrolledDown, setScrolledDown] = useState(false)
  const [footerVisible, setFooterVisible] = useState(false)

  const copyTimer = useRef<number>(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const footerRef = useRef<HTMLElement>(null)

  const catalog = useCatalog(filters, favorites)

  useEffect(() => {
    const onScroll = () => setScrolledDown(window.scrollY > 320)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const footer = footerRef.current
    if (!footer) return

    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry?.isIntersecting ?? false))
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  const anySheetOpen = filtersOpen || detailKey !== null

  useLayoutEffect(() => {
    if (!anySheetOpen) return
    const root = document.documentElement
    const width = root.clientWidth
    root.style.overflow = "hidden"
    const grown = root.clientWidth - width
    if (grown > 0) root.style.paddingRight = `${grown}px`
    return () => {
      root.style.overflow = ""
      root.style.paddingRight = ""
    }
  }, [anySheetOpen])

  useEffect(() => {
    if (favorites.length === 0) removeStored(FAVORITES_KEY)
    else writeStored(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  const copy = useCallback((value: string) => {
    void copyText(value).then((done) => {
      if (!done) return
      setCopiedKey(value)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopiedKey(null), COPIED_RESET_MS)
    })
  }, [])

  const share = useCallback(
    (pubkey: string) => {
      const url = providerUrl(pubkey)

      if (typeof navigator.share === "function") {
        void navigator.share({ url }).catch(() => undefined)
        return
      }

      copy(url)
    },
    [copy],
  )

  const toggleFavorite = useCallback((pubkey: string) => {
    setFavorites((current) =>
      current.includes(pubkey) ? current.filter((key) => key !== pubkey) : [...current, pubkey],
    )
  }, [])

  const matching = filtersOpen ? catalog.countFor(draft) : catalog.total

  const filtersTouched = useMemo(() => !isPristine(filters), [filters])
  const draftTouched = useMemo(() => !isPristine(draft), [draft])
  const draftFilters = useMemo(() => countActiveFilters(draft), [draft])

  useEffect(() => {
    if (detailKey !== null) setViewedKey(detailKey)
  }, [detailKey])

  const { detailFor } = catalog
  const detail = useMemo(() => (detailKey ? detailFor(detailKey) : null), [detailFor, detailKey])

  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const closeDetail = useCallback(() => openProvider(null), [openProvider])

  useEffect(() => {
    if (detailKey !== null && !catalog.loading && !catalog.failure && !detail) openProvider(null)
  }, [detailKey, detail, catalog.loading, catalog.failure, openProvider])

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setDraft(DEFAULT_FILTERS)
  }

  const openFilters = () => {
    setDraft(filters)
    setFiltersOpen(true)
  }

  return (
    <div className={styles.shell}>
      <Header />
      <main id="top" tabIndex={-1} className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>{t("mainTitle")}</h1>
          <p className={styles.subtitle}>{t("mainDescription")}</p>
        </div>

        <div className={styles.searchRow}>
          <div className={styles.search}>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="text"
              name="search"
              autoComplete="off"
              value={catalog.query}
              placeholder={t("ui.search")}
              aria-label={t("ui.search")}
              onChange={(event) => catalog.setQuery(event.target.value)}
            />
            {catalog.query && (
              <IconButton
                className={styles.clear}
                label={t("ui.clear")}
                onClick={() => {
                  catalog.setQuery("")
                  searchRef.current?.focus()
                }}
              >
                <X className={styles.clearIcon} aria-hidden="true" />
              </IconButton>
            )}
          </div>

          <span className={styles.filterSlot}>
            <FilterButton variant="icon" active={filtersTouched} onClick={openFilters} />
          </span>
        </div>

        {catalog.failure && (
          <LoadFailure status={catalog.failure.status} compact={catalog.total > 0} onRetry={catalog.retry} />
        )}

        {!catalog.loading && !catalog.failure && catalog.total === 0 && (
          <div className={styles.state} role="status">
            <p>{t("table.providersNotFound")}</p>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                catalog.setQuery("")
                resetFilters()
              }}
            >
              {t("buttons.reset")}
            </button>
          </div>
        )}

        {(catalog.showSkeleton || catalog.total > 0) && (
          <div className={styles.results}>
            <ProviderList
              rows={catalog.rows}
              pinned={catalog.pinned}
              favorites={favorites}
              copiedKey={copiedKey}
              sortField={catalog.sortField}
              sortDirection={catalog.sortDirection}
              filtersActive={filtersTouched}
              loading={catalog.showSkeleton}
              skeletonRows={PAGE_SIZE}
              pinnedSkeletonRows={favorites.length}
              onSort={catalog.toggleSort}
              onToggleFavorite={toggleFavorite}
              onCopy={copy}
              onShare={share}
              onOpen={openProvider}
              viewedKey={viewedKey}
              onOpenFilters={openFilters}
            />

            {!catalog.showSkeleton && (
              <div className={styles.more}>
                <span className={styles.showing} role="status">
                  {t("ui.showing", { shown: catalog.rows.length, total: catalog.total })}
                </span>
                {catalog.rows.length < catalog.total && (
                  <button type="button" className={styles.moreButton} onClick={catalog.loadMore}>
                    {t("buttons.loadMore")}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {scrolledDown && !footerVisible && (
          <button
            type="button"
            className={styles.fab}
            title={t("buttons.goUp")}
            aria-label={t("buttons.goUp")}
            onClick={() => {
              scrollToTop()
              document.getElementById("top")?.focus()
            }}
          >
            <ArrowUp className={styles.fabIcon} aria-hidden="true" />
          </button>
        )}

        <Sheet
          open={filtersOpen}
          label={t("filters.title")}
          title={t("filters.title")}
          badge={draftFilters}
          onReset={draftTouched ? resetFilters : undefined}
          onClose={closeFilters}
          footer={
            <button
              type="button"
              className={styles.apply}
              onClick={() => {
                setFilters(draft)
                closeFilters()
              }}
            >
              {catalog.showSkeleton ? t("buttons.applyFilters") : t("buttons.showMatching", { total: matching })}
            </button>
          }
        >
          {filtersOpen && (
            <Filters value={draft} bounds={catalog.bounds} options={catalog.options} onChange={setDraft} />
          )}
        </Sheet>

        <Sheet open={detailKey !== null} label={t("provider.providerTitle")} onClose={closeDetail}>
          {detailKey !== null &&
            (detail ? (
              <ProviderDetails key={detailKey} detail={detail} copiedKey={copiedKey} onCopy={copy} />
            ) : catalog.failure ? (
              <LoadFailure status={catalog.failure.status} compact={false} onRetry={catalog.retry} />
            ) : (
              <ProviderDetailsSkeleton />
            ))}
        </Sheet>
      </main>
      <Footer ref={footerRef} />
    </div>
  )
}
