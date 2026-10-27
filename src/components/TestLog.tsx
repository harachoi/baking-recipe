import { useState } from 'react'
import { combineDateTime, formatAmount, formatClock, formatKoreanDate, todayISO } from '../math'
import { emptyIngredient, uid } from '../recipe'
import { diffIngredients, type TestChange } from '../testBake'
import type { Ingredient, Recipe, TestBake, Unit } from '../types'
import { UNITS } from '../types'

function copyIngredients(items: Ingredient[]): Ingredient[] {
  const named = items.filter((item) => item.name.trim())
  const source = named.length > 0 ? named : [emptyIngredient()]
  return source.map((item) => ({ ...item, id: uid() }))
}

function qty(amount: number, unit: Unit) {
  return `${formatAmount(amount)}${unit}`
}

function DiffList({ changes }: { changes: TestChange[] }) {
  if (changes.length === 0) return <p className="test-same">현재 레시피와 같은 용량</p>
  return (
    <ul className="test-diff">
      {changes.map((change, index) => {
        if (change.kind === 'added') {
          return (
            <li key={`add-${index}-${change.name}`}>
              <span className="test-kind added">추가</span>
              <span>
                {change.name} {qty(change.amount, change.unit)}
              </span>
            </li>
          )
        }
        if (change.kind === 'removed') {
          return (
            <li key={`drop-${index}-${change.name}`}>
              <span className="test-kind removed">빠짐</span>
              <span>
                {change.name} {qty(change.amount, change.unit)}
              </span>
            </li>
          )
        }
        return (
          <li key={`chg-${index}-${change.name}`}>
            <span className="test-kind changed">변경</span>
            <span>
              {change.name} {qty(change.fromAmount, change.fromUnit)} → {qty(change.toAmount, change.toUnit)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function TestLog({ recipe, onSave }: { recipe: Recipe; onSave: (tests: TestBake[]) => void }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => copyIngredients(recipe.ingredients))
  const [taste, setTaste] = useState('')
  const [error, setError] = useState('')
  const tests = recipe.tests ?? []
  const preview = diffIngredients(recipe.ingredients, ingredients)

  function patchIngredient(id: string, partial: Partial<Ingredient>) {
    setIngredients((current) => current.map((item) => (item.id === id ? { ...item, ...partial } : item)))
  }

  function addIngredient(afterId?: string) {
    const created = emptyIngredient()
    setIngredients((current) => {
      const next = current.slice()
      const index = afterId ? current.findIndex((item) => item.id === afterId) : next.length - 1
      next.splice(index + 1, 0, created)
      return next
    })
    window.setTimeout(() => document.getElementById(`test-ing-${created.id}`)?.focus(), 0)
  }

  function saveTest() {
    const rows = ingredients
      .filter((item) => item.name.trim())
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        amount: Number.isFinite(item.amount) ? Math.round(item.amount * 100) / 100 : 0,
      }))
    const tasteText = taste.trim()
    if (rows.length === 0) {
      setError('테스트에 쓴 재료를 하나 이상 적어 주세요.')
      return
    }
    const now = new Date()
    const entry: TestBake = {
      id: uid(),
      date: todayISO(now),
      time: formatClock(now),
      ingredients: rows,
      taste: tasteText,
    }
    onSave([entry, ...tests])
    setIngredients(copyIngredients(recipe.ingredients))
    setTaste('')
    setError('')
  }

  return (
    <section className="panel test-panel">
      <header className="panel-head">
        <h3>테스트 레시피</h3>
        <span>저장하면 날짜와 시각이 남습니다</span>
      </header>
      <p className="fine">이번 테스트 용량을 적으면 현재 레시피에서 추가되거나 양이 바뀐 재료가 표시됩니다.</p>

      <div className="test-ings">
        {ingredients.map((item, index) => (
          <div className="test-ing" key={item.id}>
            <input
              id={`test-ing-${item.id}`}
              aria-label={`테스트 재료 ${index + 1}`}
              value={item.name}
              placeholder="재료"
              maxLength={40}
              onChange={(event) => patchIngredient(item.id, { name: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addIngredient(item.id)
                }
              }}
            />
            <input
              aria-label={`${item.name || '재료'} 테스트 양`}
              type="number"
              min={0}
              step="any"
              value={Number.isFinite(item.amount) ? item.amount : 0}
              onChange={(event) => patchIngredient(item.id, { amount: event.target.valueAsNumber })}
            />
            <select
              aria-label={`${item.name || '재료'} 단위`}
              value={item.unit}
              onChange={(event) => patchIngredient(item.id, { unit: event.target.value as Unit })}
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
              aria-label={`${item.name || '재료'} 테스트에서 빼기`}
              onClick={() => setIngredients((current) => current.filter((row) => row.id !== item.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="add-row" onClick={() => addIngredient()}>
        재료 추가
      </button>

      <div className="test-compare">
        <p>현재 레시피와 비교</p>
        <DiffList changes={preview} />
      </div>

      <label className="field">
        맛
        <textarea
          rows={2}
          maxLength={2000}
          value={taste}
          placeholder="껍질, 속결, 짠맛, 신맛처럼 이번에 느낀 맛"
          onChange={(event) => setTaste(event.target.value)}
        />
      </label>
      {error ? (
        <p className="test-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="note-actions">
        <button type="button" className="btn btn-primary btn-tiny" onClick={saveTest}>
          테스트 저장
        </button>
      </div>

      {tests.length > 0 ? (
        <ul className="test-log">
          {[...tests]
            .sort((a, b) => combineDateTime(b.date, b.time).getTime() - combineDateTime(a.date, a.time).getTime())
            .map((entry) => {
              const at = combineDateTime(entry.date, entry.time)
              const changes = diffIngredients(recipe.ingredients, entry.ingredients)
              return (
                <li key={entry.id}>
                  <div className="note-log-head">
                    <time dateTime={`${entry.date}T${entry.time}`}>
                      {formatKoreanDate(at)} {formatClock(at)}
                    </time>
                    <button type="button" className="text-btn" onClick={() => onSave(tests.filter((item) => item.id !== entry.id))}>
                      삭제
                    </button>
                  </div>
                  <DiffList changes={changes} />
                  {entry.taste ? <p className="test-taste">{entry.taste}</p> : null}
                </li>
              )
            })}
        </ul>
      ) : null}
    </section>
  )
}
