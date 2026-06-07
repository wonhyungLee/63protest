/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
  readonly PUBLIC_NAVER_MAP_APPNAME?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
