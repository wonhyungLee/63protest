import type { DateFilter, PublicItem } from './types'

export function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function formatKoreanDate(value?: string | null) {
  if (!value) return '날짜 미정'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

export function formatUpdatedAt(value?: string | null) {
  if (!value) return '갱신 정보 없음'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '갱신 정보 없음'

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function getDateLabel(filter: DateFilter) {
  const labels: Record<DateFilter, string> = {
    today: '오늘',
    tomorrow: '내일',
    week: '이번 주',
    all: '전체',
  }

  return labels[filter]
}

export function itemMatchesDateFilter(item: PublicItem, filter: DateFilter, today = new Date()) {
  if (filter === 'all' || !item.event_date) return true

  const itemDate = item.event_date
  const todayKey = toDateKey(today)
  const tomorrowKey = toDateKey(addDays(today, 1))
  const weekEndKey = toDateKey(addDays(today, 6))

  if (filter === 'today') return itemDate === todayKey
  if (filter === 'tomorrow') return itemDate === tomorrowKey

  return itemDate >= todayKey && itemDate <= weekEndKey
}

export function sortItems(items: PublicItem[]) {
  return [...items].sort((left, right) => {
    const leftDate = left.event_date ?? '9999-12-31'
    const rightDate = right.event_date ?? '9999-12-31'
    const dateCompare = leftDate.localeCompare(rightDate)

    if (dateCompare !== 0) return dateCompare

    const leftTime = left.time_start ?? left.time_text ?? ''
    const rightTime = right.time_start ?? right.time_text ?? ''

    return leftTime.localeCompare(rightTime)
  })
}
