import { totalMinutes } from './math'
import type { Craft, DoughType, Recipe, RecipeStatus } from './types'

export type MatchMode = 'and' | 'or'
export type DoughFilter = 'all' | Craft | DoughType
export type StatusFilter = 'all' | RecipeStatus

export type TimeRange = {
  min: number
  max: number
}

const TIME_STEP = 15

export function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

export function recipeTimeBounds(recipes: Recipe[]): TimeRange & { step: number } {
  const times = recipes.map((recipe) => totalMinutes(recipe)).filter((mins) => mins > 0)
  if (times.length === 0) return { min: 0, max: 24 * 60, step: TIME_STEP }
  let min = Math.floor(Math.min(...times) / TIME_STEP) * TIME_STEP
  let max = Math.ceil(Math.max(...times) / TIME_STEP) * TIME_STEP
  if (max <= min) max = min + 60
  return { min, max, step: TIME_STEP }
}

export function filterRecipes(
  recipes: Recipe[],
  query: string,
  ingredientFilters: string[],
  matchMode: MatchMode,
  dough: DoughFilter,
  status: StatusFilter = 'all',
  timeRange?: TimeRange | null,
) {
  const q = normalize(query)
  return recipes.filter((recipe) => {
    if (dough === 'pastry' || dough === 'bread') {
      if ((recipe.craft ?? 'bread') !== dough) return false
    } else if (dough !== 'all' && recipe.doughType !== dough) return false
    if (status !== 'all' && recipe.status !== status) return false
    if (timeRange) {
      const mins = totalMinutes(recipe)
      if (mins < timeRange.min || mins > timeRange.max) return false
    }
    if (q) {
      const hit =
        normalize(recipe.name).includes(q) ||
        normalize(recipe.summary).includes(q) ||
        normalize(recipe.sourceBook ?? '').includes(q) ||
        normalize(recipe.sourcePage ?? '').includes(q) ||
        normalize(recipe.sourceUrl ?? '').includes(q) ||
        normalize(recipe.personalNote ?? '').includes(q) ||
        (recipe.notes ?? []).some((note) => normalize(note.text).includes(q)) ||
        recipe.ingredients.some((item) => normalize(item.name).includes(q))
      if (!hit) return false
    }
    if (ingredientFilters.length > 0) {
      const names = recipe.ingredients.map((item) => normalize(item.name))
      const has = (filter: string) => names.some((name) => name.includes(normalize(filter)))
      const ok = matchMode === 'and' ? ingredientFilters.every(has) : ingredientFilters.some(has)
      if (!ok) return false
    }
    return true
  })
}

export function ingredientCatalog(recipes: Recipe[]) {
  const counts = new Map<string, number>()
  for (const recipe of recipes) {
    for (const item of recipe.ingredients) {
      const name = item.name.trim()
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
}

export function ingredientHit(name: string, query: string, filters: string[]) {
  const normalized = normalize(name)
  if (query.trim() && normalized.includes(normalize(query))) return true
  return filters.some((filter) => filter.trim() && normalized.includes(normalize(filter)))
}
