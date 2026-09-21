#!/usr/bin/env node
/**
 * The whole install story: `npx seyes`.
 *
 * Everything that would normally be an onboarding flow happens here instead:
 * ask once where the writing should live, make the folder, put one real note
 * in it so the app is never an empty box, build if this copy has never been
 * built, start on loopback only, and open the browser.
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const port = process.env.PORT ?? '3000'

/* ---------------------------- terminal styling ---------------------------- */

// Honour NO_COLOR and dumb/piped terminals: the output still reads fine,
// it just arrives at once with no escape codes and no animation.
const rich = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && process.env.TERM !== 'dumb'

const ink = (r, g, b) => (rich ? `\x1b[38;2;${r};${g};${b}m` : '')
const RESET = rich ? '\x1b[0m' : ''
const BOLD = rich ? '\x1b[1m' : ''
const HIDE = rich ? '\x1b[?25l' : ''
const SHOW = rich ? '\x1b[?25h' : ''

const AMBER = ink(215, 154, 91)
const RUST = ink(199, 94, 64)
const CREAM = ink(239, 227, 210)
const FAINT = ink(122, 110, 94)

const write = (text) => process.stdout.write(text)
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, rich ? ms : 0))

/**
 * The name is typed out one key at a time onto a sheet of Seyes ruling: a
 * rust margin rule down the left, faint horizontals drawn across. It is the
 * same paper the app puts behind your writing, rendered in a terminal.
 */
async function banner() {
  if (!rich) {
    write('\n  seyes\n  your writing, on your machine\n\n')
    return
  }

  const MARGIN = `${RUST}╷${RESET}`
  write(HIDE + '\n')
  write(`  ${MARGIN}\n`)

  // Type the name, a block cursor trailing the last letter.
  const name = 'seyes'
  for (let i = 1; i <= name.length; i++) {
    write('\x1b[2K\r')
    write(`  ${MARGIN}  ${BOLD}${CREAM}${name.slice(0, i)}${RESET}${AMBER}█${RESET}`)
    await pause(110)
  }
  await pause(240)
  write('\x1b[2K\r')
  write(`  ${MARGIN}  ${BOLD}${CREAM}${name}${RESET}\n`)

  // Then rule the sheet, left to right.
  for (let width = 2; width <= 34; width += 4) {
    write('\x1b[2K\r')
    write(`  ${MARGIN}  ${FAINT}${'─'.repeat(width)}${RESET}`)
    await pause(16)
  }
  write('\n')

  write(`  ${MARGIN}  ${FAINT}your writing, on your machine${RESET}\n`)
  write(`  ${MARGIN}\n\n`)
  write(SHOW)
}

/* -------------------------------- first run ------------------------------- */

const configFile = path.join(os.homedir(), '.config', 'seyes', 'config.json')
const documentsRoot = path.join(os.homedir(), 'Documents', 'Seyes')
const desktop = path.join(os.homedir(), 'Desktop')

function savedRoot() {
  try {
    const root = JSON.parse(fs.readFileSync(configFile, 'utf8')).root
    if (typeof root === 'string' && root) return root
  } catch {
    // Not chosen yet.
  }
  return null
}

function saveRoot(root) {
  fs.mkdirSync(path.dirname(configFile), { recursive: true })
  fs.writeFileSync(configFile, JSON.stringify({ root }, null, 2), 'utf8')
}

/**
 * Asked once, on the very first run, and never again. Where the files live is
 * the whole point of Seyes, so it is the one thing worth interrupting for.
 */
async function chooseRoot() {
  const existing = savedRoot()
  if (existing) return existing

  // Piped or non-interactive: take the default rather than hanging on a
  // prompt nobody can answer.
  if (!process.stdin.isTTY) {
    saveRoot(documentsRoot)
    return documentsRoot
  }

  write(`  ${CREAM}Your writing is kept as plain markdown files on this computer.${RESET}\n`)
  write(`  ${FAINT}Nothing is uploaded. You can move or delete the folder any time.${RESET}\n\n`)
  write('  Where should they live?\n\n')
  write(`    ${AMBER}1${RESET}  Documents/Seyes ${FAINT}(recommended)${RESET}\n`)
  write(`    ${AMBER}2${RESET}  Documents/Seyes, with a shortcut on your Desktop\n`)
  write(`    ${AMBER}3${RESET}  Desktop/Seyes\n\n`)

  // Ctrl+D or Ctrl+C should take the default quietly, not dump a stack trace
  // at someone thirty seconds into using the app.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  let answer = ''
  try {
    answer = (await rl.question(`  Choose ${AMBER}1${RESET}, ${AMBER}2${RESET} or ${AMBER}3${RESET} [1]: `)).trim()
  } catch {
    write('\n')
  } finally {
    rl.close()
  }

  const root = answer === '3' ? path.join(desktop, 'Seyes') : documentsRoot

  if (answer === '2') {
    const link = path.join(desktop, 'Seyes')
    try {
      fs.mkdirSync(documentsRoot, { recursive: true })
      if (!fs.existsSync(link)) fs.symlinkSync(documentsRoot, link, 'dir')
    } catch {
      write(`  ${FAINT}(Could not put a shortcut on the Desktop, carrying on.)${RESET}\n`)
    }
  }

  saveRoot(root)
  return root
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
  if (empty) fs.writeFileSync(path.join(writingRoot, 'Welcome.md'), FIRST_NOTE, 'utf8')
}

/**
 * Where the app actually gets built and run.
 *
 * When installed from npm this file lives inside node_modules, and Turbopack
 * refuses to treat anything under node_modules as application source, so
 * building in place fails outright. Instead the source is copied once into a
 * stable cache directory with the installed dependencies symlinked in.
 *
 * Doing it this way also means the build survives between runs: npx may throw
 * the downloaded package away, but the cache, and so the build, stays put.
 */
function workspace() {
  const installed = appRoot.includes(`${path.sep}node_modules${path.sep}`)
  if (!installed) return appRoot // a dev checkout: build where it lives

  const version = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8')).version
  const work = path.join(os.homedir(), '.cache', 'seyes', `app-${version}`)
  const stamp = path.join(work, '.seyes-source')

  try {
    if (fs.readFileSync(stamp, 'utf8').trim() === appRoot) return work
  } catch {
    // Never prepared, or prepared from a different install. Rebuild it.
  }
  return prepareWorkspace(work, stamp)
}

function prepareWorkspace(work, stamp) {
  fs.rmSync(work, { recursive: true, force: true })
  fs.mkdirSync(work, { recursive: true })

  for (const entry of ['src', 'public', 'next.config.ts', 'tsconfig.json', 'next-env.d.ts']) {
    const from = path.join(appRoot, entry)
    if (fs.existsSync(from)) fs.cpSync(from, path.join(work, entry), { recursive: true })
  }

  // A trimmed manifest: the workspace only needs to install and build, so it
  // carries no bin, no files list and no scripts that reference either.
  const manifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'))
  fs.writeFileSync(
    path.join(work, 'package.json'),
    JSON.stringify(
      {
        name: 'seyes-app',
        version: manifest.version,
        private: true,
        scripts: { build: 'next build', start: 'next start' },
        dependencies: manifest.dependencies,
      },
      null,
      2,
    ),
    'utf8',
  )

  // Dependencies are installed into the workspace itself rather than
  // symlinked from the install location. A symlinked node_modules pointing
  // outside the project is rejected outright by the bundler, and linking
  // each package individually runs into the same rule.
  write(`  ${AMBER}Setting up Seyes for the first time.${RESET}\n`)
  write(`  ${FAINT}Fetching what it needs. This only happens once.${RESET}\n\n`)
  const installed = spawnSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--silent'], {
    cwd: work,
    stdio: 'inherit',
  })
  if (installed.status !== 0) {
    write(`\n  ${RUST}Seyes could not fetch its dependencies.${RESET} Check your connection and try again.\n`)
    process.exit(installed.status ?? 1)
  }

  fs.writeFileSync(stamp, appRoot, 'utf8')
  return work
}

function ensureBuilt(work) {
  if (fs.existsSync(path.join(work, '.next', 'BUILD_ID'))) return
  write(`  ${FAINT}Building. Nearly there.${RESET}\n\n`)
  const built = spawnSync('npx', ['next', 'build'], { cwd: work, stdio: 'inherit' })
  if (built.status !== 0) {
    write(`\n  ${RUST}Seyes could not build.${RESET} Please report this with the output above.\n`)
    process.exit(built.status ?? 1)
  }
}

/* ----------------------------------- go ----------------------------------- */

await banner()
const writingRoot = await chooseRoot()
seed(writingRoot)
const work = workspace()
ensureBuilt(work)

write(`\n  ${BOLD}${CREAM}Seyes is running${RESET}  ${AMBER}http://localhost:${port}${RESET}\n`)
write(`  ${FAINT}Your writing lives in ${writingRoot}${RESET}\n`)
write(`  ${FAINT}Press ctrl-C to stop.${RESET}\n\n`)

// -H 127.0.0.1 is not cosmetic. Without it Next listens on every network
// interface, which would put a private journal on whatever wifi the user
// happens to be on, readable and writable by anyone else there.
const server = spawn('npx', ['next', 'start', '-H', '127.0.0.1', '-p', port], {
  cwd: work,
  stdio: 'inherit',
  env: process.env,
})

setTimeout(() => {
  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  spawn(opener, [`http://localhost:${port}`], { stdio: 'ignore', shell: true })
}, 1500)

const stop = () => {
  write(SHOW)
  server.kill('SIGINT')
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
server.on('exit', (code) => {
  write(SHOW)
  process.exit(code ?? 0)
})
