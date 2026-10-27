import { useEffect, useRef, useState } from 'react'
import { formatAmount } from '../math'

export type ScaleMode = 'flour' | 'count'

export interface ScaleDraft {
  mode: ScaleMode
  factor: number
  yieldCount: number
  valid: boolean
}

function nearlyOne(factor: number) {
  return Math.abs(factor - 1) < 0.0005
}

export function readScale(mode: ScaleMode, flour: number, count: number, flourText: string, countText: string): ScaleDraft {
  if (mode === 'flour') {
    const target = Number(flourText)
    const ok = flour > 0 && Number.isFinite(target) && target > 0 && target <= 50000
    const factor = ok ? target / flour : 1
    return { mode, factor, yieldCount: count, valid: ok && !nearlyOne(factor) }
  }
  const target = Number(countText)
  const ok = count > 0 && Number.isFinite(target) && target > 0 && target <= 99
  const factor = ok ? target / count : 1
  return {
    mode,
    factor,
    yieldCount: ok ? Math.round(target * 10) / 10 : count,
    valid: ok && !nearlyOne(factor),
  }
}

export function FormulaScale({
  flour,
  count,
  applyLabel,
  onChange,
  onApply,
}: {
  flour: number
  count: number
  applyLabel: string
  onChange?: (draft: ScaleDraft) => void
  onApply: (draft: ScaleDraft) => void
}) {
  const [mode, setMode] = useState<ScaleMode>('flour')
  const [flourText, setFlourText] = useState(() => (flour > 0 ? formatAmount(flour) : ''))
  const [countText, setCountText] = useState(() => formatAmount(count || 1))
  const onChangeRef = useRef(onChange)
  const modeRef = useRef(mode)
  onChangeRef.current = onChange
  modeRef.current = mode

  function publish(nextMode: ScaleMode, nextFlour: string, nextCount: string) {
    onChangeRef.current?.(readScale(nextMode, flour, count, nextFlour, nextCount))
  }

  useEffect(() => {
    const nextFlour = flour > 0 ? formatAmount(flour) : ''
    const nextCount = formatAmount(count || 1)
    setFlourText(nextFlour)
    setCountText(nextCount)
    onChangeRef.current?.(readScale(modeRef.current, flour, count, nextFlour, nextCount))
  }, [flour, count])

  const draft = readScale(mode, flour, count, flourText, countText)
  const flourBlocked = mode === 'flour' && flour <= 0

  return (
    <div className="scale-box">
      <p className="scale-title">비율 맞추기</p>
      <div className="segment" role="group" aria-label="맞출 기준">
        <button type="button" aria-pressed={mode === 'flour'} onClick={() => { setMode('flour'); publish('flour', flourText, countText) }}>
          밀가루
        </button>
        <button type="button" aria-pressed={mode === 'count'} onClick={() => { setMode('count'); publish('count', flourText, countText) }}>
          개수
        </button>
      </div>
      {mode === 'flour' ? (
        <label className="scale-line">
          <span>
            맞출 밀가루
            <small>{flour > 0 ? `지금 ${formatAmount(flour)}g` : '그램 밀가루 없음'}</small>
          </span>
          <input
            type="number"
            min={1}
            max={50000}
            step="any"
            inputMode="decimal"
            aria-label="맞출 밀가루 양"
            disabled={flourBlocked}
            value={flourText}
            onChange={(event) => {
              setFlourText(event.target.value)
              publish('flour', event.target.value, countText)
            }}
          />
        </label>
      ) : (
        <label className="scale-line">
          <span>
            맞출 개수
            <small>지금 {formatAmount(count)}개</small>
          </span>
          <input
            type="number"
            min={0.1}
            max={99}
            step="any"
            inputMode="decimal"
            aria-label="맞출 개수"
            value={countText}
            onChange={(event) => {
              setCountText(event.target.value)
              publish('count', flourText, event.target.value)
            }}
          />
        </label>
      )}
      <div className="scale-actions">
        <button type="button" className="btn btn-primary btn-tiny" disabled={!draft.valid} onClick={() => onApply(draft)}>
          {applyLabel}
        </button>
      </div>
      <p className="fine">
        {flourBlocked
          ? '그램으로 적힌 밀가루가 있으면 그 양에 맞춰 나머지 재료가 따라갑니다.'
          : '베이커스 %는 그대로 두고, 밀가루 양이나 개수에 맞춰 재료 양만 바꿉니다.'}
      </p>
    </div>
  )
}
