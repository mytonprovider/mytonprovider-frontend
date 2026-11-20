import { useTranslation } from "react-i18next"
import { GithubIcon, ProviderIcon, SiteFooter, TelegramIcon } from "@myton/ui"

export const Footer = () => {
  const { t } = useTranslation()

  return (
    <SiteFooter
      links={[
        {
          label: t("footer.becomeProvider"),
          href: "https://github.com/igroman787/mytonprovider/blob/master/README.md",
          icon: ProviderIcon,
        },
        { label: t("footer.supportChat"), href: "https://t.me/mytonprovider_chat", icon: TelegramIcon },
        { label: t("footer.github"), href: "https://github.com/mytonprovider", icon: GithubIcon },
      ]}
    />
  )
}
