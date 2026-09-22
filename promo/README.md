# Poem videos

Vertical videos of a poem being typed into Seyes, for TikTok and Instagram.

```
python3 promo/make.py promo/poems/hope.md
```

Each poem becomes `promo/out/<poem>.mp4`, 1080 x 1920 at 30 fps, about 40 seconds.
It has a soft key sound under every keystroke and no music. Add the music in
TikTok or Instagram when you post, where it's licensed.

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
