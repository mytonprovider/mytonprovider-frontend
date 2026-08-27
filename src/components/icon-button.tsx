import type { ButtonHTMLAttributes, ReactNode } from "react"
import styles from "./icon-button.module.css"
import { cx } from "@/lib/cx"

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string
  size?: "xs" | "sm" | "md" | "lg"
  children: ReactNode
}

export const IconButton = ({ label, size = "md", className, children, ...rest }: IconButtonProps) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    className={cx(styles.button, styles[size], className)}
    {...rest}
  >
    {children}
  </button>
)
