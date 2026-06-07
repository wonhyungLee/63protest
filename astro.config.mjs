import react from '@astrojs/react'
import { defineConfig } from 'astro/config'

const site = process.env.PUBLIC_SITE_URL || 'https://wonhyungLee.github.io/63protest'
const base = process.env.PUBLIC_BASE_PATH || '/'

export default defineConfig({
  site,
  base,
  output: 'static',
  integrations: [react()],
})
