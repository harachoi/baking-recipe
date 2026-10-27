import { useEffect, useMemo, useRef, useState } from 'react'
import { Detail } from './components/Detail'
import { Editor } from './components/Editor'
import { Mark } from './components/Mark'
import { Sidebar } from './components/Sidebar'
import { onCloudData, onCloudStatus, startCloud, type CloudStatus } from './cloud'
import {
  filterRecipes,
  recipeTimeBounds,
  type DoughFilter,
  type MatchMode,
  type StatusFilter,
  type TimeRange,
} from './filter'
import { blankRecipe, cloneRecipe } from './recipe'
import { SAMPLES } from './samples'
import { cacheRecipes, hydrateRecipes, loadRecipes, saveRecipes, storageExists } from './storage'
import { cacheStaples, hydrateStaples, loadStaples } from './staples'
import { cachePans, hydratePans, loadPans } from './pans'
import { cacheProcesses, hydrateProcesses, loadProcessOptions } from './processOptions'
import type { NoteEntry, Recipe, RecipeStatus, TestBake } from './types'

type Screen = 'library' | 'detail' | 'edit'
type Pending = { type: 'select'; id: string } | { type: 'create' } | null

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>(() => loadRecipes())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('library')
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<string[]>([])
  const [matchMode, setMatchMode] = useState<MatchMode>('and')
  const [dough, setDough] = useState<DoughFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [timeRange, setTimeRange] = useState<TimeRange | null>(null)
  const [hint, setHint] = useState('')
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('connecting')
  const [pans, setPans] = useState(loadPans)
  const [pending, setPending] = useState<Pending>(null)
  const mainRef = useRef<HTMLElement>(null)

  const timeBounds = useMemo(() => recipeTimeBounds(recipes), [recipes])

  const visible = useMemo(
    () => filterRecipes(recipes, query, filters, matchMode, dough, status, timeRange),
    [recipes, query, filters, matchMode, dough, status, timeRange],
  )

  useEffect(() => {
    if (!timeRange) return
    const next = {
      min: Math.min(Math.max(timeRange.min, timeBounds.min), timeBounds.max),
      max: Math.max(Math.min(timeRange.max, timeBounds.max), timeBounds.min),
    }
    if (next.min > next.max) {
      setTimeRange(null)
      return
    }
    if (next.min !== timeRange.min || next.max !== timeRange.max) setTimeRange(next)
  }, [timeBounds, timeRange])

  useEffect(() => {
    if (!storageExists()) cacheRecipes(recipes)
  }, [recipes])

  useEffect(() => {
    const stopStatus = onCloudStatus(setCloudStatus)
    const stopData = onCloudData((room) => {
      if (room.recipes) {
        const next = hydrateRecipes(room.recipes)
        cacheRecipes(next)
        setRecipes(next)
      }
      if (room.staples) cacheStaples(hydrateStaples(room.staples))
      if (room.processes) cacheProcesses(hydrateProcesses(room.processes))
      if (room.pans) {
        const next = hydratePans(room.pans)
        cachePans(next)
        setPans(next)
      }
    })
    const stopSync = startCloud(() => ({
      recipes: loadRecipes(),
      staples: loadStaples(),
      processes: loadProcessOptions(),
      pans: loadPans(),
    }))
    return () => {
      stopStatus()
      stopData()
      stopSync()
    }
  }, [])

  useEffect(() => {
    if (screen === 'edit') return
    setPans(loadPans())
  }, [screen])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [selectedId, screen])

  useEffect(() => {
    if (!hint) return
    const id = window.setTimeout(() => setHint(''), 2400)
    return () => window.clearTimeout(id)
  }, [hint])

  useEffect(() => {
    if (!pending) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPending(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])

  const selected = recipes.find((recipe) => recipe.id === selectedId) ?? null

  function openLibrary() {
    setScreen('library')
    setEditing(null)
  }

  function startCreate() {
    setEditing(blankRecipe())
    setIsNew(true)
    setScreen('edit')
  }

  function startEdit(recipe: Recipe) {
    setEditing(structuredClone(recipe))
    setIsNew(false)
    setScreen('edit')
  }

  function requestSelect(id: string) {
    if (screen === 'edit') {
      setPending({ type: 'select', id })
      return
    }
    setSelectedId(id)
    setScreen('detail')
  }

  function requestCreate() {
    if (screen === 'edit') {
      setPending({ type: 'create' })
      return
    }
    startCreate()
  }

  function confirmPending() {
    if (!pending) return
    if (pending.type === 'select') {
      setSelectedId(pending.id)
      setEditing(null)
      setScreen('detail')
    } else {
      startCreate()
    }
    setPending(null)
  }

  function cancelEdit() {
    setEditing(null)
    setScreen(isNew || !selected ? 'library' : 'detail')
  }

  function save(recipe: Recipe) {
    const exists = recipes.some((item) => item.id === recipe.id)
    const next = exists ? recipes.map((item) => (item.id === recipe.id ? recipe : item)) : [recipe, ...recipes]
    saveRecipes(next)
    setRecipes(next)
    setSelectedId(recipe.id)
    setQuery('')
    setFilters([])
    setDough('all')
    setMatchMode('and')
    setScreen('detail')
    setEditing(null)
  }

  function remove(id: string) {
    const next = recipes.filter((recipe) => recipe.id !== id)
    saveRecipes(next)
    setRecipes(next)
    if (selectedId === id) setSelectedId(null)
    setScreen('library')
    setEditing(null)
  }

  function duplicate(recipe: Recipe) {
    const copy = cloneRecipe(recipe)
    const index = recipes.findIndex((item) => item.id === recipe.id)
    const next = recipes.slice()
    next.splice(index + 1, 0, copy)
    saveRecipes(next)
    setRecipes(next)
    setSelectedId(copy.id)
    setScreen('detail')
  }

  function updateStatus(id: string, status: RecipeStatus | null) {
    const next = recipes.map((recipe) => (recipe.id === id ? { ...recipe, status, updatedAt: Date.now() } : recipe))
    saveRecipes(next)
    setRecipes(next)
  }

  function updateStartTime(id: string, startTime: string) {
    const next = recipes.map((recipe) => (recipe.id === id ? { ...recipe, startTime, updatedAt: Date.now() } : recipe))
    saveRecipes(next)
    setRecipes(next)
  }

  function updateNotes(id: string, notes: NoteEntry[]) {
    const personalNote = notes.map((note) => note.text).join('\n')
    const next = recipes.map((recipe) => (recipe.id === id ? { ...recipe, notes, personalNote, updatedAt: Date.now() } : recipe))
    saveRecipes(next)
    setRecipes(next)
  }

  function updateTests(id: string, tests: TestBake[]) {
    const next = recipes.map((recipe) => (recipe.id === id ? { ...recipe, tests, updatedAt: Date.now() } : recipe))
    saveRecipes(next)
    setRecipes(next)
  }

  function updateFormula(id: string, patch: Pick<Recipe, 'ingredients' | 'yieldCount' | 'yieldLabel'>) {
    const next = recipes.map((recipe) => (recipe.id === id ? { ...recipe, ...patch, updatedAt: Date.now() } : recipe))
    saveRecipes(next)
    setRecipes(next)
  }

  function addSamples() {
    const ids = new Set(recipes.map((recipe) => recipe.id))
    const missing = SAMPLES.filter((recipe) => !ids.has(recipe.id)).map((recipe) => structuredClone(recipe))
    if (missing.length === 0) {
      setHint('샘플 레시피가 이미 모두 있습니다')
      return
    }
    const next = [...recipes, ...missing]
    saveRecipes(next)
    setRecipes(next)
    setHint(`샘플 ${missing.length}개를 더했습니다`)
  }

  function clearFilters() {
    setQuery('')
    setFilters([])
    setDough('all')
    setStatus('all')
    setTimeRange(null)
    setMatchMode('and')
  }

  function updateTimeRange(next: TimeRange) {
    if (next.min <= timeBounds.min && next.max >= timeBounds.max) {
      setTimeRange(null)
      return
    }
    setTimeRange(next)
  }

  const library = (
    <Sidebar
      recipes={recipes}
      visible={visible}
      query={query}
      filters={filters}
      matchMode={matchMode}
      dough={dough}
      status={status}
      timeBounds={timeBounds}
      timeRange={timeRange}
      hint={hint}
      cloudNote={cloudNote(cloudStatus)}
      pans={pans}
      onQuery={setQuery}
      onToggleFilter={(name) => setFilters((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]))}
      onMatchMode={setMatchMode}
      onDough={setDough}
      onStatus={setStatus}
      onTimeRange={updateTimeRange}
      onSelect={requestSelect}
      onCreate={requestCreate}
      onAddSamples={addSamples}
      onClear={clearFilters}
    />
  )

  return (
    <div className={screen === 'library' ? 'shell is-library' : 'shell'}>
      {screen === 'edit' && editing ? (
        <main className="main stage-page" ref={mainRef}>
          <Editor
            key={editing.id}
            initial={editing}
            isNew={isNew}
            backLabel={isNew || !selected ? '목록으로' : '레시피로'}
            onSave={save}
            onCancel={cancelEdit}
          />
        </main>
      ) : screen === 'detail' && selected ? (
        <main className="main stage-page" ref={mainRef}>
          <Detail
            key={selected.id}
            recipe={selected}
            query={query}
            filters={filters}
            onBack={openLibrary}
            onEdit={(notes) => startEdit({ ...selected, notes, personalNote: notes.map((note) => note.text).join('\n') })}
            onDuplicate={(notes) => duplicate({ ...selected, notes, personalNote: notes.map((note) => note.text).join('\n') })}
            onSaveNotes={(notes) => updateNotes(selected.id, notes)}
            onSaveTests={(tests) => updateTests(selected.id, tests)}
            onSaveFormula={(patch) => updateFormula(selected.id, patch)}
            onStatus={(status) => updateStatus(selected.id, status)}
            pans={pans}
            onDelete={() => remove(selected.id)}
            onSaveStartTime={(time) => updateStartTime(selected.id, time)}
          />
        </main>
      ) : recipes.length === 0 ? (
        <main className="main stage-page" ref={mainRef}>
          <LibraryEmpty onCreate={requestCreate} onSamples={addSamples} cloudNote={cloudNote(cloudStatus)} />
        </main>
      ) : (
        library
      )}
      {pending ? (
        <div
          className="modal-back"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPending(null)
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="leave-title">
            <h3 id="leave-title">저장하지 않은 내용이 있습니다</h3>
            <p>이동하면 지금 적은 레시피가 사라집니다.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-line" onClick={() => setPending(null)}>
                계속 편집
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmPending}>
                버리고 이동
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function cloudNote(status: CloudStatus) {
  if (status === 'connecting') return '클라우드에 연결하는 중'
  if (status === 'saving') return '클라우드에 저장하는 중'
  if (status === 'live') return '클라우드에 저장됩니다'
  if (status === 'error') return '클라우드 저장에 실패했습니다. 이 브라우저에는 남아 있습니다.'
  return '레시피는 이 브라우저에만 저장됩니다.'
}

function LibraryEmpty({ onCreate, onSamples, cloudNote }: { onCreate: () => void; onSamples: () => void; cloudNote: string }) {
  return (
    <div className="blank">
      <Mark className="blank-mark" />
      <p className="eyebrow">Ferment</p>
      <h2>첫 반죽을 적어 보세요</h2>
      <p>1차·2차 발효 온도와 시간을 넣으면 굽기까지의 타임라인이 만들어집니다.</p>
      <p>{cloudNote}</p>
      <div className="quick-row">
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          새 레시피
        </button>
        <button type="button" className="btn btn-line" onClick={onSamples}>
          샘플로 시작
        </button>
      </div>
    </div>
  )
}

