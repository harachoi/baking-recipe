import { useState, type CSSProperties } from 'react'
import {
  ingredientCatalog,
  normalize,
  type DoughFilter,
  type MatchMode,
  type StatusFilter,
  type TimeRange,
} from '../filter'
import { formatDuration, totalMinutes } from '../math'
import { panNames } from '../pans'
import { recipeStatus, sourceLabel } from '../recipe'
import { youtubeId } from '../youtube'
import type { DoughType, Pan, Recipe } from '../types'
import { CRAFT_LABEL, DOUGH_LABEL, RECIPE_STATUS } from '../types'
import { Mark } from './Mark'

const DOUGH_FILTERS: Array<{ id: DoughFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'pastry', label: '제과' },
  { id: 'bread', label: '제빵' },
  { id: 'natural', label: '자연발효' },
  { id: 'yeast', label: '이스트' },
  { id: 'enriched', label: '고배합' },
]

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: '상태 전체' },
  ...RECIPE_STATUS.map((item) => ({ id: item.value, label: item.label })),
]

export function Sidebar({
  recipes,
  visible,
  query,
  filters,
  matchMode,
  dough,
  status,
  timeBounds,
  timeRange,
  hint,
  cloudNote,
  pans,
  onQuery,
  onToggleFilter,
  onMatchMode,
  onDough,
  onStatus,
  onTimeRange,
  onSelect,
  onCreate,
  onAddSamples,
  onClear,
}: {
  recipes: Recipe[]
  visible: Recipe[]
  query: string
  filters: string[]
  matchMode: MatchMode
  dough: DoughFilter
  status: StatusFilter
  timeBounds: TimeRange & { step: number }
  timeRange: TimeRange | null
  hint: string
  cloudNote: string
  pans: Pan[]
  onQuery: (value: string) => void
  onToggleFilter: (name: string) => void
  onMatchMode: (mode: MatchMode) => void
  onDough: (dough: DoughFilter) => void
  onStatus: (status: StatusFilter) => void
  onTimeRange: (range: TimeRange) => void
  onSelect: (id: string) => void
  onCreate: () => void
  onAddSamples: () => void
  onClear: () => void
}) {
  const [ingredientQuery, setIngredientQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(true)
  const ingredientQ = normalize(ingredientQuery)
  const suggestions = ingredientCatalog(recipes)
    .map(([name]) => name)
    .filter((name) => !filters.includes(name))
    .filter((name) => (ingredientQ ? normalize(name).includes(ingredientQ) : true))
    .slice(0, ingredientQ ? 40 : 8)

  const timeFrom = timeRange?.min ?? timeBounds.min
  const timeTo = timeRange?.max ?? timeBounds.max
  const span = Math.max(timeBounds.max - timeBounds.min, 1)
  const fromPct = ((timeFrom - timeBounds.min) / span) * 100
  const toPct = ((timeTo - timeBounds.min) / span) * 100
  const filtered = Boolean(query.trim() || filters.length || dough !== 'all' || status !== 'all' || timeRange)
  const filterSummary = [
    dough !== 'all' ? DOUGH_FILTERS.find((item) => item.id === dough)?.label : null,
    status !== 'all' ? STATUS_FILTERS.find((item) => item.id === status)?.label : null,
    timeRange ? `${formatDuration(timeFrom)}–${formatDuration(timeTo)}` : null,
    ...filters,
  ].filter(Boolean) as string[]

  return (
    <aside className="sidebar is-page">
      <div className="library-frame">
      <div className="library-head">
        <div className="brand">
          <Mark />
          <div>
            <p className="eyebrow">Proof Room</p>
            <h1>발효실</h1>
            <p className="brand-sub">온도와 시간으로 적는 빵 노트</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          새 레시피
        </button>
      </div>

      <label className="search">
        <span className="sr">레시피와 재료 검색</span>
        <svg className="search-ico" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12.4 12.4 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="레시피 또는 재료 검색"
        />
        {query ? (
          <button type="button" className="search-clear" onClick={() => onQuery('')} aria-label="검색어 지우기">
            ×
          </button>
        ) : null}
      </label>

      <div className="filter-block">
        <button
          type="button"
          className="filter-toggle"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <span className="filter-toggle-main">
            <span>필터</span>
            {!filtersOpen && filterSummary.length > 0 ? (
              <span className="filter-summary">{filterSummary.slice(0, 3).join(' · ')}{filterSummary.length > 3 ? ' …' : ''}</span>
            ) : null}
          </span>
          <span className="filter-chevron" aria-hidden="true">
            {filtersOpen ? '접기' : '펼치기'}
          </span>
        </button>

        {filtersOpen ? (
          <div className="filter-panel">
            <div className="dough-row" role="group" aria-label="분류">
              {DOUGH_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="dough-btn"
                  aria-pressed={dough === item.id}
                  onClick={() => onDough(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="dough-row status-row" role="group" aria-label="상태">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="dough-btn"
                  data-status={item.id === 'all' ? undefined : item.id}
                  aria-pressed={status === item.id}
                  onClick={() => onStatus(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="time-filter">
              <div className="time-filter-head">
                <p className="tool-label">제조 시간</p>
                <span>
                  {formatDuration(timeFrom)} – {formatDuration(timeTo)}
                </span>
              </div>
              <div
                className="time-slider"
                style={{ '--from': `${fromPct}%`, '--to': `${toPct}%` } as CSSProperties}
              >
                <input
                  type="range"
                  aria-label="최소 제조 시간"
                  min={timeBounds.min}
                  max={timeBounds.max}
                  step={timeBounds.step}
                  value={timeFrom}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    onTimeRange({ min: Math.min(value, timeTo), max: timeTo })
                  }}
                />
                <input
                  type="range"
                  aria-label="최대 제조 시간"
                  min={timeBounds.min}
                  max={timeBounds.max}
                  step={timeBounds.step}
                  value={timeTo}
                  onChange={(event) => {
                    const value = Number(event.target.value)
                    onTimeRange({ min: timeFrom, max: Math.max(value, timeFrom) })
                  }}
                />
              </div>
            </div>

            <p className="tool-label">재료로 찾기</p>
            <label className="search search-ing">
              <span className="sr">재료 검색</span>
              <svg className="search-ico" viewBox="0 0 20 20" aria-hidden="true">
                <circle cx="8.5" cy="8.5" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12.4 12.4 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                value={ingredientQuery}
                onChange={(event) => setIngredientQuery(event.target.value)}
                placeholder="재료 검색"
              />
              {ingredientQuery ? (
                <button type="button" className="search-clear" onClick={() => setIngredientQuery('')} aria-label="재료 검색어 지우기">
                  ×
                </button>
              ) : null}
            </label>
            {filters.length > 0 ? (
              <div className="active-filters">
                {filters.map((name) => (
                  <button key={name} type="button" className="chip is-on" onClick={() => onToggleFilter(name)}>
                    {name}
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
                {filters.length > 1 ? (
                  <div className="match-row" role="group" aria-label="재료 조건">
                    <button type="button" aria-pressed={matchMode === 'and'} onClick={() => onMatchMode('and')}>
                      모두 포함
                    </button>
                    <button type="button" aria-pressed={matchMode === 'or'} onClick={() => onMatchMode('or')}>
                      하나라도
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {suggestions.length > 0 ? (
              <div className="chip-row">
                {suggestions.map((name) => (
                  <button key={name} type="button" className="chip" onClick={() => onToggleFilter(name)}>
                    {name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="list-empty">{ingredientQuery.trim() ? '찾는 재료가 없습니다.' : '찾을 재료가 더 없습니다.'}</p>
            )}
          </div>
        ) : null}
      </div>

      <p className="tool-label">{visible.length}개의 레시피</p>
      <div className="recipe-list">
        {visible.length === 0 ? (
          <div className="list-empty-block">
            <p>{recipes.length === 0 ? '아직 적힌 레시피가 없습니다.' : '이 조건의 레시피가 없습니다.'}</p>
            {filtered ? (
              <button type="button" className="btn btn-line" onClick={onClear}>
                조건 지우기
              </button>
            ) : null}
          </div>
        ) : null}
        {visible.map((recipe) => (
          <button
            key={recipe.id}
            type="button"
            className="recipe-card"
            onClick={() => onSelect(recipe.id)}
          >
            <span className="card-top">
              <span>
                {CRAFT_LABEL[recipe.craft ?? 'bread']} · {DOUGH_LABEL[recipe.doughType as DoughType]}
              </span>
              <span className="card-top-side">
                {(recipe.stages ?? []).some((stage) => stage.kind === 'ferment' && (stage.tempC ?? 99) <= 10) ? (
                  <em className="cold-tag">저온 숙성</em>
                ) : null}
                <span className="card-open">열기</span>
              </span>
            </span>
            <span className="card-title">{recipe.name}</span>
            {recipeStatus(recipe.status) ? (
              <span className={`test-status card-status ${recipe.status}`}>{RECIPE_STATUS.find((item) => item.value === recipe.status)?.label}</span>
            ) : null}
            {sourceLabel(recipe) ? <span className="card-source">{sourceLabel(recipe)}</span> : null}
            {youtubeId(recipe.sourceUrl ?? '') ? <span className="card-source">유튜브</span> : null}
            {panNames(recipe.panIds, pans).length > 0 ? <span className="card-source">{panNames(recipe.panIds, pans).join(' · ')}</span> : null}
            <span className="card-meta">
              {(recipe.stages ?? []).filter((stage) => stage.kind === 'ferment' && stage.minutes > 0).length === 0 ? (
                <span>발효 없음</span>
              ) : (
                (recipe.stages ?? [])
                  .filter((stage) => stage.kind === 'ferment' && stage.minutes > 0)
                  .map((stage) => (
                    <span key={stage.id}>
                      {stage.label} {stage.tempC ?? 0}°C · {formatDuration(stage.minutes)}
                    </span>
                  ))
              )}
              {totalMinutes(recipe) > 0 ? <span>({formatDuration(totalMinutes(recipe))})</span> : null}
            </span>
            <span className="card-ings">{recipe.ingredients.slice(0, 3).map((item) => item.name).join(' · ')}</span>
          </button>
        ))}
      </div>

      <footer className="side-foot">
        <p>{cloudNote} 카드를 누르면 레시피 화면으로 이동합니다.</p>
        <button type="button" onClick={onAddSamples}>
          샘플 레시피 채우기
        </button>
        {hint ? <p className="hint">{hint}</p> : null}
      </footer>
      </div>
    </aside>
  )
}
