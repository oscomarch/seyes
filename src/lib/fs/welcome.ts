import fs from 'node:fs/promises'
import path from 'node:path'

/*
 * The first note, left in a new writing folder so it isn't empty. The npm
 * launcher (bin/seyes.mjs) carries its own copy, since it can't import
 * TypeScript; keep the two saying the same thing.
 */
export const WELCOME_NOTE = `# Welcome

This is a real file on your computer. Everything you write in Seyes is a
plain markdown file in this folder, and nothing ever leaves this machine.

Type \`/\` for headings, lists, to-dos, toggles and quotes. Press Tab to make
a bullet, and Tab again to indent it. Select any text to format it, or use
cmd+B, cmd+I and cmd+U.

- [x] install Seyes
- [ ] write something that matters

> Delete the app tomorrow and these files are still yours.
`

/** Leave the welcome note in `root` if the folder has nothing in it yet. */
export async function seedIfEmpty(root: string): Promise<void> {
  await fs.mkdir(root, { recursive: true })
  const entries = await fs.readdir(root)
  if (entries.every((name) => name.startsWith('.'))) {
    await fs.writeFile(path.join(root, 'Welcome.md'), WELCOME_NOTE, 'utf8')
  }
}
