import { readLocal } from "@myton/ui"

export const THEME_KEY = "mtp_theme"
export const LANGUAGE_KEY = "mtp_lang"
export const FAVORITES_KEY = "mtp_favorites"
export const LIST_KEY = "mtp_list"

export const readStoredStrings = (key: string): string[] => {
  const stored = readLocal(key)
  if (!stored) return []

  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}
