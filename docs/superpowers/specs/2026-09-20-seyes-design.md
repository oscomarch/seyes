# Seyes: design spec

Date: 2026-09-20
Status: approved (pending final spec review)

## 1. Problem

I write in paper journals and love it. I also want to write on my computer, but
every option fails on at least one of: ugly, paid, or slow to use. I want an
interface over my own filesystem. The texts live on my laptop. I own them.
Nobody else does.

The app must be frictionless enough that a non-technical person can use it, and
simple enough that anybody can run it locally in one command.

## 2. Non-goals

Explicitly out of scope for v1:

- Tables, colored text, multi-column layouts, embeds, database views
- Images and file attachments
- Sync, accounts, sharing, collaboration, telemetry, any network call at all
- Mobile
- Plugins, themes beyond the font switcher

## 3. Delivery

A local web app. The user runs one command, a local server boots, the browser
opens. Distributed so that `npx seyes` eventually works; during development it
is `npm install && npm run dev`.

Rejected alternatives:

- Single HTML file using the File System Access API. Chrome and Edge only,
  permission re-grant friction on every open, weak full-text search.
- Native desktop app (Tauri/Electron). Needs signing and notarization per
  platform, slower to iterate, and turns "anyone can run it" into "anyone can
  download a binary I built".

## 4. Storage model

### Root folder

A single root folder holds everything. Default `~/Documents/Seyes`, created on
first run. Changeable in settings, persisted in a small local config file.

### Files and folders

The sidebar is a true mirror of the filesystem. Arbitrary nesting. Folders are
real folders, notes are real `.md` files. A file moved or renamed in Finder
shows up moved or renamed in the app. There is no index, no database, no
shadow copy. The filesystem is the source of truth.

Filename is the note title. Renaming the title renames the file on disk.

### Format

Markdown, with a minimal HTML fallback for the three things markdown cannot
express:

| Feature | On disk |
|---|---|
| Bold | `**text**` |
| Italic | `*text*` |
| Strikethrough | `~~text~~` |
| Inline code | `` `text` `` |
| Link | `[text](url)` |
| Headings 1-3 | `#`, `##`, `###` |
| Bulleted list | `- ` |
| Numbered list | `1. ` |
| To-do | `- [ ]` / `- [x]` |
| Quote | `> ` |
| Code block | fenced with backticks |
| Divider | `---` |
| Underline | `<u>text</u>` |
| Highlight | `<mark>text</mark>` |
| Toggle | `<details><summary>Title</summary>body</details>` |

Rationale: the stated motivation for the project is ownership. A plain text
file is readable in any editor on any machine in twenty years with no app and
no runtime. That property is worth the cost of a serialization layer.

No YAML frontmatter. Nothing app-specific is written into the user's files.
App state (font choice, sidebar width, last open note, root path) lives in a
separate config file outside the writing folder.

## 5. Editing experience

Tiptap (ProseMirror) as the editor engine.

Three ways to format, all available at once:

1. Keyboard: cmd+B bold, cmd+I italic, cmd+U underline, cmd+shift+X
   strikethrough, cmd+shift+H highlight, cmd+E inline code, cmd+K link
2. Slash menu: typing `/` opens a filtered block menu (headings, lists, to-do,
   quote, code block, divider, toggle)
3. Selection popup: selecting text shows a small inline toolbar

Markdown input rules are enabled as an invisible bonus: typing `# ` or `- ` at
the start of a line converts the block. A user who never discovers this loses
nothing.

There is no preview mode and no mode switch of any kind. What is on screen is
the document.

## 6. Interface

Three regions, nothing else.

**Sidebar (left).** The folder tree. New note, new folder, rename, delete,
drag to move. Collapsible with cmd+\. Width is remembered.

**Page (center).** Title line, then the body. Single centered column around
680px, generous vertical margins.

**Font switcher (top right).** Three typefaces, one click, remembered
globally, applied everywhere. It is purely visual and conditions nothing:
it is not stored per file, not stored per folder, and not written to disk.

**Command palette (cmd+K).** Jump to any note by name, fuzzy matched. Also
performs full-text search across all notes.

Dark mode follows the system setting.

## 7. Saving and safety

- Autosave after a 600ms typing pause, plus on blur and on window unload
- Atomic writes: write to a temp file in the same directory, then rename, so
  an interrupted save can never truncate an existing note
- All paths are resolved and verified to sit inside the root folder before any
  read or write. Requests resolving outside it are rejected
- Deleting a note moves it to the OS trash rather than unlinking it

## 8. Architecture

Next.js App Router, one process, one port.

Server side owns all filesystem access, exposed as a small internal API:

- `tree`: read the folder structure under root
- `read(path)`: return a note's markdown
- `write(path, markdown)`: atomic save
- `create(path, kind)`: new note or folder
- `rename(from, to)`, `move(from, to)`, `trash(path)`
- `search(query)`: full-text scan across notes

Client side owns the editor and the UI. The markdown to ProseMirror conversion
(and back) is a single isolated module with its own tests, since it is the one
piece where a bug costs the user real writing.

Module boundaries:

- `lib/fs`: path safety, atomic write, tree walk. Knows nothing about markdown.
- `lib/markdown`: serialize and parse. Pure functions, no IO.
- `lib/editor`: Tiptap schema, extensions, keymaps, slash menu.
- `app/api`: thin HTTP layer over `lib/fs`, no logic of its own.
- `components`: sidebar, page, palette, font switcher.

## 9. Testing

The conversion layer gets round-trip property tests: for every supported
construct, markdown to document to markdown must be identical. This is the
highest-value test surface in the project because a regression there is
silent data loss.

Path safety gets adversarial tests (`../`, symlinks, absolute paths).

UI gets a smoke test covering: create a note, type, reload, content persists.

## 10. Success criteria

- From a clean clone: install, one command, writing within a minute
- Every formatting action in section 5 survives a save and reload byte-identically
- No network request is ever made by the running app
- A non-technical person can create a note and bold a word without instruction
