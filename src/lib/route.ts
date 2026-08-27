import { useCallback, useEffect, useState } from "react"

const PUBKEY = /^[0-9a-f]{64}$/i

const OPENED = "provider"

export const pubkeyOf = (hash: string): string | null => {
  const candidate = hash.replace(/^#/, "")
  return PUBKEY.test(candidate) ? candidate.toLowerCase() : null
}

export const providerUrl = (pubkey: string): string =>
  `${window.location.origin}${import.meta.env.BASE_URL}#${pubkey}`

const readPubkey = (): string | null => pubkeyOf(window.location.hash)

const addressFor = (pubkey: string | null): string =>
  `${window.location.pathname}${window.location.search}${pubkey === null ? "" : `#${pubkey}`}`

export const useOpenProvider = (): [string | null, (pubkey: string | null) => void] => {
  const [pubkey, setPubkey] = useState<string | null>(readPubkey)

  useEffect(() => {
    const sync = () => {
      const current = readPubkey()
      if (current !== null && window.location.hash !== `#${current}`) {
        window.history.replaceState(window.history.state, "", addressFor(current))
      }
      setPubkey(current)
    }

    sync()
    window.addEventListener("popstate", sync)
    window.addEventListener("hashchange", sync)
    return () => {
      window.removeEventListener("popstate", sync)
      window.removeEventListener("hashchange", sync)
    }
  }, [])

  const open = useCallback((next: string | null) => {
    if (readPubkey() === next) {
      setPubkey(next)
      return
    }

    if (next === null && window.history.state === OPENED) {
      window.history.back()
      return
    }

    window.history.pushState(next === null ? null : OPENED, "", addressFor(next))
    setPubkey(next)
  }, [])

  return [pubkey, open]
}
