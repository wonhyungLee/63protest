update public.sources
set
  list_url = 'http://www.smpa.go.kr/user/nd54882.do',
  detail_url_template = 'http://www.smpa.go.kr/user/nd54882.do?View&boardNo={sourceKey}',
  updated_at = now()
where adapter_key = 'smpa_seoul';
