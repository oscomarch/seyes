# Seyes

A small writing app that keeps your writing in plain files on your own computer.

```
npx seyes-app
```

---

## Why this exists

I write in paper journals and I love it. I also wanted to write on my computer,
and I never found something I actually liked. The options were always ugly, or
behind a subscription, or so full of features that opening them felt like work.
Mostly I disliked that my writing ended up somewhere I did not control, in a
format I could not read without the app that made it.

So this is an interface over a folder. That is the whole idea.

Every note is a `.md` file sitting in a normal folder on your machine. You can
open them in TextEdit, grep them, back them up, put them in Git, sync them with
iCloud, or move them somewhere else entirely and never open Seyes again. The
app is a window onto that folder, not a place your writing goes to live.

The name comes from Séyès, the ruled paper French schoolchildren write on. If
you turn on ruled paper in the settings, you will see why.

## What it is like to use

You type. There are no modes, no preview pane, no toggle between editing and
reading.

Press `/` for headings, lists, to-dos, toggles, quotes and code. Select any text
and a small bar appears, or use `⌘B`, `⌘I`, `⌘U`. If you already know markdown,
typing `# ` or `- ` works too. If you do not, you will never find out that it
does, and nothing is worse for it.

`⌘K` searches everything you have written. `⌘\` hides the sidebar.

The settings gear, top right, holds the three fonts (Courier, Verdana, Georgia),
light and dark, the ruled paper toggle, and the exact path of whatever note you
have open, with a button to reveal it in Finder.

## What happens to your files

Notes are markdown, and Seyes tries hard not to leave fingerprints on them.
There is no frontmatter, no ids, no metadata of any kind written into your
files. Your font choice and window state live in `~/.config/seyes`, not in your
writing.

Markdown cannot express underline, highlight or collapsible sections, so those
three save as `<u>`, `<mark>` and `<details>`. All valid HTML, all readable, all
understood by most other editors.

Everything round-trips exactly. There is a test that opens a file, saves it ten
times in a row, and fails if a single character moved. This matters more than it
sounds: a serializer that adds one blank line per save looks fine once and ruins
a file over a month.

Deleting a note moves it to the system Trash. It is never unlinked outright.

Because the folder is the source of truth, Seyes watches it. Rename a file in
Finder, edit a note in another app, drop a folder in, let iCloud sync something
from another machine: it shows up straight away, without a reload. If the note
you have open changes on disk, it updates itself, unless you are mid-sentence in
it, in which case your typing wins.

## About privacy

There is no account, no database, no analytics, and no network call. The server
binds to `127.0.0.1` only, so nothing on your network can reach it. Next.js
build telemetry is switched off.

This is not a promise about a privacy policy. It is just that there is nowhere
for the data to go.

## Running it

```
npx seyes-app
```

The first run asks one question, where your writing should live, defaulting to
`~/Documents/Seyes`. Then it builds itself once, which takes under a minute, and
opens your browser. Nothing else to configure.

To work on Seyes itself:

```
git clone https://github.com/oscomarch/seyes.git
cd seyes
npm install
npm run dev
```

`npm test` runs the suite. The tests worth knowing about are the markdown
round-trip ones in `tests/markdown.test.ts` and the path-containment ones in
`tests/paths.test.ts`, which check that no request can read or write outside
your writing folder.

## How it is put together

```
src/lib/fs        reading and writing files, safely
src/lib/editor    the editor, and markdown in and out of it
src/app/api       a thin HTTP layer over the above
src/components    sidebar, editor, desk, settings
bin/seyes.mjs     the launcher you get from npx
```

The filesystem layer knows nothing about markdown, and the editor layer knows
nothing about files. Everything the server does with a path goes through one
function that refuses to leave your folder.

## Honest limitations

It is early. Some things are rough:

- Renaming still uses a plain browser prompt, which is ugly
- If a note starts with a `# Heading`, the title appears twice
- No images, tables or coloured text
- It has only really been used on macOS

## License

MIT. Do what you like with it.
