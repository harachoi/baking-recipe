import { formatClock, todayISO } from './math'
import { defaultStage, legacyFromStages, stagesOf } from './process'
import { testsOf } from './testBake'
import type { Ingredient, NoteEntry, Recipe, RecipeStatus } from './types'

export function uid() {
  return crypto.randomUUID()
}

export function blankRecipe(): Recipe {
  const now = Date.now()
  const stages = [
    defaultStage('knead'),
    { ...defaultStage('ferment'), label: '1차 발효', minutes: 4 * 60 },
    defaultStage('shape'),
    { ...defaultStage('ferment'), label: '2차 발효', minutes: 60 },
    defaultStage('bake'),
    defaultStage('cool'),
  ]
  return {
    id: uid(),
    name: '',
    summary: '',
    personalNote: '',
    notes: [],
    tests: [],
    yieldLabel: '',
    yieldCount: 1,
    sourceBook: '',
    sourcePage: '',
    sourceUrl: '',
    status: null,
    panIds: [],
    craft: 'bread',
    doughType: 'natural',
    ingredients: [emptyIngredient(), emptyIngredient(), emptyIngredient()],
    stages,
    steps: [''],
    ...legacyFromStages(stages),
    startTime: '08:00',
    createdAt: now,
    updatedAt: now,
  }
}

export function emptyIngredient(): Ingredient {
  return { id: uid(), name: '', amount: 0, unit: 'g' }
}

export function notesOf(recipe: Partial<Recipe> & { personalNote?: string }): NoteEntry[] {
  if (Array.isArray(recipe.notes)) {
    return recipe.notes
      .filter((note) => note?.text?.trim())
      .map((note, index) => ({
        id: note.id || `${recipe.id || 'note'}-${index}`,
        date: /^\d{4}-\d{2}-\d{2}$/.test(note.date) ? note.date : todayISO(),
        time: /^\d{2}:\d{2}$/.test(note.time) ? note.time : '08:00',
        text: note.text.trim(),
      }))
  }
  const text = recipe.personalNote?.trim()
  if (!text) return []
  const when = new Date(recipe.updatedAt || Date.now())
  return [
    {
      id: `${recipe.id || 'note'}-legacy`,
      date: todayISO(when),
      time: formatClock(when),
      text,
    },
  ]
}

export function recipeStatus(value: unknown): RecipeStatus | null {
  return value === 'test' || value === 'done' || value === 'todo' ? value : null
}

export function sourceLabel(recipe: Pick<Recipe, 'sourceBook' | 'sourcePage'>) {
  const book = recipe.sourceBook?.trim() ?? ''
  const page = recipe.sourcePage?.trim() ?? ''
  if (book && page) return `${book} · ${page}쪽`
  if (book) return book
  if (page) return `${page}쪽`
  return ''
}

export function cloneRecipe(recipe: Recipe): Recipe {
  const now = Date.now()
  return {
    ...recipe,
    id: uid(),
    name: recipe.name ? `${recipe.name} 사본` : '',
    ingredients: recipe.ingredients.map((item) => ({ ...item, id: uid() })),
    notes: notesOf(recipe).map((note) => ({ ...note, id: uid() })),
    tests: testsOf(recipe).map((test) => ({
      ...test,
      id: uid(),
      ingredients: test.ingredients.map((item) => ({ ...item, id: uid() })),
    })),
    stages: stagesOf(recipe).map((stage) => ({ ...stage, id: uid() })),
    steps: [...recipe.steps],
    createdAt: now,
    updatedAt: now,
  }
}

export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir
  if (target < 0 || target >= list.length) return list
  const copy = list.slice()
  const [item] = copy.splice(index, 1)
  copy.splice(target, 0, item)
  return copy
}
