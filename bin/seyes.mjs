#!/usr/bin/env node
/**
 * The whole install story: `npx seyes`.
 *
 * Everything that would normally be onboarding happens here instead, without
 * asking the user anything: make the writing folder, put one real note in it
 * the first time so the app is never an empty box, build if this copy has
 * never been built, start, and open the browser.
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const port = process.env.PORT ?? '3000'

function configuredRoot() {
  const configFile = path.join(os.homedir(), '.config', 'seyes', 'config.json')
  try {
    const root = JSON.parse(fs.readFileSync(configFile, 'utf8')).root
    if (typeof root === 'string' && root) return root
  } catch {
    // No config yet. The default below is what the app uses too.
  }
  return path.join(os.homedir(), 'Documents', 'Seyes')
}

const FIRST_NOTE = `# Welcome

This is a real file on your computer. Everything you write in Seyes is a
plain markdown file in this folder, and nothing ever leaves this machine.

Type \`/\` for headings, lists, to-dos, toggles and quotes. Select any text
to format it, or use cmd+B, cmd+I and cmd+U.

- [x] install Seyes
- [ ] write something that matters

> Delete the app tomorrow and these files are still yours.
`

function seed(writingRoot) {
  fs.mkdirSync(writingRoot, { recursive: true })
  const empty = fs.readdirSync(writingRoot).every((name) => name.startsWith('.'))
  if (!empty) return
  fs.writeFileSync(path.join(writingRoot, 'Welcome.md'), FIRST_NOTE, 'utf8')
}

function ensureBuilt() {
  if (fs.existsSync(path.join(appRoot, '.next', 'BUILD_ID'))) return
  process.stdout.write('Setting up Seyes for the first time. This takes a moment.\n')
  const built = spawnSync('npx', ['next', 'build'], { cwd: appRoot, stdio: 'inherit' })
  if (built.status !== 0) {
    process.stderr.write('\nSeyes could not build. Please report this with the output above.\n')
    process.exit(built.status ?? 1)
  }
}

const writingRoot = configuredRoot()
seed(writingRoot)
ensureBuilt()

process.stdout.write(`\nSeyes is running at http://localhost:${port}\n`)
process.stdout.write(`Your writing lives in ${writingRoot}\n`)
process.stdout.write('Press ctrl-C to stop.\n\n')

const server = spawn('npx', ['next', 'start', '-p', port], {
  cwd: appRoot,
  stdio: 'inherit',
  env: process.env,
})

setTimeout(() => {
  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  spawn(opener, [`http://localhost:${port}`], { stdio: 'ignore', shell: true })
}, 1500)

const stop = () => server.kill('SIGINT')
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
server.on('exit', (code) => process.exit(code ?? 0))
