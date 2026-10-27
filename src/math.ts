import type { Ingredient, ProcessStage, Recipe, Unit } from './types'

export type StageTone = 'knead' | 'bulk' | 'shape' | 'proof' | 'bake' | 'cool'

export interface Stage {
  id: string
  tone: StageTone
  label: string
  minutes: number
  tempC: number | null
  note: string
  from: Date
  to: Date
}

export interface LiquidRatio {
  percent: number
  label: '수분율' | '액체 비율'
  caption: string
  preferment: boolean
}

const FLOUR_RE = /강력분|중력분|박력분|통밀|호밀|밀가루|쌀가루|스펠트/

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function positive(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n)
}

export function formatClock(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatKoreanDate(date: Date) {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function dayDistance(a: Date, b: Date) {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((end - start) / 86400000)
}

export function finishPhrase(start: Date, end: Date) {
  const days = dayDistance(start, end)
  if (days <= 0) return '같은 날 완성'
  if (days === 1) return '다음 날 완성'
  return `${days}일 뒤 완성`
}

export function formatDuration(mins: number) {
  const rounded = Math.max(0, Math.round(mins))
  const hours = Math.floor(rounded / 60)
  const minutes = rounded % 60
  if (hours && minutes) return `${hours}시간 ${minutes}분`
  if (hours) return `${hours}시간`
  return `${minutes}분`
}

export function formatRange(from: Date, to: Date) {
  if (sameDay(from, to)) return `${formatClock(from)} – ${formatClock(to)}`
  return `${formatClock(from)} – ${formatKoreanDate(to)} ${formatClock(to)}`
}

export function formatPercent(n: number) {
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

export function todayISO(base = new Date()) {
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`
}

export function tomorrowISO() {
  const next = new Date()
  next.setDate(next.getDate() + 1)
  return todayISO(next)
}

export function roundedNowTime() {
  const now = new Date()
  let total = Math.round((now.getHours() * 60 + now.getMinutes()) / 5) * 5
  total = ((total % 1440) + 1440) % 1440
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

export function combineDateTime(date: string, time: string) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO()
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : '08:00'
  const [year, month, day] = safeDate.split('-').map(Number)
  const [hour, minute] = safeTime.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

export function bulkMinutesOf(recipe: Recipe) {
  return positive(recipe.bulkHours) * 60 + positive(recipe.bulkMinutes)
}

export function proofMinutesOf(recipe: Recipe) {
  return positive(recipe.proofHours) * 60 + positive(recipe.proofMinutes)
}

export function totalMinutes(recipe: Recipe) {
  if (Array.isArray(recipe.stages)) return recipe.stages.reduce((sum, stage) => sum + positive(stage.minutes), 0)
  return (
    positive(recipe.kneadMinutes) +
    bulkMinutesOf(recipe) +
    positive(recipe.shapeMinutes) +
    proofMinutesOf(recipe) +
    positive(recipe.bakeMinutes) +
    positive(recipe.coolMinutes)
  )
}

function toneFor(stage: ProcessStage, fermentIndex: number): StageTone {
  if (stage.kind === 'ferment') return fermentIndex === 0 ? 'bulk' : 'proof'
  if (stage.kind === 'knead') return 'knead'
  if (stage.kind === 'shape') return 'shape'
  if (stage.kind === 'bake') return 'bake'
  return 'cool'
}

export function buildStages(recipe: Recipe, start: Date): Stage[] {
  let cursor = start.getTime()
  const stages: Stage[] = []
  let fermentIndex = 0
  for (const step of recipe.stages ?? []) {
    const minutes = positive(step.minutes)
    if (minutes <= 0) continue
    const from = new Date(cursor)
    cursor += minutes * 60000
    const tone = toneFor(step, fermentIndex)
    if (step.kind === 'ferment') fermentIndex += 1
    const temp = step.tempC
    stages.push({
      id: step.id,
      tone,
      label: step.label.trim() || '공정',
      minutes,
      tempC: (step.kind === 'ferment' || step.kind === 'bake') && temp != null && Number.isFinite(temp) ? temp : null,
      note: step.note.trim(),
      from,
      to: new Date(cursor),
    })
  }
  return stages
}

export function liveRatio(stage: Stage, now: Date) {
  const start = stage.from.getTime()
  const end = stage.to.getTime()
  const time = now.getTime()
  if (time < start || time >= end || end <= start) return null
  return (time - start) / (end - start)
}

export function tempTone(temp: number | null, tone: StageTone): 'warm' | 'cold' | 'hot' | null {
  if (temp == null || !Number.isFinite(temp)) return null
  if (tone === 'bake' || temp >= 80) return 'hot'
  if (temp <= 10) return 'cold'
  return 'warm'
}

export function formatAmount(amount: number) {
  if (!Number.isFinite(amount)) return '0'
  const rounded = Math.round(amount * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function countOr(value: number | undefined) {
  if (value == null || !Number.isFinite(value) || value <= 0) return 1
  return Math.min(99, Math.round(value * 10) / 10)
}

export function inferredYieldCount(label: string | undefined) {
  const match = (label ?? '').match(/(\d+(?:\.\d+)?)\s*(?:개|줄|덩이|판)/)
  if (!match) return 1
  return countOr(Number(match[1]))
}

export function scaleAmount(amount: number, factor: number) {
  if (!Number.isFinite(amount) || amount === 0) return 0
  if (!Number.isFinite(factor) || factor <= 0) return amount
  return Math.round(amount * factor * 10) / 10
}

export function scaleIngredients(ingredients: Ingredient[], factor: number) {
  return ingredients.map((item) => ({ ...item, amount: scaleAmount(item.amount, factor) }))
}

export function rewriteYieldCount(label: string, from: number, to: number) {
  const fromText = formatAmount(from)
  const toText = formatAmount(to)
  if (fromText === toText) return label
  const escaped = fromText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(^|\\D)${escaped}(?=\\s*(?:개|줄|덩이|판))`)
  if (pattern.test(label)) return label.replace(pattern, `$1${toText}`)
  if (!label.trim()) return `${toText}개`
  return label
}

export function flourGrams(ingredients: Ingredient[]) {
  return ingredients.reduce((sum, item) => {
    if (item.unit !== 'g') return sum
    if (!FLOUR_RE.test(item.name.replace(/\s/g, ''))) return sum
    return sum + (Number(item.amount) || 0)
  }, 0)
}

export function doughGrams(ingredients: Ingredient[]) {
  return ingredients.reduce((sum, item) => {
    if (item.unit !== 'g' && item.unit !== 'ml') return sum
    return sum + (Number(item.amount) || 0)
  }, 0)
}

export function bakersPercent(amount: number, unit: Unit, flour: number) {
  if (unit !== 'g' || flour <= 0 || !amount) return null
  return (amount / flour) * 100
}

export function liquidRatio(ingredients: Ingredient[]): LiquidRatio | null {
  const flour = flourGrams(ingredients)
  let water = 0
  let milk = 0
  let egg = 0
  for (const item of ingredients) {
    if (item.unit !== 'g' && item.unit !== 'ml') continue
    const name = item.name.replace(/\s/g, '')
    const amount = Number(item.amount) || 0
    if (!amount) continue
    if (/^(찬|따뜻한|뜨거운)?물$/.test(name)) water += amount
    else if (name.includes('우유')) milk += amount
    else if (/달걀|계란|전란|노른자|흰자/.test(name)) egg += amount
  }
  const total = water + milk + egg
  if (flour <= 0 || total <= 0) return null
  const names: string[] = []
  if (water) names.push('물')
  if (milk) names.push('우유')
  if (egg) names.push('달걀')
  return {
    percent: (total / flour) * 100,
    label: names.length === 1 && names[0] === '물' ? '수분율' : '액체 비율',
    caption: `밀가루 대비 ${names.join(' · ')}`,
    preferment: ingredients.some((item) => /르방|르뱅|사워종|풀리시|비가/.test(item.name)),
  }
}
