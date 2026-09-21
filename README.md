# Seyes

Your writing, on your machine, in files you own.

Seyes is an interface over a folder. Every note is a plain markdown file in
`~/Documents/Seyes`. There is no account, no database, and no network call.
Delete the app and your writing is still sitting there, readable in any editor.

## Run it

    npx seyes

That is the whole install. It creates `~/Documents/Seyes`, puts one note in
it so you are not staring at an empty box, builds itself the first time, and
opens your browser. There is no account, no sign-up and no setup screen.

To work on Seyes itself:

    git clone <repo-url> seyes && cd seyes && npm install && npm run dev

## Writing

- `/` opens the block menu: headings, lists, to-dos, toggles, quotes, code
- Select text for the formatting bar
- cmd+B bold, cmd+I italic, cmd+U underline, cmd+K link
- cmd+K opens search across everything you have written
- cmd+\ hides the sidebar
- Three fonts, top right. Purely visual, changes nothing on disk.

## Your files

Notes are markdown. Underline saves as `<u>`, highlight as `<mark>`, and
toggles as `<details>`, all of which are valid HTML that any browser and most
editors already understand. Nothing app-specific is ever written into your
files: no frontmatter, no ids, no metadata.

Move, rename, back up or version your folder in Finder, Git or iCloud. Seyes
follows whatever is on disk. A symlink you put in the folder is followed, and
marked with an arrow in the sidebar so you can tell where a note really lives.

Deleting a note moves it to the system Trash, never straight to oblivion.
