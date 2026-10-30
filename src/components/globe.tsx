import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { MouseEvent, PointerEvent } from "react"
import { useTranslation } from "react-i18next"
import type { GlobeNode, GlobePlaces, GlobeSpot } from "@/types/globe"
import type { Provider } from "@/types/provider"
import type { GlobeFrame, GlobeScene, mountGlobe } from "@/lib/globe-scene"
import { providersAt, summarize, toNodes } from "@/lib/globe-nodes"
import { reducedMotion, scrollToTop } from "@/lib/dom"
import styles from "./globe.module.css"

type Phase = "rest" | "opening" | "open" | "closing"

interface Metrics {
  narrow: boolean
  width: number
  content: number
  viewport: number
  top: number
}

interface Loaded {
  mount: typeof mountGlobe
  places: GlobePlaces
}

interface GlobeProps {
  providers: Provider[]
  ready: boolean
}

const SPAN = 0.7
const OVERLAP = 56
const OPEN_MS = 1000
const CLOSE_MS = 560
const HOVER_MS = 520
const OPEN_KICK = 0.9
const CLOSE_KICK = 0.35

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value))
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const easeOut = (t: number): number => 1 - (1 - t) ** 5
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

const overlapOf = (m: Metrics): number => (m.narrow ? Math.round(OVERLAP * 0.6) : OVERLAP)
const riseOf = (m: Metrics): number => (m.narrow ? 100 : 140)
const gapOf = (m: Metrics): number => (m.narrow ? 44 : 76)
const fadeOf = (m: Metrics, progress: number): number => (m.narrow ? lerp(80, 36, progress) : lerp(110, 48, progress))

const horizonOf = (m: Metrics): { radius: number; height: number } => {
  const chord = (SPAN * (m.narrow ? m.width : m.content)) / 2
  if (m.narrow) {
    const radius = chord * 1.1
    const depth = radius - Math.sqrt(radius * radius - chord * chord)
    return { radius, height: Math.round(gapOf(m) + depth + overlapOf(m) + 12) }
  }
  const depth = 300 - gapOf(m)
  return { radius: (chord * chord + depth * depth) / (2 * depth), height: 300 + overlapOf(m) }
}

const openHeightOf = (m: Metrics): number => Math.round(clamp(m.viewport - m.top - 12, m.narrow ? 400 : 480, 960))

const frameOf = (m: Metrics, progress: number, hover: number, band: number, width: number): GlobeFrame => {
  const rest = horizonOf(m)
  const room = openHeightOf(m) - overlapOf(m) - 44
  const rise = riseOf(m)
  return {
    radius: lerp(rest.radius, Math.min(width * 0.44, (room - 24) * 0.47), progress),
    centerY: lerp(rise + gapOf(m) + rest.radius, rise + room / 2 + 4, progress),
    tilt: lerp(0.12, 1, progress),
    visible: rise + band,
    glow: hover * (1 - progress),
  }
}

const placeOf = (spot: GlobeSpot): string => (spot.city ? `${spot.city}, ${spot.country}` : spot.country)

const spotsOf = (node: GlobeNode): GlobeSpot[] =>
  [...node.spots].sort((a, b) => b.providers.length - a.providers.length || Number(b.city !== null) - Number(a.city !== null))

export const Globe = ({ providers, ready }: GlobeProps) => {
  const { t } = useTranslation()

  const [wanted, setWanted] = useState(ready)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failed, setFailed] = useState(false)
  const [phase, setPhaseState] = useState<Phase>("rest")

  const bandRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<GlobeScene | null>(null)
  const metrics = useRef<Metrics>({ narrow: false, width: 0, content: 0, viewport: 0, top: 0 })
  const phaseRef = useRef<Phase>("rest")
  const progress = useRef(0)
  const hover = useRef(0)
  const hot = useRef(false)
  const frames = useRef({ main: 0, hover: 0 })
  const bandHeight = useRef(0)

  if (ready && !wanted) setWanted(true)

  const nodes = useMemo(() => (loaded ? toNodes(providers, loaded.places) : []), [providers, loaded])
  const summary = useMemo(() => summarize(nodes), [nodes])

  const nodesRef = useRef(nodes)
  const tRef = useRef(t)
  useEffect(() => {
    nodesRef.current = nodes
    tRef.current = t
  }, [nodes, t])

  const setPhase = (next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }

  const measure = useCallback(() => {
    const band = bandRef.current
    const stage = stageRef.current
    if (!band || !stage) return

    const main = band.parentElement
    const padding = main ? parseFloat(getComputedStyle(main).paddingLeft) : 0
    const contentMax = parseFloat(getComputedStyle(band).getPropertyValue("--content-max")) || band.clientWidth
    metrics.current = {
      narrow: window.innerWidth < 640,
      width: window.innerWidth,
      content: Math.min(band.clientWidth - padding * 2, contentMax),
      viewport: window.innerHeight,
      top: band.getBoundingClientRect().top + window.scrollY,
    }
    const m = metrics.current
    band.style.setProperty("--overlap", `${overlapOf(m)}px`)
    stage.style.setProperty("--rise", `${riseOf(m)}px`)
    stage.style.height = `${Math.max(openHeightOf(m), horizonOf(m).height) + riseOf(m)}px`
  }, [])

  const layout = useCallback(() => {
    const band = bandRef.current
    const stage = stageRef.current
    if (!band || !stage) return

    const m = metrics.current
    const p = progress.current
    const height = Math.round(lerp(horizonOf(m).height, openHeightOf(m), p))
    band.style.height = `${height}px`
    bandHeight.current = height
    stage.style.setProperty("--cut", `${height + riseOf(m)}px`)
    stage.style.setProperty("--fade", `${fadeOf(m, p)}px`)
    sceneRef.current?.refresh()
  }, [])

  const animate = useCallback(
    (slot: "main" | "hover", from: number, to: number, ms: number, ease: (t: number) => number, set: (v: number) => void) =>
      new Promise<void>((resolve) => {
        cancelAnimationFrame(frames.current[slot])
        if (reducedMotion() || ms <= 0) {
          set(to)
          resolve()
          return
        }
        const start = performance.now()
        const step = (now: number) => {
          const k = clamp((now - start) / ms, 0, 1)
          set(lerp(from, to, ease(k)))
          if (k < 1) frames.current[slot] = requestAnimationFrame(step)
          else resolve()
        }
        frames.current[slot] = requestAnimationFrame(step)
      }),
    [],
  )

  const setHot = useCallback(
    (next: boolean) => {
      if (next === hot.current) return
      hot.current = next
      bandRef.current?.toggleAttribute("data-hot", next)
      void animate("hover", hover.current, next ? 1 : 0, HOVER_MS, easeOut, (value) => {
        hover.current = value
        sceneRef.current?.refresh()
      })
    },
    [animate],
  )

  const settle = useCallback(
    async (target: 0 | 1, ms: number, ease: (t: number) => number) => {
      const moving: Phase = target === 1 ? "opening" : "closing"
      setPhase(moving)
      await animate("main", progress.current, target, ms, ease, (value) => {
        progress.current = value
        layout()
      })
      if (phaseRef.current !== moving) return
      if (target === 1) {
        setPhase("open")
        sceneRef.current?.setInteractive(true)
        return
      }
      setPhase("rest")
    },
    [animate, layout],
  )

  const open = useCallback(async () => {
    if (phaseRef.current !== "rest" && phaseRef.current !== "closing") return
    if (window.scrollY > metrics.current.top) scrollToTop(metrics.current.top)
    setHot(false)
    sceneRef.current?.kick(OPEN_KICK)
    await settle(1, OPEN_MS, easeOut)
  }, [settle, setHot])

  const close = useCallback(async () => {
    if (phaseRef.current === "rest" || phaseRef.current === "closing") return
    sceneRef.current?.setInteractive(false)
    sceneRef.current?.kick(CLOSE_KICK)
    await settle(0, CLOSE_MS, easeInOut)
  }, [settle])

  useEffect(() => {
    const band = bandRef.current
    if (!band || !wanted) return

    let cancelled = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        Promise.all([import("@/lib/globe-scene"), import("@/lib/globe-places.json")])
          .then(([scene, places]) => {
            if (!cancelled) setLoaded({ mount: scene.mountGlobe, places: places.default })
          })
          .catch(() => {
            if (!cancelled) setFailed(true)
          })
      },
      { rootMargin: "200px" },
    )
    observer.observe(band)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [wanted])

  useLayoutEffect(() => {
    measure()
    layout()
    const onResize = () => {
      if (window.innerWidth === metrics.current.width) return
      measure()
      layout()
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [measure, layout])

  useEffect(() => {
    const stage = stageRef.current
    if (!loaded || !stage) return

    let scene: GlobeScene
    try {
      scene = loaded.mount(stage, {
        frame: (width) =>
          frameOf(metrics.current, progress.current, hover.current, bandHeight.current, width),
        describe: (id) => {
          const node = nodesRef.current.find((item) => item.id === id)
          if (!node) return null
          const count = providersAt(node)
          return {
            title: `${count} ${tRef.current("globe.providers", { count })}`,
            region: spotsOf(node)
              .map(placeOf)
              .join(" · "),
          }
        },
        classes: {
          tooltip: styles.tooltip,
          title: styles.tooltipTitle,
          region: styles.tooltipRegion,
          visible: styles.tooltipVisible,
        },
      })
    } catch {
      setFailed(true)
      return
    }
    sceneRef.current = scene
    return () => {
      sceneRef.current = null
      scene.dispose()
    }
  }, [loaded])

  useEffect(() => {
    sceneRef.current?.setNodes(nodes)
  }, [nodes])

  useEffect(() => {
    const opened = () => phaseRef.current === "open" || phaseRef.current === "opening"

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && phaseRef.current !== "rest") void close()
    }
    let lastY = window.scrollY
    const onScroll = () => {
      if (window.scrollY > lastY + 2 && opened()) void close()
      lastY = window.scrollY
    }

    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onScroll)
    }
  }, [close])

  useEffect(() => {
    const current = frames.current
    return () => {
      cancelAnimationFrame(current.main)
      cancelAnimationFrame(current.hover)
    }
  }, [])

  if (failed) return null

  const overGlobe = (event: MouseEvent<HTMLElement>): boolean => sceneRef.current?.covers(event.nativeEvent) ?? false

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") setHot(phaseRef.current === "rest" && overGlobe(event))
  }

  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (sceneRef.current && (event.detail === 0 || overGlobe(event))) void open()
  }

  const onBandClick = (event: MouseEvent<HTMLElement>) => {
    if (phaseRef.current === "open" && !overGlobe(event)) void close()
  }

  const stats = [
    ["providers", summary.providers],
    ["countries", summary.countries],
    ["cities", summary.cities],
  ] as const

  return (
    <section
      ref={bandRef}
      className={styles.band}
      data-state={phase}
      aria-label={t("globe.label")}
      onClick={onBandClick}
    >
      <div ref={stageRef} className={styles.stage} />

      {phase === "rest" && (
        <button
          type="button"
          className={styles.opener}
          aria-label={t("globe.open")}
          aria-expanded={false}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHot(false)}
          onClick={onClick}
        />
      )}

      <p className={styles.stats}>
        {stats.map(([key, count]) => (
          <span key={key} className={styles.stat}>
            <b>{count}</b> {t(`globe.${key}`, { count })}
          </span>
        ))}
      </p>
    </section>
  )
}
