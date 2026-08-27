import type { Ref } from "react"
import { useTranslation } from "react-i18next"
import { GithubIcon, ProviderIcon, TelegramIcon } from "./brand-icons"
import styles from "./footer.module.css"

const LINKS = [
  {
    label: "footer.becomeProvider",
    href: "https://github.com/igroman787/mytonprovider/blob/master/README.md",
    icon: <ProviderIcon className={styles.icon} />,
  },
  {
    label: "footer.supportChat",
    href: "https://t.me/mytonprovider_chat",
    icon: <TelegramIcon className={styles.icon} />,
  },
  {
    label: "footer.github",
    href: "https://github.com/mytonprovider",
    icon: <GithubIcon className={styles.icon} />,
  },
]

export default function Footer({ ref }: { ref?: Ref<HTMLElement> }) {
  const { t } = useTranslation()

  return (
    <footer ref={ref} className={styles.footer}>
      <nav className={styles.inner}>
        {LINKS.map((link) => (
          <a
            key={link.href}
            className={styles.link}
            href={link.href}
            aria-label={t(link.label)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.icon}
            <span className={styles.label}>{t(link.label)}</span>
          </a>
        ))}
      </nav>
    </footer>
  )
}
