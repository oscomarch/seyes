# Seyes

A small writing app. Your writing stays in plain files on your own computer.

```
npx seyes-app
```

On a Mac you can also install it as a real app. That's further down, in
[Get it as a Mac app](#get-it-as-a-mac-app).

![Seyes](.github/media/seyes.png)

<details>
<summary>Dark</summary>

![Seyes in dark mode](.github/media/seyes-dark.png)

</details>

---

## Why I made it

I keep paper journals and I love them. I wanted to write on my computer too,
but I never found an app I liked. They were ugly, or they wanted a
subscription, or they had so many features that opening one felt like work.
What bothered me most was that my writing ended up somewhere I didn't control,
in a format I couldn't read without the app.

So Seyes is just an interface over a folder.

Every note is a `.md` file in a normal folder. You can open it in TextEdit,
search it with grep, back it up or put it in Git. If you stop using Seyes
tomorrow, your writing is still there. The app is a window onto the folder.
Your writing doesn't live inside it.

The name comes from Séyès, the ruled paper French kids learn to write on. Turn
on ruled paper in the settings and you'll see why.

## Using it

You just type. There are no modes and no preview pane.

Press `/` to add a heading, a list, a to-do, a toggle, a quote or some code.
Select text and a small toolbar shows up, or use `⌘B`, `⌘I` and `⌘U`. If you
know markdown, typing `# ` or `- ` does what you'd expect. If you don't, you
never need to.

`⌘K` searches everything you've written. `⌘\` hides the sidebar.

The gear in the top right opens the settings. You can pick a font (Courier,
Verdana or Georgia), switch between light and dark, and turn the ruled paper
on or off. It also shows where the open note lives on disk, with a button to
find it in Finder.

## Your files

Seyes tries not to leave marks on your notes. It writes no frontmatter, no ids
and no hidden metadata. Settings like your font are kept in `~/.config/seyes`,
away from your writing.

Markdown has no way to write underline, highlight or a collapsible section. So
those three are saved as `<u>`, `<mark>` and `<details>`. That's plain HTML,
and most editors read it fine.

A file should come back exactly as it went in. There's a test that opens a
note, saves it ten times, and fails if a single character moved. It sounds
small. But an editor that adds one blank line on every save looks fine at first
and wrecks a file over a month.

When you delete a note it goes to the Trash. Nothing is ever deleted for good.

Seyes watches the folder, so changes from outside show up right away. Rename a
file in Finder or edit a note in another app and you'll see it without
reloading. If the note you have open changes on disk, it updates. The one
exception is when you're typing in it. Then your typing wins.

## Privacy

There's no account, no database and no analytics. Seyes makes no network
calls. The server only listens on `127.0.0.1`, so nothing else on your network
can reach it. Next.js telemetry is turned off.

I'm not asking you to trust a privacy policy. There's just nowhere for your
data to go.

## Running it

```
npx seyes-app
```

The first time, it asks where your writing should go. The default is
`~/Documents/Seyes`. Then it builds itself once, which takes under a minute,
and opens in your browser.

A note for Mac users. If iCloud's "Desktop & Documents Folders" option is on,
then `~/Documents` is in iCloud Drive, and so is that default. That's fine if
you want your notes synced. If you want them to stay on your machine, pick a
folder like `~/Seyes` instead. You can change it later in the settings.

If you use it every day, install it once. `npx` can download and rebuild it
again whenever you type the command a little differently.

```
npm i -g seyes-app
seyes
```

## Get it as a Mac app

This gives you an icon in your Dock. No terminal, and ⌘Q quits it.

```
npm i -g seyes-app
bash "$(npm root -g)/seyes-app/mac/build.sh"
```

That puts `Seyes.app` in `/Applications`. Open it from there, or press ⌘Space
and type "seyes". You'll need Xcode's command line tools
(`xcode-select --install`). Building takes a few seconds.

The app doesn't carry its own copy of Seyes. It starts the `seyes` command,
shows it in a window, and stops it when you quit. To upgrade, run
`npm i -g seyes-app` again. You don't need to rebuild the app.

To move the window, drag it by the top bar. Anywhere that isn't a button works.

## Working on Seyes

```
git clone https://github.com/oscomarch/seyes.git
cd seyes
npm install
npm run dev
```

`npm test` runs the tests. The two worth knowing about are the markdown
round-trip tests in `tests/markdown.test.ts` and the path tests in
`tests/paths.test.ts`. The path tests make sure no request can read or write
outside your writing folder.

## How it's built

```
src/lib/fs        reading and writing files, safely
src/lib/editor    the editor, and markdown in and out of it
src/app/api       a thin HTTP layer over the above
src/components    sidebar, editor, desk, settings
bin/seyes.mjs     the launcher you get from npx
mac/              the Mac app, and the script that builds it
```

The file code doesn't know anything about markdown. The editor doesn't know
anything about files. Every path the server touches goes through one function,
and that function won't leave your folder.

## Limitations

It's early, and some things are rough. There are no images, tables or colored
text yet. I've mostly used it on macOS. The Mac app isn't signed, so you build
it on your own machine instead of downloading it.

## License

MIT. Do what you like with it.
