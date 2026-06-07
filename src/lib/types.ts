export type ItemKind = 'event' | 'assembly' | 'traffic' | 'notice'

export type TipCategory =
  | 'move'
  | 'prepare'
  | 'accessibility'
  | 'return_home'
  | 'correction'
  | 'other'

export type Region = {
  code: string
  name: string
  slug: string
  shortName: string
  mapX: number
  mapY: number
  accent: string
  tint: string
}

export type PublicItem = {
  id: string
  region_code: string
  region_name: string
  kind: ItemKind
  title: string
  event_date: string | null
  time_start?: string | null
  time_end?: string | null
  time_text?: string | null
  place_name?: string | null
  route_text?: string | null
  traffic_note?: string | null
  participants_text?: string | null
  source_url?: string | null
  source_title?: string | null
  agency?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type PublicTip = {
  id: string
  region_code: string
  item_id?: string | null
  category: TipCategory
  body: string
  nickname: string
  created_at: string
}

export type DateFilter = 'today' | 'tomorrow' | 'week' | 'all'
export type KindFilter = 'all' | ItemKind
export type AppPanel = 'schedule' | 'tips' | 'sources'
