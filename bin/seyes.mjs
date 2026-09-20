#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const port = process.env.PORT ?? '3000'

const server = spawn('npx', ['next', 'start', '-p', port], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})

setTimeout(() => {
  const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  spawn(open, [`http://localhost:${port}`], { stdio: 'ignore', shell: true })
}, 1500)

server.on('exit', (code) => process.exit(code ?? 0))
