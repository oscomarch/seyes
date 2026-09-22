import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // The Mac app ships a pre-built, self-contained server (mac/release.sh sets
  // this). The npm launcher builds and runs the normal way, so it stays off.
  ...(process.env.SEYES_STANDALONE === '1' ? { output: 'standalone' as const } : {}),
  // Pin the project root. Otherwise Next finds a stray package-lock.json in a
  // parent folder (a home directory, say) and traces files from there.
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: { root: path.resolve(__dirname) },
}

export default nextConfig
