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
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const port = process.env.PORT ?? '3000'

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
 * Asked once, on the very first run, and never again.
 *
 * Where the files live is the whole point of Seyes, so it is the one thing
 * worth interrupting for. Everything else is defaulted silently.
 */
async function chooseRoot() {
  const existing = savedRoot()
  if (existing) return existing

  // Piped or non-interactive (CI, `npx seyes < /dev/null`): take the default
  // rather than hanging on a prompt nobody can answer.
  if (!process.stdin.isTTY) {
    saveRoot(documentsRoot)
    return documentsRoot
  }

  process.stdout.write(`
  Seyes keeps your writing as plain markdown files on this computer.
  Nothing is uploaded, and you can move or delete the folder any time.

  Where should they live?

    1  Documents/Seyes                        (recommended)
    2  Documents/Seyes, with a shortcut on your Desktop
    3  Desktop/Seyes

`)

  // Ctrl+D or Ctrl+C at the prompt should take the default quietly, not dump
  // a stack trace at someone who is thirty seconds into using the app.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  let answer = ''
  try {
    answer = (await rl.question('  Choose 1, 2 or 3 [1]: ')).trim()
  } catch {
    process.stdout.write('\n')
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
      process.stdout.write('  (Could not put a shortcut on the Desktop, carrying on.)\n')
    }
  }

  saveRoot(root)
  process.stdout.write(`\n  Your writing will live in ${root}\n`)
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

const writingRoot = await chooseRoot()
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
