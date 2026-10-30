import type { Provider } from "./provider"

export interface GlobePlaces {
  zones: Record<string, number[]>
  cities: Record<string, Record<string, number[]>>
}

export interface GlobeSpot {
  city: string | null
  country: string
  providers: Provider[]
}

export interface GlobeNode {
  id: string
  lat: number
  lng: number
  spots: GlobeSpot[]
}

export interface GlobeLink {
  from: GlobeNode
  to: GlobeNode
  long: boolean
}

export interface GlobeSummary {
  providers: number
  countries: number
  cities: number
}
