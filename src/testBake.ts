import { todayISO } from './math'
import type { Ingredient, Recipe, TestBake, Unit } from './types'
import { UNITS } from './types'

export type TestChange =
  | { kind: 'added'; name: string; amount: number; unit: Unit }
  | { kind: 'changed'; name: string; fromAmount: number; fromUnit: Unit; toAmount: number; toUnit: Unit }
  | { kind: 'removed'; name: string; amount: number; unit: Unit }

function nameKey(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function sameQty(amount: number, unit: Unit, otherAmount: number, otherUnit: Unit) {
  return Math.round(amount * 100) / 100 === Math.round(otherAmount * 100) / 100 && unit === otherUnit
}

function isUnit(value: string): value is Unit {
  return (UNITS as string[]).includes(value)
}

export function testsOf(recipe: Partial<Recipe>): TestBake[] {
  if (!Array.isArray(recipe.tests)) return []
  return recipe.tests.flatMap((test, index) => {
    if (!test) return []
    const ingredients = (Array.isArray(test.ingredients) ? test.ingredients : []).flatMap((item, itemIndex) => {
      const name = item?.name?.trim()
      if (!name) return []
      const amount = Number(item.amount)
      return [
        {
          id: item.id || `${test.id || 'test'}-ing-${itemIndex}`,
          name,
          amount: Number.isFinite(amount) ? amount : 0,
          unit: isUnit(item.unit) ? item.unit : 'g',
        },
      ]
    })
    const taste = (test.taste ?? '').trim()
    if (ingredients.length === 0 && !taste) return []
    return [
      {
        id: test.id || `${recipe.id || 'test'}-${index}`,
        date: /^\d{4}-\d{2}-\d{2}$/.test(test.date) ? test.date : todayISO(),
        time: /^\d{2}:\d{2}$/.test(test.time) ? test.time : '08:00',
        ingredients,
        taste,
      },
    ]
  })
}

export function diffIngredients(current: Ingredient[], tested: Ingredient[]): TestChange[] {
  const pool = new Map<string, Ingredient[]>()
  for (const item of current) {
    const key = nameKey(item.name)
    if (!key) continue
    const list = pool.get(key) ?? []
    list.push(item)
    pool.set(key, list)
  }

  const added: TestChange[] = []
  const changed: TestChange[] = []
  for (const item of tested) {
    const key = nameKey(item.name)
    if (!key) continue
    const match = pool.get(key)?.shift()
    if (!match) {
      added.push({ kind: 'added', name: item.name.trim(), amount: item.amount, unit: item.unit })
      continue
    }
    if (!sameQty(match.amount, match.unit, item.amount, item.unit)) {
      changed.push({
        kind: 'changed',
        name: item.name.trim(),
        fromAmount: match.amount,
        fromUnit: match.unit,
        toAmount: item.amount,
        toUnit: item.unit,
      })
    }
  }

  const removed: TestChange[] = []
  for (const list of pool.values()) {
    for (const item of list) {
      if (!nameKey(item.name)) continue
      removed.push({ kind: 'removed', name: item.name.trim(), amount: item.amount, unit: item.unit })
    }
  }
  return [...added, ...changed, ...removed]
}
