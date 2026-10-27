import type { ProcessKind, ProcessStage, Recipe } from './types'

export const PROCESS_KINDS: ProcessKind[] = ['knead', 'ferment', 'shape', 'bake', 'cool']

const KIND_LABEL: Record<ProcessKind, string> = {
  knead: '반죽',
  ferment: '발효',
  shape: '분할 · 성형',
  bake: '굽기',
  cool: '식히기',
}

export function usesTemp(kind: ProcessKind) {
  return kind === 'ferment' || kind === 'bake'
}

function num(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.max(0, Math.round(value))
}

export function defaultStage(kind: ProcessKind, existing: ProcessStage[] = []): ProcessStage {
  const fermentCount = existing.filter((stage) => stage.kind === 'ferment').length
  const label =
    kind === 'ferment' ? (fermentCount === 0 ? '1차 발효' : fermentCount === 1 ? '2차 발효' : '발효') : KIND_LABEL[kind]
  const minutes = kind === 'ferment' ? 60 : kind === 'bake' || kind === 'cool' ? 40 : 20
  const tempC = kind === 'ferment' ? 24 : kind === 'bake' ? 230 : null
  return { id: crypto.randomUUID(), kind, label, minutes, tempC, note: '' }
}

export function stagesFromLegacy(recipe: Partial<Recipe>): ProcessStage[] {
  const id = recipe.id || 'recipe'
  const stages: ProcessStage[] = []
  const knead = num(recipe.kneadMinutes)
  if (knead > 0) stages.push({ id: `${id}-knead`, kind: 'knead', label: '반죽', minutes: knead, tempC: null, note: '' })
  const bulk = num(recipe.bulkHours) * 60 + num(recipe.bulkMinutes)
  if (bulk > 0) {
    stages.push({
      id: `${id}-bulk`,
      kind: 'ferment',
      label: '1차 발효',
      minutes: bulk,
      tempC: num(recipe.bulkTempC),
      note: recipe.bulkNote?.trim() ?? '',
    })
  }
  const shape = num(recipe.shapeMinutes)
  if (shape > 0) stages.push({ id: `${id}-shape`, kind: 'shape', label: '분할 · 성형', minutes: shape, tempC: null, note: '' })
  const proof = num(recipe.proofHours) * 60 + num(recipe.proofMinutes)
  if (proof > 0) {
    stages.push({
      id: `${id}-proof`,
      kind: 'ferment',
      label: '2차 발효',
      minutes: proof,
      tempC: num(recipe.proofTempC),
      note: recipe.proofNote?.trim() ?? '',
    })
  }
  const bake = num(recipe.bakeMinutes)
  if (bake > 0) {
    stages.push({
      id: `${id}-bake`,
      kind: 'bake',
      label: '굽기',
      minutes: bake,
      tempC: num(recipe.bakeTempC),
      note: '',
    })
  }
  const cool = num(recipe.coolMinutes)
  if (cool > 0) stages.push({ id: `${id}-cool`, kind: 'cool', label: '식히기', minutes: cool, tempC: null, note: '' })
  return stages
}

export function stagesOf(recipe: Partial<Recipe>): ProcessStage[] {
  const recipeId = recipe.id || 'recipe'
  if (Array.isArray(recipe.stages)) {
    return recipe.stages.flatMap((stage, index) => {
      if (!stage || !PROCESS_KINDS.includes(stage.kind)) return []
      return [
        {
          id: stage.id || `${recipeId}-stage-${index}`,
          kind: stage.kind,
          label: (stage.label || KIND_LABEL[stage.kind]).trim() || KIND_LABEL[stage.kind],
          minutes: num(stage.minutes),
          tempC: usesTemp(stage.kind) ? num(stage.tempC) : null,
          note: (stage.note || '').trim(),
        },
      ]
    })
  }
  return stagesFromLegacy(recipe)
}

export function legacyFromStages(stages: ProcessStage[]): Pick<
  Recipe,
  | 'kneadMinutes'
  | 'bulkTempC'
  | 'bulkHours'
  | 'bulkMinutes'
  | 'bulkNote'
  | 'shapeMinutes'
  | 'proofTempC'
  | 'proofHours'
  | 'proofMinutes'
  | 'proofNote'
  | 'bakeTempC'
  | 'bakeMinutes'
  | 'coolMinutes'
> {
  const ferments = stages.filter((stage) => stage.kind === 'ferment')
  const bulk = ferments[0]
  const proof = ferments[1]
  const split = (total: number) => ({ hours: Math.floor(total / 60), minutes: total % 60 })
  const bulkTime = split(bulk?.minutes ?? 0)
  const proofTime = split(proof?.minutes ?? 0)
  const bake = stages.find((stage) => stage.kind === 'bake')
  return {
    kneadMinutes: stages.find((stage) => stage.kind === 'knead')?.minutes ?? 0,
    bulkTempC: bulk?.tempC ?? 24,
    bulkHours: bulkTime.hours,
    bulkMinutes: bulkTime.minutes,
    bulkNote: bulk?.note ?? '',
    shapeMinutes: stages.find((stage) => stage.kind === 'shape')?.minutes ?? 0,
    proofTempC: proof?.tempC ?? 24,
    proofHours: proofTime.hours,
    proofMinutes: proofTime.minutes,
    proofNote: proof?.note ?? '',
    bakeTempC: bake?.tempC ?? 0,
    bakeMinutes: bake?.minutes ?? 0,
    coolMinutes: stages.find((stage) => stage.kind === 'cool')?.minutes ?? 0,
  }
}
