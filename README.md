# 전국 집회길 웹페이지

공식 집회, 행사, 교통통제 원문을 지역별로 보여주는 모바일 우선 웹 앱입니다. `README_supabase_github_national_assembly.md`의 제품 방향을 기준으로 첫 화면에서 바로 지역 지도, 일정 카드, 지도 링크, 팁, 원문 목록을 다룹니다.

## 실행

```bash
npm install
npm run dev
```

## 환경변수

`.env.example`을 참고해 `.env`를 만들면 Supabase 공개 데이터를 읽습니다.

```bash
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
PUBLIC_SITE_URL=https://wonhyungLee.github.io/63protest
PUBLIC_BASE_PATH=/63protest
```

브라우저에 노출되는 값은 `PUBLIC_` 값만 사용합니다. DB 접속 문자열, service role key, 관리자 토큰은 GitHub Pages나 프론트엔드 코드에 넣지 않습니다.

## 현재 구현

- 전국 17개 지역 선택 지도
- 오늘, 내일, 이번 주, 전체 일정 필터
- 집회, 행사, 교통통제, 공지 종류 필터
- 장소, 행사명, 경로 검색
- 네이버지도, 카카오맵, Google 지도 검색 링크
- 지역 팁 작성 UI와 개인정보 패턴 차단
- Supabase `public_items`, `public_tips`, `submit-tip` 연결 준비
- Supabase 데이터가 비어 있거나 환경변수가 없을 때 시연 데이터 표시
- Supabase 스키마, RLS, 공개 View, 서울 공식 출처 seed
- 공개 팁 제출 Edge Function `submit-tip`

## Supabase 백엔드

대상 프로젝트는 `qmdknxbuvftwqmfxtkch`입니다.

```bash
npm run supabase:link
npm run supabase:push
npm run supabase:deploy-functions
```

마이그레이션은 `supabase/migrations/20260607134000_init_public_backend.sql`에 있습니다. 공개 프론트엔드는 `public_items`, `public_tips` View만 읽고, 팁 작성은 `submit-tip` Edge Function을 통해 `tips` 테이블에 저장합니다.

## 실제 데이터 수집

서울경찰청과 대구경찰청의 오늘의 집회 게시판 첨부 PDF를 파싱합니다.

```bash
npm run ingest -- --limit=10
```

GitHub-hosted runner에서는 두 경찰청 도메인 연결이 차단될 수 있어, 현재 자동 수집은 이 머신의 systemd user timer로 운영합니다.

```bash
cp scripts/systemd/63protest-ingest.* ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now 63protest-ingest.timer
```

타이머는 매일 06:20, 09:20, 12:20, 15:20, 18:20, 21:20에 실행됩니다. 서비스 역할 키는 파일에 저장하지 않고 Supabase CLI 인증으로 매 실행 조회합니다.

## 빌드

```bash
npm run build
npm run preview
```
