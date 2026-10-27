import { useEffect, useRef, useState } from 'react'
import { ingredientHit } from '../filter'
import {
  bakersPercent,
  buildStages,
  combineDateTime,
  countOr,
  doughGrams,
  finishPhrase,
  flourGrams,
  formatAmount,
  formatClock,
  formatDuration,
  formatKoreanDate,
  formatPercent,
  liquidRatio,
  rewriteYieldCount,
  roundedNowTime,
  scaleIngredients,
  todayISO,
  tomorrowISO,
  totalMinutes,
} from '../math'
import { recipeStatus, sourceLabel, uid } from '../recipe'
import { panNames } from '../pans'
import type { NoteEntry, Pan, Recipe, RecipeStatus, TestBake } from '../types'
import { CRAFT_LABEL, DOUGH_LABEL } from '../types'
import { FormulaScale, type ScaleDraft } from './FormulaScale'
import { StatusPicker } from './StatusPicker'
import { RecipeVideo } from './RecipeVideo'
import { TestLog } from './TestLog'
import { Timeline } from './Timeline'

export function Detail({
  recipe,
  query,
  filters,
  onBack,
  onEdit,
  onDuplicate,
  onDelete,
  onSaveStartTime,
  onSaveNotes,
  onSaveTests,
  onSaveFormula,
  onStatus,
  pans,
}: {
  recipe: Recipe
  query: string
  filters: string[]
  onBack: () => void
  onEdit: (notes: NoteEntry[]) => void
  onDuplicate: (notes: NoteEntry[]) => void
  onDelete: () => void
  onSaveStartTime: (time: string) => void
  onSaveNotes: (notes: NoteEntry[]) => void
  onSaveTests: (tests: TestBake[]) => void
  onSaveFormula: (patch: Pick<Recipe, 'ingredients' | 'yieldCount' | 'yieldLabel'>) => void
  onStatus: (status: RecipeStatus | null) => void
  pans: Pan[]
}) {
  const [date, setDate] = useState(todayISO)
  const [time, setTime] = useState(recipe.startTime)
  const [noteText, setNoteText] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [confirming, setConfirming] = useState(false)
  const [scale, setScale] = useState<ScaleDraft | null>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const savedNotes = recipe.notes ?? []

  useEffect(() => {
    setDate(todayISO())
    setTime(recipe.startTime || '08:00')
    setNoteText('')
    setNoteOpen(false)
    setConfirming(false)
  }, [recipe.id])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!confirming && !noteOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (noteOpen) closeNote()
      else setConfirming(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirming, noteOpen])

  useEffect(() => {
    if (!noteOpen) return
    noteRef.current?.focus()
  }, [noteOpen])

  const start = combineDateTime(date, time)
  const stages = buildStages(recipe, start)
  const finish = stages.length ? stages[stages.length - 1].to : start
  const live = stages.find((stage) => now >= stage.from && now < stage.to)
  const baseCount = countOr(recipe.yieldCount)
  const factor = scale?.valid ? scale.factor : 1
  const shownIngredients = factor === 1 ? recipe.ingredients : scaleIngredients(recipe.ingredients, factor)
  const shownLabel =
    scale?.valid && scale.mode === 'count' ? rewriteYieldCount(recipe.yieldLabel, baseCount, scale.yieldCount) : recipe.yieldLabel
  const flour = flourGrams(shownIngredients)
  const dough = doughGrams(shownIngredients)
  const ratio = liquidRatio(shownIngredients)
  const showPercent = flour > 0

  function closeNote() {
    setNoteText('')
    setNoteOpen(false)
  }

  function saveNote() {
    const text = noteText.trim()
    if (!text) return
    const at = new Date()
    const entry: NoteEntry = {
      id: uid(),
      date: todayISO(at),
      time: formatClock(at),
      text,
    }
    onSaveNotes([entry, ...savedNotes])
    closeNote()
  }

  return (
    <div className="wrap">
      <button type="button" className="back-link" onClick={onBack}>
        목록으로
      </button>
      <header className="detail-top">
        <div>
          <p className="kicker">
            {CRAFT_LABEL[recipe.craft ?? 'bread']} · {DOUGH_LABEL[recipe.doughType]}
          </p>
          <h2>{recipe.name}</h2>
          {recipe.summary ? <p className="summary">{recipe.summary}</p> : null}
          {sourceLabel(recipe) ? <p className="source-line">{sourceLabel(recipe)}</p> : null}
          <RecipeVideo url={recipe.sourceUrl ?? ''} />
          <StatusPicker value={recipeStatus(recipe.status)} onChange={onStatus} />
        </div>
        <div className="detail-actions">
          <button type="button" className="btn btn-line" onClick={() => onEdit(savedNotes)}>
            편집
          </button>
          <button type="button" className="btn btn-line" onClick={() => onDuplicate(savedNotes)}>
            복제
          </button>
          <button type="button" className="btn btn-line" onClick={() => setNoteOpen(true)}>
            노트 추가
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
            삭제
          </button>
        </div>
      </header>

      <div className="stat-row">
        <article className="stat">
          <span>분량</span>
          <strong>{shownLabel || `${formatAmount(scale?.valid && scale.mode === 'count' ? scale.yieldCount : baseCount)}개`}</strong>
        </article>
        {panNames(recipe.panIds, pans).length > 0 ? (
          <article className="stat">
            <span>빵틀</span>
            <strong>{panNames(recipe.panIds, pans).join(' · ')}</strong>
          </article>
        ) : null}
        {ratio ? (
          <article className="stat">
            <span>{ratio.label}</span>
            <strong>{formatPercent(ratio.percent)}</strong>
            <small>{ratio.caption}</small>
          </article>
        ) : null}
        <article className="stat">
          <span>총 시간</span>
          <strong>{formatDuration(totalMinutes(recipe))}</strong>
        </article>
        {(() => {
          const bake = (recipe.stages ?? []).find((stage) => stage.kind === 'bake' && stage.minutes > 0)
          if (!bake) return null
          return (
            <article className="stat">
              <span>굽기</span>
              <strong>{bake.tempC == null ? '—' : `${Math.round(bake.tempC)}°C`}</strong>
              <small>{formatDuration(bake.minutes)}</small>
            </article>
          )
        })()}
      </div>

      {savedNotes.length > 0 ? (
        <section className="panel note-panel">
          <header className="panel-head">
            <h3>개인 노트</h3>
            <span>{savedNotes.length}개</span>
          </header>
          <ul className="note-log">
            {[...savedNotes]
              .sort((a, b) => combineDateTime(b.date, b.time).getTime() - combineDateTime(a.date, a.time).getTime())
              .map((entry) => {
                const at = combineDateTime(entry.date, entry.time)
                return (
                  <li key={entry.id}>
                    <div className="note-log-head">
                      <time dateTime={`${entry.date}T${entry.time}`}>
                        {formatKoreanDate(at)} {formatClock(at)}
                      </time>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => onSaveNotes(savedNotes.filter((note) => note.id !== entry.id))}
                      >
                        삭제
                      </button>
                    </div>
                    <p>{entry.text}</p>
                  </li>
                )
              })}
          </ul>
        </section>
      ) : null}

      <div className="detail-grid">
        <div className="detail-notes">
          <section className="panel">
            <header className="panel-head">
              <h3>재료</h3>
              <span>
                {factor !== 1 ? '미리보기 · ' : ''}
                {flour > 0 ? `밀가루 ${formatAmount(flour)}g` : '밀가루 없음'}
                {dough > 0 ? ` · 약 ${formatAmount(dough)}g` : ''}
              </span>
            </header>
            <FormulaScale
              flour={flourGrams(recipe.ingredients)}
              count={baseCount}
              applyLabel="이 비율로 저장"
              onChange={setScale}
              onApply={(draft) => {
                const nextCount = draft.mode === 'count' ? draft.yieldCount : baseCount
                setScale(null)
                onSaveFormula({
                  ingredients: scaleIngredients(recipe.ingredients, draft.factor),
                  yieldCount: nextCount,
                  yieldLabel: draft.mode === 'count' ? rewriteYieldCount(recipe.yieldLabel, baseCount, draft.yieldCount) : recipe.yieldLabel,
                })
              }}
            />
            <ul className={showPercent ? `ings has-pct${factor !== 1 ? ' is-preview' : ''}` : `ings${factor !== 1 ? ' is-preview' : ''}`}>
              {showPercent ? (
                <li className="ing ing-head">
                  <span>재료</span>
                  <span>양</span>
                  <span>베이커스 %</span>
                </li>
              ) : null}
              {shownIngredients.map((item) => {
                const percent = bakersPercent(item.amount, item.unit, flour)
                const hit = ingredientHit(item.name, query, filters)
                return (
                  <li key={item.id} className={hit ? 'ing is-hit' : 'ing'}>
                    <span className="ing-name">{item.name}</span>
                    <span className="ing-amt">
                      {formatAmount(item.amount)}
                      {item.unit}
                    </span>
                    {showPercent ? <span className="ing-pct">{percent == null ? '—' : formatPercent(percent)}</span> : null}
                  </li>
                )
              })}
            </ul>
            {ratio?.preferment ? (
              <p className="fine">르방·풀리시 안의 물과 밀가루는 비율에 넣지 않았습니다.</p>
            ) : (
              <p className="fine">{ratio ? ratio.caption : '물이나 우유, 달걀이 있으면 액체 비율을 계산합니다.'}</p>
            )}
          </section>

          <section className="panel">
            <header className="panel-head">
              <h3>과정</h3>
            </header>
            {recipe.steps.length === 0 ? (
              <p className="fine">적힌 과정이 없습니다.</p>
            ) : (
              <ol className="step-list">
                {recipe.steps.map((step, index) => (
                  <li key={`${index}-${step}`}>
                    <span>{index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section className="schedule">
          <article className="finish-card">
            <div>
              <p className="eyebrow">{live ? `Now · ${live.label}` : 'Finish'}</p>
              <p className="finish-date">{formatKoreanDate(finish)}</p>
              <p className="finish-time">{formatClock(finish)}</p>
              <p className="finish-sub">{live ? `지금 ${live.label} 중입니다` : finishPhrase(start, finish)}</p>
            </div>
            <div className="finish-side">
              <span>시작 {formatClock(start)}</span>
              <strong>{formatDuration(totalMinutes(recipe))}</strong>
            </div>
          </article>

          <div className="planner">
            <div className="planner-row">
              <label>
                시작 날짜
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label>
                시작 시각
                <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
              </label>
            </div>
            <div className="quick-row">
              <button
                type="button"
                className="btn btn-line btn-tiny"
                onClick={() => {
                  setDate(todayISO())
                  setTime(roundedNowTime())
                }}
              >
                지금 시작
              </button>
              <button
                type="button"
                className="btn btn-line btn-tiny"
                onClick={() => {
                  setDate(tomorrowISO())
                  setTime('08:00')
                }}
              >
                내일 오전 8시
              </button>
              <button
                type="button"
                className="btn btn-primary btn-tiny"
                disabled={time === recipe.startTime}
                onClick={() => onSaveStartTime(time)}
              >
                이 시작 시각 기억
              </button>
            </div>
            <p className="fine">날짜는 이번 계획에만 쓰입니다. 레시피에 남는 것은 시작 시각입니다.</p>
          </div>

          <Timeline stages={stages} now={now} />
          <TestLog recipe={recipe} onSave={onSaveTests} />
        </section>
      </div>

      {noteOpen ? (
        <div
          className="modal-back"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeNote()
          }}
        >
          <div className="modal note-modal" role="dialog" aria-modal="true" aria-labelledby="note-title">
            <h3 id="note-title">개인 노트</h3>
            <p>저장하면 지금 날짜와 시각이 함께 남습니다.</p>
            <textarea
              ref={noteRef}
              value={noteText}
              rows={5}
              maxLength={4000}
              placeholder="오븐 상태, 발효가 느렸던 이유, 다음에 바꿀 점"
              onChange={(event) => setNoteText(event.target.value)}
            />
            <div className="modal-actions">
              <button type="button" className="btn btn-line" onClick={closeNote}>
                닫기
              </button>
              <button type="button" className="btn btn-primary" disabled={!noteText.trim()} onClick={saveNote}>
                노트 저장
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div
          className="modal-back"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirming(false)
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title">이 레시피를 지울까요</h3>
            <p>이 브라우저에 저장된 기록에서 빠집니다.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-line" onClick={() => setConfirming(false)}>
                남겨 두기
              </button>
              <button type="button" className="btn btn-primary" onClick={onDelete}>
                지우기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
