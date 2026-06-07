export function buildMapQuery(regionName: string, placeName?: string | null) {
  return `${regionName} ${placeName || ''}`.replace(/\s+/g, ' ').trim()
}

export function googleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function kakaoMapSearchUrl(query: string) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`
}

export function naverMapWebFallbackUrl(query: string) {
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`
}

export function splitRoute(routeText?: string | null) {
  if (!routeText) return []

  return routeText
    .replace(/\s*(→|↔|⇄|~|∼|-)\s*/g, ' → ')
    .split(/\s*→\s*|,\s*|ㆍ\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 8)
}
