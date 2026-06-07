import { createClient } from '@supabase/supabase-js'
import type { PublicItem, PublicTip, TipCategory } from './types'

type QueryError = { message: string } | null
type QueryResult<T> = { data: T[] | null; error: QueryError }

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY

function hasValue(value?: string) {
  return Boolean(value && !value.includes('YOUR_') && !value.includes('REPLACE_WITH'))
}

export function hasSupabaseConfig() {
  return hasValue(supabaseUrl) && hasValue(supabaseKey)
}

export const supabase = hasSupabaseConfig()
  ? createClient(supabaseUrl as string, supabaseKey as string)
  : null

export async function fetchPublicItems(): Promise<QueryResult<PublicItem>> {
  if (!supabase) return { data: null, error: null }

  const { data, error } = await supabase
    .from('public_items')
    .select(
      'id, region_code, region_name, kind, title, event_date, time_start, time_end, time_text, place_name, route_text, traffic_note, participants_text, source_url, source_title, agency, created_at, updated_at',
    )
    .order('event_date', { ascending: true })

  return { data: data as PublicItem[] | null, error }
}

export async function fetchPublicTips(): Promise<QueryResult<PublicTip>> {
  if (!supabase) return { data: null, error: null }

  const { data, error } = await supabase
    .from('public_tips')
    .select('id, region_code, item_id, category, body, nickname, created_at')
    .order('created_at', { ascending: false })
    .limit(80)

  return { data: data as PublicTip[] | null, error }
}

export async function submitTip(input: {
  regionCode: string
  itemId?: string | null
  category: TipCategory
  body: string
  nickname?: string
}) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase configuration is missing') }
  }

  return supabase.functions.invoke('submit-tip', {
    body: input,
  }) as Promise<{ data: { id?: string } | null; error: Error | null }>
}
