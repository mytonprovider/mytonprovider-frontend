import { useTranslation } from "react-i18next"
import {
  FieldGroup,
  FieldRow,
  GhostValue,
  Notice,
  Skeleton,
  skeletonClass,
  splitColumns,
  StatusCard,
  useCopyFeedback,
} from "@myton/ui"
import { reasonLabel } from "@/lib/model"
import type { ProviderDetail } from "@/types/model"
import styles from "./provider-details.module.css"

interface ProviderDetailsProps {
  detail: ProviderDetail
  loading?: boolean
}

export const ProviderDetails = ({ detail, loading = false }: ProviderDetailsProps) => {
  const { t } = useTranslation()
  const { copied: copiedKey, copy } = useCopyFeedback()
  // An empty column is still a grid item: it takes the first track and pushes a lone section into the second
  const columns = splitColumns(detail.sections, (section) => section.fields.length + 1).filter(
    (column) => column.length > 0,
  )

  return (
    <div className={styles.details} aria-hidden={loading ? "true" : undefined}>
      {detail.stale.map((signal) => (
        <Notice key={signal} tone="red">
          {t(`ui:stale.${signal}`)}
        </Notice>
      ))}
      <StatusCard
        loading={loading}
        tone={detail.status.tone}
        label={detail.status.label}
        ratio={detail.status.ratio}
        description={detail.description}
        reasons={detail.reasons}
        describe={(reason) => reasonLabel(reason, t)}
      />

      <div className={styles.groups}>
        {columns.map((column, index) => (
          <div key={index} className={styles.column}>
            {column.map((section) => (
              <FieldGroup key={section.id} title={section.title} className={styles.section}>
                {section.fields.map((field) =>
                  loading ? (
                    <FieldRow
                      key={field.label}
                      hidden
                      label={<span className={skeletonClass()}>{field.label}</span>}
                      value={<GhostValue sample={field.value} />}
                      mono={field.mono}
                      upper={field.uppercase}
                      trailing={
                        field.copy && (
                          <span className={styles.copySlot}>
                            <Skeleton round width="var(--icon-sm)" height="var(--icon-sm)" />
                          </span>
                        )
                      }
                    />
                  ) : (
                    <FieldRow
                      key={field.label}
                      label={field.label}
                      value={field.value}
                      title={field.title}
                      href={field.href}
                      mono={field.mono}
                      upper={field.uppercase}
                      tone={field.alert ? "red" : undefined}
                      copy={field.copy}
                      copied={copiedKey === field.copy}
                      onCopy={(value) => void copy(value)}
                    />
                  ),
                )}
              </FieldGroup>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
