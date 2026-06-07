# 전국 집회길

공식 집회·행사·교통통제 원문을 수집하고, 사용자가 지역별 이동 팁을 가볍게 공유할 수 있는 **모바일 우선 정보 안내 사이트**입니다.

> 이 프로젝트는 경찰청·지자체·교통정보센터 등 공개 원문을 보기 쉽게 정리하는 비공식 안내 서비스입니다. 현장 상황은 바뀔 수 있으므로 중요한 판단은 반드시 공식 원문과 현장 공지로 다시 확인하세요.

---

## 1. 제품 방향

### 한 문장 설명

**“전국 어디서든 지역을 먼저 고르고, 오늘·내일의 집회/행사/교통통제 정보를 빠르게 확인한 뒤, 지도 앱으로 바로 이동 경로를 찾는 서비스.”**

### 기존 Apps Script 방식에서 배운 점

Apps Script + 스프레드시트 방식은 빠르게 시제품을 만들기에는 좋았지만, 다음 문제가 반복되었습니다.

- 공식 사이트가 Google 서버 요청을 거절하거나 불안정하게 응답함
- 파싱 로직이 복잡해질수록 HTML 로딩이 느려짐
- 스프레드시트 행 구조가 길어지면서 UI와 데이터 모델이 뒤섞임
- 모바일 UI 자유도와 공유/OG/라우팅 구현이 제한됨
- 전국 확장 시 지역별 파서, 원문 보관, 재파싱, 검수 이력을 관리하기 어려움

따라서 새 구조는 **Supabase를 데이터·API 계층**, **GitHub를 코드·자동수집·정적 배포 계층**으로 사용합니다.

---

## 2. 핵심 기능

### 사용자 기능

- 전국 지도형 지역 선택
- 지역별 오늘/내일/이번 주 집회·행사·교통통제 조회
- 행사명, 집회 장소, 시간, 인원, 행진/코스, 통제 정보 표시
- 장소명 터치 시 네이버지도·카카오맵·Google 지도 검색 연결
- 행진/코스 지점을 칩 형태로 표시하고 각 지점 지도 검색
- 원문 보기, 원문 출처 링크 보기
- 이동·준비물·접근성·귀가 팁 작성
- 팁은 기본적으로 즉시 공개하되 자동 필터·신고·관리자 숨김 기능 적용

### 관리자/운영 기능

- 지역별 공식 출처 등록
- GitHub Actions 기반 주기적 자동 수집
- 원문 저장 및 해시 비교
- 파서 버전 관리
- 원문 재파싱
- 지역별 파서 추가
- 팁 신고 확인 및 숨김 처리
- 잘못 파싱된 행사명·인원·장소 수동 보정

---

## 3. 기술 스택

### 권장 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| Frontend | Astro + React + TypeScript | 정적 HTML, 빠른 모바일 초기 로딩, 필요 부분만 React로 상호작용 |
| Styling | Tailwind CSS + CSS Variables | 디자인 토큰 관리, 빠른 반응형 UI 구현 |
| Backend/Data | Supabase Postgres | 구조화 데이터, 원문 저장, RLS, 공개 API |
| Tip API | Supabase Edge Functions | 즉시 공개 전 자동 필터·레이트 리밋 처리 |
| Ingestion | GitHub Actions + Node.js/TypeScript | 예약 수집, 수동 실행, 로그 추적 |
| Hosting | GitHub Pages | 정적 사이트 배포, 무료·간단·GitHub Actions 연동 |
| Parsing | Cheerio + Playwright optional | 기본 HTML 파싱, 동적/차단 사이트 대응 |
| Maps | 외부 지도 링크 | 지도 API 비용·키 없이 지도 앱 검색/길찾기 연결 |

### 왜 Astro인가

React SPA만 쓰면 Open Graph, 지역별 정적 공유 페이지, 초기 로딩에서 손해가 생길 수 있습니다. Astro는 정적 페이지를 기본으로 만들고, 필요한 컴포넌트만 React island로 동작시킬 수 있어 이 프로젝트에 적합합니다.

다만 팀이 React/Vite에 익숙하다면 `Vite + React`로 시작해도 됩니다. 이 README는 **Astro + React** 기준으로 작성합니다.

---

## 4. 서비스 구조

```text
사용자 브라우저
  │
  ├─ GitHub Pages 정적 사이트
  │    ├─ 지역 선택 지도
  │    ├─ 일정/팁/원문 화면
  │    └─ Supabase public view 조회
  │
  ├─ 지도 앱/지도 웹으로 이동
  │    ├─ 네이버지도
  │    ├─ 카카오맵
  │    └─ Google 지도
  │
  └─ 팁 작성
       └─ Supabase Edge Function submit-tip
            ├─ 금칙어/개인정보/스팸 검사
            └─ tips 테이블에 public 상태로 저장

GitHub Actions
  │
  ├─ ingest.yml 예약 실행
  │    ├─ 지역별 source adapter 실행
  │    ├─ 공식 원문 fetch
  │    ├─ raw_text 저장
  │    ├─ event/item 파싱
  │    └─ Supabase upsert
  │
  └─ deploy.yml
       ├─ Astro build
       ├─ 정적 region/share page 생성
       └─ GitHub Pages 배포

Supabase
  │
  ├─ Postgres tables
  ├─ public views
  ├─ RLS policies
  ├─ Edge Functions
  └─ Auth/admin optional
```

---

## 5. 데이터 설계

### 핵심 개념

| 개념 | 설명 |
|---|---|
| Region | 서울, 부산, 대구 등 사용자가 처음 선택하는 지역 |
| Source | 지역별 공식 원문 출처 |
| Official Post | 공식 사이트의 게시물 또는 상세 페이지 원문 단위 |
| Official Item | 원문에서 파싱된 개별 행사·집회·통제 일정 |
| Tip | 사용자가 작성한 이동/준비/접근성/귀가 팁 |
| Ingest Run | 자동 수집 실행 이력 |
| Parser Version | 파서 변경 이력 추적용 버전 |

### 파싱 기준

공식 원문은 보통 다음처럼 섞여 있습니다.

```text
□ 행사
『2026 마인드 마라톤』
- 일시: ...
- 인원: ...
- 코스: ...

□ 집회
연번 / 시간 / 장소
1 / 11:00~13:00 / 동화면세점 앞
```

따라서 파서는 원문을 다음 두 계층으로 나눕니다.

1. **행사 블록 파서**
   - `『...』`, `[ ... ]`, `1. 행사명` 같은 제목 패턴 추출
   - `일시`, `기간`, `통제시간`, `인원`, `장소`, `코스`, `구간`, `통제` 추출

2. **집회 표 파서**
   - `연번`, `시간`, `장소`, `장소 및 행진`, `집회 등 개요` 표 추출
   - 행진 경로는 `※ 행진:` 이후 문장을 분리
   - 공식 원문에 집회명·인원이 없으면 장소명 중심 카드로 표시

---

## 6. Supabase 스키마 초안

> 실제 프로젝트에서는 아래 SQL을 `supabase/migrations/0001_init.sql`로 저장합니다.

```sql
create extension if not exists pgcrypto;

create type item_kind as enum ('event', 'assembly', 'traffic', 'notice');
create type tip_category as enum ('move', 'prepare', 'accessibility', 'return_home', 'correction', 'other');
create type tip_status as enum ('public', 'hidden', 'blocked');
create type source_status as enum ('active', 'paused', 'manual_only');

create table public.regions (
  code text primary key,
  name text not null,
  slug text not null unique,
  short_name text not null,
  display_order int not null default 999,
  map_x numeric,
  map_y numeric,
  color_token text,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  region_code text not null references public.regions(code),
  agency text not null,
  name text not null,
  source_type text not null default 'official_page',
  adapter_key text not null,
  list_url text,
  detail_url_template text,
  status source_status not null default 'active',
  parser_version text not null default 'v1',
  fetch_mode text not null default 'fetch',
  crawl_interval_minutes int not null default 180,
  license_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id),
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  new_posts int not null default 0,
  updated_posts int not null default 0,
  parsed_items int not null default 0,
  error_message text,
  meta jsonb not null default '{}'::jsonb
);

create table public.official_posts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id),
  source_key text not null,
  region_code text not null references public.regions(code),
  agency text not null,
  title text not null,
  event_date date,
  posted_at timestamptz,
  source_url text not null,
  raw_text text,
  raw_hash text,
  parser_version text not null,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_id, source_key)
);

create table public.official_items (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.official_posts(id) on delete cascade,
  region_code text not null references public.regions(code),
  source_item_key text not null,
  kind item_kind not null default 'assembly',
  title text not null,
  event_date date,
  time_start time,
  time_end time,
  time_text text,
  place_name text,
  route_text text,
  traffic_note text,
  participants_text text,
  source_url text,
  raw_item_text text,
  parser_version text not null,
  is_public boolean not null default true,
  confidence numeric not null default 0.8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(post_id, source_item_key)
);

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  region_code text not null references public.regions(code),
  item_id uuid references public.official_items(id) on delete set null,
  category tip_category not null,
  body text not null check (char_length(body) between 5 and 500),
  nickname text check (char_length(nickname) <= 30),
  status tip_status not null default 'public',
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tip_reports (
  id uuid primary key default gen_random_uuid(),
  tip_id uuid not null references public.tips(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.place_aliases (
  id uuid primary key default gen_random_uuid(),
  region_code text not null references public.regions(code),
  alias text not null,
  search_query text not null,
  naver_url text,
  kakao_url text,
  google_url text,
  created_at timestamptz not null default now(),
  unique(region_code, alias)
);
```

### 공개 조회용 View

원문 전문을 프론트엔드에 모두 내려보내면 무겁고 불필요합니다. 공개 화면은 view를 통해 필요한 컬럼만 조회합니다.

```sql
create view public.public_items as
select
  i.id,
  i.region_code,
  r.name as region_name,
  i.kind,
  i.title,
  i.event_date,
  i.time_start,
  i.time_end,
  i.time_text,
  i.place_name,
  i.route_text,
  i.traffic_note,
  i.participants_text,
  i.source_url,
  p.title as source_title,
  p.agency,
  i.created_at,
  i.updated_at
from public.official_items i
join public.official_posts p on p.id = i.post_id
join public.regions r on r.code = i.region_code
where i.is_public = true and p.is_public = true;

create view public.public_posts as
select
  p.id,
  p.region_code,
  r.name as region_name,
  p.agency,
  p.title,
  p.event_date,
  p.posted_at,
  p.source_url,
  p.updated_at
from public.official_posts p
join public.regions r on r.code = p.region_code
where p.is_public = true;

create view public.public_tips as
select
  id,
  region_code,
  item_id,
  category,
  body,
  coalesce(nullif(nickname, ''), '익명') as nickname,
  created_at
from public.tips
where status = 'public';
```

---

## 7. RLS 정책

### 원칙

- 공개 데이터는 `public_*` view로만 읽게 합니다.
- 원문 전문 `raw_text`는 관리자·수집 작업만 접근합니다.
- 사용자는 팁을 작성할 수 있지만 직접 수정·삭제는 못 합니다.
- 관리자 기능은 Supabase Auth와 `admin_users` 테이블로 분리합니다.
- GitHub Actions 수집 작업은 `service_role` 키를 사용하므로 GitHub Secrets에만 저장합니다.

```sql
alter table public.regions enable row level security;
alter table public.sources enable row level security;
alter table public.ingest_runs enable row level security;
alter table public.official_posts enable row level security;
alter table public.official_items enable row level security;
alter table public.tips enable row level security;
alter table public.tip_reports enable row level security;
alter table public.place_aliases enable row level security;

-- regions는 공개 조회 허용
create policy "Public can read enabled regions"
on public.regions for select
using (is_enabled = true);

-- tips는 공개 상태만 조회 허용
create policy "Public can read public tips"
on public.tips for select
using (status = 'public');

-- 신고는 누구나 생성 가능
create policy "Public can report tips"
on public.tip_reports for insert
with check (true);
```

팁 작성은 이상적으로는 Edge Function을 통해 처리합니다. 클라이언트에서 `tips` 테이블에 직접 insert를 열어두지 않는 편이 스팸·악성 입력 대응에 유리합니다.

---

## 8. 지역 데이터 초기값

```sql
insert into public.regions (code, name, slug, short_name, display_order, map_x, map_y, color_token) values
('KR-11', '서울', 'seoul', '서울', 10, 55, 25, 'indigo'),
('KR-26', '부산', 'busan', '부산', 20, 74, 74, 'cyan'),
('KR-27', '대구', 'daegu', '대구', 30, 68, 61, 'lime'),
('KR-28', '인천', 'incheon', '인천', 40, 44, 28, 'violet'),
('KR-29', '광주', 'gwangju', '광주', 50, 48, 75, 'amber'),
('KR-30', '대전', 'daejeon', '대전', 60, 55, 55, 'blue'),
('KR-31', '울산', 'ulsan', '울산', 70, 78, 67, 'teal'),
('KR-36', '세종', 'sejong', '세종', 80, 53, 49, 'purple'),
('KR-41', '경기', 'gyeonggi', '경기', 90, 49, 31, 'sky'),
('KR-42', '강원', 'gangwon', '강원', 100, 66, 25, 'emerald'),
('KR-43', '충북', 'chungbuk', '충북', 110, 58, 44, 'slate'),
('KR-44', '충남', 'chungnam', '충남', 120, 45, 52, 'rose'),
('KR-45', '전북', 'jeonbuk', '전북', 130, 49, 65, 'orange'),
('KR-46', '전남', 'jeonnam', '전남', 140, 47, 84, 'green'),
('KR-47', '경북', 'gyeongbuk', '경북', 150, 71, 50, 'fuchsia'),
('KR-48', '경남', 'gyeongnam', '경남', 160, 66, 75, 'pink'),
('KR-50', '제주', 'jeju', '제주', 170, 38, 96, 'zinc');
```

---

## 9. 공식 출처 등록 방식

처음부터 전국 모든 지역의 세부 파서를 완벽하게 만들기보다, **출처 레지스트리 + 어댑터 구조**로 확장합니다.

```sql
insert into public.sources (
  region_code,
  agency,
  name,
  adapter_key,
  list_url,
  detail_url_template,
  status,
  parser_version,
  fetch_mode
) values (
  'KR-11',
  '서울경찰청 교통정보센터',
  '서울 행사 및 집회',
  'spatic_seoul',
  'https://www.spatic.go.kr/spatic/main/assem.do',
  'https://www.spatic.go.kr/spatic/assem/getInfoView.do?mgrSeq={seq}',
  'active',
  'spatic-seoul-v1',
  'fetch'
);
```

### 어댑터 인터페이스

```ts
export type OfficialPostInput = {
  sourceKey: string
  title: string
  regionCode: string
  agency: string
  eventDate?: string
  postedAt?: string
  sourceUrl: string
  rawText: string
}

export type OfficialItemInput = {
  sourceItemKey: string
  kind: 'event' | 'assembly' | 'traffic' | 'notice'
  title: string
  eventDate?: string
  timeText?: string
  timeStart?: string
  timeEnd?: string
  placeName?: string
  routeText?: string
  trafficNote?: string
  participantsText?: string
  rawItemText?: string
  confidence?: number
}

export interface SourceAdapter {
  key: string
  fetchPosts(source: Source): Promise<OfficialPostInput[]>
  parseItems(post: OfficialPostInput): OfficialItemInput[]
}
```

---

## 10. GitHub Actions 자동 수집

### `.github/workflows/ingest.yml`

```yaml
name: ingest-official-sources

on:
  workflow_dispatch:
    inputs:
      region:
        description: 'region slug or all'
        required: false
        default: 'all'
  schedule:
    # UTC 기준. 한국시간 06:10, 09:10, 12:10, 15:10, 18:10, 21:10에 실행.
    - cron: '10 21,0,3,6,9,12 * * *'

concurrency:
  group: ingest-official-sources
  cancel-in-progress: false

jobs:
  ingest:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Run ingestion
        run: pnpm ingest --region=${{ github.event.inputs.region || 'all' }}
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

### 수집 원칙

- 같은 원문은 `raw_hash`로 비교해 중복 파싱을 피합니다.
- `source_key`와 `source_item_key`를 안정적으로 만듭니다.
- 공식 사이트에 과도한 요청을 보내지 않습니다.
- 실패해도 기존 공개 데이터는 유지합니다.
- 파서 버전이 바뀌면 `pnpm reparse --source=...`로 재파싱합니다.

---

## 11. GitHub Pages 배포

### `.github/workflows/deploy.yml`

```yaml
name: deploy-site

on:
  push:
    branches: [main]
  workflow_dispatch:
  schedule:
    # 공식 데이터 수집 후 정적 공유 페이지 갱신용
    - cron: '30 21,0,3,6,9,12 * * *'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          PUBLIC_SUPABASE_URL: ${{ vars.PUBLIC_SUPABASE_URL }}
          PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ vars.PUBLIC_SUPABASE_PUBLISHABLE_KEY }}

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

## 12. 프로젝트 구조

```text
national-assembly-road/
  README.md
  package.json
  astro.config.mjs
  tailwind.config.ts
  .env.example

  public/
    icons/
    og/
    korea-map.svg

  src/
    components/
      AppShell.astro
      RegionMap.tsx
      RegionPicker.tsx
      ScheduleCard.tsx
      RouteChips.tsx
      TipComposer.tsx
      TipList.tsx
      SourceList.tsx
      MapButtons.tsx
      EmptyState.tsx

    layouts/
      BaseLayout.astro

    pages/
      index.astro
      r/[slug].astro
      share/[itemId].astro

    lib/
      supabase.browser.ts
      map-links.ts
      date.ts
      text.ts
      design-tokens.ts

    styles/
      global.css

  scripts/
    ingest/
      index.ts
      adapters/
        spatic-seoul.ts
        police-board-generic.ts
        manual-json.ts
      parse/
        normalize-text.ts
        parse-event-blocks.ts
        parse-assembly-table.ts
      db/
        upsert-post.ts
        upsert-items.ts
    reparse.ts
    seed-regions.ts

  supabase/
    migrations/
      0001_init.sql
      0002_public_views.sql
      0003_rls.sql
    functions/
      submit-tip/
        index.ts
      hide-tip/
        index.ts

  .github/
    workflows/
      ingest.yml
      deploy.yml
```

---

## 13. 환경변수

### `.env.example`

```bash
# Frontend public values
PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
PUBLIC_SITE_URL=https://YOUR_GITHUB_ID.github.io/national-assembly-road

# Server-only values for scripts/functions
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# Naver URL scheme appname. Mobile web can use site URL.
PUBLIC_NAVER_MAP_APPNAME=https://YOUR_GITHUB_ID.github.io/national-assembly-road
```

GitHub 저장소에는 다음을 등록합니다.

- Repository Variables
  - `PUBLIC_SUPABASE_URL`
  - `PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Repository Secrets
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

서비스 롤 키는 절대 프론트엔드 코드에 노출하지 않습니다.

---

## 14. 설치와 실행

```bash
# 1. 저장소 생성
mkdir national-assembly-road
cd national-assembly-road

# 2. 패키지 설치
pnpm install

# 3. Supabase 로컬 시작, 선택 사항
supabase init
supabase start

# 4. 마이그레이션 적용
supabase db push

# 5. 지역 seed
pnpm seed:regions

# 6. 개발 서버
pnpm dev

# 7. 공식자료 수집 테스트
pnpm ingest --region=seoul

# 8. 빌드
pnpm build
```

---

## 15. UI/UX 디자인 방향

### 디자인 키워드

- **지도에서 시작**: 사용자는 지역을 먼저 고릅니다.
- **카드 한 장에 필요한 정보만**: 제목, 날짜, 시간, 장소, 인원, 이동 버튼.
- **원문은 숨기지 않되 보조로**: 카드 하단에서 공식 원문 확인.
- **팁은 메모처럼**: 글쓰기 부담을 줄입니다.
- **이모티콘보다 색감**: 세련된 컬러, 여백, 타이포그래피로 분위기를 만듭니다.
- **엄지손가락 사용성**: 하단/중앙 터치 영역을 크게 유지합니다.

### 색상 토큰

```css
:root {
  --bg: #f6f7fb;
  --surface: rgba(255, 255, 255, 0.82);
  --surface-solid: #ffffff;
  --text: #111827;
  --muted: #64748b;
  --line: rgba(15, 23, 42, 0.1);

  --primary: #4338ca;
  --primary-2: #06b6d4;
  --accent: #84cc16;
  --danger: #ef4444;

  --gradient-main: linear-gradient(135deg, #4338ca 0%, #06b6d4 100%);
  --gradient-soft: radial-gradient(circle at 20% 0%, rgba(67,56,202,.18), transparent 34%),
                   radial-gradient(circle at 90% 10%, rgba(6,182,212,.18), transparent 28%),
                   #f6f7fb;

  --radius-xl: 28px;
  --radius-lg: 22px;
  --shadow-card: 0 18px 50px rgba(15, 23, 42, 0.10);
}
```

### 화면 구조

#### `/`

- 큰 중앙 제목: `전국 집회길`
- 짧은 설명: `지역을 고르면 공식 일정과 이동 팁을 바로 볼 수 있어요.`
- 지도형 지역 선택
- 아래에는 인기/최근 갱신 지역 카드

#### `/r/seoul`

- 상단 지역 헤더
- 날짜 칩: `오늘`, `내일`, `이번 주`, `전체`
- 검색은 작고 접히는 형태
- 일정 카드 리스트
- 하단 고정 네비게이션: `일정`, `팁`, `원문`

#### 일정 카드

```text
[공식 행사] [6/7 일] [교통통제]
2026 마인드 마라톤
07:30 ~ 11:00
인원 총 10,000명
서울시청 → 세종대로사거리 → 종로5가 → ...

[네이버지도] [카카오맵] [Google 지도]
[원문 보기]
```

#### 팁 작성

필수 입력은 두 개만 둡니다.

```text
분류: 이동 / 준비물 / 접근성 / 귀가 / 정정
내용: “시청역 5번 출구가 비교적 덜 붐볐어요.”
```

선택 입력은 접습니다.

- 관련 일정
- 닉네임
- 출처 링크

---

## 16. 지도 연결

좌표가 없을 때는 장소명 검색 기반으로 연결합니다. 검색어는 `지역명 + 장소명`으로 만듭니다.

```ts
export function buildMapQuery(regionName: string, placeName: string) {
  return `${regionName} ${placeName}`
    .replace(/\s+/g, ' ')
    .trim()
}

export function googleMapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function kakaoMapSearchUrl(query: string) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`
}

export function naverMapSearchUrl(query: string, appname: string) {
  const encoded = encodeURIComponent(query)
  return `nmap://search?query=${encoded}&appname=${encodeURIComponent(appname)}`
}

export function naverMapWebFallbackUrl(query: string) {
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`
}
```

모바일 웹에서는 네이버 앱 스킴이 실패할 수 있으므로 `nmap://` 호출 후 일정 시간 안에 페이지가 유지되면 웹 검색 fallback을 열도록 구현합니다.

---

## 17. 팁 즉시 공개 정책

사용자가 원한 방향은 “관리자 승인 없이 바로 반영되는 가벼운 팁”입니다. 다만 공개 서비스에서는 최소한의 안전장치가 필요합니다.

### 권장 흐름

1. 사용자가 팁 입력
2. Edge Function `submit-tip` 호출
3. 서버에서 다음 항목 검사
   - 전화번호·주민번호·정확한 개인 위치 등 개인정보 패턴
   - 욕설·협박·선동·불법행위 조장 문구
   - 지나치게 긴 반복 문구
   - 짧은 시간 내 과도한 제출
4. 통과하면 `tips.status = 'public'`
5. 실패하면 `tips.status = 'blocked'` 또는 저장하지 않음
6. 공개된 팁은 신고 가능
7. 신고 누적 또는 관리자 판단으로 숨김

### Edge Function 예시

```ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(url, serviceKey)

const blockedPatterns = [
  /\b\d{2,3}-\d{3,4}-\d{4}\b/,
  /\b\d{6}-\d{7}\b/,
]

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.json()
  const text = String(body.body || '').trim()

  if (text.length < 5 || text.length > 500) {
    return Response.json({ error: '팁은 5~500자로 작성해 주세요.' }, { status: 400 })
  }

  if (blockedPatterns.some((p) => p.test(text))) {
    return Response.json({ error: '개인정보로 보이는 내용은 공개할 수 없어요.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('tips')
    .insert({
      region_code: body.regionCode,
      item_id: body.itemId || null,
      category: body.category,
      body: text,
      nickname: String(body.nickname || '').slice(0, 30),
      status: 'public',
    })
    .select('id')
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, id: data.id })
})
```

---

## 18. 파서 구현 전략

### 텍스트 정규화

```ts
export function normalizeOfficialText(input: string) {
  return input
    .replace(/&rarr;/gi, '→')
    .replace(/&larr;/gi, '←')
    .replace(/&harr;/gi, '↔')
    .replace(/&sim;/gi, '∼')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*→\s*/g, ' → ')
    .replace(/\s*↔\s*/g, ' ↔ ')
    .replace(/\s*⇄\s*/g, ' ⇄ ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
```

### 행사 블록 파서 기준

인식해야 할 제목 패턴:

```text
『2026 마인드 마라톤』
[2026 차없는 잠수교 뚜벅뚜벅축제]
1. 2026 이순신 축제
[KB 스타런 마라톤]
```

필드 패턴:

```text
일시 / 일 시 / 대회일시 / 행사 일시 / 기간
인원 / 인 원
장소 / 장 소
코스 / 코 스 / 대회코스
통제 / 교통통제 / 통제시간 / 통제구간
구간 / 통제구간
```

### 집회 표 파서 기준

- `연번`, `연 번`, `시 간`, `장소`, `장소 및 행진`, `집회 등 개요` 이후부터 표로 판단
- 다음 `행사`, `공지`, 다른 제목 블록이 나오기 전까지 읽음
- 행 번호와 시간 패턴을 기준으로 행 분리
- `※ 행진:` 이후를 `route_text`로 분리

---

## 19. 데이터 품질 규칙

### 카드 제목 우선순위

1. 공식 행사 제목
2. 원문에 표시된 집회명
3. 장소명 + `집회`
4. `공식 일정`

### 장소명 정리

- `앞`, `인도`, `2개차로` 같은 부가정보를 모두 삭제하지 않습니다. 사용자가 현장 접근에 참고할 수 있기 때문입니다.
- 지도 검색어에는 부가정보를 줄입니다.

예시:

```text
표시: 동화면세점 앞 (인도)
지도 검색: 서울 동화면세점
```

### 인원 표시

- 원문에 있으면 그대로 표시합니다.
- 원문에 없으면 `원문 미제공` 대신 UI에서는 아예 줄을 숨기는 것이 더 깔끔합니다.
- 상세 화면에서는 `인원: 원문 미제공`을 보일 수 있습니다.

### 공식 원문 보관

- `official_posts.raw_text`: 원문 전문
- `official_items.raw_item_text`: 개별 일정 원문 조각
- 공개 리스트에서는 raw 전문을 내려보내지 않습니다.
- 상세/원문 화면에서만 필요한 범위로 보여줍니다.

---

## 20. 검색과 필터

검색 탭을 따로 만들지 않고 일정 화면 안에 작게 배치합니다.

### 필터

- 지역
- 날짜
- 종류: 행사 / 집회 / 교통통제
- 이동 영향: 행진 있음 / 차로 통제 있음 / 대규모 인원
- 키워드: 장소명, 행사명, 역명

### 정렬

1. 오늘 진행 중
2. 오늘 예정
3. 내일 예정
4. 이후 날짜
5. 원문 게시 최신순

---

## 21. 선택적 Open Graph 전략

Apps Script에서는 OG가 불안정했지만, GitHub Pages에서는 정적 HTML을 만들 수 있으므로 훨씬 단순합니다.

초기 MVP에서는 OG를 끄고 시작해도 됩니다. 이후 공유가 중요해지면 다음 방식으로 추가합니다.

- `/share/[itemId].astro`를 정적 생성
- Supabase에서 공개 item을 읽어 제목·설명·이미지 meta 생성
- OG 이미지는 지역명·행사명·날짜를 넣은 SVG/PNG 자동 생성
- 런타임 데이터 로딩과 분리해 사이트 로딩에 영향을 주지 않음

---

## 22. 운영 가이드

### 매일 확인할 것

- `ingest_runs`에 실패가 쌓이는 지역
- 새 official_posts는 들어왔지만 official_items가 0개인 원문
- 같은 일정이 중복 파싱된 경우
- 팁 신고 내역
- 지도 검색이 어색한 장소 alias

### 장애 대응

| 증상 | 원인 | 조치 |
|---|---|---|
| 특정 지역 일정 0개 | 소스 파서 없음 또는 공식 사이트 구조 변경 | `ingest_runs.error_message` 확인, 어댑터 수정 |
| 원문은 있는데 카드가 이상함 | 파서가 새 원문 패턴을 모름 | `raw_text` 기준으로 parser test 추가 |
| 팁 스팸 | 공개 팁 제출 악용 | Edge Function rate limit, 차단 패턴 강화 |
| 지도 검색 부정확 | 장소명이 너무 모호함 | `place_aliases`에 검색어 보정 |
| 배포 후 화면이 예전 그대로 | GitHub Pages 캐시 또는 배포 실패 | Actions 로그, Pages 환경 확인 |

---

## 23. MVP 범위

### 1차 MVP

- Supabase 스키마 구축
- GitHub Pages 정적 사이트 배포
- 전국 지역 선택 지도
- 서울 SPATIC 자동 수집
- 서울 행사/집회 파싱
- 팁 즉시 공개
- 지도 링크

### 2차

- 대구/부산/인천 등 공식 출처 어댑터 추가
- 원문 재파싱 관리 화면
- 관리자 로그인
- 팁 신고/숨김 UI
- 지역별 최신성 표시

### 3차

- Static OG 공유 페이지
- 장소 alias 자동 추천
- 접근성 태그
- PWA 설치
- 푸시 알림 또는 구독 기능

---

## 24. 보안과 윤리 원칙

이 서비스는 공개 원문을 보기 쉽게 정리하는 안내 사이트입니다. 다음 정보는 수집하거나 공개하지 않습니다.

- 개인 연락처, 단체 내부 연락망, 개인 실시간 위치
- 참여자 식별 정보
- 현장 충돌, 회피, 불법행위에 관한 조언
- 경찰 배치나 통제 회피를 목적으로 한 민감 정보
- 확인되지 않은 루머

공개 가능한 정보는 다음에 한정합니다.

- 공식 원문에 공개된 일정·장소·시간·교통통제 정보
- 대중교통 접근, 도보 이동, 귀가, 준비물, 접근성 팁
- 원문 출처 링크
- 사용자가 자발적으로 남긴 비개인적 경험 팁

---

## 25. 개발 명령어 예시

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "seed:regions": "tsx scripts/seed-regions.ts",
    "ingest": "tsx scripts/ingest/index.ts",
    "reparse": "tsx scripts/reparse.ts",
    "test:parser": "vitest run scripts/ingest"
  }
}
```

---

## 26. 마이그레이션: 기존 Google Sheets 데이터 가져오기

기존 시트에서 다음 탭을 CSV로 내보냅니다.

- `OfficialPosts`
- `OfficialItems`
- `Submissions`

이후 Supabase Table Editor 또는 SQL copy 명령으로 임시 테이블에 넣고, 정규 테이블로 변환합니다.

```sql
-- 예: 임시 테이블로 가져온 뒤 정규 테이블에 삽입
insert into public.official_posts (
  source_id,
  source_key,
  region_code,
  agency,
  title,
  event_date,
  posted_at,
  source_url,
  raw_text,
  raw_hash,
  parser_version,
  is_public
)
select
  s.id,
  csv.official_post_id,
  'KR-11',
  csv.agency,
  csv.title,
  csv.event_date_hint::date,
  null,
  csv.source_url,
  csv.raw_text,
  encode(digest(coalesce(csv.raw_text, ''), 'sha256'), 'hex'),
  'legacy-sheets',
  true
from staging_official_posts csv
join public.sources s on s.adapter_key = 'spatic_seoul';
```

---

## 27. README 이후 바로 할 일

1. GitHub 저장소 생성
2. Supabase 프로젝트 생성
3. `supabase/migrations` 작성
4. `regions` seed
5. 서울 SPATIC adapter부터 이전
6. `pnpm ingest --region=seoul` 성공 확인
7. Astro 첫 화면 구현
8. GitHub Pages 배포
9. 팁 Edge Function 구현
10. 전국 출처를 지역별로 하나씩 추가

---

## 28. 이름 후보

- 전국 집회길
- 모임길
- 오늘의 집회길
- 열린길
- 시민길 안내

현재 README에서는 **전국 집회길**을 임시 이름으로 사용합니다.
