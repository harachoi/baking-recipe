import { useEffect, useRef, useState } from 'react'
import { onCloudData } from '../cloud'
import { buildStages, combineDateTime, countOr, flourGrams, formatClock, formatKoreanDate, rewriteYieldCount, scaleIngredients, todayISO } from '../math'
import { defaultStage, legacyFromStages, stagesOf, usesTemp } from '../process'
import { emptyIngredient, moveItem, recipeStatus, uid } from '../recipe'
import { loadPans, savePans, hydratePans, panIdsOf } from '../pans'
import { loadProcessOptions, saveProcessOptions, hydrateProcesses } from '../processOptions'
import { loadStaples, saveStaples, hydrateStaples } from '../staples'
import { testsOf } from '../testBake'
import type { Ingredient, NoteEntry, ProcessKind, ProcessOption, ProcessStage, Recipe, Staple } from '../types'
import { CRAFT_LABEL, PROCESS_KIND_LABEL, UNITS, type Craft } from '../types'
import { FormulaScale } from './FormulaScale'
import { StatusPicker } from './StatusPicker'
import { Timeline } from './Timeline'

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

function cleanNotes(notes: NoteEntry[] | undefined): NoteEntry[] {
  return (notes ?? [])
    .map((note) => ({
      id: note.id || uid(),
      date: /^\d{4}-\d{2}-\d{2}$/.test(note.date) ? note.date : todayISO(),
      time: /^\d{2}:\d{2}$/.test(note.time) ? note.time : '08:00',
      text: (note.text ?? '').trim(),
    }))
    .filter((note) => note.text)
}

function clean(draft: Recipe): Recipe {
  const notes = cleanNotes(draft.notes)
  const stages = (draft.stages ?? []).map((stage) => ({
    ...stage,
    label: stage.label.trim() || '공정',
    minutes: clamp(stage.minutes, 0, 72 * 60),
    tempC: usesTemp(stage.kind) ? clamp(stage.tempC ?? 0, 0, stage.kind === 'bake' ? 300 : 45) : null,
    note: stage.note.trim(),
  }))
  return {
    ...draft,
    ...legacyFromStages(stages),
    name: draft.name.trim(),
    summary: draft.summary.trim(),
    notes,
    tests: testsOf(draft),
    personalNote: notes.map((note) => note.text).join('\n'),
    yieldLabel: draft.yieldLabel.trim(),
    sourceBook: draft.sourceBook.trim(),
    sourcePage: draft.sourcePage.trim(),
    sourceUrl: draft.sourceUrl.trim(),
    status: recipeStatus(draft.status),
    panIds: panIdsOf(draft.panIds),
    yieldCount: countOr(draft.yieldCount),
    startTime: /^\d{2}:\d{2}$/.test(draft.startTime) ? draft.startTime : '08:00',
    stages,
    ingredients: draft.ingredients
      .filter((item) => item.name.trim())
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        amount: Math.round(item.amount * 100) / 100,
      })),
    steps: draft.steps.map((step) => step.trim()).filter(Boolean),
    updatedAt: Date.now(),
  }
}

export function Editor({
  initial,
  isNew,
  backLabel,
  onSave,
  onCancel,
}: {
  initial: Recipe
  isNew: boolean
  backLabel: string
  onSave: (recipe: Recipe) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(() => ({ ...initial, stages: stagesOf(initial) }))
  const [error, setError] = useState('')
  const [noteText, setNoteText] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [staples, setStaples] = useState(loadStaples)
  const [managingStaples, setManagingStaples] = useState(false)
  const [stapleName, setStapleName] = useState('')
  const [processOptions, setProcessOptions] = useState(loadProcessOptions)
  const [managingProcesses, setManagingProcesses] = useState(false)
  const [processName, setProcessName] = useState('')
  const [processKind, setProcessKind] = useState<ProcessKind>('knead')
  const [pans, setPans] = useState(loadPans)
  const [managingPans, setManagingPans] = useState(false)
  const [panName, setPanName] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const ingredientListRef = useRef<HTMLDivElement>(null)
  const stageListRef = useRef<HTMLDivElement>(null)
  const ingredientDrag = useRef<string | null>(null)
  const stageDrag = useRef<string | null>(null)
  const stageLock = useRef(false)
  const dragLock = useRef(false)
  const focusIngredient = useRef<{ id: string; field: 'name' | 'amt' } | null>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  useEffect(() => {
    dragLock.current = false
    const target = focusIngredient.current
    if (!target) return
    const prefix = target.field === 'amt' ? 'ing-amt-' : 'ing-'
    document.getElementById(`${prefix}${target.id}`)?.focus()
    const timer = window.setTimeout(() => {
      if (focusIngredient.current?.id === target.id) focusIngredient.current = null
    }, 0)
    return () => window.clearTimeout(timer)
  }, [draft.ingredients])

  useEffect(() => {
    return onCloudData((room) => {
      if (room.staples) setStaples(hydrateStaples(room.staples))
      if (room.processes) setProcessOptions(hydrateProcesses(room.processes))
      if (room.pans) setPans(hydratePans(room.pans))
    })
  }, [])

  useEffect(() => {
    saveStaples(staples)
  }, [staples])

  useEffect(() => {
    saveProcessOptions(processOptions)
  }, [processOptions])

  useEffect(() => {
    savePans(pans)
  }, [pans])

  function focusIngredientField(id: string, field: 'name' | 'amt') {
    const element = document.getElementById(`${field === 'amt' ? 'ing-amt-' : 'ing-'}${id}`)
    if (!(element instanceof HTMLInputElement)) return
    element.focus()
    if (field === 'amt') element.select()
  }

  function onIngredientKeyDown(event: React.KeyboardEvent<HTMLInputElement>, item: Ingredient, index: number, field: 'name' | 'amt') {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    if (field === 'name') {
      focusIngredientField(item.id, 'amt')
      return
    }
    const next = draft.ingredients[index + 1]
    if (next) {
      focusIngredientField(next.id, 'name')
      return
    }
    addIngredient(item.id)
  }

  function addIngredient(afterId?: string) {
    const created = emptyIngredient()
    focusIngredient.current = { id: created.id, field: 'name' }
    setDraft((current) => {
      const next = current.ingredients.slice()
      const index = afterId ? current.ingredients.findIndex((item) => item.id === afterId) : next.length - 1
      next.splice(index + 1, 0, created)
      return { ...current, ingredients: next }
    })
  }

  function addFromStaple(staple: Staple) {
    setDraft((current) => {
      const blank = [...current.ingredients].reverse().find((item) => !item.name.trim() && !item.amount)
      if (blank) {
        focusIngredient.current = { id: blank.id, field: 'amt' }
        return {
          ...current,
          ingredients: current.ingredients.map((item) =>
            item.id === blank.id ? { ...item, name: staple.name, unit: staple.unit } : item,
          ),
        }
      }
      const created = { ...emptyIngredient(), name: staple.name, unit: staple.unit }
      focusIngredient.current = { id: created.id, field: 'amt' }
      return { ...current, ingredients: [...current.ingredients, created] }
    })
  }

  function updateStaple(id: string, partial: Partial<Staple>) {
    setStaples((current) => current.map((item) => (item.id === id ? { ...item, ...partial } : item)))
  }

  function removeStaple(id: string) {
    setStaples((current) => current.filter((item) => item.id !== id))
  }

  function addStaple() {
    const name = stapleName.trim()
    if (!name) return
    setStaples((current) => [...current, { id: uid(), name, unit: 'g' }])
    setStapleName('')
  }

  useEffect(() => {
    const list = ingredientListRef.current
    if (!list) return
    const root: HTMLElement = list

    function targetIndex(clientY: number) {
      const rows = root.querySelectorAll<HTMLElement>('[data-ing-id]')
      if (!rows.length) return -1
      let target = 0
      rows.forEach((row, index) => {
        const rect = row.getBoundingClientRect()
        if (clientY > rect.top + rect.height / 2) target = index
      })
      return target
    }

    function onDown(event: PointerEvent) {
      const handle = (event.target as Element | null)?.closest?.('.drag-handle')
      const row = handle?.closest<HTMLElement>('[data-ing-id]')
      if (!row?.dataset.ingId || event.button !== 0) return
      event.preventDefault()
      ingredientDrag.current = row.dataset.ingId
      setDraggingId(row.dataset.ingId)
      try {
        ;(handle as HTMLElement).setPointerCapture(event.pointerId)
      } catch {
        /* the pointer can still move the row */
      }
    }

    function onMove(event: PointerEvent) {
      const id = ingredientDrag.current
      if (!id || dragLock.current) return
      const rows = [...root.querySelectorAll<HTMLElement>('[data-ing-id]')]
      const from = rows.findIndex((row) => row.dataset.ingId === id)
      const to = targetIndex(event.clientY)
      if (from < 0 || to < 0 || from === to) return
      dragLock.current = true
      setDraft((current) => {
        const start = current.ingredients.findIndex((item) => item.id === id)
        if (start < 0 || start === to || to >= current.ingredients.length) {
          dragLock.current = false
          return current
        }
        const next = current.ingredients.slice()
        const [item] = next.splice(start, 1)
        next.splice(to, 0, item)
        return { ...current, ingredients: next }
      })
    }

    function onUp() {
      if (!ingredientDrag.current) return
      ingredientDrag.current = null
      setDraggingId(null)
    }

    root.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      root.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  useEffect(() => {
    stageLock.current = false
  }, [draft.stages])

  useEffect(() => {
    const list = stageListRef.current
    if (!list) return
    const root: HTMLElement = list

    function targetIndex(clientY: number) {
      const rows = root.querySelectorAll<HTMLElement>('[data-stage-id]')
      if (!rows.length) return -1
      let target = 0
      rows.forEach((row, index) => {
        const rect = row.getBoundingClientRect()
        if (clientY > rect.top + rect.height / 2) target = index
      })
      return target
    }

    function onDown(event: PointerEvent) {
      const handle = (event.target as Element | null)?.closest?.('.drag-handle')
      const row = handle?.closest<HTMLElement>('[data-stage-id]')
      if (!row?.dataset.stageId || event.button !== 0) return
      event.preventDefault()
      stageDrag.current = row.dataset.stageId
      setDraggingId(row.dataset.stageId)
      try {
        ;(handle as HTMLElement).setPointerCapture(event.pointerId)
      } catch {
        /* the pointer can still move the row */
      }
    }

    function onMove(event: PointerEvent) {
      const id = stageDrag.current
      if (!id || stageLock.current) return
      const rows = [...root.querySelectorAll<HTMLElement>('[data-stage-id]')]
      const from = rows.findIndex((row) => row.dataset.stageId === id)
      const to = targetIndex(event.clientY)
      if (from < 0 || to < 0 || from === to) return
      stageLock.current = true
      setDraft((current) => {
        const start = current.stages.findIndex((item) => item.id === id)
        if (start < 0 || start === to || to >= current.stages.length) {
          stageLock.current = false
          return current
        }
        const next = current.stages.slice()
        const [item] = next.splice(start, 1)
        next.splice(to, 0, item)
        return { ...current, stages: next }
      })
    }

    function onUp() {
      if (!stageDrag.current) return
      stageDrag.current = null
      setDraggingId(null)
    }

    root.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      root.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  function patch(partial: Partial<Recipe>) {
    setDraft((current) => ({ ...current, ...partial }))
  }

  function patchStage(id: string, partial: Partial<ProcessStage>) {
    setDraft((current) => ({
      ...current,
      stages: current.stages.map((stage) => (stage.id === id ? { ...stage, ...partial } : stage)),
    }))
  }

  function setStageDuration(stage: ProcessStage, hours: number, minutes: number) {
    const nextHours = clamp(hours, 0, 72)
    const nextMinutes = clamp(minutes, 0, 59)
    patchStage(stage.id, { minutes: nextHours * 60 + nextMinutes })
  }

  function addProcess(option: ProcessOption) {
    setDraft((current) => {
      const stage = defaultStage(option.kind, current.stages)
      const keepDefaultLabel = (option.kind === 'ferment' && option.label.trim() === '발효') || option.id === 'process-shape'
      return {
        ...current,
        stages: [...current.stages, keepDefaultLabel ? stage : { ...stage, label: option.label.trim() }],
      }
    })
  }

  function updateProcessOption(id: string, partial: Partial<ProcessOption>) {
    setProcessOptions((current) => current.map((item) => (item.id === id ? { ...item, ...partial } : item)))
  }

  function removeProcessOption(id: string) {
    setProcessOptions((current) => current.filter((item) => item.id !== id))
  }

  function addProcessOption() {
    const label = processName.trim()
    if (!label) return
    setProcessOptions((current) => [...current, { id: uid(), label, kind: processKind }])
    setProcessName('')
    setProcessKind('knead')
  }

  function togglePan(id: string) {
    setDraft((current) => {
      const ids = panIdsOf(current.panIds)
      return { ...current, panIds: ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id] }
    })
  }

  function updatePan(id: string, name: string) {
    setPans((current) => current.map((pan) => (pan.id === id ? { ...pan, name } : pan)))
  }

  function removePan(id: string) {
    setPans((current) => current.filter((pan) => pan.id !== id))
    setDraft((current) => ({ ...current, panIds: panIdsOf(current.panIds).filter((item) => item !== id) }))
  }

  function addPan() {
    const name = panName.trim()
    if (!name) return
    setPans((current) => [...current, { id: uid(), name }])
    setPanName('')
  }

  function patchIngredient(id: string, partial: Partial<Ingredient>) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((item) => (item.id === id ? { ...item, ...partial } : item)),
    }))
  }

  function pendingNote(): NoteEntry | null {
    const text = noteText.trim()
    if (!text) return null
    const now = new Date()
    return {
      id: uid(),
      date: todayISO(now),
      time: formatClock(now),
      text,
    }
  }

  function submit() {
    const extra = pendingNote()
    const next = clean(extra ? { ...draft, notes: [extra, ...(draft.notes ?? [])] } : draft)
    if (!next.name) {
      setError('이름을 입력해 주세요.')
      return
    }
    if (next.ingredients.length === 0) {
      setError('재료를 하나 이상 입력해 주세요.')
      return
    }
    if (next.ingredients.some((item) => !Number.isFinite(item.amount) || item.amount <= 0)) {
      setError('재료 양은 0보다 커야 합니다.')
      return
    }
    if (!next.stages.some((stage) => stage.minutes > 0)) {
      setError('공정을 하나 이상 입력해 주세요.')
      return
    }
    setError('')
    onSave(next)
  }

  const preview = isNew ? [] : buildStages(draft, combineDateTime(todayISO(), draft.startTime))

  return (
    <form
      className="wrap editor"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <button type="button" className="back-link" onClick={onCancel}>
        {backLabel}
      </button>
      <div className="editor-lead">
        <p className="eyebrow">{isNew ? 'New recipe' : 'Edit'}</p>
        <h2>{isNew ? '새 발효빵' : '레시피 다듬기'}</h2>
      </div>

      <div className="section-h">
        <span>01</span>
        <div>
          <h3>기본</h3>
          <p>이름, 상태, 참고한 책을 적습니다.</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="recipe-name">이름</label>
        <input
          id="recipe-name"
          ref={nameRef}
          className="name-input"
          value={draft.name}
          maxLength={80}
          placeholder="예: 주말 사워도우"
          onChange={(event) => patch({ name: event.target.value })}
        />
      </div>
      <div className="segment" role="group" aria-label="제과 제빵">
        {(Object.keys(CRAFT_LABEL) as Craft[]).map((craft) => (
          <button
            key={craft}
            type="button"
            aria-pressed={(draft.craft ?? 'bread') === craft}
            onClick={() => patch({ craft })}
          >
            {CRAFT_LABEL[craft]}
          </button>
        ))}
      </div>
      <div className="field">
        <span className="note-label">상태</span>
        <StatusPicker value={recipeStatus(draft.status)} onChange={(status) => patch({ status })} />
      </div>
      <div className="field">
        <label htmlFor="summary">한 줄 메모</label>
        <textarea
          id="summary"
          rows={2}
          maxLength={180}
          value={draft.summary}
          placeholder="식감, 종, 주의할 점"
          onChange={(event) => patch({ summary: event.target.value })}
        />
      </div>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="source-book">참고 책</label>
          <input
            id="source-book"
            value={draft.sourceBook}
            maxLength={80}
            placeholder="책 제목"
            onChange={(event) => patch({ sourceBook: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="source-page">페이지</label>
          <input
            id="source-page"
            value={draft.sourcePage}
            maxLength={40}
            placeholder="128"
            onChange={(event) => patch({ sourcePage: event.target.value })}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="source-url">영상 링크</label>
        <input
          id="source-url"
          value={draft.sourceUrl}
          maxLength={300}
          placeholder="https://www.youtube.com/watch?v="
          onChange={(event) => patch({ sourceUrl: event.target.value })}
        />
      </div>
      <div className="field">
        <span className="note-label" id="personal-note-label">개인 노트</span>
        <textarea
          id="personal-note"
          aria-labelledby="personal-note-label"
          rows={2}
          maxLength={4000}
          value={noteText}
          placeholder="저장하면 지금 날짜와 시각이 함께 남습니다"
          onChange={(event) => setNoteText(event.target.value)}
        />
        <div className="note-actions">
          <button
            type="button"
            className="btn btn-line btn-tiny"
            disabled={!noteText.trim()}
            onClick={() => {
              const entry = pendingNote()
              if (!entry) return
              patch({ notes: [entry, ...(draft.notes ?? [])] })
              setNoteText('')
            }}
          >
            노트 추가
          </button>
        </div>
        {(draft.notes ?? []).length > 0 ? (
          <ul className="note-log">
            {(draft.notes ?? []).map((entry) => (
              <li key={entry.id}>
                <div className="note-log-head">
                  <time dateTime={`${entry.date}T${entry.time}`}>
                    {formatKoreanDate(combineDateTime(entry.date, entry.time))} {formatClock(combineDateTime(entry.date, entry.time))}
                  </time>
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => patch({ notes: (draft.notes ?? []).filter((note) => note.id !== entry.id) })}
                  >
                    삭제
                  </button>
                </div>
                <p>{entry.text}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="yield">분량</label>
          <input
            id="yield"
            value={draft.yieldLabel}
            maxLength={40}
            placeholder="식빵 1줄"
            onChange={(event) => patch({ yieldLabel: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="start-time">기본 시작 시각</label>
          <input
            id="start-time"
            type="time"
            value={draft.startTime}
            onChange={(event) => patch({ startTime: event.target.value })}
          />
        </div>
      </div>
      <div className="staple-box">
        <div className="staple-head">
          <span>빵틀</span>
          <button type="button" className="text-btn" onClick={() => setManagingPans((current) => !current)}>
            {managingPans ? '완료' : '목록 편집'}
          </button>
        </div>
        {managingPans ? (
          <>
            {pans.map((pan) => (
              <div className="staple-edit" key={pan.id}>
                <input
                  aria-label={`${pan.name} 이름`}
                  value={pan.name}
                  maxLength={40}
                  onChange={(event) => updatePan(pan.id, event.target.value)}
                  onBlur={() => {
                    const name = pan.name.trim()
                    if (!name) removePan(pan.id)
                    else if (name !== pan.name) updatePan(pan.id, name)
                  }}
                />
                <button type="button" className="icon-btn danger" aria-label={`${pan.name} 틀 삭제`} onClick={() => removePan(pan.id)}>
                  ×
                </button>
              </div>
            ))}
            <div className="staple-edit">
              <input
                aria-label="새 빵틀"
                value={panName}
                maxLength={40}
                placeholder="틀 이름, 예: 450g 식빵틀"
                onChange={(event) => setPanName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return
                  event.preventDefault()
                  addPan()
                }}
              />
              <button type="button" className="icon-btn" aria-label="빵틀 추가" disabled={!panName.trim()} onClick={addPan}>
                +
              </button>
            </div>
          </>
        ) : pans.length === 0 ? (
          <p className="fine">목록 편집에서 쓰는 빵틀을 추가하세요.</p>
        ) : (
          <div className="pan-picks">
            {pans.map((pan) => {
              const selected = panIdsOf(draft.panIds).includes(pan.id)
              return (
                <button key={pan.id} type="button" aria-pressed={selected} onClick={() => togglePan(pan.id)}>
                  {pan.name}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="section-h">
        <span>02</span>
        <div>
          <h3>재료</h3>
          <p>자주 쓰는 재료를 누르면 그 줄이 추가됩니다. 손잡이를 끌어 순서를 바꿉니다.</p>
        </div>
      </div>
      <FormulaScale
        flour={flourGrams(draft.ingredients)}
        count={countOr(draft.yieldCount)}
        applyLabel="이 비율로 양 바꾸기"
        onApply={(next) => {
          const count = countOr(draft.yieldCount)
          patch({
            ingredients: scaleIngredients(draft.ingredients, next.factor),
            yieldCount: next.mode === 'count' ? next.yieldCount : count,
            yieldLabel: next.mode === 'count' ? rewriteYieldCount(draft.yieldLabel, count, next.yieldCount) : draft.yieldLabel,
          })
        }}
      />
      <div className="ing-list" ref={ingredientListRef}>
        {draft.ingredients.map((item, index) => (
          <div className={draggingId === item.id ? 'ing-edit is-dragging' : 'ing-edit'} key={item.id} data-ing-id={item.id}>
            <button type="button" className="drag-handle" aria-label={`${item.name || '재료'} 순서 변경`}>
              <span aria-hidden="true" />
            </button>
            <input
              id={`ing-${item.id}`}
              className="name"
              aria-label={`재료 ${index + 1}`}
              value={item.name}
              placeholder="강력분"
              onChange={(event) => patchIngredient(item.id, { name: event.target.value })}
              onKeyDown={(event) => onIngredientKeyDown(event, item, index, 'name')}
            />
            <input
              id={`ing-amt-${item.id}`}
              className="amt"
              aria-label={`${item.name || '재료'} 양`}
              type="number"
              min={0}
              step="any"
              value={Number.isFinite(item.amount) ? item.amount : 0}
              onChange={(event) => patchIngredient(item.id, { amount: event.target.valueAsNumber })}
              onKeyDown={(event) => onIngredientKeyDown(event, item, index, 'amt')}
            />
            <select
              aria-label={`${item.name || '재료'} 단위`}
              value={item.unit}
              onChange={(event) => patchIngredient(item.id, { unit: event.target.value as Ingredient['unit'] })}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="icon-btn danger"
              aria-label="재료 삭제"
              onClick={() => patch({ ingredients: draft.ingredients.filter((row) => row.id !== item.id) })}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="staple-box">
        <div className="staple-head">
          <span>자주 쓰는 재료</span>
          <button type="button" className="text-btn" onClick={() => setManagingStaples((current) => !current)}>
            {managingStaples ? '완료' : '목록 편집'}
          </button>
        </div>
        {managingStaples ? (
          <>
            {staples.map((staple) => (
              <div className="staple-edit" key={staple.id}>
                <input
                  aria-label={`${staple.name} 이름`}
                  value={staple.name}
                  maxLength={40}
                  onChange={(event) => updateStaple(staple.id, { name: event.target.value })}
                  onBlur={() => {
                    const name = staple.name.trim()
                    if (!name) removeStaple(staple.id)
                    else if (name !== staple.name) updateStaple(staple.id, { name })
                  }}
                />
                <button type="button" className="icon-btn danger" aria-label={`${staple.name} 목록에서 삭제`} onClick={() => removeStaple(staple.id)}>
                  ×
                </button>
              </div>
            ))}
            <div className="staple-edit">
              <input
                aria-label="새 자주 쓰는 재료"
                value={stapleName}
                maxLength={40}
                placeholder="재료 이름"
                onChange={(event) => setStapleName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addStaple()
                  }
                }}
              />
              <button type="button" className="icon-btn" aria-label="자주 쓰는 재료 추가" disabled={!stapleName.trim()} onClick={addStaple}>
                +
              </button>
            </div>
          </>
        ) : staples.length === 0 ? (
          <p className="fine">목록 편집에서 자주 쓰는 재료를 추가하세요.</p>
        ) : (
          <div className="staple-picks">
            {staples.map((staple) => (
              <button type="button" key={staple.id} onClick={() => addFromStaple(staple)}>
                {staple.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="add-row" onClick={() => addIngredient()}>
        재료 추가
      </button>

      <div className="section-h">
        <span>03</span>
        <div>
          <h3>공정</h3>
          <p>발효가 없으면 그 줄을 지웁니다. 손잡이를 끌어 순서를 바꿉니다.</p>
        </div>
      </div>
      <div className="staple-box">
        <div className="staple-head">
          <span>공정 선택</span>
          <button type="button" className="text-btn" onClick={() => setManagingProcesses((current) => !current)}>
            {managingProcesses ? '완료' : '목록 편집'}
          </button>
        </div>
        {managingProcesses ? (
          <>
            {processOptions.map((option) => (
              <div className="staple-edit process-option-edit" key={option.id}>
                <input
                  aria-label={`${option.label} 이름`}
                  value={option.label}
                  maxLength={40}
                  onChange={(event) => updateProcessOption(option.id, { label: event.target.value })}
                  onBlur={() => {
                    const label = option.label.trim()
                    if (!label) removeProcessOption(option.id)
                    else if (label !== option.label) updateProcessOption(option.id, { label })
                  }}
                />
                <select
                  aria-label={`${option.label} 종류`}
                  value={option.kind}
                  onChange={(event) => updateProcessOption(option.id, { kind: event.target.value as ProcessKind })}
                >
                  {(Object.keys(PROCESS_KIND_LABEL) as ProcessKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {PROCESS_KIND_LABEL[kind]}
                    </option>
                  ))}
                </select>
                <button type="button" className="icon-btn danger" aria-label={`${option.label} 선택지에서 삭제`} onClick={() => removeProcessOption(option.id)}>
                  ×
                </button>
              </div>
            ))}
            <div className="staple-edit process-option-edit">
              <input
                aria-label="새 공정 이름"
                value={processName}
                maxLength={40}
                placeholder="공정 이름"
                onChange={(event) => setProcessName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addProcessOption()
                  }
                }}
              />
              <select aria-label="새 공정 종류" value={processKind} onChange={(event) => setProcessKind(event.target.value as ProcessKind)}>
                {(Object.keys(PROCESS_KIND_LABEL) as ProcessKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {PROCESS_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
              <button type="button" className="icon-btn" aria-label="공정 선택지 추가" disabled={!processName.trim()} onClick={addProcessOption}>
                +
              </button>
            </div>
          </>
        ) : processOptions.length === 0 ? (
          <p className="fine">목록 편집에서 공정 선택지를 추가하세요.</p>
        ) : (
          <div className="stage-picks">
            {processOptions.map((option) => (
              <button type="button" key={option.id} onClick={() => addProcess(option)}>
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="stage-columns" aria-hidden="true">
        <span />
        <span>이름</span>
        <span>시간</span>
        <span>분</span>
        <span>°C</span>
        <span />
      </div>
      <div className="stage-list" ref={stageListRef}>
        {draft.stages.map((stage) => {
          const hours = Math.floor(stage.minutes / 60)
          const minutes = stage.minutes % 60
          const timed = usesTemp(stage.kind)
          return (
            <div className={draggingId === stage.id ? 'stage-edit is-dragging' : 'stage-edit'} key={stage.id} data-stage-id={stage.id}>
              <button type="button" className="drag-handle" aria-label={`${stage.label || '공정'} 순서 변경`}>
                <span aria-hidden="true" />
              </button>
              <input
                aria-label={`${stage.label || '공정'} 이름`}
                value={stage.label}
                maxLength={40}
                onChange={(event) => patchStage(stage.id, { label: event.target.value })}
              />
              <input
                aria-label={`${stage.label || '공정'} 시간`}
                type="number"
                min={0}
                max={72}
                value={hours}
                onChange={(event) => setStageDuration(stage, event.target.valueAsNumber, minutes)}
              />
              <input
                aria-label={`${stage.label || '공정'} 분`}
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(event) => setStageDuration(stage, hours, event.target.valueAsNumber)}
              />
              <input
                aria-label={`${stage.label || '공정'} 온도`}
                type="number"
                min={0}
                max={stage.kind === 'bake' ? 300 : 45}
                disabled={!timed}
                value={timed ? (stage.tempC ?? 0) : ''}
                placeholder={timed ? '°C' : '—'}
                onChange={(event) => patchStage(stage.id, { tempC: event.target.valueAsNumber })}
              />
              <button
                type="button"
                className="icon-btn danger"
                aria-label={`${stage.label || '공정'} 삭제`}
                onClick={() => patch({ stages: draft.stages.filter((item) => item.id !== stage.id) })}
              >
                ×
              </button>
              {stage.kind === 'ferment' ? (
                <input
                  className="stage-note"
                  aria-label={`${stage.label || '발효'} 메모`}
                  maxLength={200}
                  value={stage.note}
                  placeholder="예: 30분마다 코일 폴드"
                  onChange={(event) => patchStage(stage.id, { note: event.target.value })}
                />
              ) : null}
            </div>
          )
        })}
      </div>
      <p className="fine">10°C 이하는 타임라인에 저온으로 표시됩니다. 발효 줄은 없어도 됩니다.</p>

      <div className="section-h">
        <span>04</span>
        <div>
          <h3>과정</h3>
          <p>한 줄이 한 단계입니다.</p>
        </div>
      </div>
      {draft.steps.map((step, index) => (
        <div className="step-edit" key={`step-${index}`}>
          <span className="line-index">{index + 1}</span>
          <textarea
            rows={2}
            maxLength={400}
            aria-label={`과정 ${index + 1}`}
            value={step}
            placeholder="반죽하고 30분 둔다"
            onChange={(event) => {
              const steps = draft.steps.slice()
              steps[index] = event.target.value
              patch({ steps })
            }}
          />
          <button type="button" className="icon-btn" aria-label="위로" disabled={index === 0} onClick={() => patch({ steps: moveItem(draft.steps, index, -1) })}>
            ↑
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="아래로"
            disabled={index === draft.steps.length - 1}
            onClick={() => patch({ steps: moveItem(draft.steps, index, 1) })}
          >
            ↓
          </button>
          <button
            type="button"
            className="icon-btn danger"
            aria-label="과정 삭제"
            onClick={() => patch({ steps: draft.steps.filter((_, stepIndex) => stepIndex !== index) })}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="add-row" onClick={() => patch({ steps: [...draft.steps, ''] })}>
        과정 추가
      </button>

      {isNew ? null : (
        <>
          <div className="section-h">
            <span>05</span>
            <div>
              <h3>타임라인 미리보기</h3>
              <p>오늘 날짜와 위의 시작 시각 기준입니다.</p>
            </div>
          </div>
          <Timeline stages={preview} now={new Date()} />
        </>
      )}

      <div className="editor-bar">
        <p className="error" role="alert">
          {error}
        </p>
        <div className="editor-actions">
          <button type="button" className="btn btn-line" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="btn btn-primary">
            레시피 저장
          </button>
        </div>
      </div>
    </form>
  )
}
