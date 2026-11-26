import { defineConfig } from 'drizzle-kit'

// locally, read the settings `vercel env pull` saved; elsewhere they come from the environment
try {
  process.loadEnvFile('.env.local')
} catch {
  /* no .env.local: use the environment as it is */
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // migrations need a direct connection; the pooled one is for the app
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '' },
})
