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
) values
(
  'KR-11',
  '서울경찰청',
  '오늘의 집회/시위',
  'smpa_seoul',
  'https://www.smpa.go.kr/user/nd54882.do',
  'https://www.smpa.go.kr/user/nd54882.do?View&boardNo={sourceKey}',
  'active',
  'smpa-seoul-pdf-v1',
  'fetch',
  '서울경찰청 오늘의 집회/시위 공개 게시글과 첨부 PDF를 파싱합니다.'
),
(
  'KR-27',
  '대구경찰청',
  '오늘의 집회시위',
  'dgpolice_daegu',
  'https://www.dgpolice.go.kr/bbs/List.do?bbsId=d495f174',
  'https://www.dgpolice.go.kr/dgpo/bbs/view.do?bbsId=d495f174&num={sourceKey}',
  'active',
  'dgpolice-daegu-pdf-v1',
  'fetch',
  '대구경찰청 오늘의 집회시위 공개 게시글과 첨부 PDF를 파싱합니다.'
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
