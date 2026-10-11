import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { ProviderDetail, SectionId } from "@/types/model"
import { CopyButton } from "./copy-button"
import { SECTION_ICONS } from "./section-icons"
import styles from "./provider-details.module.css"
import { cx } from "@/lib/cx"

interface ProviderDetailsProps {
  detail: ProviderDetail
  copiedKey: string | null
  onCopy: (value: string) => void
}

interface SectionProps {
  id: SectionId
  title: string
  children: ReactNode
}

const Section = ({ id, title, children }: SectionProps) => {
  const Icon = SECTION_ICONS[id]

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <Icon className={styles.sectionIcon} aria-hidden="true" />
        <span className={styles.sectionName}>{title}</span>
      </h2>

      <div className={styles.rows}>{children}</div>
    </section>
  )
}

export const ProviderDetails = ({ detail, copiedKey, onCopy }: ProviderDetailsProps) => {
  const { t } = useTranslation()
  const [showLegend, setShowLegend] = useState(false)

  return (
    <div className={styles.details}>
      <div className={styles.statusCard} data-tone={detail.status.tone}>
        {detail.breakdown.length > 0 && (
          <div className={styles.bar}>
            {detail.breakdown.map((item) => (
              <span
                key={item.id}
                className={styles.barSegment}
                data-tone={item.tone}
                style={{ flexGrow: item.count }}
                title={`${item.label} • ${item.count} (${item.percent})`}
              />
            ))}
          </div>
        )}

        <div className={styles.statusBody}>
          <div className={styles.statusMain}>
            <div className={styles.statusLabel}>
              <span className={styles.dot} />
              <span className={styles.statusText}>{detail.status.label}</span>
              {detail.checks && <span className={styles.statusRatio}>{detail.checks.percent}</span>}
            </div>
            <p className={styles.description}>{detail.description}</p>
          </div>

          {detail.checks && (
            <div className={styles.checks}>
              <div className={styles.checksRow}>
                <span className={styles.checksLabel}>{t("status.filesAvailable")}</span>
                <span className={styles.checksValue}>
                  <span className={styles.badgeValid} data-tone={detail.checks.tone}>
                    {detail.checks.valid}
                  </span>
                  <span className={styles.slash}>/</span>
                  <span className={styles.badgeTotal}>{detail.checks.total}</span>
                </span>
              </div>
              <button type="button" className={styles.toggle} onClick={() => setShowLegend((open) => !open)}>
                {t(showLegend ? "status.hideDetails" : "status.showDetails")}
              </button>
            </div>
          )}
        </div>

        {showLegend && detail.breakdown.length > 0 && (
          <div className={styles.legend}>
            {detail.breakdown.map((item) => (
              <div key={item.id} className={styles.legendRow} data-tone={item.tone}>
                <span className={styles.legendDot} />
                <span className={styles.legendLabel}>{item.label}</span>
                <span className={styles.spacer} />
                <span className={styles.legendMeta}>
                  {item.count} • {item.percent}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.groups}>
        {detail.sections.map((section) => (
          <Section key={section.id} id={section.id} title={section.title}>
            {section.fields.map((field) => (
              <div key={field.label} className={styles.row}>
                <span className={styles.rowLabel}>{field.label}</span>
                <span className={styles.spacer} />
                {field.href ? (
                  <a
                    className={cx(styles.rowValue, field.mono && styles.mono)}
                    href={field.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={field.title}
                  >
                    {field.value}
                  </a>
                ) : (
                  <span
                    className={cx(
                      styles.rowValue,
                      field.uppercase && styles.uppercase,
                      field.alert && styles.alert,
                      field.mono && styles.mono,
                    )}
                    title={field.title}
                  >
                    {field.value}
                  </span>
                )}
                {field.copy && (
                  <CopyButton
                    value={field.copy}
                    copied={copiedKey === field.copy}
                    onCopy={onCopy}
                    className={styles.copy}
                  />
                )}
              </div>
            ))}
          </Section>
        ))}
      </div>
    </div>
  )
}

interface SkeletonSection {
  id: SectionId
  label: string
  rows: [string, string][]
  copies: number
}

const RATIO_PLACEHOLDER = "100%"

const SKELETON_SECTIONS: SkeletonSection[] = [
  {
    id: "provider",
    label: "provider.providerTitle",
    copies: 2,
    rows: [
      ["table.publicKey", "7.8em"],
      ["provider.address", "7.8em"],
      ["provider.span", "6.7em"],
      ["provider.maxBagSize", "3em"],
      ["provider.workingTime", "3.6em"],
      ["provider.lastOnline", "5.4em"],
      ["provider.lastTelemetry", "5.4em"],
      ["provider.location", "6.4em"],
      ["provider.uptime", "3.1em"],
      ["provider.rating", "2.5em"],
      ["provider.price", "4.3em"],
    ],
  },
  {
    id: "software",
    label: "provider.software",
    copies: 2,
    rows: [["provider.storageGitHash", "3.8em"], ["provider.providerGitHash", "4.3em"]],
  },
  {
    id: "benchmarks",
    label: "provider.benchmarks",
    copies: 0,
    rows: [["provider.diskReadSpeed", "4.9em"], ["provider.diskWriteSpeed", "5em"]],
  },
  {
    id: "hardware",
    label: "provider.hardware",
    copies: 0,
    rows: [
      ["provider.cpuName", "11em"],
      ["provider.cpuNumber", "0.7em"],
      ["provider.cpuIsVirtual", "1.8em"],
      ["provider.ram", "6.5em"],
      ["provider.totalProviderSpace", "7.5em"],
    ],
  },
  {
    id: "network",
    label: "provider.network",
    copies: 0,
    rows: [
      ["provider.speedtestDownload", "5.2em"],
      ["provider.speedtestUpload", "5em"],
      ["provider.speedtestPing", "3.7em"],
      ["provider.country", "1.4em"],
      ["provider.isp", "6.8em"],
    ],
  },
]

const line = (width: string) => ({ "--shape-w": width }) as React.CSSProperties

export const ProviderDetailsSkeleton = () => {
  const { t } = useTranslation()

  return (
    <div className={styles.details} aria-hidden="true">
      <div className={styles.statusCard}>
        <div className={styles.bar}>
          <span className={cx(styles.barSegment, styles.shape)} style={{ flexGrow: 1 }} />
        </div>

        <div className={styles.statusBody}>
          <div className={styles.statusMain}>
            <div className={cx(styles.statusLabel, styles.shape, styles.statusShape)}>
              <span className={styles.dot} />
              <span className={styles.statusText}>{t("status.unstable")}</span>
              <span className={styles.statusRatio}>{RATIO_PLACEHOLDER}</span>
            </div>
            <p className={styles.description}>
              <span className={cx(styles.shape, styles.shapeText)}>{t("status.reason.0")}</span>
            </p>
          </div>

          <div className={styles.checks}>
            <div className={styles.checksRow}>
              <span className={cx(styles.checksLabel, styles.shape, styles.shapeText)}>
                {t("status.filesAvailable")}
              </span>
              <span className={cx(styles.badgeTotal, styles.shape, styles.shapeLine)} style={line("4em")}>
                &nbsp;
              </span>
            </div>
            <span className={cx(styles.toggle, styles.shape, styles.shapeText)}>{t("status.showDetails")}</span>
          </div>
        </div>
      </div>

      <div className={styles.groups}>
        {SKELETON_SECTIONS.map((section) => (
          <Section key={section.id} id={section.id} title={t(section.label)}>
            {section.rows.map(([row, width], index) => (
              <div key={row} className={styles.row}>
                <span className={cx(styles.rowLabel, styles.shape, styles.shapeLabel)}>{t(row)}</span>
                <span className={styles.spacer} />
                <span className={cx(styles.rowValue, styles.shape, styles.shapeLine)} style={line(width)}>
                  &nbsp;
                </span>
                {index < section.copies && (
                  <span className={styles.copySlot}>
                    <span className={cx(styles.shape, styles.shapeCopy)} />
                  </span>
                )}
              </div>
            ))}
          </Section>
        ))}
      </div>
    </div>
  )
}
