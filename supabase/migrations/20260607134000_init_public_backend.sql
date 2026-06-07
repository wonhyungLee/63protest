create extension if not exists pgcrypto;

do $$
begin
  create type public.item_kind as enum ('event', 'assembly', 'traffic', 'notice');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.tip_category as enum ('move', 'prepare', 'accessibility', 'return_home', 'correction', 'other');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.tip_status as enum ('public', 'hidden', 'blocked');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.source_status as enum ('active', 'paused', 'manual_only');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.regions (
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

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  region_code text not null references public.regions(code),
  agency text not null,
  name text not null,
  source_type text not null default 'official_page',
  adapter_key text not null,
  list_url text,
  detail_url_template text,
  status public.source_status not null default 'active',
  parser_version text not null default 'v1',
  fetch_mode text not null default 'fetch',
  crawl_interval_minutes int not null default 180,
  license_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (region_code, adapter_key)
);

create table if not exists public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources(id) on delete set null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  new_posts int not null default 0,
  updated_posts int not null default 0,
  parsed_items int not null default 0,
  error_message text,
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.official_posts (
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
  unique (source_id, source_key)
);

create table if not exists public.official_items (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.official_posts(id) on delete cascade,
  region_code text not null references public.regions(code),
  source_item_key text not null,
  kind public.item_kind not null default 'assembly',
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
  confidence numeric not null default 0.8 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, source_item_key)
);

create table if not exists public.tips (
  id uuid primary key default gen_random_uuid(),
  region_code text not null references public.regions(code),
  item_id uuid references public.official_items(id) on delete set null,
  category public.tip_category not null,
  body text not null check (char_length(body) between 5 and 500),
  nickname text check (char_length(nickname) <= 30),
  status public.tip_status not null default 'public',
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tip_reports (
  id uuid primary key default gen_random_uuid(),
  tip_id uuid not null references public.tips(id) on delete cascade,
  reason text not null check (char_length(reason) between 2 and 300),
  created_at timestamptz not null default now()
);

create table if not exists public.place_aliases (
  id uuid primary key default gen_random_uuid(),
  region_code text not null references public.regions(code),
  alias text not null,
  search_query text not null,
  naver_url text,
  kakao_url text,
  google_url text,
  created_at timestamptz not null default now(),
  unique (region_code, alias)
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_regions_enabled_order on public.regions (is_enabled, display_order);
create index if not exists idx_sources_region_status on public.sources (region_code, status);
create index if not exists idx_ingest_runs_source_started on public.ingest_runs (source_id, started_at desc);
create index if not exists idx_official_posts_region_date on public.official_posts (region_code, event_date desc);
create index if not exists idx_official_posts_hash on public.official_posts (raw_hash);
create index if not exists idx_official_items_region_date on public.official_items (region_code, event_date, time_start);
create index if not exists idx_official_items_kind on public.official_items (kind);
create index if not exists idx_tips_region_created on public.tips (region_code, created_at desc);
create index if not exists idx_tips_item_created on public.tips (item_id, created_at desc);
create index if not exists idx_tip_reports_tip on public.tip_reports (tip_id);

drop trigger if exists set_sources_updated_at on public.sources;
create trigger set_sources_updated_at
before update on public.sources
for each row execute function public.set_updated_at();

drop trigger if exists set_official_posts_updated_at on public.official_posts;
create trigger set_official_posts_updated_at
before update on public.official_posts
for each row execute function public.set_updated_at();

drop trigger if exists set_official_items_updated_at on public.official_items;
create trigger set_official_items_updated_at
before update on public.official_items
for each row execute function public.set_updated_at();

drop trigger if exists set_tips_updated_at on public.tips;
create trigger set_tips_updated_at
before update on public.tips
for each row execute function public.set_updated_at();

create or replace view public.public_items as
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
  coalesce(i.source_url, p.source_url) as source_url,
  p.title as source_title,
  p.agency,
  i.created_at,
  i.updated_at
from public.official_items i
join public.official_posts p on p.id = i.post_id
join public.regions r on r.code = i.region_code
where i.is_public = true
  and p.is_public = true
  and r.is_enabled = true;

create or replace view public.public_posts as
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
where p.is_public = true
  and r.is_enabled = true;

create or replace view public.public_tips as
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

alter table public.regions enable row level security;
alter table public.sources enable row level security;
alter table public.ingest_runs enable row level security;
alter table public.official_posts enable row level security;
alter table public.official_items enable row level security;
alter table public.tips enable row level security;
alter table public.tip_reports enable row level security;
alter table public.place_aliases enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public can read enabled regions" on public.regions;
create policy "Public can read enabled regions"
on public.regions for select
to anon, authenticated
using (is_enabled = true);

drop policy if exists "Public can read active sources" on public.sources;
create policy "Public can read active sources"
on public.sources for select
to anon, authenticated
using (status = 'active');

drop policy if exists "Public can read public tips" on public.tips;
create policy "Public can read public tips"
on public.tips for select
to anon, authenticated
using (status = 'public');

drop policy if exists "Public can report tips" on public.tip_reports;
create policy "Public can report tips"
on public.tip_reports for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.tips t
    where t.id = tip_id
      and t.status = 'public'
  )
);

drop policy if exists "Admins can read admin users" on public.admin_users;
create policy "Admins can read admin users"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.public_items to anon, authenticated;
grant select on public.public_posts to anon, authenticated;
grant select on public.public_tips to anon, authenticated;
grant select on public.regions to anon, authenticated;
grant select on public.sources to anon, authenticated;
grant select on public.tips to anon, authenticated;
grant insert on public.tip_reports to anon, authenticated;

insert into public.regions (code, name, slug, short_name, display_order, map_x, map_y, color_token) values
('KR-11', '서울', 'seoul', '서울', 10, 55, 25, 'blue'),
('KR-26', '부산', 'busan', '부산', 20, 74, 74, 'cyan'),
('KR-27', '대구', 'daegu', '대구', 30, 68, 61, 'lime'),
('KR-28', '인천', 'incheon', '인천', 40, 44, 28, 'violet'),
('KR-29', '광주', 'gwangju', '광주', 50, 48, 75, 'amber'),
('KR-30', '대전', 'daejeon', '대전', 60, 55, 55, 'teal'),
('KR-31', '울산', 'ulsan', '울산', 70, 78, 67, 'emerald'),
('KR-36', '세종', 'sejong', '세종', 80, 53, 49, 'orange'),
('KR-41', '경기', 'gyeonggi', '경기', 90, 49, 31, 'sky'),
('KR-42', '강원', 'gangwon', '강원', 100, 66, 25, 'green'),
('KR-43', '충북', 'chungbuk', '충북', 110, 58, 44, 'indigo'),
('KR-44', '충남', 'chungnam', '충남', 120, 45, 52, 'rose'),
('KR-45', '전북', 'jeonbuk', '전북', 130, 49, 65, 'orange'),
('KR-46', '전남', 'jeonnam', '전남', 140, 47, 84, 'green'),
('KR-47', '경북', 'gyeongbuk', '경북', 150, 71, 50, 'rose'),
('KR-48', '경남', 'gyeongnam', '경남', 160, 66, 75, 'pink'),
('KR-50', '제주', 'jeju', '제주', 170, 38, 96, 'zinc')
on conflict (code) do update set
  name = excluded.name,
  slug = excluded.slug,
  short_name = excluded.short_name,
  display_order = excluded.display_order,
  map_x = excluded.map_x,
  map_y = excluded.map_y,
  color_token = excluded.color_token,
  is_enabled = true;

insert into public.sources (
  region_code,
  agency,
  name,
  adapter_key,
  list_url,
  detail_url_template,
  status,
  parser_version,
  fetch_mode,
  license_note
) values (
  'KR-11',
  '서울경찰청 교통정보센터',
  '서울 행사 및 집회',
  'spatic_seoul',
  'https://www.spatic.go.kr/spatic/main/assem.do',
  'https://www.spatic.go.kr/spatic/assem/getInfoView.do?mgrSeq={seq}',
  'active',
  'spatic-seoul-v1',
  'fetch',
  '공식 공개 원문 링크와 파싱 결과만 안내 화면에 표시합니다.'
)
on conflict (region_code, adapter_key) do update set
  agency = excluded.agency,
  name = excluded.name,
  list_url = excluded.list_url,
  detail_url_template = excluded.detail_url_template,
  status = excluded.status,
  parser_version = excluded.parser_version,
  fetch_mode = excluded.fetch_mode,
  license_note = excluded.license_note,
  updated_at = now();
