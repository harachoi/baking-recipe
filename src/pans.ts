import { queueCloud } from './cloud'
import type { Pan } from './types'

const KEY = 'ferment-room.pans.v1'

export function hydratePans(input: unknown): Pan[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((item) => item && typeof item.name === 'string' && item.name.trim())
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `pan-${index}`,
      name: item.name.trim(),
    }))
}

export function panIdsOf(input: unknown) {
  if (!Array.isArray(input)) return []
  const ids = input.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  return [...new Set(ids)]
}

export function panNames(ids: string[] | undefined, pans: Pan[]) {
  return panIdsOf(ids)
    .map((id) => pans.find((pan) => pan.id === id)?.name)
    .filter((name): name is string => Boolean(name))
}

export function loadPans(): Pan[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return []
    return hydratePans(JSON.parse(raw))
  } catch {
    return []
  }
}

export function cachePans(pans: Pan[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pans))
  } catch {
    /* private mode or full storage */
  }
}

export function savePans(pans: Pan[]) {
  cachePans(pans)
  queueCloud({ pans })
}
