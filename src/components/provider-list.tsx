import { useEffect, useRef, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Check, ChevronDown, Share2, Star } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ProviderRow, SortDirection, SortField } from "@/types/model"
import { CopyButton } from "./copy-button"
import { IconButton } from "./icon-button"
import { FilterButton } from "./filter-button"
import styles from "./provider-list.module.css"
import { cx } from "@/lib/cx"
import { STATUS_KEYS } from "@/lib/model"
import { providerUrl } from "@/lib/route"

type StatId = "rating" | "uptime" | "price" | "freeSpace" | "workingTime" | "location"

interface Column {
  id: StatId | "pubkey" | "status"
  label: string
  hint?: string
  sort?: SortField
}

const COLUMNS: Column[] = [
  { id: "pubkey", label: "table.publicKey", sort: "pubkey" },
  { id: "rating", label: "table.rating", sort: "rating" },
  { id: "status", label: "table.status", hint: "status.accessibleFilesHint", sort: "status" },
  { id: "uptime", label: "table.uptime", hint: "status.uptimeHint", sort: "uptime" },
  { id: "price", label: "table.price", hint: "status.priceHint", sort: "price" },
  { id: "freeSpace", label: "table.freeSpace", sort: "freeSpace" },
  { id: "workingTime", label: "table.workingTime", sort: "workingTime" },
  { id: "location", label: "table.location", sort: "location" },
]

const STAGGER_LIMIT = 10

const KEY_PLACEHOLDER = "000000…000000"

const ORDER: Record<StatId, string> = {
  rating: styles.orderRating,
  uptime: styles.orderUptime,
  price: styles.orderPrice,
  freeSpace: styles.orderFreeSpace,
  workingTime: styles.orderWorkingTime,
  location: styles.orderLocation,
}

const SORT_COLUMNS = COLUMNS.filter(
  (column): column is Column & { sort: SortField } => column.sort !== undefined,
)

const STAT_COLUMNS = COLUMNS.filter(
  (column): column is Column & { id: StatId } => column.id !== "pubkey" && column.id !== "status",
)

const SKELETON_VALUE: Record<StatId, string> = {
  rating: "4em",
  uptime: "3.7em",
  price: "4.3em",
  freeSpace: "5.4em",
  workingTime: "4.2em",
  location: "4.3em",
}

const STAT_VALUES: Record<StatId, (row: ProviderRow) => ReactNode> = {
  rating: (row) => (
    <>
      <Star className={styles.star} aria-hidden="true" />
      <span>{row.rating}</span>
    </>
  ),
  uptime: (row) => <span>{row.uptime}</span>,
  price: (row) => (
    <>
      <span>{row.price}</span>
      <span className={styles.unit}>{row.priceUnit}</span>
    </>
  ),
  freeSpace: (row) => (
    <>
      <span>{row.freeSpace}</span>
      {row.freeSpaceUnit && <span className={styles.unit}>{row.freeSpaceUnit}</span>}
    </>
  ),
  workingTime: (row) => <span>{row.workingTime}</span>,
  location: (row) => <span>{row.location}</span>,
}

interface CardProps {
  onShare: (pubkey: string) => void
  sharedUrl: boolean
  row: ProviderRow
  index: number
  fresh: boolean
  viewed: boolean
  favorite: boolean
  copied: boolean
  onToggleFavorite: (pubkey: string) => void
  onCopy: (pubkey: string) => void
  onOpen: (pubkey: string) => void
}

const shape = (...names: string[]) => cx(styles.shape, ...names)

const WIDEST_RATIO = "100%"

const KeyText = ({ value }: { value: string }) => {
  const [head, tail] = value.split("…")

  return (
    <>
      <span className={styles.keyHead}>{head}</span>…<span className={styles.keyTail}>{tail}</span>
    </>
  )
}

const StatusCell = ({ status }: { status: ProviderRow["status"] }) => {
  const { t } = useTranslation()

  return (
    <span className={styles.statusStack}>
      <span className={styles.statusRow}>
        <span className={styles.statusLabel}>{status.label}</span>
        {status.ratio && <span className={styles.ratio}>{status.ratio}</span>}
      </span>
      <span className={styles.statusGhost} aria-hidden="true">
        {STATUS_KEYS.map((key) => (
          <span key={key}>
            {t(`status.${key}`)}
            <span className={styles.ratio}>{WIDEST_RATIO}</span>
          </span>
        ))}
      </span>
    </span>
  )
}

const SkeletonCard = ({ index }: { index: number }) => {
  const { t } = useTranslation()

  return (
    <article
      className={cx(styles.card, styles.placeholder)}
      style={{ "--card-index": index } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className={styles.head}>
        <span className={cx(shape(styles.shapeCircleSm), styles.orderFavorite)} />
        <div className={cx(styles.key, styles.orderKey)}>
          <span className={cx(styles.keyText, shape(styles.keyShape))}>
            <KeyText value={KEY_PLACEHOLDER} />
          </span>
          <span className={shape(styles.shapeCopy)} />
        </div>
        <span className={cx(styles.status, styles.orderStatus, shape(styles.statusShape))}>
          <span className={styles.dot} />
          <StatusCell status={{ tone: "green", label: t("status.stable"), ratio: WIDEST_RATIO }} />
        </span>

        <span className={cx(shape(styles.shapeCircleSm), styles.orderShare)} />
      </div>

      <div className={styles.stats}>
        {STAT_COLUMNS.map((column) => (
          <div key={column.id} className={cx(styles.cell, ORDER[column.id])}>
            <span className={styles.label}>
              <span className={shape(styles.shapeText)}>{t(column.label)}</span>
            </span>
            <span className={styles.value}>
              <span
                className={shape(styles.shapeValue)}
                style={{ "--shape-w": SKELETON_VALUE[column.id] } as React.CSSProperties}
              />
            </span>
          </div>
        ))}
      </div>
    </article>
  )
}

const Cell = ({ id, label, children }: { id: StatId; label: string; children: ReactNode }) => (
  <div className={cx(styles.cell, ORDER[id])}>
    <span className={styles.label}>{label}</span>
    <span className={styles.value}>{children}</span>
  </div>
)

const ProviderCard = ({
  row,
  index,
  fresh,
  viewed,
  favorite,
  copied,
  sharedUrl,
  onToggleFavorite,
  onCopy,
  onShare,
  onOpen,
}: CardProps) => {
  const { t } = useTranslation()

  return (
    <article
      className={cx(styles.card, fresh && styles.enter)}
      data-viewed={viewed ? "" : undefined}
      style={{ "--card-index": index } as React.CSSProperties}
    >
      <button
        type="button"
        className={styles.open}
        aria-label={`${t("table.providerDetails")} ${row.keyShort}`}
        onClick={() => onOpen(row.pubkey)}
      />

      <div className={styles.head}>
        <IconButton
          size="sm"
          label={`${t("ui.favorites")} ${row.keyShort}`}
          aria-pressed={favorite}
          className={cx(styles.favorite, styles.orderFavorite, favorite && styles.favoriteActive)}
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite(row.pubkey)
          }}
        >
          <Star className={styles.starIcon} aria-hidden="true" />
        </IconButton>

        <div className={cx(styles.key, styles.orderKey)}>
          <span className={styles.keyText} title={row.pubkey}>
            <KeyText value={row.keyShort} />
          </span>
          <CopyButton value={row.pubkey} copied={copied} onCopy={onCopy} label={`${t("ui.copy")} ${row.keyShort}`} />
        </div>

        <span className={cx(styles.status, styles.orderStatus)} data-tone={row.status.tone}>
          <span className={styles.dot} aria-hidden="true" />
          <StatusCell status={row.status} />
        </span>

        <IconButton
          size="sm"
          label={`${t("ui.share")} ${row.keyShort}`}
          className={cx(styles.share, styles.orderShare)}
          onClick={(event) => {
            event.stopPropagation()
            onShare(row.pubkey)
          }}
        >
          {sharedUrl ? (
            <Check className={styles.shareIcon} aria-hidden="true" />
          ) : (
            <Share2 className={styles.shareIcon} aria-hidden="true" />
          )}
        </IconButton>
      </div>

      <div className={styles.stats}>
        {STAT_COLUMNS.map((column) => (
          <Cell key={column.id} id={column.id} label={t(column.label)}>
            {STAT_VALUES[column.id](row)}
          </Cell>
        ))}
      </div>
    </article>
  )
}

interface ProviderListProps {
  rows: ProviderRow[]
  pinned: ProviderRow[]
  favorites: string[]
  copiedKey: string | null
  sortField: SortField
  sortDirection: SortDirection
  filtersActive: boolean
  loading: boolean
  skeletonRows: number
  pinnedSkeletonRows: number
  onSort: (field: SortField) => void
  onToggleFavorite: (pubkey: string) => void
  onCopy: (pubkey: string) => void
  onShare: (pubkey: string) => void
  onOpen: (pubkey: string) => void
  onOpenFilters: () => void
  viewedKey: string | null
}

export const ProviderList = ({
  rows,
  pinned,
  favorites,
  copiedKey,
  sortField,
  sortDirection,
  filtersActive,
  loading,
  skeletonRows,
  pinnedSkeletonRows,
  onSort,
  onToggleFavorite,
  onCopy,
  onShare,
  onOpen,
  onOpenFilters,
  viewedKey,
}: ProviderListProps) => {
  const { t } = useTranslation()
  const seen = useRef(new Set<string>())

  useEffect(() => {
    for (const row of [...pinned, ...rows]) seen.current.add(row.pubkey)
  }, [pinned, rows])

  const renderCard = (row: ProviderRow, index: number) => (
    <ProviderCard
      key={row.pubkey}
      row={row}
      index={index % STAGGER_LIMIT}
      fresh={!seen.current.has(row.pubkey)}
      viewed={row.pubkey === viewedKey}
      favorite={favorites.includes(row.pubkey)}
      copied={copiedKey === row.pubkey}
      sharedUrl={copiedKey === providerUrl(row.pubkey)}
      onToggleFavorite={onToggleFavorite}
      onCopy={onCopy}
      onShare={onShare}
      onOpen={onOpen}
    />
  )

  const pinnedCards = loading
    ? Array.from({ length: pinnedSkeletonRows }, (_, index) => (
        <SkeletonCard key={index} index={index % STAGGER_LIMIT} />
      ))
    : pinned.map(renderCard)

  return (
    <div className={styles.table}>
      {pinnedCards.length > 0 && (
        <div className={cx(styles.list, styles.pinned)}>{pinnedCards}</div>
      )}

      <div className={styles.headerRow}>
        <span />
        {COLUMNS.map((column) => {
          const sort = column.sort
          const isActive = sort !== undefined && sort === sortField

          const content = (
            <>
              <span className={styles.headerLabel}>{t(column.label)}</span>
              {column.hint && (
                <span
                  className={styles.hint}
                  data-hint={t(column.hint)}
                  aria-hidden="true"
                  onClick={(event) => event.stopPropagation()}
                />
              )}
              {sort !== undefined &&
                (isActive && sortDirection === "asc" ? (
                  <ArrowUp className={styles.sortIcon} aria-hidden="true" />
                ) : (
                  <ArrowDown className={cx(styles.sortIcon, !isActive && styles.sortIconIdle)} aria-hidden="true" />
                ))}
            </>
          )

          if (sort === undefined) {
            return (
              <span key={column.id} className={styles.headerCell}>
                {content}
              </span>
            )
          }

          const className = cx(
            styles.headerCell,
            styles.sortable,
            isActive && styles.active,
            column.id === "status" && styles.headerDotOffset,
          )
          const label = t(column.label)
          const state = isActive
            ? t(sortDirection === "asc" ? "ui.sortedAsc" : "ui.sortedDesc", { label })
            : t("ui.sortColumn", { label })
          const announced = column.hint ? `${state}. ${t(column.hint)}` : state

          return (
            <button
              key={column.id}
              type="button"
              className={className}
              aria-label={announced}
              onClick={() => onSort(sort)}
            >
              {content}
            </button>
          )
        })}
        <span />
      </div>

      <div className={styles.sortBar}>
        <FilterButton variant="labeled" active={filtersActive} onClick={onOpenFilters} />

        <div className={styles.sortSelect}>
          <select
            className={styles.select}
            name="sort"
            value={sortField}
            aria-label={t("ui.sortBy")}
            onChange={(event) => onSort(event.target.value as SortField)}
          >
            {SORT_COLUMNS.map((column) => (
              <option key={column.id} value={column.sort}>
                {t(column.label)}
              </option>
            ))}
          </select>
          <ChevronDown className={styles.selectIcon} aria-hidden="true" />
        </div>

        <IconButton className={styles.direction} label={t("ui.sortDirection")} onClick={() => onSort(sortField)}>
          {sortDirection === "asc" ? (
            <ArrowUp className={styles.directionIcon} aria-hidden="true" />
          ) : (
            <ArrowDown className={styles.directionIcon} aria-hidden="true" />
          )}
        </IconButton>
      </div>

      <div className={styles.list}>
        {loading
          ? Array.from({ length: skeletonRows }, (_, index) => (
              <SkeletonCard key={index} index={index % STAGGER_LIMIT} />
            ))
          : rows.map(renderCard)}
      </div>
    </div>
  )
}
