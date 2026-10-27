import { useState } from 'react'
import { youtubeId } from '../youtube'

export function RecipeVideo({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false)
  const trimmed = url.trim()
  const id = youtubeId(trimmed)
  if (!trimmed) return null

  if (!id) {
    return (
      <p className="source-line">
        <a href={trimmed} target="_blank" rel="noreferrer">
          {trimmed}
        </a>
      </p>
    )
  }

  if (!playing) {
    return (
      <button type="button" className="video-poster" onClick={() => setPlaying(true)}>
        <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" />
        <span>영상 재생</span>
      </button>
    )
  }

  return (
    <div className="video-frame">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
        title="레시피 영상"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}
