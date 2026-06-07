import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

const execFileAsync = promisify(execFile)

type SourceConfig = {
  adapterKey: string
  regionCode: string
  agency: string
  name: string
  listUrl: string
  detailUrlTemplate?: string
  parserVersion: string
}

type OfficialPostInput = {
  sourceKey: string
  title: string
  regionCode: string
  agency: string
  eventDate?: string | null
  postedAt?: string | null
  sourceUrl: string
  rawText: string
  rawHash: string
  parserVersion: string
  items: OfficialItemInput[]
}

type OfficialItemInput = {
  sourceItemKey: string
  kind: 'assembly'
  title: string
  eventDate?: string | null
  timeStart?: string | null
  timeEnd?: string | null
  timeText?: string | null
  placeName?: string | null
  routeText?: string | null
  participantsText?: string | null
  rawItemText?: string | null
  confidence?: number
}

const sources: SourceConfig[] = [
  {
    adapterKey: 'smpa_seoul',
    regionCode: 'KR-11',
    agency: '서울경찰청',
    name: '오늘의 집회/시위',
    listUrl: 'https://www.smpa.go.kr/user/nd54882.do',
    detailUrlTemplate: 'https://www.smpa.go.kr/user/nd54882.do?View&boardNo={sourceKey}',
    parserVersion: 'smpa-seoul-pdf-v1',
  },
  {
    adapterKey: 'dgpolice_daegu',
    regionCode: 'KR-27',
    agency: '대구경찰청',
    name: '오늘의 집회시위',
    listUrl: 'https://www.dgpolice.go.kr/bbs/List.do?bbsId=d495f174',
    detailUrlTemplate: 'https://www.dgpolice.go.kr/dgpo/bbs/view.do?bbsId=d495f174&num={sourceKey}',
    parserVersion: 'dgpolice-daegu-pdf-v1',
  },
]

const userAgent =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36 national-assembly-road/0.1'

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} environment variable is required`)
  return value
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.5',
    },
  })

  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} ${response.statusText}: ${url}`)
  }

  return response.text()
}

async function fetchPdfText(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.5',
    },
  })

  if (!response.ok) {
    throw new Error(`PDF fetch failed ${response.status} ${response.statusText}: ${url}`)
  }

  const dir = await mkdtemp(join(tmpdir(), 'assembly-pdf-'))
  const filePath = join(dir, 'source.pdf')

  try {
    await writeFile(filePath, Buffer.from(await response.arrayBuffer()))
    const { stdout } = await execFileAsync('pdftotext', ['-layout', filePath, '-'], {
      maxBuffer: 10 * 1024 * 1024,
    })
    return normalizeText(stdout)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function normalizeText(input: string) {
  return input
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

function hashText(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

function absoluteUrl(base: string, href: string) {
  return new URL(href, base).toString()
}

function parseKoreanDateFromCompactTitle(title: string) {
  const match = title.match(/(\d{2})(\d{2})(\d{2})/)
  if (!match) return null

  return `20${match[1]}-${match[2]}-${match[3]}`
}

function parsePostedAt(value?: string) {
  const match = value?.match(/(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function parseDateWithMonthDay(month: string, day: string, fallbackYear: number) {
  return `${fallbackYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function cleanRouteText(value?: string | null) {
  if (!value) return null
  return value
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*<->\s*/g, ' ↔ ')
    .replace(/\s*->\s*/g, ' → ')
    .replace(/\s*→\s*/g, ' → ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferPlaceName(routeText?: string | null) {
  if (!routeText) return null
  const cleaned = cleanRouteText(routeText)
  if (!cleaned) return null

  return cleaned
    .split(/→|↔|<->|->|\(/)[0]
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTimeRange(value: string) {
  const match = value.match(/(\d{1,2}:\d{2})\s*[~∼-]\s*(\d{1,2}:\d{2})/)
  if (!match) return { timeStart: null, timeEnd: null, timeText: value.trim() }

  return {
    timeStart: match[1],
    timeEnd: match[2],
    timeText: `${match[1]} ~ ${match[2]}`,
  }
}

async function fetchSeoulPosts(source: SourceConfig, limit: number): Promise<OfficialPostInput[]> {
  const listHtml = await fetchText(source.listUrl)
  const $ = cheerio.load(listHtml)
  const rows: Array<{ sourceKey: string; title: string; postedAt: string | null; detailUrl: string }> = []

  $('a[href*="goBoardView"]').each((_, element) => {
    const href = $(element).attr('href') ?? ''
    const match = href.match(/goBoardView\('([^']+)','View','([^']+)'\)/)
    const title = $(element).text().replace(/\s+/g, ' ').trim()
    if (!match || !title.includes('오늘의 집회')) return

    const row = $(element).closest('tr')
    const cells = row
      .find('td')
      .map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim())
      .get()
    const postedAt = parsePostedAt(cells.at(-2))

    rows.push({
      sourceKey: match[2],
      title,
      postedAt,
      detailUrl: absoluteUrl(source.listUrl, `${match[1]}?View&boardNo=${match[2]}`),
    })
  })

  const posts: OfficialPostInput[] = []

  for (const row of rows.slice(0, limit)) {
    const detailHtml = await fetchText(row.detailUrl)
    const detail = cheerio.load(detailHtml)
    const pdfLink = detail('a.doc_link')
      .toArray()
      .map((element) => ({
        name: detail(element).text().replace(/\s+/g, ' ').trim(),
        onclick: detail(element).attr('onclick') ?? '',
      }))
      .find((file) => file.name.toLowerCase().endsWith('.pdf'))

    if (!pdfLink) continue

    const attachMatch = pdfLink.onclick.match(/attachfileDownload\('([^']+)','([^']+)'\)/)
    if (!attachMatch) continue

    const pdfUrl = absoluteUrl(row.detailUrl, `${attachMatch[1]}?attachNo=${attachMatch[2]}`)
    const pdfText = await fetchPdfText(pdfUrl)
    const eventDate = parseKoreanDateFromCompactTitle(row.title)
    const items = parseSeoulPdfItems(pdfText, eventDate, row.sourceKey)

    posts.push({
      sourceKey: row.sourceKey,
      title: row.title,
      regionCode: source.regionCode,
      agency: source.agency,
      eventDate,
      postedAt: row.postedAt,
      sourceUrl: row.detailUrl,
      rawText: pdfText,
      rawHash: hashText(pdfText),
      parserVersion: source.parserVersion,
      items,
    })
  }

  return posts
}

function parseSeoulPdfItems(pdfText: string, eventDate: string | null, sourceKey: string): OfficialItemInput[] {
  const items: OfficialItemInput[] = []
  const lines = pdfText.split('\n').map((line) => line.trim()).filter(Boolean)

  for (const line of lines) {
    const match = line.match(/^(\d{1,2}:\d{2}\s*[~∼-]\s*\d{1,2}:\d{2})\s+(.+?)\s+([\d,]+)\s+(.+)$/)
    if (!match) continue

    const routeText = cleanRouteText(match[2])
    const placeName = inferPlaceName(routeText)
    const time = parseTimeRange(match[1])
    const participantsText = `${match[3]}명`
    const title = placeName ? `${placeName} 집회` : '서울 집회'

    items.push({
      sourceItemKey: `${sourceKey}-${items.length + 1}`,
      kind: 'assembly',
      title,
      eventDate,
      timeStart: time.timeStart,
      timeEnd: time.timeEnd,
      timeText: time.timeText,
      placeName,
      routeText,
      participantsText,
      rawItemText: line,
      confidence: 0.86,
    })
  }

  return items
}

async function fetchDaeguPosts(source: SourceConfig, limit: number): Promise<OfficialPostInput[]> {
  const listHtml = await fetchText(source.listUrl)
  const $ = cheerio.load(listHtml)
  const rows: Array<{ sourceKey: string; title: string; postedAt: string | null; detailUrl: string }> = []

  $('table.b_table a[href*="view.do"][href*="bbsId=d495f174"]').each((_, element) => {
    const href = $(element).attr('href') ?? ''
    const num = new URL(absoluteUrl(source.listUrl, href)).searchParams.get('num')
    const title = $(element).text().replace(/\s+/g, ' ').trim()
    if (!num || !title.includes('오늘의 집회')) return

    const cells = $(element)
      .closest('tr')
      .find('td')
      .map((__, cell) => $(cell).text().replace(/\s+/g, ' ').trim())
      .get()

    rows.push({
      sourceKey: num,
      title,
      postedAt: parsePostedAt(cells.at(-3)),
      detailUrl: absoluteUrl(source.listUrl, href),
    })
  })

  const posts: OfficialPostInput[] = []

  for (const row of rows.slice(0, limit)) {
    const detailHtml = await fetchText(row.detailUrl)
    const detail = cheerio.load(detailHtml)
    const pdfHref = detail('a[href*="FileDown.do"]')
      .toArray()
      .map((element) => ({
        name: detail(element).text().replace(/\s+/g, ' ').trim(),
        href: detail(element).attr('href') ?? '',
      }))
      .find((file) => file.name.toLowerCase().endsWith('.pdf'))

    if (!pdfHref) continue

    const pdfUrl = absoluteUrl(row.detailUrl, pdfHref.href)
    const pdfText = await fetchPdfText(pdfUrl)
    const baseYear = Number(row.postedAt?.slice(0, 4) || new Date().getFullYear())
    const items = parseDaeguPdfItems(pdfText, baseYear, row.sourceKey)

    posts.push({
      sourceKey: row.sourceKey,
      title: row.title,
      regionCode: source.regionCode,
      agency: source.agency,
      eventDate: items[0]?.eventDate ?? null,
      postedAt: row.postedAt,
      sourceUrl: row.detailUrl,
      rawText: pdfText,
      rawHash: hashText(pdfText),
      parserVersion: source.parserVersion,
      items,
    })
  }

  return posts
}

function parseDaeguPdfItems(pdfText: string, baseYear: number, sourceKey: string): OfficialItemInput[] {
  const groups: string[][] = []
  let current: string[] = []
  let blankCount = 0

  for (const rawLine of pdfText.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      blankCount += 1
      if (blankCount >= 2 && current.length > 0) {
        groups.push(current)
        current = []
      }
      continue
    }

    blankCount = 0
    current.push(line)
  }

  if (current.length > 0) groups.push(current)

  const items: OfficialItemInput[] = []

  for (const group of groups) {
    const dateLineIndex = group.findIndex((line) => /\d{1,2}\.\d{1,2}\.\([^)]+\)\s+\d{1,2}:\d{2}/.test(line))
    if (dateLineIndex < 0) continue

    const dateLine = group[dateLineIndex]
    const match = dateLine.match(/(\d{1,2})\.(\d{1,2})\.\([^)]+\)\s+(\d{1,2}:\d{2})\s*(.*?)\s+([\d,]+명)\s+(\S+)/)
    if (!match) continue

    const [, month, day, startTime, inlineRoute, participantsText] = match
    const routeParts = [
      ...group.slice(0, dateLineIndex),
      inlineRoute,
      ...group.slice(dateLineIndex + 1),
    ]
      .map((part) => part.trim())
      .filter(Boolean)

    const routeText = cleanRouteText(routeParts.join(' '))
    const placeName = inferPlaceName(routeText)
    const eventDate = parseDateWithMonthDay(month, day, baseYear)

    items.push({
      sourceItemKey: `${sourceKey}-${items.length + 1}`,
      kind: 'assembly',
      title: placeName ? `${placeName} 집회` : '대구 집회',
      eventDate,
      timeStart: startTime,
      timeEnd: null,
      timeText: startTime,
      placeName,
      routeText,
      participantsText,
      rawItemText: group.join('\n'),
      confidence: 0.78,
    })
  }

  return items
}

async function upsertPosts(source: SourceConfig, posts: OfficialPostInput[]) {
  const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  const runStartedAt = new Date().toISOString()
  let parsedItems = 0
  let updatedPosts = 0

  const { data: sourceRow, error: sourceError } = await supabase
    .from('sources')
    .upsert(
      {
        region_code: source.regionCode,
        agency: source.agency,
        name: source.name,
        adapter_key: source.adapterKey,
        list_url: source.listUrl,
        detail_url_template: source.detailUrlTemplate ?? null,
        status: 'active',
        parser_version: source.parserVersion,
        fetch_mode: 'fetch',
      },
      { onConflict: 'region_code,adapter_key' },
    )
    .select('id')
    .single()

  if (sourceError) throw sourceError

  for (const post of posts) {
    const { data: postRow, error: postError } = await supabase
      .from('official_posts')
      .upsert(
        {
          source_id: sourceRow.id,
          source_key: post.sourceKey,
          region_code: post.regionCode,
          agency: post.agency,
          title: post.title,
          event_date: post.eventDate,
          posted_at: post.postedAt,
          source_url: post.sourceUrl,
          raw_text: post.rawText,
          raw_hash: post.rawHash,
          parser_version: post.parserVersion,
          is_public: true,
        },
        { onConflict: 'source_id,source_key' },
      )
      .select('id')
      .single()

    if (postError) throw postError
    updatedPosts += 1

    if (post.items.length > 0) {
      const { error: itemError } = await supabase.from('official_items').upsert(
        post.items.map((item) => ({
          post_id: postRow.id,
          region_code: post.regionCode,
          source_item_key: item.sourceItemKey,
          kind: item.kind,
          title: item.title,
          event_date: item.eventDate,
          time_start: item.timeStart,
          time_end: item.timeEnd,
          time_text: item.timeText,
          place_name: item.placeName,
          route_text: item.routeText,
          traffic_note: null,
          participants_text: item.participantsText,
          source_url: post.sourceUrl,
          raw_item_text: item.rawItemText,
          parser_version: post.parserVersion,
          is_public: true,
          confidence: item.confidence ?? 0.75,
        })),
        { onConflict: 'post_id,source_item_key' },
      )

      if (itemError) throw itemError
      parsedItems += post.items.length
    }
  }

  const { error: runError } = await supabase.from('ingest_runs').insert({
    source_id: sourceRow.id,
    status: 'success',
    started_at: runStartedAt,
    finished_at: new Date().toISOString(),
    new_posts: 0,
    updated_posts: updatedPosts,
    parsed_items: parsedItems,
    meta: { adapterKey: source.adapterKey },
  })

  if (runError) throw runError

  return { updatedPosts, parsedItems }
}

async function run() {
  const sourceArg = process.argv.find((arg) => arg.startsWith('--source='))?.split('=')[1]
  const limitArg = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? 5)
  const dryRun = process.argv.includes('--dry-run')
  const selectedSources = sourceArg ? sources.filter((source) => source.adapterKey.includes(sourceArg)) : sources

  for (const source of selectedSources) {
    const posts =
      source.adapterKey === 'smpa_seoul'
        ? await fetchSeoulPosts(source, limitArg)
        : await fetchDaeguPosts(source, limitArg)
    const itemCount = posts.reduce((total, post) => total + post.items.length, 0)

    console.log(`${source.adapterKey}: fetched ${posts.length} posts, parsed ${itemCount} items`)

    if (dryRun) {
      for (const post of posts) {
        console.log(`- ${post.title}: ${post.items.length} items`)
      }
      continue
    }

    const result = await upsertPosts(source, posts)
    console.log(`${source.adapterKey}: upserted ${result.updatedPosts} posts, ${result.parsedItems} items`)
  }
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
