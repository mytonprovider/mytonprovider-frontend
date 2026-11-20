import "@myton/ui/fonts.css"
import "@myton/ui/styles.css"
import "@myton/ui/site.css"
import "@/styles/tokens.css"

import { StrictMode } from "react"
import ReactDOM from "react-dom/client"
import { initI18n } from "@/i18n"
import { App } from "@/app"

initI18n()

const root = document.getElementById("root")
if (root) {
  ReactDOM.createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
