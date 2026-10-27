import { queueCloud } from './cloud'
import type { ProcessKind, ProcessOption } from './types'
import { PROCESS_KIND_LABEL } from './types'

const KEY = 'ferment-room.processes.v1'

export const DEFAULT_PROCESS_OPTIONS: ProcessOption[] = [
  { id: 'process-knead', label: '반죽', kind: 'knead' },
  { id: 'process-ferment', label: '발효', kind: 'ferment' },
  { id: 'process-shape', label: '성형', kind: 'shape' },
  { id: 'process-bake', label: '굽기', kind: 'bake' },
  { id: 'process-cool', label: '식히기', kind: 'cool' },
]

function isKind(value: unknown): value is ProcessKind {
  return typeof value === 'string' && value in PROCESS_KIND_LABEL
}

export function hydrateProcesses(input: unknown): ProcessOption[] {
  if (!Array.isArray(input)) return DEFAULT_PROCESS_OPTIONS.map((item) => ({ ...item }))
  return input
    .filter((item) => item && typeof item.label === 'string' && item.label.trim() && isKind(item.kind))
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `process-${index}`,
      label: item.label.trim(),
      kind: item.kind,
    }))
}

export function loadProcessOptions(): ProcessOption[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return DEFAULT_PROCESS_OPTIONS.map((item) => ({ ...item }))
    return hydrateProcesses(JSON.parse(raw))
  } catch {
    return DEFAULT_PROCESS_OPTIONS.map((item) => ({ ...item }))
  }
}

export function cacheProcesses(options: ProcessOption[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(options))
  } catch {
    /* private mode or full storage */
  }
}

export function saveProcessOptions(options: ProcessOption[]) {
  cacheProcesses(options)
  queueCloud({ processes: options })
}
