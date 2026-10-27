import { formatClock, formatDuration, formatKoreanDate, formatRange, liveRatio, sameDay, tempTone, type Stage } from '../math'

export function Timeline({ stages, now }: { stages: Stage[]; now: Date }) {
  if (stages.length === 0) {
    return <p className="timeline-empty">공정을 추가하면 반죽부터 완성까지의 일정이 여기에 쌓입니다.</p>
  }

  const total = stages.reduce((sum, stage) => sum + stage.minutes, 0)
  const spansDays = !sameDay(stages[0].from, stages[stages.length - 1].to)
  const finish = stages[stages.length - 1].to

  return (
    <div className="timeline-block">
      <div className="share" role="img" aria-label="공정별 시간 비율">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="share-seg"
            data-tone={stage.tone}
            style={{ flex: stage.minutes }}
            title={`${stage.label} ${formatDuration(stage.minutes)}`}
          >
            {stage.minutes / total >= 0.12 ? <span>{stage.label}</span> : null}
          </div>
        ))}
      </div>
      <ul className="legend">
        {stages.map((stage) => (
          <li key={stage.id}>
            <i data-tone={stage.tone} />
            {stage.label}
            <em>{formatDuration(stage.minutes)}</em>
          </li>
        ))}
      </ul>
      <ol className="timeline">
        {stages.map((stage) => {
          const ratio = liveRatio(stage, now)
          const tone = tempTone(stage.tempC, stage.tone)
          return (
            <li key={stage.id} className={ratio != null ? 'stage is-live' : 'stage'}>
              <div className="stage-time">
                {spansDays ? <small>{formatKoreanDate(stage.from)}</small> : null}
                <strong>{formatClock(stage.from)}</strong>
              </div>
              <div className="stage-rail">
                <span className={ratio != null ? 'dot live' : 'dot'} data-tone={stage.tone} />
              </div>
              <article className="stage-card">
                <header className="stage-head">
                  <div>
                    <h3>{stage.label}</h3>
                    <p>{formatRange(stage.from, stage.to)}</p>
                  </div>
                  <div className="stage-tags">
                    {ratio != null ? <span className="live-badge">진행 중</span> : null}
                    {tone && stage.tempC != null ? (
                      <span className={`temp-pill ${tone}`}>
                        {Math.round(stage.tempC)}°C{tone === 'cold' ? ' · 저온' : ''}
                      </span>
                    ) : null}
                  </div>
                </header>
                <p className="stage-duration">{formatDuration(stage.minutes)}</p>
                {stage.note ? <p className="stage-note">{stage.note}</p> : null}
                {ratio != null ? (
                  <div className="live-track" aria-hidden="true">
                    <span style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                ) : null}
              </article>
            </li>
          )
        })}
        <li className="stage">
          <div className="stage-time">
            {spansDays ? <small>{formatKoreanDate(finish)}</small> : null}
            <strong>{formatClock(finish)}</strong>
          </div>
          <div className="stage-rail">
            <span className="dot done" />
          </div>
          <div className="done-card">완성</div>
        </li>
      </ol>
    </div>
  )
}
