import type { ComponentType } from "react"
import { BarChart2, Cpu, Globe, Info, Server } from "lucide-react"
import type { SectionId } from "@/types/model"

export const SECTION_ICONS: Record<SectionId, ComponentType<{ className?: string }>> = {
  provider: Info,
  hardware: Cpu,
  benchmarks: BarChart2,
  network: Globe,
  software: Server,
}
