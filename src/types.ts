export type Unit = 'g' | 'ml' | '개' | '큰술' | '작은술'

export type DoughType = 'natural' | 'yeast' | 'enriched'

export type Craft = 'pastry' | 'bread'

export const UNITS: Unit[] = ['g', 'ml', '개', '큰술', '작은술']

export const DOUGH_LABEL: Record<DoughType, string> = {
  natural: '자연발효',
  yeast: '이스트',
  enriched: '고배합',
}

export const CRAFT_LABEL: Record<Craft, string> = {
  pastry: '제과',
  bread: '제빵',
}

export interface Ingredient {
  id: string
  name: string
  amount: number
  unit: Unit
}

export interface Staple {
  id: string
  name: string
  unit: Unit
}

export interface Pan {
  id: string
  name: string
}

export interface NoteEntry {
  id: string
  date: string
  time: string
  text: string
}

export type RecipeStatus = 'test' | 'done' | 'todo'

export const RECIPE_STATUS: { value: RecipeStatus; label: string }[] = [
  { value: 'test', label: 'TEST' },
  { value: 'done', label: 'DONE' },
  { value: 'todo', label: 'TODO' },
]

export interface TestBake {
  id: string
  date: string
  time: string
  ingredients: Ingredient[]
  taste: string
}

export type ProcessKind = 'knead' | 'ferment' | 'shape' | 'bake' | 'cool'

export const PROCESS_KIND_LABEL: Record<ProcessKind, string> = {
  knead: '반죽',
  ferment: '발효',
  shape: '성형',
  bake: '굽기',
  cool: '식히기',
}

export interface ProcessOption {
  id: string
  label: string
  kind: ProcessKind
}

export interface ProcessStage {
  id: string
  kind: ProcessKind
  label: string
  minutes: number
  tempC: number | null
  note: string
}

export interface Recipe {
  id: string
  name: string
  summary: string
  personalNote: string
  notes: NoteEntry[]
  tests: TestBake[]
  yieldLabel: string
  yieldCount: number
  sourceBook: string
  sourcePage: string
  sourceUrl: string
  status: RecipeStatus | null
  panIds: string[]
  craft: Craft
  doughType: DoughType
  ingredients: Ingredient[]
  stages: ProcessStage[]
  steps: string[]
  kneadMinutes: number
  bulkTempC: number
  bulkHours: number
  bulkMinutes: number
  bulkNote: string
  shapeMinutes: number
  proofTempC: number
  proofHours: number
  proofMinutes: number
  proofNote: string
  bakeTempC: number
  bakeMinutes: number
  coolMinutes: number
  startTime: string
  createdAt: number
  updatedAt: number
}
