import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  Filter,
  Loader2,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Navigation,
  Route,
  Search,
  Send,
  ShieldCheck,
  TrafficCone,
  UsersRound,
} from 'lucide-react'
import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { addDays, formatKoreanDate, formatUpdatedAt, itemMatchesDateFilter, sortItems, toDateKey } from '@/lib/date'
import { createDemoItems, createDemoTips } from '@/lib/demo-data'
import { buildMapQuery, googleMapsSearchUrl, kakaoMapSearchUrl, naverMapWebFallbackUrl, splitRoute } from '@/lib/map-links'
import { findRegionByCode, findRegionBySlug, regions } from '@/lib/regions'
import { fetchPublicItems, fetchPublicTips, hasSupabaseConfig, submitTip } from '@/lib/supabase.browser'
import type { AppPanel, DateFilter, ItemKind, KindFilter, PublicItem, PublicTip, Region, TipCategory } from '@/lib/types'

const dateFilters: DateFilter[] = ['today', 'tomorrow', 'week', 'all']

const kindFilters: Array<{ value: KindFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'assembly', label: '집회' },
  { value: 'event', label: '행사' },
  { value: 'traffic', label: '통제' },
  { value: 'notice', label: '공지' },
]

const panelOptions: Array<{ value: AppPanel; label: string; icon: typeof CalendarDays }> = [
  { value: 'schedule', label: '일정', icon: CalendarDays },
  { value: 'tips', label: '팁', icon: MessageCircle },
  { value: 'sources', label: '원문', icon: FileText },
]

const kindMeta: Record<ItemKind, { label: string; icon: typeof CalendarDays; tone: string }> = {
  assembly: { label: '집회', icon: UsersRound, tone: 'assembly' },
  event: { label: '행사', icon: CalendarDays, tone: 'event' },
  traffic: { label: '교통통제', icon: TrafficCone, tone: 'traffic' },
  notice: { label: '공지', icon: ShieldCheck, tone: 'notice' },
}

const tipCategoryLabels: Record<TipCategory, string> = {
  move: '이동',
  prepare: '준비물',
  accessibility: '접근성',
  return_home: '귀가',
  correction: '정정',
  other: '기타',
}

const privacyPatterns = [/\b\d{2,3}-\d{3,4}-\d{4}\b/, /\b\d{6}-\d{7}\b/, /\b\d{10,11}\b/]

type DataMode = 'loading' | 'live' | 'demo' | 'error'

export default function NationalAssemblyRoadApp() {
  const [items, setItems] = useState<PublicItem[]>(() => createDemoItems())
  const [tips, setTips] = useState<PublicTip[]>(() => createDemoTips())
  const [selectedRegionCode, setSelectedRegionCode] = useState('KR-11')
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [panel, setPanel] = useState<AppPanel>('schedule')
  const [query, setQuery] = useState('')
  const [dataMode, setDataMode] = useState<DataMode>(hasSupabaseConfig() ? 'loading' : 'demo')
  const [statusMessage, setStatusMessage] = useState(
    hasSupabaseConfig() ? '공개 데이터를 불러오는 중' : '시연 데이터 표시 중',
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const regionSlug = params.get('region') || window.location.hash.replace('#', '')
    const region = regionSlug ? findRegionBySlug(regionSlug) : null

    if (region) {
      setSelectedRegionCode(region.code)
    }
  }, [])

  useEffect(() => {
    const selectedRegion = findRegionByCode(selectedRegionCode)
    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.set('region', selectedRegion.slug)
    window.history.replaceState({}, '', `${nextUrl.pathname}?${nextUrl.searchParams.toString()}`)
  }, [selectedRegionCode])

  useEffect(() => {
    let cancelled = false

    async function loadPublicData() {
      if (!hasSupabaseConfig()) return

      setDataMode('loading')
      setStatusMessage('Supabase 공개 데이터를 확인 중')

      try {
        const [itemResult, tipResult] = await Promise.all([fetchPublicItems(), fetchPublicTips()])
        if (cancelled) return

        const publicItems = itemResult.data ?? []
        const publicTips = tipResult.data ?? []

        if (itemResult.error) {
          setDataMode('error')
          setStatusMessage('공개 일정 조회 실패, 시연 데이터 표시')
          return
        }

        if (publicItems.length === 0) {
          setDataMode('demo')
          setStatusMessage('공개 일정이 없어 시연 데이터 표시')
          return
        }

        setItems(publicItems)
        setTips(publicTips.length > 0 ? publicTips : [])
        setDataMode('live')
        setStatusMessage('Supabase 공개 데이터 연결됨')
      } catch {
        if (!cancelled) {
          setDataMode('error')
          setStatusMessage('데이터 연결 오류, 시연 데이터 표시')
        }
      }
    }

    loadPublicData()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedRegion = findRegionByCode(selectedRegionCode)

  const regionItems = useMemo(
    () => items.filter((item) => item.region_code === selectedRegionCode),
    [items, selectedRegionCode],
  )

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase()

    return sortItems(
      regionItems.filter((item) => {
        const matchesDate = itemMatchesDateFilter(item, dateFilter)
        const matchesKind = kindFilter === 'all' || item.kind === kindFilter
        const searchableText = [item.title, item.place_name, item.route_text, item.traffic_note, item.agency]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return matchesDate && matchesKind && (!keyword || searchableText.includes(keyword))
      }),
    )
  }, [dateFilter, kindFilter, query, regionItems])

  const regionTips = useMemo(
    () => tips.filter((tip) => tip.region_code === selectedRegionCode),
    [selectedRegionCode, tips],
  )

  const todayCount = useMemo(
    () => regionItems.filter((item) => itemMatchesDateFilter(item, 'today')).length,
    [regionItems],
  )
  const tomorrowCount = useMemo(
    () => regionItems.filter((item) => itemMatchesDateFilter(item, 'tomorrow')).length,
    [regionItems],
  )
  const weekCount = useMemo(
    () => regionItems.filter((item) => itemMatchesDateFilter(item, 'week')).length,
    [regionItems],
  )
  const routeCount = useMemo(
    () => regionItems.filter((item) => Boolean(item.route_text || item.traffic_note)).length,
    [regionItems],
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <MapIcon size={22} />
          </span>
          <span>
            <strong>전국 집회길</strong>
            <small>공식 원문 기반 지역 안내</small>
          </span>
        </div>

        <StatusPill mode={dataMode} message={statusMessage} />
      </header>

      <main className="workspace">
        <section className="region-workbench" aria-label="지역 선택">
          <div className="headline">
            <p className="eyebrow">전국 공식 일정</p>
            <h1>지역을 고르면 오늘의 집회, 행사, 교통통제가 정리됩니다.</h1>
          </div>

          <RegionMap selectedRegionCode={selectedRegionCode} onSelect={setSelectedRegionCode} />

          <div className="region-strip" aria-label="지역 빠른 선택">
            {regions.map((region) => (
              <button
                key={region.code}
                className={region.code === selectedRegionCode ? 'region-chip is-active' : 'region-chip'}
                style={{ '--chip-accent': region.accent, '--chip-tint': region.tint } as CSSProperties}
                type="button"
                onClick={() => setSelectedRegionCode(region.code)}
              >
                {region.shortName}
              </button>
            ))}
          </div>

          <div className="metric-grid" aria-label={`${selectedRegion.name} 요약`}>
            <MetricTile label="오늘" value={todayCount} />
            <MetricTile label="내일" value={tomorrowCount} />
            <MetricTile label="이번 주" value={weekCount} />
            <MetricTile label="이동 영향" value={routeCount} />
          </div>
        </section>

        <section className="content-workbench" aria-label={`${selectedRegion.name} 일정과 팁`}>
          <div className="content-header">
            <div>
              <p className="region-kicker" style={{ color: selectedRegion.accent }}>
                {selectedRegion.name}
              </p>
              <h2>{selectedRegion.name} 일정</h2>
              <p>{getRegionSummary(filteredItems.length, regionTips.length)}</p>
            </div>
            <button
              className="source-shortcut"
              type="button"
              title="원문 목록 보기"
              onClick={() => setPanel('sources')}
            >
              <FileText size={16} />
              원문 목록
            </button>
          </div>

          <div className="toolbar" aria-label="일정 필터">
            <div className="segmented-control" role="group" aria-label="날짜 필터">
              {dateFilters.map((filter) => (
                <button
                  key={filter}
                  className={dateFilter === filter ? 'segment is-active' : 'segment'}
                  type="button"
                  onClick={() => setDateFilter(filter)}
                >
                  {getDateFilterLabel(filter)}
                </button>
              ))}
            </div>

            <div className="segmented-control compact" role="group" aria-label="종류 필터">
              <Filter size={15} aria-hidden="true" />
              {kindFilters.map((filter) => (
                <button
                  key={filter.value}
                  className={kindFilter === filter.value ? 'segment is-active' : 'segment'}
                  type="button"
                  onClick={() => setKindFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <label className="search-field">
              <Search size={17} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="장소, 행사명, 역명"
                type="search"
              />
            </label>
          </div>

          <PanelTabs activePanel={panel} onChange={setPanel} className="desktop-tabs" />

          {panel === 'schedule' && (
            <SchedulePanel
              dataMode={dataMode}
              items={filteredItems}
              region={selectedRegion}
              resetFilters={() => {
                setDateFilter('all')
                setKindFilter('all')
                setQuery('')
              }}
            />
          )}

          {panel === 'tips' && (
            <TipsPanel
              dataMode={dataMode}
              items={regionItems}
              onTipCreated={(tip) => setTips((current) => [tip, ...current])}
              region={selectedRegion}
              tips={regionTips}
            />
          )}

          {panel === 'sources' && <SourcesPanel dataMode={dataMode} items={regionItems} region={selectedRegion} />}
        </section>
      </main>

      <PanelTabs activePanel={panel} onChange={setPanel} className="bottom-tabs" />
    </div>
  )
}

function StatusPill({ mode, message }: { mode: DataMode; message: string }) {
  const Icon = mode === 'loading' ? Loader2 : mode === 'live' ? CheckCircle2 : mode === 'error' ? AlertCircle : Database

  return (
    <div className={`status-pill ${mode}`}>
      <Icon size={16} className={mode === 'loading' ? 'spin' : ''} />
      <span>{message}</span>
    </div>
  )
}

function RegionMap({
  selectedRegionCode,
  onSelect,
}: {
  selectedRegionCode: string
  onSelect: (code: string) => void
}) {
  const selectedRegion = findRegionByCode(selectedRegionCode)

  return (
    <div className="map-tool">
      <div className="map-canvas" aria-label="전국 지역 지도">
        <svg className="korea-shape" viewBox="0 0 320 480" role="img" aria-label="대한민국 지도 배경">
          <path
            d="M144 30c40 10 81 33 91 72 7 28-10 52-3 78 7 27 37 39 43 70 8 38-18 66-37 94-22 32-17 72-44 96-30 26-75 6-106-15-27-19-48-45-51-79-3-35 18-60 22-91 5-34-16-62-10-96 7-39 45-51 61-82 8-15 13-33 34-47Z"
            fill="currentColor"
          />
          <path
            d="M98 430c22-12 55-8 75 4 10 6 8 18-4 24-23 12-55 8-75-4-10-6-8-18 4-24Z"
            fill="currentColor"
          />
        </svg>

        <svg className="route-lines" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M42 22 C54 34, 49 47, 65 63" />
          <path d="M45 77 C52 68, 62 70, 73 78" />
          <path d="M43 22 C36 31, 39 43, 48 49" />
        </svg>

        {regions.map((region) => (
          <button
            key={region.code}
            className={region.code === selectedRegionCode ? 'map-node is-active' : 'map-node'}
            style={
              {
                '--node-x': `${region.mapX}%`,
                '--node-y': `${region.mapY}%`,
                '--node-accent': region.accent,
                '--node-tint': region.tint,
              } as CSSProperties
            }
            title={`${region.name} 선택`}
            type="button"
            onClick={() => onSelect(region.code)}
          >
            <span>{region.shortName}</span>
          </button>
        ))}
      </div>

      <div className="map-caption">
        <MapPin size={16} />
        <span>{selectedRegion.name} 선택됨</span>
      </div>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function PanelTabs({
  activePanel,
  onChange,
  className,
}: {
  activePanel: AppPanel
  onChange: (panel: AppPanel) => void
  className?: string
}) {
  return (
    <nav className={`panel-tabs ${className || ''}`} aria-label="화면 탭">
      {panelOptions.map((option) => {
        const Icon = option.icon

        return (
          <button
            key={option.value}
            className={activePanel === option.value ? 'panel-tab is-active' : 'panel-tab'}
            title={`${option.label} 보기`}
            type="button"
            onClick={() => onChange(option.value)}
          >
            <Icon size={18} />
            <span>{option.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function SchedulePanel({
  dataMode,
  items,
  region,
  resetFilters,
}: {
  dataMode: DataMode
  items: PublicItem[]
  region: Region
  resetFilters: () => void
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        actionLabel="전체 일정 보기"
        icon={CalendarDays}
        message={`${region.name} 조건에 맞는 일정이 없습니다.`}
        onAction={resetFilters}
        title="일정 없음"
      />
    )
  }

  return (
    <div className="schedule-list">
      {dataMode !== 'live' && (
        <div className="data-note">
          <Database size={16} />
          <span>현재 화면은 시연 데이터입니다. Supabase 공개 데이터가 채워지면 자동으로 실제 일정이 표시됩니다.</span>
        </div>
      )}

      {items.map((item) => (
        <ScheduleCard key={item.id} item={item} region={region} />
      ))}
    </div>
  )
}

function ScheduleCard({ item, region }: { item: PublicItem; region: Region }) {
  const meta = kindMeta[item.kind]
  const Icon = meta.icon
  const mapQuery = buildMapQuery(region.name, item.place_name)

  return (
    <article className="schedule-card">
      <div className="card-topline">
        <span className={`kind-badge ${meta.tone}`}>
          <Icon size={14} />
          {meta.label}
        </span>
        <span className="date-badge">{formatKoreanDate(item.event_date)}</span>
      </div>

      <h3>{item.title}</h3>

      <div className="fact-grid">
        <Fact icon={Clock3} label="시간" value={item.time_text || joinTime(item.time_start, item.time_end)} />
        <Fact icon={MapPin} label="장소" value={item.place_name || '장소 미정'} />
        {item.participants_text && <Fact icon={UsersRound} label="인원" value={item.participants_text} />}
        {item.traffic_note && <Fact icon={TrafficCone} label="교통" value={item.traffic_note} />}
      </div>

      <RouteChips region={region} routeText={item.route_text} />

      <div className="card-actions">
        <MapButtons query={mapQuery} />
        {item.source_url && (
          <a className="icon-link" href={item.source_url} target="_blank" rel="noreferrer" title="공식 원문 열기">
            <ExternalLink size={16} />
            원문
          </a>
        )}
      </div>

      <div className="source-line">
        <FileText size={14} />
        <span>{item.agency || '공개 원문'}</span>
        <span>{formatUpdatedAt(item.updated_at)}</span>
      </div>
    </article>
  )
}

function Fact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value?: string | null }) {
  if (!value) return null

  return (
    <div className="fact">
      <Icon size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RouteChips({ region, routeText }: { region: Region; routeText?: string | null }) {
  const points = splitRoute(routeText)

  if (points.length === 0) return null

  return (
    <div className="route-block">
      <div className="route-heading">
        <Route size={16} />
        <span>경로</span>
      </div>
      <div className="route-chip-row">
        {points.map((point, index) => {
          const query = buildMapQuery(region.name, point)

          return (
            <a
              key={`${point}-${index}`}
              className="route-chip"
              href={googleMapsSearchUrl(query)}
              target="_blank"
              rel="noreferrer"
              title={`${point} 지도 검색`}
            >
              <span>{index + 1}</span>
              {point}
            </a>
          )
        })}
      </div>
    </div>
  )
}

function MapButtons({ query }: { query: string }) {
  return (
    <div className="map-buttons" aria-label="지도 검색">
      <a href={naverMapWebFallbackUrl(query)} target="_blank" rel="noreferrer" title="네이버지도 검색">
        <Navigation size={15} />
        네이버
      </a>
      <a href={kakaoMapSearchUrl(query)} target="_blank" rel="noreferrer" title="카카오맵 검색">
        <MapPin size={15} />
        카카오
      </a>
      <a href={googleMapsSearchUrl(query)} target="_blank" rel="noreferrer" title="Google 지도 검색">
        <MapIcon size={15} />
        Google
      </a>
    </div>
  )
}

function TipsPanel({
  dataMode,
  items,
  onTipCreated,
  region,
  tips,
}: {
  dataMode: DataMode
  items: PublicItem[]
  onTipCreated: (tip: PublicTip) => void
  region: Region
  tips: PublicTip[]
}) {
  return (
    <div className="tips-layout">
      <TipComposer dataMode={dataMode} items={items} onTipCreated={onTipCreated} region={region} />

      <div className="tip-list" aria-label={`${region.name} 팁 목록`}>
        {tips.length === 0 ? (
          <EmptyState icon={MessageCircle} message={`${region.name}에 공개된 팁이 없습니다.`} title="팁 없음" />
        ) : (
          tips.map((tip) => <TipCard key={tip.id} tip={tip} />)
        )}
      </div>
    </div>
  )
}

function TipComposer({
  dataMode,
  items,
  onTipCreated,
  region,
}: {
  dataMode: DataMode
  items: PublicItem[]
  onTipCreated: (tip: PublicTip) => void
  region: Region
}) {
  const [category, setCategory] = useState<TipCategory>('move')
  const [body, setBody] = useState('')
  const [nickname, setNickname] = useState('')
  const [itemId, setItemId] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: { preventDefault: () => void }) {
    event.preventDefault()

    const normalizedBody = body.trim()
    const normalizedNickname = nickname.trim().slice(0, 30)

    if (normalizedBody.length < 5 || normalizedBody.length > 500) {
      setMessage('팁은 5자 이상 500자 이하로 작성해 주세요.')
      return
    }

    if (privacyPatterns.some((pattern) => pattern.test(normalizedBody))) {
      setMessage('개인정보로 보이는 내용은 공개할 수 없습니다.')
      return
    }

    setSubmitting(true)
    setMessage('')

    try {
      let persistedId: string | undefined

      if (hasSupabaseConfig() && dataMode === 'live') {
        const result = await submitTip({
          regionCode: region.code,
          itemId: itemId || null,
          category,
          body: normalizedBody,
          nickname: normalizedNickname,
        })

        if (result.error) throw result.error
        persistedId = result.data?.id
      }

      onTipCreated({
        id: persistedId || `local-tip-${Date.now()}`,
        region_code: region.code,
        item_id: itemId || null,
        category,
        body: normalizedBody,
        nickname: normalizedNickname || '익명',
        created_at: new Date().toISOString(),
      })

      setBody('')
      setNickname('')
      setItemId('')
      setMessage(persistedId ? '팁이 공개되었습니다.' : '브라우저에 임시 표시했습니다.')
    } catch {
      onTipCreated({
        id: `local-tip-${Date.now()}`,
        region_code: region.code,
        item_id: itemId || null,
        category,
        body: normalizedBody,
        nickname: normalizedNickname || '익명',
        created_at: new Date().toISOString(),
      })
      setBody('')
      setMessage('제출 API 응답이 없어 브라우저에 임시 표시했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="tip-composer" onSubmit={handleSubmit}>
      <div className="composer-header">
        <div>
          <p className="eyebrow">지역 팁</p>
          <h3>{region.name} 메모</h3>
        </div>
        <span>{body.trim().length}/500</span>
      </div>

      <div className="category-grid" role="group" aria-label="팁 분류">
        {(Object.keys(tipCategoryLabels) as TipCategory[]).map((value) => (
          <button
            key={value}
            className={category === value ? 'category-button is-active' : 'category-button'}
            type="button"
            onClick={() => setCategory(value)}
          >
            {tipCategoryLabels[value]}
          </button>
        ))}
      </div>

      <textarea
        value={body}
        maxLength={500}
        onChange={(event) => setBody(event.target.value)}
        placeholder="대중교통, 접근성, 귀가, 준비물 정보를 남겨 주세요."
      />

      <div className="composer-row">
        <select value={itemId} onChange={(event) => setItemId(event.target.value)} aria-label="관련 일정">
          <option value="">지역 전체</option>
          {items.slice(0, 20).map((item) => (
            <option key={item.id} value={item.id}>
              {formatKoreanDate(item.event_date)} {item.title}
            </option>
          ))}
        </select>
        <input
          value={nickname}
          maxLength={30}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="닉네임"
          type="text"
        />
      </div>

      <div className="composer-actions">
        <p aria-live="polite">{message}</p>
        <button className="primary-button" disabled={submitting} type="submit" title="팁 등록">
          {submitting ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
          등록
        </button>
      </div>
    </form>
  )
}

function TipCard({ tip }: { tip: PublicTip }) {
  return (
    <article className="tip-card">
      <div className="tip-meta">
        <span>{tipCategoryLabels[tip.category]}</span>
        <time dateTime={tip.created_at}>{formatUpdatedAt(tip.created_at)}</time>
      </div>
      <p>{tip.body}</p>
      <strong>{tip.nickname || '익명'}</strong>
    </article>
  )
}

function SourcesPanel({ dataMode, items, region }: { dataMode: DataMode; items: PublicItem[]; region: Region }) {
  const sources = useMemo(() => {
    const sourceMap = new globalThis.Map<string, PublicItem>()

    for (const item of items) {
      const key = `${item.agency || '공개 원문'}-${item.source_title || item.source_url || item.id}`
      if (!sourceMap.has(key)) sourceMap.set(key, item)
    }

    return [...sourceMap.values()]
  }, [items])

  if (sources.length === 0) {
    return <EmptyState icon={FileText} message={`${region.name}에 연결된 원문이 없습니다.`} title="원문 없음" />
  }

  return (
    <div className="source-list">
      {dataMode !== 'live' && (
        <div className="data-note">
          <Database size={16} />
          <span>시연 원문 목록입니다. 운영 데이터에서는 공식 출처와 갱신 시간이 표시됩니다.</span>
        </div>
      )}

      {sources.map((source) => (
        <article className="source-card" key={`${source.id}-${source.source_title}`}>
          <div className="source-icon">
            <FileText size={20} />
          </div>
          <div>
            <p>{source.agency || '공개 원문'}</p>
            <h3>{source.source_title || source.title}</h3>
            <span>{formatUpdatedAt(source.updated_at)}</span>
          </div>
          {source.source_url ? (
            <a href={source.source_url} target="_blank" rel="noreferrer" title="원문 열기">
              <ExternalLink size={16} />
            </a>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function EmptyState({
  actionLabel,
  icon: Icon,
  message,
  onAction,
  title,
}: {
  actionLabel?: string
  icon: typeof CalendarDays
  message: string
  onAction?: () => void
  title: string
}) {
  return (
    <div className="empty-state">
      <Icon size={28} />
      <h3>{title}</h3>
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function getDateFilterLabel(filter: DateFilter) {
  const today = new Date()

  if (filter === 'today') return `오늘 ${formatKoreanDate(toDateKey(today))}`
  if (filter === 'tomorrow') return `내일 ${formatKoreanDate(toDateKey(addDays(today, 1)))}`
  if (filter === 'week') return '이번 주'

  return '전체'
}

function getRegionSummary(itemCount: number, tipCount: number) {
  if (itemCount === 0 && tipCount === 0) return '공개 일정과 팁을 기다리는 중'
  if (itemCount === 0) return `공개 팁 ${tipCount}개`
  if (tipCount === 0) return `일정 ${itemCount}건`

  return `일정 ${itemCount}건, 팁 ${tipCount}개`
}

function joinTime(start?: string | null, end?: string | null) {
  if (start && end) return `${start.slice(0, 5)} ~ ${end.slice(0, 5)}`
  if (start) return start.slice(0, 5)

  return '시간 미정'
}
