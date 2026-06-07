import { createClient } from '@supabase/supabase-js'

type TipCategory = 'move' | 'prepare' | 'accessibility' | 'return_home' | 'correction' | 'other'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const allowedCategories = new Set<TipCategory>([
  'move',
  'prepare',
  'accessibility',
  'return_home',
  'correction',
  'other',
])

const blockedPatterns = [
  /\b\d{2,3}-\d{3,4}-\d{4}\b/,
  /\b\d{6}-\d{7}\b/,
  /\b\d{10,11}\b/,
  /(?:주민등록번호|계좌번호|카드번호)\s*[:：]/i,
]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase function environment is not configured' }, 500)
  }

  let payload: Record<string, unknown>

  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON body is required' }, 400)
  }

  const regionCode = cleanText(payload.regionCode, 12)
  const itemId = cleanText(payload.itemId, 80)
  const category = cleanText(payload.category, 30) as TipCategory
  const body = cleanText(payload.body, 500)
  const nickname = cleanText(payload.nickname, 30)

  if (!/^KR-\d{2}$/.test(regionCode)) {
    return json({ error: '올바른 지역 코드가 아닙니다.' }, 400)
  }

  if (!allowedCategories.has(category)) {
    return json({ error: '올바른 팁 분류가 아닙니다.' }, 400)
  }

  if (body.length < 5 || body.length > 500) {
    return json({ error: '팁은 5~500자로 작성해 주세요.' }, 400)
  }

  if (blockedPatterns.some((pattern) => pattern.test(body))) {
    return json({ error: '개인정보로 보이는 내용은 공개할 수 없어요.' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: region, error: regionError } = await supabase
    .from('regions')
    .select('code')
    .eq('code', regionCode)
    .eq('is_enabled', true)
    .maybeSingle()

  if (regionError) {
    return json({ error: regionError.message }, 500)
  }

  if (!region) {
    return json({ error: '공개된 지역이 아닙니다.' }, 400)
  }

  if (itemId) {
    const { data: item, error: itemError } = await supabase
      .from('official_items')
      .select('id')
      .eq('id', itemId)
      .eq('region_code', regionCode)
      .eq('is_public', true)
      .maybeSingle()

    if (itemError) {
      return json({ error: itemError.message }, 500)
    }

    if (!item) {
      return json({ error: '관련 일정을 찾을 수 없습니다.' }, 400)
    }
  }

  const { data, error } = await supabase
    .from('tips')
    .insert({
      region_code: regionCode,
      item_id: itemId || null,
      category,
      body,
      nickname,
      status: 'public',
    })
    .select('id')
    .single()

  if (error) {
    return json({ error: error.message }, 500)
  }

  return json({ ok: true, id: data.id })
})
