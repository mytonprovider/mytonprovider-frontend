export const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches

export const scrollToTop = (): void => {
  window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" })
}

export const copyText = async (value: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const host = document.querySelector("dialog[open]") ?? document.body
    const area = document.createElement("textarea")
    area.value = value
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.opacity = "0"
    host.append(area)
    area.select()

    let done = false
    try {
      done = document.execCommand("copy")
    } catch {
      done = false
    }

    area.remove()
    return done
  }
}
