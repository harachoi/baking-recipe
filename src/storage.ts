import { queueCloud } from './cloud'
import { inferredYieldCount } from './math'
import { stagesOf } from './process'
import { notesOf, recipeStatus } from './recipe'
import { panIdsOf } from './pans'
import { testsOf } from './testBake'
import { SAMPLES } from './samples'
import type { Recipe } from './types'

const KEY = 'ferment-room.recipes.v1'

export function hydrateRecipes(input: unknown): Recipe[] {
  if (!Array.isArray(input)) return []
  return input.map((recipe: Recipe) => {
    const notes = notesOf(recipe)
    return {
      ...recipe,
      notes,
      tests: testsOf(recipe),
      personalNote: notes.map((note) => note.text).join('\n'),
      yieldCount: recipe.yieldCount > 0 ? recipe.yieldCount : inferredYieldCount(recipe.yieldLabel),
        sourceBook: recipe.sourceBook?.trim() ?? '',
        sourcePage: recipe.sourcePage?.trim() ?? '',
        sourceUrl: recipe.sourceUrl?.trim() ?? '',
        status: recipeStatus(recipe.status),
        panIds: panIdsOf(recipe.panIds),
      stages: stagesOf(recipe),
      craft: recipe.craft === 'pastry' ? 'pastry' : 'bread',
    }
  })
}

export function loadRecipes(): Recipe[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return structuredClone(SAMPLES)
    const parsed = JSON.parse(raw) as Recipe[]
    if (!Array.isArray(parsed)) return structuredClone(SAMPLES)
    return hydrateRecipes(parsed)
  } catch {
    return structuredClone(SAMPLES)
  }
}

export function cacheRecipes(recipes: Recipe[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(recipes))
  } catch {
    /* private mode or full storage */
  }
}

export function saveRecipes(recipes: Recipe[]) {
  cacheRecipes(recipes)
  queueCloud({ recipes })
}

export function storageExists() {
  return localStorage.getItem(KEY) != null
}
