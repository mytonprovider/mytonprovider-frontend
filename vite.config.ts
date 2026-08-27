import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import react from "@vitejs/plugin-react-swc"
import { defineConfig, loadEnv } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

const backgroundOf = (selector: string): string => {
  const tokens = readFileSync("src/styles/tokens.css", "utf8")
  const found = /--bg:\s*(#[0-9a-f]{3,8})/i.exec(tokens.slice(tokens.indexOf(selector)))
  if (!found) throw new Error(`no --bg under ${selector}`)
  return found[1]
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const siteUrl = env.VITE_SITE_URL || "https://mytonprovider.org"
  let base = "/"

  return {
    plugins: [
      react(),
      tsconfigPaths(),
      {
        name: "index-values",
        transformIndexHtml: (html) =>
          html
            .replaceAll("%SITE_URL%", siteUrl)
            .replaceAll("%BG_LIGHT%", backgroundOf(":root {"))
            .replaceAll("%BG_DARK%", backgroundOf('[data-theme="dark"] {')),
      },
      {
        name: "preload-fonts",
        enforce: "post",
        configResolved: (config) => {
          base = config.base
        },
        transformIndexHtml: (html, ctx) => ({
          html,
          tags: Object.keys(ctx.bundle ?? {})
            .filter((file) => /inter-(latin|cyrillic)-wght-normal-[^.]+\.woff2$/.test(file))
            .map((file) => ({
              tag: "link",
              attrs: { rel: "preload", as: "font", type: "font/woff2", crossorigin: "", href: `${base}${file}` },
              injectTo: "head-prepend" as const,
            })),
        }),
      },
    ],
    css: {
      modules: {
        generateScopedName: (name, filename) => {
          const file = filename.split("/").pop()?.replace(".module.css", "") ?? "styles"
          const hash = createHash("sha256").update(`${filename}:${name}`).digest("base64url").slice(0, 5)
          return `${file}_${name}__${hash}`
        },
      },
    },
    server: {
      host: true,
    },
  }
})
