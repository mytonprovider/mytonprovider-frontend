import { useTranslation } from "react-i18next"
import { SiteHeader, useSiteTheme } from "@myton/ui"
import { pickLang } from "@myton/ui/i18n"
import { chooseLanguage } from "@/i18n"
import { THEME_KEY } from "@/lib/storage"
import logo from "./logo.svg"

export const Header = () => {
  const { t, i18n } = useTranslation()
  const { dark, toggle } = useSiteTheme(THEME_KEY)

  return (
    <SiteHeader
      title={t("siteTitle")}
      logo={logo}
      language={pickLang(i18n.language)}
      onLanguage={chooseLanguage}
      dark={dark}
      onToggleTheme={toggle}
    />
  )
}
