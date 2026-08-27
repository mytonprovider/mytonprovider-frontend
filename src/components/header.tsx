import { Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useTheme } from "@/lib/theme"
import { scrollToTop } from "@/lib/dom"
import logo from "./logo.svg"
import { IconButton } from "./icon-button"
import styles from "./header.module.css"

export default function Header() {
  const { t, i18n } = useTranslation()
  const { dark, toggle } = useTheme()

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a
          href="#top"
          className={styles.brand}
          aria-label={t("siteTitle")}
          onClick={(event) => {
            event.preventDefault()
            scrollToTop()
          }}
        >
          <img className={styles.logo} src={logo} alt="" width={36} height={36} />
          <span className={styles.title}>{t("siteTitle")}</span>
        </a>

        <span className={styles.spacer} />

        <IconButton
          size="lg"
          label={t("ui.language")}
          className={styles.language}
          onClick={() => void i18n.changeLanguage(i18n.language === "en" ? "ru" : "en")}
        >
          {i18n.language === "en" ? "RU" : "EN"}
        </IconButton>

        <IconButton
          size="lg"
          label={t("ui.theme")}
          onClick={(event) => toggle(event.currentTarget.getBoundingClientRect())}
        >
          {dark ? <Sun className={styles.icon} aria-hidden="true" /> : <Moon className={styles.icon} aria-hidden="true" />}
        </IconButton>
      </div>
    </header>
  )
}
