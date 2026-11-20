import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import react from "@vitejs/plugin-react-swc"
import { defineConfig, loadEnv, searchForWorkspaceRoot } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

const uiSrc = process.env.UI_SRC

const tokensFile = uiSrc
  ? `${uiSrc}/src/styles/tokens.css`
  : createRequire(import.meta.url).resolve("@myton/ui/tokens.css")

const blockOf = (tokens: string, selector: string): string => {
  const start = tokens.indexOf(selector)
  return start < 0 ? "" : tokens.slice(start, tokens.indexOf("}", start))
}

const tokenIn = (block: string, name: string): string | undefined =>
  new RegExp(`(?<![\\w-])--${name}:\\s*([^;]+);`).exec(block)?.[1].trim()

const backgroundOf = (selector: string): string => {
  const tokens = readFileSync(tokensFile, "utf8")
  const own = blockOf(tokens, selector)
  const root = blockOf(tokens, ":root {")
  const resolve = (value: string, seen: Set<string>): string => {
    const ref = /^var\(--([\w-]+)\)$/.exec(value)
    if (!ref || seen.has(ref[1])) return value
    return resolve(tokenIn(own, ref[1]) ?? tokenIn(root, ref[1]) ?? "", seen.add(ref[1]))
  }
  const found = resolve("var(--bg)", new Set())
  if (!/^#[0-9a-f]{3,8}$/i.test(found)) throw new Error(`no hex --bg under ${selector}`)
  return found
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const siteUrl = env.VITE_SITE_URL || "https://mytonprovider.org"
  let base = "/"

  return {
    resolve: {
      alias: uiSrc
        ? [
            { find: /^@myton\/ui$/, replacement: `${uiSrc}/src/index.ts` },
            { find: /^@myton\/ui\/domain$/, replacement: `${uiSrc}/src/domain/index.ts` },
            { find: /^@myton\/ui\/locale$/, replacement: `${uiSrc}/src/locale/index.ts` },
            { find: /^@myton\/ui\/styles\.css$/, replacement: `${uiSrc}/src/styles/index.css` },
            { find: /^@myton\/ui\/site\.css$/, replacement: `${uiSrc}/src/styles/site.css` },
            { find: /^@myton\/ui\/fonts\.css$/, replacement: `${uiSrc}/src/styles/fonts.css` },
            { find: /^@myton\/ui\/i18n$/, replacement: `${uiSrc}/src/i18n/index.ts` },
            { find: /^@myton\/ui\/text\.module\.css$/, replacement: `${uiSrc}/src/styles/text.module.css` },
            { find: /^@myton\/ui\/motion\.module\.css$/, replacement: `${uiSrc}/src/styles/motion.module.css` },
          ]
        : [],
      dedupe: ["react", "react-dom", "i18next", "react-i18next"],
    },
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
    build: {
      chunkSizeWarningLimit: 900,
    },
    server: {
      host: true,
      fs: { allow: [searchForWorkspaceRoot(process.cwd()), ...(uiSrc ? [uiSrc] : [])] },
    },
  }
})
