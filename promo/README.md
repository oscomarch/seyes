# Poem videos

Vertical videos of a poem being typed into Seyes, for TikTok and Instagram.

```
python3 promo/make.py promo/poems/hope.md
```

Each poem becomes `promo/out/<poem>.mp4`, 1080 x 1920 at 30 fps, about 40 seconds.
The Seyes window sits on a generated background, under a macOS menu bar and
above a Dock with this Mac's own app icons (exported on the fly by
`icons.swift`, never committed). When the poem is done, the author's name is
selected by hand, made bold and highlighted from Seyes' own formatting bar.
There's a key sound under every keystroke and no music. Add the music in
TikTok or Instagram when you post, where it's licensed.

The key sound is a real keyboard. `keys.py` takes a recording of someone
typing, cleans out the background hiss, cuts it into single keystrokes and
sorts out the big keys, into `keys/bank.npz`. Each key keeps its own
keystroke and is placed left to right in stereo where it sits on the
keyboard. To use another recording, record 30 seconds of typing in a quiet
room and run

```
python3 promo/keys.py ~/Downloads/typing.m4a
```

Two synthesised sounds are there too, `--keys natural` and the first,
lighter `--keys soft`.

## Adding a poem

Make a file in `promo/poems/` like this one.

```
---
title: Hope is the thing with feathers
author: Emily Dickinson
mood: dusk
---
"Hope" is the thing with feathers -
That perches in the soul -
```

`mood` sets the background. It can be `dusk`, `dawn`, `forest`, `sea` or `ink`.
`clock` is optional and sets the time in the menu bar, like `Tue 22 Sep  21:14`.

Only use poems in the public domain. A safe rule is a poet who died more than
70 years ago, which covers Dickinson, Whitman, Keats, Shakespeare, Blake,
Rossetti, Baudelaire, Rimbaud, Verlaine, Hugo and Apollinaire. Translations
have their own copyright, so use the original language.

## How it works

`make.py` plans every keystroke with a human rhythm, faster inside words,
slower at commas and line ends, with the odd typo caught and fixed. That one
plan drives the picture and the sound. `scene.html` draws the window at any
moment, `capture.swift` asks it for every frame and streams them into
ffmpeg, and the key sounds are placed at the same instants. The same poem
always gives the same video.
