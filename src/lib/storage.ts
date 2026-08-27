export const THEME_KEY = "mtp_theme"
export const LANGUAGE_KEY = "mtp_lang"
export const FAVORITES_KEY = "mtp_favorites"

export const readStored = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const writeStored = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    return
  }
}

export const removeStored = (key: string): void => {
  try {
    localStorage.removeItem(key)
  } catch {
    return
  }
}

export const readStoredStrings = (key: string): string[] => {
  const stored = readStored(key)
  if (!stored) return []

  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}
