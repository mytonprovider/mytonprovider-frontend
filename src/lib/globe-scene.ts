import {
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshPhongMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Timer,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from "three"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import type { GlobeNode } from "@/types/globe"
import { linkNodes, providersAt } from "@/lib/globe-nodes"
import { reducedMotion } from "@/lib/dom"
import land from "./globe-land.json"
import landShape from "./globe-land-mesh.json"

export interface GlobeFrame {
  radius: number
  centerY: number
  tilt: number
  visible: number
  glow: number
}

interface GlobeTip {
  title: string
  region: string
}

interface GlobeOptions {
  frame: (width: number) => GlobeFrame
  describe: (id: string) => GlobeTip | null
  classes: { tooltip: string; title: string; region: string; visible: string }
}

export interface GlobeScene {
  covers: (event: PointerEvent | MouseEvent) => boolean
  setNodes: (nodes: GlobeNode[]) => void
  setInteractive: (interactive: boolean) => void
  kick: (radians: number) => void
  refresh: () => void
  dispose: () => void
}

interface Arc {
  start: GlobeNode
  end: GlobeNode
  long: boolean
  pause: number
  phase: number
}

interface Marker {
  id: string
  lng: number
  born: number
  mesh: Mesh<CylinderGeometry, MeshBasicMaterial>
  wave: Mesh<CircleGeometry, MeshBasicMaterial> | null
  normal: Vector3
  offset: number
  size: number
  height: number
}

interface Press {
  id: number
  touch: boolean
  startX: number
  startY: number
  x: number
  y: number
  drag: boolean
}

interface Tooltip {
  element: HTMLDivElement
  title: HTMLDivElement
  region: HTMLDivElement
  id: string | null
  width: number
  height: number
}

const LIGHT_INTENSITY = { ambient: 0.74, key: 1.8, back: 0.7 }

const LAYER_OPACITY = {
  globe: 0.88,
  rim: 0.18,
  plasma: 0.32,
  atmosphere: 0.6,
  land: 0.45,
  coast: 0.47,
  grid: 0.1,
  wave: 0.1,
}

const GLOBE = {
  rotationSpeed: 0.16,
  tiltX: 0.7,
  tiltZ: 0.06,
  startLng: 40,
  cameraFov: 44,
  maxDpr: 1.75,
  frameBudget: 1 / 30,
  revealFrames: 8,
  revealDelay: 0.28,
  radius: 100,
  sphereSegments: 90,
  gridStep: 10,
  gridSample: 2,
  landAltitude: 0.006,
  occluderScale: 0.985,
  rimPower: 1.55,
  rimGlow: 1.6,
  atmosphereAltitude: 0.15,
  atmosphereCoefficient: 0.1,
  atmospherePower: 3.5,
  atmosphereGlow: 0.7,
  atmosphereRadius: 220,
  waveMaxRadius: 3.4,
  waveSpeed: 0.6,
  wavePeriod: 1.8,
  waveFadeStart: 0.58,
  waveFadePower: 1.6,
  markerSize: 2,
  markerAltitude: 0.004,
  waveAltitude: 0.002,
  markerRestHeight: 0.035,
  markerHoverAltitude: 0.008,
  markerScaleStep: 0.3,
  markerScaleMax: 2.8,
  markerGrow: 0.45,
  markerSpread: 0.5,
  arcAltitude: 0.18,
  arcMinAltitude: 0.02,
  arcLongAltitude: 0.14,
  arcFullHeightDistance: 120,
  arcStroke: 0.3,
  arcSides: 6,
  arcStep: 2,
  arcMinSteps: 12,
  arcDashShare: 0.38,
  arcDashMin: 20,
  arcDashMax: 90,
  arcPauseMin: 1.5,
  arcPauseMax: 4,
  arcDashFade: 10,
  arcSpeed: 27,
  arcFadeLength: 0.06,
  arcFadePower: 1.6,
  arcOcclusionSoftness: 22,
  arcSeed: 11235813,
  tooltipCycle: 4.2,
  tooltipMinGap: 210,
  tooltipMinOpacity: 0.5,
  tooltipZone: 0.656,
  tooltipKeepZone: 0.735,
  hitRadius: 34,
  grabScale: 1.03,
  tapSlop: 8,
  dragSpin: 0.006,
  dragTilt: 0.005,
  dragRoll: 0.00125,
  dragLimit: 0.85,
}

const TOKENS = {
  globe: "--globe-sphere",
  emissive: "--globe-sphere-light",
  key: "--globe-key-light",
  back: "--globe-back-light",
  rim: "--globe-rim",
  plasma: "--globe-plasma",
  plasmaHot: "--globe-plasma-hot",
  atmosphere: "--globe-atmosphere",
  land: "--globe-land",
  coast: "--globe-coast",
  grid: "--globe-grid",
  arc: "--globe-arc",
  wave: "--globe-wave",
  marker: "--globe-marker",
  glow: "--globe-glow",
}

const RIM_SHADER = {
  vertex: `
    varying vec3 vWorldNormal;
    varying vec3 vViewDirection;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vViewDirection = normalize(cameraPosition - worldPosition.xyz);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }`,
  fragment: `
    uniform vec3 glowColor;
    uniform float rimOpacity;
    uniform float rimPower;
    varying vec3 vWorldNormal;
    varying vec3 vViewDirection;
    void main() {
      float facing = clamp(dot(normalize(vWorldNormal), normalize(vViewDirection)), 0.0, 1.0);
      gl_FragColor = vec4(glowColor, pow(1.0 - facing, rimPower) * rimOpacity);
    }`,
}

const ATMOSPHERE_SHADER = {
  vertex: `
    uniform float hollowRadius;
    varying vec3 vViewNormal;
    varying vec3 vWorldPosition;
    varying float vHollow;
    void main() {
      vViewNormal = normalize(normalMatrix * normal);
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vec4 center = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
      vHollow = acos(dot(normalize(viewPosition.xyz), normalize(center.xyz))) - atan(hollowRadius / length(center.xyz));
      gl_Position = projectionMatrix * viewPosition;
    }`,
  fragment: `
    uniform vec3 color;
    uniform float coefficient;
    uniform float power;
    uniform float opacity;
    varying vec3 vViewNormal;
    varying vec3 vWorldPosition;
    varying float vHollow;
    void main() {
      if (vHollow < 0.0) discard;
      vec3 toVertex = normalize((viewMatrix * vec4(vWorldPosition - cameraPosition, 0.0)).xyz);
      gl_FragColor = vec4(color, pow(coefficient + dot(vViewNormal, toVertex), power) * opacity);
    }`,
}

const PLASMA_SHADER = {
  vertex: `
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    varying vec3 vViewNormal;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      vViewNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }`,
  fragment: `
    uniform vec3 glowColor;
    uniform vec3 hotColor;
    uniform float glowOpacity;
    uniform float time;
    varying vec3 vWorldNormal;
    varying vec3 vWorldPosition;
    varying vec3 vViewNormal;
    const float arcCenter = 2.28;
    const float arcSpan = 0.62;
    const float glowWidth = 0.48;
    const float noiseAmount = 0.32;
    const float flowSpeed = 0.85;
    float angleDistance(float a, float b) { return abs(atan(sin(a - b), cos(a - b))); }
    void main() {
      vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
      float horizon = 1.0 - clamp(dot(normalize(vWorldNormal), viewDirection), 0.0, 1.0);
      float rimBand = smoothstep(1.0 - glowWidth, 1.0, horizon);
      float rimCore = smoothstep(1.0 - glowWidth * 0.38, 1.0, horizon);
      float screenAngle = atan(vViewNormal.y, vViewNormal.x);
      float arcMask = 1.0 - smoothstep(arcSpan * 0.5, arcSpan + 0.66, angleDistance(screenAngle, arcCenter));
      float upperBias = smoothstep(-0.42, 0.28, vViewNormal.y);
      float leftBias = 1.0 - smoothstep(0.38, 0.92, vViewNormal.x);
      float waveA = sin(screenAngle * 28.0 + time * flowSpeed * 2.1);
      float waveB = sin(vViewNormal.y * 34.0 - time * flowSpeed * 3.7);
      float plasma = 1.0 + (waveA * waveB) * noiseAmount;
      float filament = pow(max(0.0, sin((screenAngle - arcCenter) * 18.0 - time * flowSpeed * 4.2)), 5.0) * noiseAmount;
      float mask = arcMask * upperBias * leftBias;
      float alpha = clamp(glowOpacity * mask * (rimBand * plasma + filament * rimCore), 0.0, 1.0);
      gl_FragColor = vec4(mix(glowColor, hotColor, clamp(filament + rimCore * 0.36, 0.0, 0.75)), alpha);
    }`,
}

const ARC_SHADER = {
  vertex: `
    attribute float aDelay;
    attribute float aLength;
    attribute float aDash;
    attribute float aGap;
    varying float vRel;
    varying float vDelay;
    varying float vLength;
    varying float vDash;
    varying float vGap;
    varying vec3 vWorldPosition;
    void main() {
      vRel = uv.x;
      vDelay = aDelay;
      vLength = aLength;
      vDash = aDash;
      vGap = aGap;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }`,
  fragment: `
    uniform vec3 uColor;
    uniform float uTime;
    uniform float uBorn;
    uniform float uSpeed;
    uniform float uDashFade;
    uniform float uEndFade;
    uniform float uEndPower;
    uniform float uGlobeRadius;
    uniform float uOcclusionSoftness;
    varying float vRel;
    varying float vDelay;
    varying float vLength;
    varying float vDash;
    varying float vGap;
    varying vec3 vWorldPosition;
    void main() {
      float head = (uTime - uBorn - vDelay) * uSpeed;
      float position = mod(vRel * vLength - head + vDash, vDash + vGap);
      float fade = min(uDashFade, vDash * 0.45);
      float dash = position < vDash ? smoothstep(0.0, fade, position) * (1.0 - smoothstep(vDash - fade, vDash, position)) : 0.0;
      float ends = pow(smoothstep(0.0, 1.0, min(vRel, 1.0 - vRel) / uEndFade), uEndPower);
      vec3 rayDirection = normalize(vWorldPosition - cameraPosition);
      float b = dot(cameraPosition, rayDirection);
      float h = b * b - (dot(cameraPosition, cameraPosition) - uGlobeRadius * uGlobeRadius);
      float occlusion = 1.0;
      if (h > 0.0) {
        float hidden = length(vWorldPosition - cameraPosition) - (-b - sqrt(h));
        occlusion = 1.0 - smoothstep(0.0, uOcclusionSoftness, hidden);
      }
      gl_FragColor = vec4(uColor, dash * ends * occlusion);
    }`,
}

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value))
const smooth = (value: number): number => {
  const x = clamp(value, 0, 1)
  return x * x * (3 - 2 * x)
}
const toRad = (deg: number): number => (deg * Math.PI) / 180

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let x = Math.imul(seed ^ (seed >>> 15), seed | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}

const arcsOf = (nodes: GlobeNode[]): Arc[] => {
  const random = seeded(GLOBE.arcSeed)
  return linkNodes(nodes, random).map(({ from, to, long }) => {
    const [start, end] = random() < 0.5 ? [from, to] : [to, from]
    return {
      start,
      end,
      long,
      pause: GLOBE.arcPauseMin + (GLOBE.arcPauseMax - GLOBE.arcPauseMin) * random(),
      phase: random(),
    }
  })
}

const toSurface = (lat: number, lng: number, altitude = 0): Vector3 => {
  const phi = toRad(90 - lat)
  const theta = toRad(90 - lng)
  const r = GLOBE.radius * (1 + altitude)
  return new Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta))
}

const graticule = (): number[][][] => {
  const range = (from: number, to: number, step: number) =>
    Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => from + i * step)
  const meridian = (lng: number, edge: number) => range(-edge, edge, GLOBE.gridSample).map((lat) => [lng, lat])
  const parallel = (lat: number) => range(-180, 180, GLOBE.gridSample).map((lng) => [lng, lat])
  return [
    ...range(-180, 180 - GLOBE.gridStep, GLOBE.gridStep).map((lng) => meridian(lng, lng % 90 === 0 ? 90 : 80)),
    ...range(-80, 80, GLOBE.gridStep).map(parallel),
  ]
}

const segmentsOf = (lines: number[][][], altitude: number): number[] =>
  lines.flatMap((line) =>
    line.slice(1).flatMap((point, i) => [
      ...toSurface(line[i][1], line[i][0], altitude).toArray(),
      ...toSurface(point[1], point[0], altitude).toArray(),
    ]),
  )

const isMesh = (object: Object3D): object is Mesh => object instanceof Mesh
const isLines = (object: Object3D): object is LineSegments => object instanceof LineSegments

const disposeTree = (root: Object3D): void => {
  root.traverse((object) => {
    if (!isMesh(object) && !isLines(object)) return
    object.geometry.dispose()
    for (const material of [object.material].flat()) material.dispose()
  })
}

export const mountGlobe = (host: HTMLElement, options: GlobeOptions): GlobeScene => {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
  renderer.setClearColor(0x000000, 0)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, GLOBE.maxDpr))
  renderer.setScissorTest(true)
  host.prepend(renderer.domElement)

  const reduced = reducedMotion()
  const scene = new Scene()
  const camera = new PerspectiveCamera(GLOBE.cameraFov, 1, 0.1, 2000)
  const keyLight = new DirectionalLight(0xffffff, LIGHT_INTENSITY.key)
  keyLight.position.set(-1.4, 1.1, 0)
  const backLight = new DirectionalLight(0xffffff, LIGHT_INTENSITY.back)
  backLight.position.set(1.6, -0.6, -1.2)
  scene.add(new AmbientLight(0xffffff, LIGHT_INTENSITY.ambient), keyLight, backLight)

  const axis = new Group()
  scene.add(axis)

  const globe = new Group()
  axis.add(globe)
  const radius = GLOBE.radius

  const globeMaterial = new MeshPhongMaterial({
    shininess: 0,
    transparent: true,
    opacity: LAYER_OPACITY.globe,
    depthWrite: false,
  })
  const sphere = new Mesh(new SphereGeometry(radius, GLOBE.sphereSegments, GLOBE.sphereSegments / 2), globeMaterial)
  sphere.renderOrder = -1
  const gridMaterial = new LineBasicMaterial({ transparent: true, opacity: LAYER_OPACITY.grid })
  const grid = new LineSegments(
    new BufferGeometry().setAttribute("position", new Float32BufferAttribute(segmentsOf(graticule(), 0), 3)),
    gridMaterial,
  )
  globe.add(sphere, grid)

  const occluder = new Mesh(
    new SphereGeometry(1, 96, 48),
    new MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
  )
  occluder.renderOrder = -100
  occluder.frustumCulled = false
  occluder.scale.setScalar(radius * GLOBE.occluderScale)
  globe.add(occluder)

  const glowMaterial = (shader: { vertex: string; fragment: string }, uniforms: ShaderMaterial["uniforms"]) =>
    new ShaderMaterial({
      uniforms,
      vertexShader: shader.vertex,
      fragmentShader: shader.fragment,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    })
  const rimColor = new Color()
  const plasmaColor = new Color()
  const plasmaHot = new Color()
  const plasmaTime = { value: 0 }
  const rimMaterial = glowMaterial(RIM_SHADER, {
    glowColor: { value: rimColor },
    rimOpacity: { value: LAYER_OPACITY.rim },
    rimPower: { value: GLOBE.rimPower },
  })
  const plasmaMaterial = glowMaterial(PLASMA_SHADER, {
    glowColor: { value: plasmaColor },
    hotColor: { value: plasmaHot },
    glowOpacity: { value: LAYER_OPACITY.plasma },
    time: plasmaTime,
  })
  const rim = new Mesh(new SphereGeometry(1, 128, 64), rimMaterial)
  rim.renderOrder = 1
  rim.scale.setScalar(radius * 1.006)
  const plasma = new Mesh(new SphereGeometry(1, 96, 48), plasmaMaterial)
  plasma.renderOrder = 2
  plasma.scale.setScalar(radius * 1.026)
  axis.add(rim, plasma)

  const landMaterial = new MeshBasicMaterial({
    transparent: true,
    opacity: LAYER_OPACITY.land,
    depthWrite: false,
    side: DoubleSide,
  })
  const landMesh = new Mesh(
    new BufferGeometry()
      .setAttribute("position", new Float32BufferAttribute(landShape.positions, 3))
      .setIndex(landShape.indices),
    landMaterial,
  )
  landMesh.scale.setScalar(radius * (1 + GLOBE.landAltitude))

  const coastMaterial = new LineBasicMaterial({ transparent: true, opacity: LAYER_OPACITY.coast, depthWrite: false })
  const coasts = new LineSegments(
    new BufferGeometry().setAttribute("position", new Float32BufferAttribute(segmentsOf(land.flat(), GLOBE.landAltitude), 3)),
    coastMaterial,
  )
  globe.add(landMesh, coasts)

  const markerRadius = GLOBE.markerSize * 0.38
  const markerBase = radius * (1 + GLOBE.markerAltitude)
  const markerLifted = clamp(GLOBE.markerHoverAltitude * radius, GLOBE.markerRestHeight, 1.15)
  const markerScale = (count: number) => clamp(1 + Math.log2(count) * GLOBE.markerScaleStep, 1, GLOBE.markerScaleMax)
  const markerGeometry = new CylinderGeometry(1, 1, 1, 36, 1, false)
  const waveGeometry = new CircleGeometry(1, 70)
  const layer = new Group()
  globe.add(layer)

  const tooltips: Tooltip[] = Array.from({ length: 3 }, () => {
    const element = document.createElement("div")
    const title = document.createElement("div")
    const region = document.createElement("div")
    element.className = options.classes.tooltip
    title.className = options.classes.title
    region.className = options.classes.region
    element.append(title, region)
    host.append(element)
    return { element, title, region, id: null, width: 0, height: 0 }
  })

  let markers: Marker[] = []
  const timer = new Timer()
  const arcColor = new Color()
  const arcTime = { value: 0 }
  const arcBorn = { value: 0 }
  const arcMaterial = new ShaderMaterial({
    uniforms: {
      uColor: { value: arcColor },
      uTime: arcTime,
      uBorn: arcBorn,
      uSpeed: { value: GLOBE.arcSpeed },
      uDashFade: { value: GLOBE.arcDashFade },
      uEndFade: { value: GLOBE.arcFadeLength },
      uEndPower: { value: GLOBE.arcFadePower },
      uGlobeRadius: { value: radius * GLOBE.occluderScale },
      uOcclusionSoftness: { value: GLOBE.arcOcclusionSoftness },
    },
    vertexShader: ARC_SHADER.vertex,
    fragmentShader: ARC_SHADER.fragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const arcMesh = new Mesh(new BufferGeometry(), arcMaterial)
  globe.add(arcMesh)

  const atmosphereColor = new Color()
  const atmospherePower = { value: GLOBE.atmospherePower }
  const atmosphere = new Mesh(
    new SphereGeometry(radius * (1 + GLOBE.atmosphereAltitude), GLOBE.sphereSegments, GLOBE.sphereSegments / 2),
    new ShaderMaterial({
      uniforms: {
        color: { value: atmosphereColor },
        coefficient: { value: GLOBE.atmosphereCoefficient },
        power: atmospherePower,
        opacity: { value: LAYER_OPACITY.atmosphere },
        hollowRadius: { value: radius },
      },
      vertexShader: ATMOSPHERE_SHADER.vertex,
      fragmentShader: ATMOSPHERE_SHADER.fragment,
      transparent: true,
      depthWrite: false,
      side: BackSide,
    }),
  )
  globe.add(atmosphere)
  let colors = { wave: "#ffffff", marker: "#ffffff" }
  let glow = 1
  let interactive = false
  let changed = true
  let hoveredId: string | null = null
  let overSphere = false
  let spin = -toRad(GLOBE.startLng)
  let kick = 0
  let globePx = 0
  const center = { x: 0, y: 0 }
  const tilt = { pitch: 0, roll: 0 }
  let press: Press | null = null
  let rect = host.getBoundingClientRect()

  const applyTheme = () => {
    const style = getComputedStyle(host)
    const token = (name: string) => style.getPropertyValue(name).trim()
    globeMaterial.color.set(token(TOKENS.globe))
    globeMaterial.emissive.set(token(TOKENS.emissive))
    keyLight.color.set(token(TOKENS.key))
    backLight.color.set(token(TOKENS.back))
    rimColor.set(token(TOKENS.rim))
    plasmaColor.set(token(TOKENS.plasma))
    plasmaHot.set(token(TOKENS.plasmaHot))
    landMaterial.color.set(token(TOKENS.land))
    coastMaterial.color.set(token(TOKENS.coast))
    gridMaterial.color.set(token(TOKENS.grid))
    atmosphereColor.set(token(TOKENS.atmosphere))
    arcColor.set(token(TOKENS.arc)).convertLinearToSRGB()
    colors = { wave: token(TOKENS.wave), marker: token(TOKENS.marker) }
    glow = Number(token(TOKENS.glow))
    for (const marker of markers) {
      marker.mesh.material.color.set(colors.marker)
      marker.wave?.material.color.set(colors.wave)
    }
    changed = true
  }

  const arcGeometry = (arc: Arc) => {
    const from = toSurface(arc.start.lat, arc.start.lng).normalize()
    const to = toSurface(arc.end.lat, arc.end.lng).normalize()
    const axis = new Vector3().crossVectors(from, to).normalize()
    const span = from.angleTo(to)
    const sweep = arc.long ? span - 2 * Math.PI : span
    const height = arc.long
      ? GLOBE.arcLongAltitude
      : clamp((GLOBE.arcAltitude * span) / toRad(GLOBE.arcFullHeightDistance), GLOBE.arcMinAltitude, GLOBE.arcAltitude)
    const steps = Math.max(GLOBE.arcMinSteps, Math.ceil(Math.abs(sweep) / toRad(GLOBE.arcStep)))
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps
      return from
        .clone()
        .applyAxisAngle(axis, sweep * t)
        .multiplyScalar(radius * (1 + height * Math.sin(Math.PI * t)))
    })
    const curve = new CatmullRomCurve3(points)
    const geometry = new TubeGeometry(curve, steps * 2, GLOBE.arcStroke / 2, GLOBE.arcSides, false)
    const length = curve.getLength()
    const dash = clamp(length * GLOBE.arcDashShare, GLOBE.arcDashMin, GLOBE.arcDashMax)
    const gap = length + arc.pause * GLOBE.arcSpeed
    const count = geometry.getAttribute("position").count
    const attribute = (value: number) => new BufferAttribute(new Float32Array(count).fill(value), 1)
    geometry.setAttribute("aDelay", attribute(arc.phase * arc.pause))
    geometry.setAttribute("aLength", attribute(length))
    geometry.setAttribute("aDash", attribute(dash))
    geometry.setAttribute("aGap", attribute(gap))
    return geometry
  }

  const setNodes = (nodes: GlobeNode[]) => {
    for (const marker of markers) {
      for (const mesh of [marker.mesh, marker.wave]) {
        if (!mesh) continue
        layer.remove(mesh)
        mesh.material.dispose()
      }
    }

    markers = nodes.map((node, i) => {
      const normal = toSurface(node.lat, node.lng).normalize()
      const mesh = new Mesh(markerGeometry, new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }))
      mesh.material.toneMapped = false
      mesh.material.color.set(colors.marker)
      mesh.renderOrder = 1000
      mesh.frustumCulled = false
      mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), normal)
      layer.add(mesh)

      const wave = reduced
        ? null
        : new Mesh(waveGeometry, new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }))
      if (wave) {
        wave.material.toneMapped = false
        wave.material.color.set(colors.wave)
        wave.renderOrder = 990
        wave.frustumCulled = false
        wave.position.copy(normal).multiplyScalar(radius * (1 + GLOBE.waveAltitude))
        wave.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal)
        layer.add(wave)
      }

      return {
        id: node.id,
        lng: node.lng,
        born: Number.POSITIVE_INFINITY,
        mesh,
        wave,
        normal,
        offset: i / nodes.length,
        size: markerRadius * markerScale(providersAt(node)),
        height: GLOBE.markerRestHeight,
      }
    })

    const arcParts = reduced ? [] : arcsOf(nodes).map(arcGeometry)
    arcMesh.geometry.dispose()
    arcMesh.geometry = (arcParts.length > 0 && mergeGeometries(arcParts)) || new BufferGeometry()
    for (const part of arcParts) part.dispose()
    stamp(timer.getElapsed())
    for (const tip of tooltips) tip.id = null
    changed = true
  }

  const stamp = (start: number) => {
    arcBorn.value = start
    const order = [...markers].sort((a, b) => a.lng - b.lng)
    order.forEach((marker, rank) => {
      marker.born = start + (order.length > 1 ? (rank / (order.length - 1)) * GLOBE.markerSpread : 0)
    })
  }

  const grown = (born: number, time: number) => (reduced ? 1 : smooth((time - born) / GLOBE.markerGrow))

  const toCamera = new Vector3()
  const worldPos = new Vector3()
  const projected = new Vector3()
  const limbFade = (dot: number) => smooth((dot - 0.055) / (0.18 - 0.055))
  const waveFade = (x: number) =>
    x <= GLOBE.waveFadeStart
      ? 1
      : (1 - smooth((x - GLOBE.waveFadeStart) / (1 - GLOBE.waveFadeStart))) ** GLOBE.waveFadePower
  const facing = (normal: Vector3) => worldPos.copy(normal).transformDirection(layer.matrixWorld).dot(toCamera)

  const updateMarkers = (time: number) => {
    for (const marker of markers) {
      const grow = grown(marker.born, time)
      const target = marker.id === hoveredId ? markerLifted : GLOBE.markerRestHeight
      marker.height = reduced ? target : marker.height + (target - marker.height) * 0.24
      marker.mesh.position.copy(marker.normal).multiplyScalar(markerBase + marker.height * 0.5)
      marker.mesh.scale.set(marker.size * grow, marker.height * grow, marker.size * grow)
      const fade = limbFade(facing(marker.normal))
      marker.mesh.material.opacity = fade
      marker.mesh.visible = fade > 0.002 && grow > 0.001
    }
  }

  const updateWaves = (time: number) => {
    const maxRadius = GLOBE.waveMaxRadius * ((2 * Math.PI * radius) / 360)
    for (const { wave, normal, offset, born } of markers) {
      if (!wave) continue
      const phase = ((time * GLOBE.waveSpeed + offset * GLOBE.wavePeriod) % GLOBE.wavePeriod) / GLOBE.wavePeriod
      const size = Math.max(0.01, maxRadius * smooth(phase))
      wave.scale.set(size, size, 1)
      wave.material.opacity =
        LAYER_OPACITY.wave * smooth(phase / 0.12) * waveFade(phase) * limbFade(facing(normal)) * grown(born, time)
      wave.visible = wave.material.opacity > 0.002
    }
  }

  const screenOf = (mesh: Object3D) => {
    mesh.getWorldPosition(projected).project(camera)
    return { x: (projected.x * 0.5 + 0.5) * rect.width, y: (-projected.y * 0.5 + 0.5) * rect.height }
  }
  const frontMarkers = () =>
    markers
      .filter((marker) => marker.mesh.visible && marker.mesh.material.opacity > 0.6)
      .map((marker) => ({ marker, ...screenOf(marker.mesh) }))

  let autoMarkers: Marker[] = []
  let autoSlot = -1
  const pickAuto = (slot: number): Marker[] => {
    const zone = globePx * GLOBE.tooltipZone
    const candidates = frontMarkers()
      .filter((item) => Math.hypot(item.x - center.x, item.y - center.y) < zone)
      .sort((a, b) => b.marker.size - a.marker.size)
    const pool = candidates
      .slice(0, Math.max(4, Math.ceil(candidates.length / 2)))
      .map((item, index) => ({ item, order: (index * 37 + slot * 17) % 997 }))
      .sort((a, b) => a.order - b.order)
      .map(({ item }) => item)
    const chosen: typeof pool = []
    for (const item of pool) {
      if (chosen.length >= tooltips.length - 1) break
      if (chosen.every((other) => Math.hypot(other.x - item.x, other.y - item.y) >= GLOBE.tooltipMinGap)) chosen.push(item)
    }
    return chosen.map((item) => item.marker)
  }

  const fillTooltip = (tip: Tooltip, id: string): boolean => {
    const text = options.describe(id)
    if (!text) return false
    if (tip.id === id && tip.title.textContent === text.title && tip.region.textContent === text.region) return true
    tip.id = id
    tip.title.textContent = text.title
    tip.region.textContent = text.region
    tip.width = tip.element.offsetWidth
    tip.height = tip.element.offsetHeight
    return true
  }

  const updateTooltips = (time: number) => {
    if (!interactive) {
      for (const tip of tooltips) tip.element.classList.remove(options.classes.visible)
      return
    }
    const slot = Math.floor(time / GLOBE.tooltipCycle)
    if (slot !== autoSlot) {
      autoSlot = slot
      autoMarkers = reduced ? [] : pickAuto(slot)
    }
    const hovered = markers.find((marker) => marker.id === hoveredId)
    const anchor = hovered && screenOf(hovered.mesh)
    const apart = (marker: Marker) => {
      if (!anchor) return true
      const point = screenOf(marker.mesh)
      return Math.hypot(point.x - anchor.x, point.y - anchor.y) >= GLOBE.tooltipMinGap
    }
    const wanted = hovered
      ? [hovered, ...autoMarkers.filter((marker) => marker !== hovered && apart(marker))]
      : autoMarkers
    const keepZone = globePx * GLOBE.tooltipKeepZone
    tooltips.forEach((tip, i) => {
      const marker = wanted[i]
      const point = marker && screenOf(marker.mesh)
      const inZone = point && Math.hypot(point.x - center.x, point.y - center.y) < keepZone
      if (
        !marker ||
        !point ||
        marker.mesh.material.opacity < GLOBE.tooltipMinOpacity ||
        (marker !== hovered && !inZone) ||
        !fillTooltip(tip, marker.id)
      ) {
        tip.element.classList.remove(options.classes.visible)
        return
      }
      const left = clamp(point.x - tip.width / 2, 8, rect.width - tip.width - 8)
      const top = clamp(point.y - tip.height - 16, 8, rect.height - tip.height - 8)
      tip.element.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`
      tip.element.style.setProperty("--tail-x", `${clamp(point.x - left, 12, tip.width - 12).toFixed(1)}px`)
      tip.element.classList.add(options.classes.visible)
    })
  }

  const pointer = new Vector2()
  const raycaster = new Raycaster()
  const origin = new Vector3()
  const overGlobe = (event: PointerEvent | MouseEvent) => {
    rect = host.getBoundingClientRect()
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
    return raycaster.ray.distanceSqToPoint(origin) <= (radius * GLOBE.grabScale) ** 2
  }
  const markerAt = (event: PointerEvent): string | null => {
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    let best: string | null = null
    let bestDistance = GLOBE.hitRadius
    for (const item of frontMarkers()) {
      const distance = Math.hypot(item.x - x, item.y - y)
      if (distance < bestDistance) {
        bestDistance = distance
        best = item.marker.id
      }
    }
    return best
  }

  const onPointerMove = (event: PointerEvent) => {
    const drag = press?.drag && event.pointerId === press.id ? press : null
    overSphere = overGlobe(event)
    hoveredId = drag ? null : markerAt(event)
    changed = true
    host.style.cursor = drag ? "grabbing" : hoveredId != null ? "pointer" : overSphere ? "grab" : ""
    if (!drag) return
    event.preventDefault()
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    drag.x = event.clientX
    drag.y = event.clientY
    spin += dx * GLOBE.dragSpin
    if (!drag.touch) tilt.pitch = clamp(tilt.pitch + dy * GLOBE.dragTilt, -GLOBE.dragLimit, GLOBE.dragLimit)
    tilt.roll = clamp(tilt.roll - dx * GLOBE.dragRoll, -GLOBE.dragLimit, GLOBE.dragLimit)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || press) return
    host.setPointerCapture(event.pointerId)
    const drag = overGlobe(event)
    press = {
      id: event.pointerId,
      touch: event.pointerType === "touch",
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      drag,
    }
    if (drag) event.preventDefault()
  }

  const onRelease = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
    const tapped = Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < GLOBE.tapSlop
    if (event.pointerType === "touch") {
      hoveredId = event.type === "pointerup" && tapped ? markerAt(event) : hoveredId
      overSphere = false
      changed = true
    }
    press = null
  }

  const onPointerLeave = (event: PointerEvent) => {
    if (press?.drag || event.pointerType === "touch") return
    hoveredId = null
    overSphere = false
    changed = true
  }

  host.addEventListener("pointermove", onPointerMove)
  host.addEventListener("pointerdown", onPointerDown)
  host.addEventListener("pointerup", onRelease)
  host.addEventListener("pointercancel", onRelease)
  host.addEventListener("lostpointercapture", onRelease)
  host.addEventListener("pointerleave", onPointerLeave)

  const resize = () => {
    rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    renderer.setSize(rect.width, rect.height, false)
    camera.aspect = rect.width / rect.height
    for (const tip of tooltips) tip.id = null
    changed = true
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)

  const applyView = () => {
    if (!rect.width || !rect.height) return
    const { width, height } = rect
    const view = options.frame(width)
    const half = Math.tan(toRad(GLOBE.cameraFov / 2))
    camera.position.z = radius / Math.sin(Math.atan((view.radius / (height / 2)) * half))
    camera.setViewOffset(width, height, 0, height / 2 - view.centerY, width, height)
    globePx = view.radius
    center.x = width / 2
    center.y = view.centerY
    axis.rotation.set(GLOBE.tiltX * view.tilt + tilt.pitch, 0, GLOBE.tiltZ + tilt.roll)
    const visible = clamp(Math.ceil(view.visible), 0, height)
    renderer.setScissor(0, height - visible, width, visible)
    atmospherePower.value = GLOBE.atmospherePower * Math.max(1, view.radius / GLOBE.atmosphereRadius)
    rimMaterial.uniforms.rimOpacity.value = LAYER_OPACITY.rim * (1 + GLOBE.rimGlow * glow * view.glow)
    atmosphere.material.uniforms.opacity.value = LAYER_OPACITY.atmosphere * (1 + GLOBE.atmosphereGlow * glow * view.glow)
  }

  let frame = 0
  let onScreen = true
  let lost = false
  let compiled = false
  let disposed = false
  let lastRender = Number.NEGATIVE_INFINITY
  let rendered = 0
  let revealed = false

  const loop = (timestamp: number) => {
    frame = requestAnimationFrame(loop)
    timer.update(timestamp)
    const time = timer.getElapsed()
    const dragging = press?.drag ?? false
    const settling = (!dragging && Math.abs(tilt.roll) > 1e-4) || (!interactive && Math.abs(tilt.pitch) > 1e-4)
    if (!dragging) tilt.roll *= 0.9
    if (!interactive) tilt.pitch *= 0.9
    const moving = dragging || settling
    if (reduced && revealed && !moving && !changed) return
    const budget = interactive || moving || changed ? 0 : GLOBE.frameBudget
    if (time - lastRender < budget - 0.002) return
    const delta = Math.min(time - lastRender, 0.1)
    lastRender = time
    changed = false

    if (!reduced && !dragging && !overSphere) spin += delta * GLOBE.rotationSpeed
    if (kick) {
      const step = kick * Math.min(1, delta * 2.6)
      spin += step
      kick = Math.abs(kick - step) < 1e-4 ? 0 : kick - step
      changed = kick !== 0
    }
    applyView()
    globe.rotation.set(0, spin, 0)
    axis.updateMatrixWorld()
    toCamera.copy(camera.position).normalize()
    if (!reduced) plasmaTime.value = time
    arcTime.value = time
    updateWaves(time)
    updateMarkers(time)
    updateTooltips(time)
    renderer.render(scene, camera)
    rendered += 1
    if (!revealed && rendered >= GLOBE.revealFrames && time >= GLOBE.revealDelay) {
      revealed = true
      host.toggleAttribute("data-ready", true)
      stamp(time)
    }
  }

  const sync = () => {
    const active = compiled && !disposed && onScreen && !document.hidden && !lost
    if (active && !frame) {
      timer.reset()
      lastRender = Number.NEGATIVE_INFINITY
      frame = requestAnimationFrame(loop)
    } else if (!active && frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }

  const intersection = new IntersectionObserver(
    ([entry]) => {
      onScreen = entry?.isIntersecting ?? false
      sync()
    },
    { rootMargin: "240px 0px" },
  )
  intersection.observe(host)
  document.addEventListener("visibilitychange", sync)

  const onContextLost = (event: Event) => {
    event.preventDefault()
    lost = true
    sync()
  }
  const onContextRestored = () => {
    lost = false
    changed = true
    sync()
  }
  renderer.domElement.addEventListener("webglcontextlost", onContextLost)
  renderer.domElement.addEventListener("webglcontextrestored", onContextRestored)

  const themeObserver = new MutationObserver(applyTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })

  applyTheme()
  resize()
  const parallel = renderer.extensions.has("KHR_parallel_shader_compile")
  void (parallel ? renderer.compileAsync(scene, camera) : Promise.resolve()).then(() => {
    compiled = true
    sync()
  })

  return {
    covers: overGlobe,
    setNodes,
    setInteractive: (value) => {
      interactive = value
      if (!value) hoveredId = null
      changed = true
    },
    kick: (radians) => {
      kick = reduced ? 0 : radians
      changed = true
    },
    refresh: () => {
      changed = true
    },
    dispose: () => {
      disposed = true
      cancelAnimationFrame(frame)
      frame = 0
      resizeObserver.disconnect()
      intersection.disconnect()
      themeObserver.disconnect()
      document.removeEventListener("visibilitychange", sync)
      host.removeEventListener("pointermove", onPointerMove)
      host.removeEventListener("pointerdown", onPointerDown)
      host.removeEventListener("pointerup", onRelease)
      host.removeEventListener("pointercancel", onRelease)
      host.removeEventListener("lostpointercapture", onRelease)
      host.removeEventListener("pointerleave", onPointerLeave)
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost)
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored)
      disposeTree(scene)
      markerGeometry.dispose()
      waveGeometry.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      for (const tip of tooltips) tip.element.remove()
    },
  }
}
