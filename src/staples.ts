import { queueCloud } from './cloud'
import type { Staple, Unit } from './types'
import { UNITS } from './types'

const KEY = 'ferment-room.staples.v1'

export const DEFAULT_STAPLES: Staple[] = [
  { id: 'staple-bread-flour', name: '강력분', unit: 'g' },
  { id: 'staple-whole', name: '통밀가루', unit: 'g' },
  { id: 'staple-ap', name: '중력분', unit: 'g' },
  { id: 'staple-rye', name: '호밀가루', unit: 'g' },
  { id: 'staple-water', name: '물', unit: 'g' },
  { id: 'staple-salt', name: '소금', unit: 'g' },
  { id: 'staple-yeast', name: '인스턴트 이스트', unit: 'g' },
  { id: 'staple-levain', name: '르방', unit: 'g' },
  { id: 'staple-milk', name: '우유', unit: 'g' },
  { id: 'staple-egg', name: '달걀', unit: '개' },
  { id: 'staple-butter', name: '버터', unit: 'g' },
  { id: 'staple-sugar', name: '설탕', unit: 'g' },
  { id: 'staple-oil', name: '올리브오일', unit: 'g' },
]

function isUnit(value: unknown): value is Unit {
  return typeof value === 'string' && UNITS.includes(value as Unit)
}

export function hydrateStaples(input: unknown): Staple[] {
  if (!Array.isArray(input)) return DEFAULT_STAPLES.map((item) => ({ ...item }))
  return input
    .filter((item) => item && typeof item.name === 'string' && item.name.trim())
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `staple-${index}`,
      name: item.name.trim(),
      unit: isUnit(item.unit) ? item.unit : 'g',
    }))
}

export function loadStaples(): Staple[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return DEFAULT_STAPLES.map((item) => ({ ...item }))
    return hydrateStaples(JSON.parse(raw))
  } catch {
    return DEFAULT_STAPLES.map((item) => ({ ...item }))
  }
}

export function cacheStaples(staples: Staple[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(staples))
  } catch {
    /* private mode or full storage */
  }
}

export function saveStaples(staples: Staple[]) {
  cacheStaples(staples)
  queueCloud({ staples })
}
