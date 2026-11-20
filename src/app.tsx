import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Star } from "lucide-react"
import {
  Button,
  cx,
  EmptyState,
  FavoriteButton,
  FilterPanel,
  Globe,
  LoadError,
  ProviderIcon,
  removeLocal,
  SearchField,
  shareLink,
  ShareButton,
  Sheet,
  SheetFooter,
  ShortId,
  ShowMore,
  SectionTabs,
  SitePage,
  TabPanel,
  UiProvider,
  useCopyFeedback,
  writeLocal,
} from "@myton/ui"
import { START_FILTERS, countChanged, isStart, type FilterValues } from "@myton/ui/domain"
import { pickLang } from "@myton/ui/i18n"
import { globeWords, locales } from "@myton/ui/locale"
import { useCatalog } from "@/lib/catalog"
import { sampleDetail } from "@/lib/model"
import { FAVORITES_KEY, readStoredStrings } from "@/lib/storage"
import { providerUrl, useOpenProvider } from "@/lib/route"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { FilterButton } from "@/components/filter-button"
import { ProviderDetails } from "@/components/provider-details"
import { ProviderList } from "@/components/provider-list"
import styles from "./app.module.css"

type ListTab = "all" | "favorites"

const TABS = "list"
const TAB_ORDER: readonly ListTab[] = ["all", "favorites"]

export const App = () => {
  const { t, i18n } = useTranslation()
  const lang = pickLang(i18n.language)
  const locale = locales[lang]

  const [filters, setFilters] = useState<FilterValues>(START_FILTERS)
  const [draft, setDraft] = useState<FilterValues>(START_FILTERS)
  const [favorites, setFavorites] = useState<string[]>(() => readStoredStrings(FAVORITES_KEY))

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [tab, setTab] = useState<ListTab>("all")
  const [detailKey, openProvider] = useOpenProvider()
  const [viewedKey, setViewedKey] = useState<string | null>(detailKey)

  const catalog = useCatalog(filters, favorites)
  // The tabs move at once; the list, the globe and the panel follow a step later, so building a section's rows never
  // holds the thumb back
  const shownTab = useDeferredValue(tab)
  const onFavorites = shownTab === "favorites"
  const shownTotal = onFavorites ? catalog.favoriteRows.length : catalog.total
  const noFavorites = onFavorites && favorites.length === 0

  useEffect(() => {
    if (favorites.length === 0) removeLocal(FAVORITES_KEY)
    else writeLocal(FAVORITES_KEY, JSON.stringify(favorites))
  }, [favorites])

  const { copied: copiedKey, copy: copyValue } = useCopyFeedback()
  const copy = useCallback((value: string) => void copyValue(value), [copyValue])
  const share = useCallback((pubkey: string) => shareLink(providerUrl(pubkey), copy), [copy])

  const { copied: sheetCopiedKey, copy: copySheetValue } = useCopyFeedback()
  const copyFromSheet = useCallback((value: string) => void copySheetValue(value), [copySheetValue])

  const toggleFavorite = useCallback((pubkey: string) => {
    setFavorites((current) =>
      current.includes(pubkey) ? current.filter((key) => key !== pubkey) : [...current, pubkey],
    )
  }, [])

  const matchCount = filtersOpen ? catalog.countFor(draft) : catalog.total

  const filtersTouched = !isStart(filters)
  const draftTouched = !isStart(draft)
  const draftFilters = countChanged(draft)

  if (detailKey !== null && detailKey !== viewedKey) setViewedKey(detailKey)

  const { detailFor } = catalog
  const detail = useMemo(() => (detailKey ? detailFor(detailKey) : null), [detailFor, detailKey])

  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const closeDetail = useCallback(() => openProvider(null), [openProvider])

  useEffect(() => {
    if (detailKey !== null && !catalog.loading && !catalog.failure && !detail) openProvider(null)
  }, [detailKey, detail, catalog.loading, catalog.failure, openProvider])

  const resetFilters = () => {
    setFilters(START_FILTERS)
    setDraft(START_FILTERS)
  }

  const openFilters = () => {
    setDraft(filters)
    setFiltersOpen(true)
  }

  return (
    <UiProvider labels={locale.ui}>
      <SitePage header={<Header />} footer={<Footer />} title={t("mainTitle")} subtitle={t("mainDescription")}>
        <SectionTabs
          tabs={TABS}
          items={[
            { key: "all", label: t("tabs.providers"), icon: ProviderIcon },
            {
              key: "favorites",
              label: t("tabs.favorites"),
              icon: Star,
              badge: favorites.length > 0 ? String(favorites.length) : undefined,
            },
          ]}
          value={tab}
          onChange={setTab}
        />

        <Globe
          providers={onFavorites ? catalog.favoriteProviders : catalog.matching}
          ready={!catalog.loading}
          words={globeWords[lang]}
        />

        <div className={styles.catalog}>
          <div className={styles.searchRow}>
            <SearchField
              className={styles.search}
              name="search"
              value={catalog.query}
              label={t("ui.search")}
              onChange={catalog.setQuery}
            />

            <span className={styles.filterSlot}>
              <FilterButton variant="icon" active={filtersTouched} onClick={openFilters} />
            </span>
          </div>

          <TabPanel tabs={TABS} value={shownTab} order={TAB_ORDER}>
            {catalog.failure && (
              <LoadError
                message={t("errors.failedToLoadProviders")}
                status={catalog.failure.status}
                onRetry={catalog.retry}
                className={cx(styles.state, catalog.total > 0 && styles.compact)}
              />
            )}

            {noFavorites && !catalog.failure && (
              <EmptyState
                role="status"
                title={t("tabs.noFavorites")}
                hint={t("tabs.noFavoritesHint")}
                className={styles.state}
              />
            )}

            {!catalog.loading && !catalog.failure && shownTotal === 0 && !noFavorites && (
              <EmptyState
                role="status"
                title={t("table.providersNotFound")}
                action={
                  <Button
                    variant="text"
                    tone="red"
                    onClick={() => {
                      catalog.setQuery("")
                      resetFilters()
                    }}
                  >
                    {t("ui:ui.reset")}
                  </Button>
                }
                className={styles.state}
              />
            )}

            {((catalog.showSkeleton && !noFavorites) || shownTotal > 0) && (
              <div className={styles.results}>
                <ProviderList
                  rows={onFavorites ? catalog.favoriteRows : catalog.rows}
                  favorites={favorites}
                  copiedKey={copiedKey}
                  sortField={catalog.sortField}
                  sortDirection={catalog.sortDirection}
                  filtersActive={filtersTouched}
                  loading={catalog.showSkeleton}
                  skeletonRows={onFavorites ? favorites.length : catalog.placeholder.shown}
                  onSort={catalog.toggleSort}
                  onToggleFavorite={toggleFavorite}
                  onCopy={copy}
                  onShare={share}
                  onOpen={openProvider}
                  viewedKey={viewedKey}
                  onOpenFilters={openFilters}
                />

                {onFavorites ? null : catalog.showSkeleton ? (
                  catalog.placeholder.total > 0 && (
                    <ShowMore
                      loading
                      shown={catalog.placeholder.shown}
                      total={catalog.placeholder.total}
                      onMore={catalog.loadMore}
                    />
                  )
                ) : (
                  <ShowMore shown={catalog.rows.length} total={catalog.total} onMore={catalog.loadMore} />
                )}
              </div>
            )}
          </TabPanel>
        </div>

        <Sheet
          open={filtersOpen}
          title={t("ui:filters.title")}
          badge={draftFilters}
          actions={
            draftTouched ? (
              <Button variant="text" tone="red" onClick={resetFilters}>
                {t("ui:ui.reset")}
              </Button>
            ) : undefined
          }
          onClose={closeFilters}
        >
          {filtersOpen && (
            <FilterPanel
              values={draft}
              edges={catalog.edges}
              options={catalog.options}
              labels={locale.filters}
              onChange={setDraft}
            />
          )}
          <SheetFooter>
            <Button
              variant="primary"
              size="xl"
              onClick={() => {
                setFilters(draft)
                catalog.setQuery("")
                closeFilters()
              }}
            >
              {catalog.showSkeleton ? t("buttons.applyFilters") : t("ui:filters.show", { total: matchCount })}
            </Button>
          </SheetFooter>
        </Sheet>

        <Sheet
          open={detailKey !== null}
          title={t("ui:filters.group.provider")}
          lead={detailKey !== null && <ShortId value={detailKey} />}
          actions={
            detailKey !== null && (
              <>
                <FavoriteButton
                  size="sm"
                  active={favorites.includes(detailKey)}
                  label={t("ui.favorites")}
                  onToggle={() => toggleFavorite(detailKey)}
                />
                <ShareButton
                  size="sm"
                  label={t("ui.share")}
                  shared={sheetCopiedKey === providerUrl(detailKey)}
                  onShare={() => shareLink(providerUrl(detailKey), copyFromSheet)}
                />
              </>
            )
          }
          onClose={closeDetail}
        >
          {detailKey !== null &&
            (detail ? (
              <ProviderDetails key={detailKey} detail={detail} />
            ) : catalog.failure ? (
              <LoadError
                message={t("errors.failedToLoadProviders")}
                status={catalog.failure.status}
                onRetry={catalog.retry}
                className={styles.state}
              />
            ) : (
              <ProviderDetails detail={sampleDetail(Date.now() / 1000, t, lang)} loading />
            ))}
        </Sheet>
      </SitePage>
    </UiProvider>
  )
}
