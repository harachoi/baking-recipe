export function youtubeId(value: string) {
  const raw = value.trim()
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
    if (host === 'youtu.be') return videoId(url.pathname.split('/').filter(Boolean)[0])
    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
      const fromQuery = url.searchParams.get('v')
      if (fromQuery) return videoId(fromQuery)
      const parts = url.pathname.split('/').filter(Boolean)
      if (['embed', 'shorts', 'live', 'v'].includes(parts[0] ?? '')) return videoId(parts[1])
    }
  } catch {
    return null
  }
  return null
}

function videoId(value: string | undefined) {
  if (!value) return null
  const id = value.slice(0, 11)
  return /^[\w-]{11}$/.test(id) ? id : null
}
