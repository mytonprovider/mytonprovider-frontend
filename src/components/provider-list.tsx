import { useEffect, useRef, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Star } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Badge,
  Button,
  CopyButton,
  cx,
  DataRow,
  DataTable,
  DataTableHead,
  DataTableRows,
  FavoriteButton,
  FreeMark,
  GhostGlyph,
  GhostIcon,
  GhostValue,
  ShareButton,
  RankMark,
  Sheet,
  SheetFooter,
  ShortId,
  skeletonClass,
  SortColumn,
  SortList,
  useCompactStatus,
} from "@myton/ui"
import { fmt, GRAM, PAGE_SIZE, PROVIDER_SAMPLE, STATE_TONE } from "@myton/ui/domain"
import { pickLang } from "@myton/ui/i18n"
import { words } from "@myton/ui/locale"
import { providerUrl } from "@/lib/route"
import type { ProviderRow, SortDirection, SortField } from "@/types/model"
import { FilterButton } from "./filter-button"
import styles from "./provider-list.module.css"

type StatId = Exclude<SortField, "pubkey" | "status">

interface Column {
  id: SortField
  label: string
  hint?: string
}

const TABLE_COLUMNS = [
  "var(--control-md)",
  "auto",
  "auto",
  "minmax(4.4em, auto)",
  "auto",
  "minmax(3.8em, auto)",
  "minmax(5.2em, auto)",
  "minmax(5.4em, auto)",
  "minmax(6em, auto)",
  "minmax(8em, auto)",
  "var(--control-md)",
].join(" ")

const COLUMNS: Column[] = [
  { id: "pubkey", label: "ui:columns.pubkey" },
  { id: "rating", label: "ui:columns.rating" },
  { id: "status", label: "ui:columns.status", hint: "status.accessibleFilesHint" },
  { id: "uptime", label: "ui:columns.uptime", hint: "status.uptimeHint" },
  { id: "price", label: "ui:columns.price", hint: "status.priceHint" },
  { id: "freeSpace", label: "ui:columns.freeSpace" },
  { id: "workingTime", label: "ui:columns.workingTime" },
  { id: "location", label: "ui:columns.location" },
]

// Past a page the steps shrink, so the last row still lands within one page of steps
const staggerScale = (count: number): number => Math.min(1, PAGE_SIZE / Math.max(count, 1))

const KEY_PLACEHOLDER = "000000…000000"

const ORDER: Record<StatId, string> = {
  rating: styles.orderRating,
  uptime: styles.orderUptime,
  price: styles.orderPrice,
  freeSpace: styles.orderFreeSpace,
  workingTime: styles.orderWorkingTime,
  location: styles.orderLocation,
}

const STAT_COLUMNS = COLUMNS.filter(
  (column): column is Column & { id: StatId } => column.id !== "pubkey" && column.id !== "status",
)

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
  location: (row) => <span title={row.location}>{row.location}</span>,
}

interface CardProps {
  row: ProviderRow
  stagger: number
  fresh: boolean
  viewed: boolean
  favorite: boolean
  copied: boolean
  shared: boolean
  onToggleFavorite: (pubkey: string) => void
  onCopy: (pubkey: string) => void
  onShare: (pubkey: string) => void
  onOpen: (pubkey: string) => void
}

const WIDEST_RATIO = "100%"

const StatusCell = ({ status }: { status: ProviderRow["status"] }) => (
  <span className={styles.statusRow}>
    <span className={styles.statusLabel}>{status.label}</span>
    {status.ratio && <span className={styles.ratio}>{status.ratio}</span>}
  </span>
)

// Every status word with the widest share, so the badge holds one width down the column; on a phone the share is
// hidden
const useStatusReserve = (): ReactNode[] => {
  const { t } = useTranslation()
  return Object.keys(STATE_TONE).map((key) => (
    <span key={key} className={styles.statusRow}>
      {t(`ui:status.${key}`)}
      <span className={styles.ratio}>{WIDEST_RATIO}</span>
    </span>
  ))
}

const SkeletonCard = ({ index }: { index: number }) => {
  const { t, i18n } = useTranslation()
  const reserve = useStatusReserve()
  const time = words[pickLang(i18n.language)]
  const space = fmt.splitSpace(PROVIDER_SAMPLE.freeBytes)
  const rank = <RankMark rank={index + 1} className={skeletonClass()} />
  const free = <FreeMark percent={PROVIDER_SAMPLE.freePercent} className={skeletonClass()} />

  // The row's own parts with sample values hidden, so each column takes the width a loaded row gives it
  const values: Record<StatId, ReactNode> = {
    rating: (
      <>
        <GhostGlyph />
        <GhostValue vary sample={fmt.number(PROVIDER_SAMPLE.rating, 2)} />
      </>
    ),
    uptime: <GhostValue vary sample={fmt.percent(PROVIDER_SAMPLE.uptime)} />,
    price: (
      <>
        <GhostValue vary sample={fmt.price(PROVIDER_SAMPLE.price)} />
        <GhostValue sample={GRAM} className={styles.unit} />
      </>
    ),
    freeSpace: (
      <>
        <GhostValue vary sample={space.value} />
        <GhostValue sample={space.unit} className={styles.unit} />
        <span className={styles.tableMark}>
          <FreeMark percent={PROVIDER_SAMPLE.freePercent} variant="row" className={skeletonClass()} />
        </span>
      </>
    ),
    workingTime: <GhostValue vary sample={fmt.duration(PROVIDER_SAMPLE.workingTime, time.duration)} />,
    location: <GhostValue vary sample={PROVIDER_SAMPLE.country} />,
  }
  const captionMarks: Partial<Record<StatId, ReactNode>> = { rating: rank, freeSpace: free }

  return (
    <DataRow ghost className={styles.card}>
      <div className={styles.head}>
        <GhostIcon size="sm" className={styles.orderFavorite} />
        <span className={cx(styles.tableRank, styles.orderRank)}>
          <RankMark rank={index + 1} variant="row" className={skeletonClass()} />
        </span>
        <div className={cx(styles.key, styles.orderKey)}>
          <span className={skeletonClass(styles.keyText)}>{KEY_PLACEHOLDER}</span>
          <GhostIcon />
        </div>
        <Badge
          tone="gray"
          dot
          reserve={reserve}
          className={skeletonClass(cx(styles.status, styles.orderStatus))}
        >
          <StatusCell status={{ tone: "green", label: t("ui:status.stable"), ratio: WIDEST_RATIO }} />
        </Badge>

        <GhostIcon size="sm" className={styles.orderShare} />
      </div>

      <div className={styles.stats}>
        {STAT_COLUMNS.map((column) => (
          <div key={column.id} className={cx(styles.cell, ORDER[column.id])}>
            <span className={styles.label}>
              <span className={skeletonClass()}>{t(column.label)}</span>
              {captionMarks[column.id]}
            </span>
            <span className={styles.value}>{values[column.id]}</span>
          </div>
        ))}
      </div>
    </DataRow>
  )
}

// A card shows the marks in its captions; the table has its captions in the header, so the share follows the value
// and the rank leads the row
const Cell = ({
  id,
  label,
  mark,
  rowMark,
  children,
}: {
  id: StatId
  label: string
  mark?: ReactNode
  rowMark?: ReactNode
  children: ReactNode
}) => (
  <div className={cx(styles.cell, ORDER[id])}>
    <span className={styles.label}>
      {label}
      {mark}
    </span>
    <span className={styles.value}>
      {children}
      {rowMark && <span className={styles.tableMark}>{rowMark}</span>}
    </span>
  </div>
)

const CAPTION_MARKS: Partial<Record<StatId, (row: ProviderRow) => ReactNode>> = {
  rating: (row) => row.rank !== null && <RankMark rank={row.rank} />,
  freeSpace: (row) => row.freePercent !== null && <FreeMark percent={row.freePercent} />,
}

const ROW_MARKS: Partial<Record<StatId, (row: ProviderRow) => ReactNode>> = {
  freeSpace: (row) => row.freePercent !== null && <FreeMark percent={row.freePercent} variant="row" />,
}

const ProviderCard = ({
  row,
  stagger,
  fresh,
  viewed,
  favorite,
  copied,
  shared,
  onToggleFavorite,
  onCopy,
  onShare,
  onOpen,
}: CardProps) => {
  const { t } = useTranslation()
  const reserve = useStatusReserve()
  const openRef = useRef<HTMLButtonElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const compact = useCompactStatus(headRef)

  return (
    <DataRow
      onOpen={() => onOpen(row.pubkey)}
      label={`${t("table.providerDetails")} ${row.keyShort}`}
      openRef={openRef}
      viewed={viewed}
      className={cx(styles.card, fresh && styles.enter)}
      style={{ "--card-index": stagger } as React.CSSProperties}
    >
      <div ref={headRef} className={styles.head}>
        <FavoriteButton
          size="sm"
          active={favorite}
          label={`${t("ui.favorites")} ${row.keyShort}`}
          className={styles.orderFavorite}
          onToggle={() => onToggleFavorite(row.pubkey)}
        />

        <span className={cx(styles.tableRank, styles.orderRank)}>
          {row.rank !== null && <RankMark rank={row.rank} variant="row" />}
        </span>

        <div className={cx(styles.key, styles.orderKey)}>
          <button
            type="button"
            tabIndex={-1}
            className={styles.keyText}
            title={row.pubkey}
            onClick={() => {
              openRef.current?.focus()
              onOpen(row.pubkey)
            }}
          >
            <ShortId value={row.pubkey} />
          </button>
          <CopyButton
            value={row.pubkey}
            copied={copied}
            onCopy={onCopy}
            label={`${t("ui:ui.copy")} ${row.keyShort}`}
          />
        </div>

        <Badge
          tone={row.status.tone}
          dot
          compact={compact}
          reserve={reserve}
          className={cx(styles.status, styles.orderStatus)}
        >
          <StatusCell status={row.status} />
        </Badge>

        <ShareButton
          size="sm"
          shared={shared}
          label={`${t("ui.share")} ${row.keyShort}`}
          className={styles.orderShare}
          onShare={() => onShare(row.pubkey)}
        />
      </div>

      <div className={styles.stats}>
        {STAT_COLUMNS.map((column) => (
          <Cell
            key={column.id}
            id={column.id}
            label={t(column.label)}
            mark={CAPTION_MARKS[column.id]?.(row)}
            rowMark={ROW_MARKS[column.id]?.(row)}
          >
            {STAT_VALUES[column.id](row)}
          </Cell>
        ))}
      </div>
    </DataRow>
  )
}

interface ProviderListProps {
  rows: ProviderRow[]
  favorites: string[]
  copiedKey: string | null
  sortField: SortField
  sortDirection: SortDirection
  filtersActive: boolean
  loading: boolean
  skeletonRows: number
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
  favorites,
  copiedKey,
  sortField,
  sortDirection,
  filtersActive,
  loading,
  skeletonRows,
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
  const [sortOpen, setSortOpen] = useState(false)
  const sortLabel = t(`ui:sortFields.${sortField}`)

  useEffect(() => {
    for (const row of rows) seen.current.add(row.pubkey)
  }, [rows])

  const scale = staggerScale(rows.length)

  const renderCard = (row: ProviderRow, index: number) => (
    <ProviderCard
      key={row.pubkey}
      row={row}
      stagger={index * scale}
      fresh={!seen.current.has(row.pubkey)}
      viewed={row.pubkey === viewedKey}
      favorite={favorites.includes(row.pubkey)}
      copied={copiedKey === row.pubkey}
      shared={copiedKey === providerUrl(row.pubkey)}
      onToggleFavorite={onToggleFavorite}
      onCopy={onCopy}
      onShare={onShare}
      onOpen={onOpen}
    />
  )

  return (
    <DataTable framed columns={TABLE_COLUMNS} className={styles.table}>
      <DataTableHead className={styles.headerRow}>
        <span />
        <span />
        {COLUMNS.map((column) => (
          <SortColumn
            key={column.id}
            label={t(column.label)}
            hint={column.hint && t(column.hint)}
            active={column.id === sortField}
            direction={sortDirection}
            onSort={() => onSort(column.id)}
            className={column.id === "status" ? styles.statusHead : undefined}
          />
        ))}
        <span />
      </DataTableHead>

      <div className={styles.sortBar}>
        <Button
          variant="secondary"
          aria-label={`${t("ui.sortBy")}: ${sortLabel}, ${t(`ui:sortDirection.${sortDirection}`)}`}
          onClick={() => setSortOpen(true)}
        >
          {sortDirection === "asc" ? (
            <ArrowUp className={styles.sortGlyph} aria-hidden="true" />
          ) : (
            <ArrowDown className={styles.sortGlyph} aria-hidden="true" />
          )}
          <span className={styles.sortLabel}>{sortLabel}</span>
        </Button>

        <FilterButton variant="labeled" active={filtersActive} onClick={onOpenFilters} />
      </div>

      <Sheet open={sortOpen} title={t("ui.sortBy")} onClose={() => setSortOpen(false)}>
        <div className={styles.sortSheet}>
          <SortList
            options={COLUMNS.map((column) => ({ value: column.id, label: t(`ui:sortFields.${column.id}`) }))}
            value={sortField}
            direction={sortDirection}
            directionLabel={t(`ui:sortDirection.${sortDirection}`)}
            onPick={onSort}
          />
        </div>
        <SheetFooter>
          <Button variant="primary" size="xl" onClick={() => setSortOpen(false)}>
            {t("buttons.done")}
          </Button>
        </SheetFooter>
      </Sheet>

      <DataTableRows className={styles.list}>
        {loading
          ? Array.from({ length: skeletonRows }, (_, index) => <SkeletonCard key={index} index={index} />)
          : rows.map(renderCard)}
      </DataTableRows>
    </DataTable>
  )
}
