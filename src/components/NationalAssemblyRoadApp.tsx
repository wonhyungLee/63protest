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
  MapPin,
  MessageCircle,
  Navigation,
  Search,
  Send,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { addDays, formatKoreanDate, formatUpdatedAt, itemMatchesDateFilter, sortItems, toDateKey } from '@/lib/date'
import { createDemoItems, createDemoTips } from '@/lib/demo-data'
import { buildMapQuery, googleMapsSearchUrl, kakaoMapSearchUrl, naverMapWebFallbackUrl } from '@/lib/map-links'
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
  { value: 'schedule', label: '관련 후보', icon: CalendarDays },
  { value: 'tips', label: '제보', icon: MessageCircle },
  { value: 'sources', label: '공식 자료', icon: FileText },
]

const kindMeta: Record<ItemKind, { label: string; icon: typeof CalendarDays; tone: string }> = {
  assembly: { label: '집회', icon: UsersRound, tone: 'assembly' },
  event: { label: '행사', icon: CalendarDays, tone: 'event' },
  traffic: { label: '교통통제', icon: ShieldCheck, tone: 'traffic' },
  notice: { label: '공지', icon: FileText, tone: 'notice' },
}

const tipCategoryLabels: Record<TipCategory, string> = {
  move: '이동',
  prepare: '준비',
  accessibility: '접근성',
  return_home: '귀가',
  correction: '정정',
  other: '기타',
}

const electionKeywords = [
  '6.3',
  '6·3',
  '63지방',
  '지방선거',
  '재선거',
  '부정선거',
  '선거무효',
  '선관위',
  '투표용지',
  '사전투표',
  '개표',
]

const privacyPatterns = [/\b\d{2,3}-\d{3,4}-\d{4}\b/, /\b\d{6}-\d{7}\b/, /\b\d{10,11}\b/]

type DataMode = 'loading' | 'live' | 'demo' | 'error'

export default function NationalAssemblyRoadApp() {
  const [items, setItems] = useState<PublicItem[]>(() => createDemoItems())
  const [tips, setTips] = useState<PublicTip[]>(() => createDemoTips())
  const [selectedRegionCode, setSelectedRegionCode] = useState('KR-11')
  const [dateFilter, setDateFilter] = useState<DateFilter>('week')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [panel, setPanel] = useState<AppPanel>('schedule')
  const [query, setQuery] = useState('')
  const [dataMode, setDataMode] = useState<DataMode>(hasSupabaseConfig() ? 'loading' : 'demo')
  const [statusMessage, setStatusMessage] = useState(
    hasSupabaseConfig() ? '공개 데이터 확인 중' : '시연 데이터 표시 중',
  )

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const regionSlug = params.get('region') || window.location.hash.replace('#', '')
    const region = regionSlug ? findRegionBySlug(regionSlug) : null

    if (region) setSelectedRegionCode(region.code)
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
      setStatusMessage('Supabase 공개 데이터 확인 중')

      try {
        const [itemResult, tipResult] = await Promise.all([fetchPublicItems(), fetchPublicTips()])
        if (cancelled) return

        const publicItems = itemResult.data ?? []
        const publicTips = tipResult.data ?? []

        if (itemResult.error) {
          setDataMode('error')
          setStatusMessage('조회 실패, 시연 데이터 표시')
          return
        }

        if (publicItems.length === 0) {
          setDataMode('demo')
          setStatusMessage('운영 데이터 없음')
          return
        }

        setItems(publicItems)
        setTips(publicTips)
        setDataMode('live')
        setStatusMessage('운영 데이터 연결됨')
      } catch {
        if (!cancelled) {
          setDataMode('error')
          setStatusMessage('연결 오류, 시연 데이터 표시')
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

  const candidateItems = useMemo(() => regionItems.filter(isElectionRelatedItem), [regionItems])
  const referenceItems = useMemo(() => regionItems.filter((item) => !isElectionRelatedItem(item)), [regionItems])

  const filteredCandidates = useMemo(() => {
    const keyword = query.trim().toLowerCase()

    return sortItems(
      candidateItems.filter((item) => {
        const matchesDate = itemMatchesDateFilter(item, dateFilter)
        const matchesKind = kindFilter === 'all' || item.kind === kindFilter
        const searchableText = getSearchText(item)

        return matchesDate && matchesKind && (!keyword || searchableText.includes(keyword))
      }),
    )
  }, [candidateItems, dateFilter, kindFilter, query])

  const regionTips = useMemo(
    () => tips.filter((tip) => tip.region_code === selectedRegionCode),
    [selectedRegionCode, tips],
  )

  const todayCount = candidateItems.filter((item) => itemMatchesDateFilter(item, 'today')).length
  const weekCount = candidateItems.filter((item) => itemMatchesDateFilter(item, 'week')).length
  const officialCount = regionItems.length

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <ShieldCheck size={21} />
          </span>
          <span>
            <strong>6.3 집회 모니터</strong>
            <small>재선거 요구·선거 관련 집회 후보</small>
          </span>
        </div>

        <StatusPill mode={dataMode} message={statusMessage} />
      </header>

      <main className="workspace">
        <section className="overview-panel" aria-label="요약">
          <div className="overview-copy">
            <p className="eyebrow">출처 기반 후보 목록</p>
            <h1>6.3 지방선거 관련 집회만 먼저 추려서 보여줍니다.</h1>
            <p>
              경찰 신고 자료는 참고 출처로 유지하고, 선거·재선거 관련 키워드가 확인된 일정만 기본 목록에 올립니다.
            </p>
          </div>

          <div className="metric-grid" aria-label={`${selectedRegion.name} 요약`}>
            <MetricTile label="오늘 후보" value={todayCount} />
            <MetricTile label="이번 주 후보" value={weekCount} />
            <MetricTile label="공식 자료" value={officialCount} />
            <MetricTile label="제보" value={regionTips.length} />
          </div>
        </section>

        <section className="control-panel" aria-label="필터">
          <RegionStrip selectedRegionCode={selectedRegionCode} onSelect={setSelectedRegionCode} />

          <div className="toolbar">
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
                placeholder="장소, 키워드, 출처"
                type="search"
              />
            </label>
          </div>

          <PanelTabs activePanel={panel} onChange={setPanel} />
        </section>

        <section className="content-grid" aria-label={`${selectedRegion.name} 데이터`}>
          <div className="primary-column">
            <div className="content-heading">
              <div>
                <p className="region-kicker">{selectedRegion.name}</p>
                <h2>{getPanelTitle(panel, selectedRegion.name)}</h2>
              </div>
              <p>{getPanelSummary(panel, filteredCandidates.length, officialCount, regionTips.length)}</p>
            </div>

            {panel === 'schedule' && (
              <SchedulePanel
                dataMode={dataMode}
                items={filteredCandidates}
                referenceCount={referenceItems.length}
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
                items={candidateItems}
                onTipCreated={(tip) => setTips((current) => [tip, ...current])}
                region={selectedRegion}
                tips={regionTips}
              />
            )}

            {panel === 'sources' && <SourcesPanel dataMode={dataMode} items={regionItems} region={selectedRegion} />}
          </div>

          <aside className="support-panel" aria-label="운영 상태">
            <DataNotice mode={dataMode} />
            <ReferenceList items={referenceItems} region={selectedRegion} />
          </aside>
        </section>
      </main>
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

function RegionStrip({
  selectedRegionCode,
  onSelect,
}: {
  selectedRegionCode: string
  onSelect: (code: string) => void
}) {
  return (
    <div className="region-strip" aria-label="지역 선택">
      {regions.map((region) => (
        <button
          key={region.code}
          className={region.code === selectedRegionCode ? 'region-chip is-active' : 'region-chip'}
          type="button"
          onClick={() => onSelect(region.code)}
        >
          {region.shortName}
        </button>
      ))}
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
}: {
  activePanel: AppPanel
  onChange: (panel: AppPanel) => void
}) {
  return (
    <nav className="panel-tabs" aria-label="화면 탭">
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
  referenceCount,
  region,
  resetFilters,
}: {
  dataMode: DataMode
  items: PublicItem[]
  referenceCount: number
  region: Region
  resetFilters: () => void
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        actionLabel="필터 초기화"
        icon={CalendarDays}
        message={`${region.name}에서 조건에 맞는 6.3 관련 후보가 아직 없습니다. 공식 자료 ${referenceCount}건은 참고 자료에 보관되어 있습니다.`}
        onAction={resetFilters}
        title="관련 후보 없음"
      />
    )
  }

  return (
    <div className="schedule-list">
      {dataMode !== 'live' && (
        <div className="data-note">
          <Database size={16} />
          <span>현재 화면은 시연 데이터입니다. 운영 데이터가 연결되면 실제 후보만 표시됩니다.</span>
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
        <span className="verify-badge">키워드 확인</span>
      </div>

      <h3>{item.title}</h3>

      <div className="fact-grid">
        <Fact icon={Clock3} label="시간" value={item.time_text || joinTime(item.time_start, item.time_end)} />
        <Fact icon={MapPin} label="장소" value={item.place_name || '장소 미정'} />
        {item.participants_text && <Fact icon={UsersRound} label="인원" value={item.participants_text} />}
      </div>

      <div className="card-actions">
        <MapButtons query={mapQuery} />
        {item.source_url && (
          <a className="icon-link" href={item.source_url} target="_blank" rel="noreferrer" title="원문 열기">
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
        <Search size={15} />
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

      <div className="tip-list" aria-label={`${region.name} 제보 목록`}>
        {tips.length === 0 ? (
          <EmptyState icon={MessageCircle} message={`${region.name}에 공개된 제보가 없습니다.`} title="제보 없음" />
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
  const [category, setCategory] = useState<TipCategory>('correction')
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
      setMessage('제보는 5자 이상 500자 이하로 작성해 주세요.')
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
      setMessage(persistedId ? '제보가 등록되었습니다.' : '브라우저에 임시 표시했습니다.')
    } catch {
      setMessage('제출 API 응답이 없어 저장하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="tip-composer" onSubmit={handleSubmit}>
      <div className="composer-header">
        <div>
          <p className="eyebrow">현장 제보</p>
          <h3>{region.name} 후보 보강</h3>
        </div>
        <span>{body.trim().length}/500</span>
      </div>

      <div className="category-grid" role="group" aria-label="제보 분류">
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
        placeholder="날짜, 시간, 장소, 근거 링크를 함께 남겨 주세요."
      />

      <div className="composer-row">
        <select value={itemId} onChange={(event) => setItemId(event.target.value)} aria-label="관련 후보">
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
        <button className="primary-button" disabled={submitting} type="submit" title="제보 등록">
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
  const sources = useMemo(() => collectSources(items), [items])

  if (sources.length === 0) {
    return <EmptyState icon={FileText} message={`${region.name}에 연결된 공식 자료가 없습니다.`} title="자료 없음" />
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
        <SourceCard key={`${source.id}-${source.source_title || source.title}`} item={source} />
      ))}
    </div>
  )
}

function SourceCard({ item }: { item: PublicItem }) {
  return (
    <article className="source-card">
      <div className="source-icon">
        <FileText size={20} />
      </div>
      <div>
        <p>{item.agency || '공개 원문'}</p>
        <h3>{item.source_title || item.title}</h3>
        <span>{formatUpdatedAt(item.updated_at)}</span>
      </div>
      {item.source_url ? (
        <a href={item.source_url} target="_blank" rel="noreferrer" title="원문 열기">
          <ExternalLink size={16} />
        </a>
      ) : null}
    </article>
  )
}

function DataNotice({ mode }: { mode: DataMode }) {
  return (
    <div className="notice-box">
      <div className="notice-icon">
        <ShieldCheck size={18} />
      </div>
      <div>
        <h3>표시 기준</h3>
        <p>
          기본 목록은 6.3 지방선거, 재선거 요구, 선거 관련 키워드가 일정 제목·장소·원문명에 잡힌 항목만
          보여줍니다.
        </p>
        <span>{mode === 'live' ? '운영 데이터 기준' : '시연 데이터 기준'}</span>
      </div>
    </div>
  )
}

function ReferenceList({ items, region }: { items: PublicItem[]; region: Region }) {
  const references = sortItems(items).slice(0, 5)

  return (
    <div className="reference-panel">
      <div className="reference-heading">
        <h3>공식 자료 참고</h3>
        <span>{items.length}건</span>
      </div>

      {references.length === 0 ? (
        <p className="muted-line">{region.name} 공식 자료가 없습니다.</p>
      ) : (
        <div className="reference-list">
          {references.map((item) => (
            <a
              key={item.id}
              className="reference-item"
              href={item.source_url || '#'}
              target={item.source_url ? '_blank' : undefined}
              rel={item.source_url ? 'noreferrer' : undefined}
            >
              <span>{formatKoreanDate(item.event_date)}</span>
              <strong>{item.title}</strong>
            </a>
          ))}
        </div>
      )}
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

function getPanelTitle(panel: AppPanel, regionName: string) {
  if (panel === 'tips') return `${regionName} 제보`
  if (panel === 'sources') return `${regionName} 공식 자료`
  return `${regionName} 관련 후보`
}

function getPanelSummary(panel: AppPanel, candidateCount: number, officialCount: number, tipCount: number) {
  if (panel === 'tips') return `공개 제보 ${tipCount}건`
  if (panel === 'sources') return `공식 원문 기준 ${officialCount}건`
  return `조건 일치 ${candidateCount}건`
}

function joinTime(start?: string | null, end?: string | null) {
  if (start && end) return `${start.slice(0, 5)} ~ ${end.slice(0, 5)}`
  if (start) return start.slice(0, 5)

  return '시간 미정'
}

function isElectionRelatedItem(item: PublicItem) {
  const text = getSearchText(item).replace(/\s+/g, '')
  return electionKeywords.some((keyword) => text.includes(keyword.toLowerCase().replace(/\s+/g, '')))
}

function getSearchText(item: PublicItem) {
  return [
    item.title,
    item.place_name,
    item.route_text,
    item.traffic_note,
    item.participants_text,
    item.source_title,
    item.agency,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function collectSources(items: PublicItem[]) {
  const sourceMap = new globalThis.Map<string, PublicItem>()

  for (const item of items) {
    const key = `${item.agency || '공개 원문'}-${item.source_title || item.source_url || item.id}`
    if (!sourceMap.has(key)) sourceMap.set(key, item)
  }

  return [...sourceMap.values()]
}
