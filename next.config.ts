import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // the share card reads its fonts from disk at request time; make sure they ship with the function
  outputFileTracingIncludes: { '/w/[slug]/opengraph-image': ['./src/assets/og-fonts/*'] },
}

export default nextConfig
