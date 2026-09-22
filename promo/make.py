#!/usr/bin/env python3
"""
Turn a poem into a vertical video of it being typed into Seyes.

    python3 promo/make.py promo/poems/hope.md        # one poem
    python3 promo/make.py promo/poems/*.md           # all of them
    python3 promo/make.py --keys real <poem>         # Oscar's recorded keyboard, in stereo
    python3 promo/make.py --keys natural <poem>      # the synthesised stereo keyboard

Writes promo/out/<poem>.mp4: 1080 x 1920, 30 fps, with a soft key sound
under every keystroke and no music (music goes on in TikTok or Instagram,
where it's licensed). The same seed always gives the same video.

How it works: the typing is planned first, as a list of timed keystrokes
with human rhythm (faster inside words, pauses at commas and line ends, the
odd typo caught and fixed). That one plan drives both the picture, drawn
frame by frame by scene.html, and the sound, placed at the same instants.
"""
import base64
import hashlib
import json
import random
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
BUILD = HERE / ".build"
FPS = 30
SPEED = 1.35      # quicker than the base rhythm, at least
TARGET = 42.0     # seconds of typing to aim for; longer poems type faster...
MAX_SPEED = 2.0   # ...but never faster than a quick human typist
RATE = 48000

# Keys next to each other on a QWERTY keyboard, for believable typos.
ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
NEAR = {}
for r, row in enumerate(ROWS):
    for c, k in enumerate(row):
        near = [row[c - 1]] if c > 0 else []
        near += [row[c + 1]] if c + 1 < len(row) else []
        NEAR[k] = near


def read_poem(path):
    text = path.read_text(encoding="utf-8")
    meta, body = {}, text
    if text.startswith("---"):
        head, body = text[3:].split("---", 1)
        for line in head.strip().splitlines():
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return meta, body.strip("\n")


def plan(title, body, author, seed):
    """Every keystroke, with the time it happens: [t, field, op, char]."""
    rng = random.Random(seed)
    ops, t = [], 0.45

    def gap(base=0.085):
        return min(0.26, max(0.035, rng.lognormvariate(np.log(base), 0.35)))

    def press(field, ch):
        nonlocal t
        ops.append([round(t, 4), field, "+", ch])

    def back(field, ch):
        nonlocal t
        ops.append([round(t, 4), field, "-", ch])

    def write(field, text, base=0.085):
        nonlocal t
        words = text.split(" ")
        for w, word in enumerate(words):
            # Now and then, a slip of the finger on a longer word, noticed
            # a letter or two later, taken back, and typed again.
            slip = len(word) >= 4 and word.isalpha() and word.isascii() and rng.random() < 0.035
            at = rng.randint(1, len(word) - 2) if slip else -1
            for i, ch in enumerate(word):
                if i == at and ch.lower() in NEAR:
                    wrong = rng.choice(NEAR[ch.lower()])
                    wrong = wrong.upper() if ch.isupper() else wrong
                    typed = [wrong] + (list(word[i + 1:i + 2]) if rng.random() < 0.4 else [])
                    for c in typed:
                        press(field, c); t += gap(base)
                    t += rng.uniform(0.22, 0.45)
                    for c in reversed(typed):
                        back(field, c); t += rng.uniform(0.07, 0.11)
                    t += rng.uniform(0.08, 0.16)
                press(field, ch)
                t += gap(base)
                if ch in ",;:":
                    t += rng.uniform(0.16, 0.32)
                elif ch in ".!?":
                    t += rng.uniform(0.28, 0.5)
            if w < len(words) - 1:
                press(field, " ")
                t += gap(base) + 0.02
                if rng.random() < 0.03:
                    t += rng.uniform(0.35, 0.8)  # a moment's thought

    write("t", title, base=0.095)
    t += 0.35
    press("t", "\n")  # Enter, from the title into the page
    t += 0.55
    lines = body.split("\n") + ["", author]
    for n, line in enumerate(lines):
        if line:
            write("b", line)
        if n < len(lines) - 1:
            t += rng.uniform(0.22, 0.45)
            press("b", "\n")
            t += 0.12 + (rng.uniform(0.5, 0.9) if not line else 0)
    # Speed it up so most poems land around TARGET seconds, however long.
    speed = min(MAX_SPEED, max(SPEED, t / TARGET))
    for op in ops:
        op[0] = round(op[0] / speed, 4)
    return ops, t / speed


# ---------------------------------------------------------------- sound
#
# Three sounds. "soft" (the default) is the first one, chosen to keep.
# "real" is Oscar's own keyboard, recorded and cut up by keys.py. "natural" is modelled on a laptop keyboard heard
# from a little way off: each key has its own voice, keys sit left to right
# in stereo, soft or firm with the rhythm, in a small room. "soft" is the
# first version, kept because it was liked: lighter and more even.
# Pick one with --keys soft.

LAYOUT = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"]
KEY_X = {k: -0.85 + 1.7 * (c + 0.4 * r) / 10.5 for r, row in enumerate(LAYOUT) for c, k in enumerate(row)}
KEY_X.update({" ": 0.0, "\n": 0.78, "back": 0.82, "arrow": 0.7})


def band_noise(rng, n, lo, hi):
    spec = np.fft.rfft(rng.standard_normal(n))
    freqs = np.fft.rfftfreq(n, 1 / RATE)
    spec[(freqs < lo) | (freqs > hi)] = 0
    out = np.fft.irfft(spec, n)
    return out / (np.max(np.abs(out)) + 1e-9)


def ring(freq, tau, n, phase=0.0):
    tt = np.arange(n) / RATE
    return np.sin(2 * np.pi * freq * tt + phase) * np.exp(-tt / tau)


def natural_key(key, rng):
    """A scissor-switch key: the fingertip's tap, the cap bottoming out on the
    frame (with this key's own resonance), a faint thud through the chassis,
    and the quieter click of it springing back."""
    voice = random.Random(key)  # the same key always has the same character
    f1, f2 = voice.uniform(1300, 2500), voice.uniform(3100, 5200)
    thud = voice.uniform(135, 200)
    big = key in (" ", "\n")
    if big:
        f1, thud = voice.uniform(650, 950), voice.uniform(95, 125)
    n = int(0.2 * RATE)
    out = np.zeros(n)
    out += 0.7 * band_noise(rng, n, 1500, 12000) * np.exp(-np.arange(n) / RATE / 0.0005)
    hit = int(rng.uniform(0.0015, 0.0035) * RATE)
    m = n - hit
    bottom = (0.55 * ring(f1 * rng.uniform(0.98, 1.02), 0.0032, m, rng.uniform(0, 6))
              + 0.3 * ring(f2 * rng.uniform(0.98, 1.02), 0.0018, m, rng.uniform(0, 6))
              + 0.35 * band_noise(rng, m, f1 * 0.7, f1 * 1.5) * np.exp(-np.arange(m) / RATE / 0.004))
    out[hit:] += bottom
    out[hit:] += (0.45 if big else 0.22) * ring(thud, 0.009 if not big else 0.014, m)
    if big:  # the stabiliser wire's little rattle
        r = hit + int(rng.uniform(0.005, 0.008) * RATE)
        out[r:] += 0.25 * band_noise(rng, n - r, 900, 3500) * np.exp(-np.arange(n - r) / RATE / 0.006)
    up = int(rng.uniform(0.045, 0.085) * RATE)
    out[up:] += 0.3 * (ring(f1 * 1.08, 0.002, n - up) + 0.6 * band_noise(rng, n - up, 2000, 9000)
                       * np.exp(-np.arange(n - up) / RATE / 0.0006))
    return out


def trackpad_click(rng, up=False):
    """The trackpad's click, pressed or let go: a short low knock and a tick."""
    n = int(0.06 * RATE)
    tt = np.arange(n) / RATE
    out = (0.5 if up else 0.8) * np.sin(2 * np.pi * 150 * tt) * np.exp(-tt / 0.004)
    out += (0.25 if up else 0.4) * band_noise(rng, n, 2000, 7000) * np.exp(-tt / 0.0004)
    return out * 0.55


def place(track, sound, t, pan, delay=0.00025):
    """Put a mono sound into the stereo track at t, panned -1 (left) to 1 (right)."""
    i = int(t * RATE)
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    d = int(abs(pan) * delay * RATE)  # the far ear hears it a touch later
    li, ri = (i + d, i) if pan > 0 else (i, i + d)
    for ch, at, gain in ((0, li, left), (1, ri, right)):
        seg = sound[: max(0, len(track) - at)]
        track[at:at + len(seg), ch] += gain * seg


def room(track, rng):
    """A small room: a few early reflections, a short soft tail, a mic that
    doesn't hear the very top, and the faint hiss every recording has."""
    n = int(0.16 * RATE)
    ir = np.zeros(n)
    ir[0] = 1.0
    for ms, g in ((7, 0.22), (13, 0.15), (19, 0.11), (27, 0.08), (38, 0.05)):
        ir[int(ms / 1000 * RATE)] += g * rng.choice([-1, 1])
    ir += rng.standard_normal(n) * np.exp(-np.arange(n) / RATE / 0.035) * 0.012
    out = np.stack([np.convolve(track[:, c], ir)[: len(track)] for c in range(2)], axis=1)
    spec = np.fft.rfft(out, axis=0)
    freqs = np.fft.rfftfreq(len(out), 1 / RATE)
    spec *= (1 / np.sqrt(1 + (freqs / 11000) ** 4))[:, None]
    out = np.fft.irfft(spec, len(out), axis=0)
    out *= 0.5 / (np.max(np.abs(out)) + 1e-9)
    hiss = np.cumsum(rng.standard_normal((len(out), 2)), axis=0)
    hiss -= np.convolve(hiss[:, 0], np.ones(400) / 400, mode="same")[:, None]
    hiss *= 10 ** (-64 / 20) / (np.std(hiss) + 1e-9)
    return out + hiss


def natural_soundtrack(ops, seconds, seed, finale):
    rng = np.random.default_rng(seed)
    track = np.zeros((int((seconds + 0.5) * RATE), 2))
    bank = {}
    prev = None
    for t, _field, op, ch in ops:
        key = "back" if op == "-" else ch.lower()
        if key not in bank:
            bank[key] = [natural_key(key, rng) for _ in range(3)]
        # Soft when the fingers are flying, firmer after a pause.
        gap = 0.5 if prev is None else t - prev
        velocity = np.clip(0.72 + 0.5 * min(gap, 0.6), 0.75, 1.05) * rng.uniform(0.9, 1.08)
        place(track, bank[key][rng.integers(3)] * velocity, t, KEY_X.get(key, 0.0) + rng.uniform(-0.05, 0.05))
        prev = t
    for t in (finale["press"], finale["boldAt"] - 0.05, finale["markAt"] - 0.05):
        place(track, trackpad_click(rng), t, 0.15)
    for t in (finale["release"], finale["boldAt"] + 0.05, finale["markAt"] + 0.05):
        place(track, trackpad_click(rng, up=True), t, 0.15)
    place(track, natural_key("arrow", rng) * 0.9, finale["deselect"], KEY_X["arrow"])
    return room(track, rng)


def soft_key(kind, rng):
    """The first sound: a bright tick, a soft wooden thud, a faint release."""
    n = int(0.16 * RATE)
    tt = np.arange(n) / RATE
    out = np.zeros(n)

    def tick(at, amp, tau, lo, hi):
        start = int(at * RATE)
        m = n - start
        out[start:] += amp * band_noise(rng, m, lo, hi) * np.exp(-np.arange(m) / RATE / tau)

    thud = {"key": 230, "space": 150, "enter": 125, "back": 200}[kind] * rng.uniform(0.93, 1.07)
    weight = {"key": 1.0, "space": 1.25, "enter": 1.35, "back": 1.0}[kind]
    tick(0.0, 0.55 * weight, 0.0016, 1800, 7500)
    tick(rng.uniform(0.007, 0.012), 0.28 * weight, 0.0022, 900, 4500)
    out += 0.32 * weight * np.sin(2 * np.pi * thud * tt) * np.exp(-tt / 0.014)
    tick(rng.uniform(0.07, 0.1), 0.12, 0.0012, 2500, 8000)
    return out * rng.uniform(0.8, 1.1)


def soft_soundtrack(ops, seconds, seed, finale):
    """The first sound, now in stereo: each key placed left to right where it
    sits on the keyboard, like the others."""
    rng = np.random.default_rng(seed)
    bank = {kind: [soft_key(kind, rng) for _ in range(16)] for kind in ("key", "space", "enter", "back")}
    track = np.zeros((int((seconds + 0.5) * RATE), 2))
    events = []
    for t, _f, op, ch in ops:
        key = "back" if op == "-" else ch.lower()
        kind = "back" if op == "-" else "enter" if ch == "\n" else "space" if ch == " " else "key"
        events.append((t, kind, KEY_X.get(key, 0.0) + rng.uniform(-0.05, 0.05)))
    events += [(finale[k], "key", 0.15) for k in ("press", "boldAt", "markAt")]
    events.append((finale["deselect"], "key", KEY_X["arrow"]))
    for t, kind, pan in events:
        place(track, bank[kind][rng.integers(len(bank[kind]))], t, pan)
    ir_len = int(0.22 * RATE)
    ir = rng.standard_normal(ir_len) * np.exp(-np.arange(ir_len) / RATE / 0.05) * 0.05
    ir[0] = 1.0
    track = np.stack([np.convolve(track[:, c], ir)[: len(track)] for c in range(2)], axis=1)
    return track * (0.5 / (np.max(np.abs(track)) + 1e-9))


def real_soundtrack(ops, seconds, seed, finale):
    """Oscar's own keyboard, from promo/keys/bank.npz (built by keys.py from a
    recording). Each key keeps its own recorded keystroke, so an "e" always
    sounds like the same "e", placed left to right in stereo like the others,
    softer when the typing is quick. No room is added: the recording has its own."""
    bank = np.load(HERE / "keys" / "bank.npz")
    small, big = bank["small"], bank["big"]
    rng = np.random.default_rng(seed)

    def voices(key, pool):
        pick = random.Random(key)
        return [pool[pick.randrange(len(pool))] for _ in range(2)]

    cache = {}
    track = np.zeros((int((seconds + 0.5) * RATE), 2))
    prev = None
    for t, _field, op, ch in ops:
        key = "back" if op == "-" else ch.lower()
        if key == " ":
            sound = big[rng.integers(len(big))]  # the space bar never sounds quite the same twice
        else:
            if key not in cache:
                cache[key] = voices(key, big if key == "\n" else small)
            sound = cache[key][rng.integers(2)]
        gap = 0.5 if prev is None else t - prev
        velocity = np.clip(0.72 + 0.5 * min(gap, 0.6), 0.75, 1.05) * rng.uniform(0.92, 1.06)
        place(track, sound * velocity, t, KEY_X.get(key, 0.0) + rng.uniform(-0.05, 0.05))
        prev = t
    click_level = np.max(np.abs(small)) * 0.8 / 0.44
    for t in (finale["press"], finale["boldAt"] - 0.05, finale["markAt"] - 0.05):
        place(track, trackpad_click(rng) * click_level, t, 0.15)
    for t in (finale["release"], finale["boldAt"] + 0.05, finale["markAt"] + 0.05):
        place(track, trackpad_click(rng, up=True) * click_level, t, 0.15)
    place(track, voices("arrow", small)[0], finale["deselect"], KEY_X["arrow"])
    return track * (0.5 / (np.max(np.abs(track)) + 1e-9))


SOUNDS = {"real": real_soundtrack, "natural": natural_soundtrack, "soft": soft_soundtrack}
# The first sound, the one Oscar chose to keep. The others stay a flag away.
DEFAULT_KEYS = "soft"


def write_wav(path, samples):
    data = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())


# ---------------------------------------------------------------- picture

def sizes(title, body, author):
    """Fit every verse on one line: a poem's line breaks are part of it."""
    column = 430  # text width inside the window, in CSS pixels
    longest = max(len(line) for line in body.split("\n") + [author])
    font = min(19.0, round(column / (longest * 0.6) * 0.98, 1))
    title_font = min(22.0, round(column / (len(title) * 0.6) * 0.98, 1))
    return font, round(font * 1.75), title_font


def mac_icons():
    """This Mac's own Dock icons and menu-bar symbols, exported once into .build.
    They're Apple's, so they're made here rather than kept in the repo."""
    out = BUILD / "icons-out"
    tool = BUILD / "icons"
    source = HERE / "icons.swift"
    if not tool.exists() or tool.stat().st_mtime < source.stat().st_mtime:
        subprocess.run(["swiftc", "-O", "-o", str(tool), str(source), "-framework", "AppKit"],
                       check=True, stderr=subprocess.DEVNULL)
    if not (out / "trash.png").exists():
        subprocess.run([str(tool), str(out)], check=True, stdout=subprocess.DEVNULL)
    return out


def capture_tool():
    tool = BUILD / "capture"
    source = HERE / "capture.swift"
    if not tool.exists() or tool.stat().st_mtime < source.stat().st_mtime:
        BUILD.mkdir(exist_ok=True)
        subprocess.run(["swiftc", "-O", "-o", str(tool), str(source), "-framework", "AppKit", "-framework", "WebKit"],
                       check=True, stderr=subprocess.DEVNULL)
    return tool


def finale_times(end, author):
    """After the name is typed: the pointer comes in, drags back across the
    name to select it, clicks B, then H, and an arrow key lets go."""
    f = {"pointerIn": end + 0.55}
    f["press"] = f["pointerIn"] + 0.75
    f["release"] = f["press"] + min(0.9, 0.35 + 0.035 * len(author))
    f["toolbar"] = f["release"] + 0.12
    f["boldMove"] = f["toolbar"] + 0.3
    f["boldAt"] = f["boldMove"] + 0.6
    f["markMove"] = f["boldAt"] + 0.45
    f["markAt"] = f["markMove"] + 0.5
    f["deselect"] = f["markAt"] + 0.7
    f["reveal"] = f["deselect"] + 0.5
    return {k: round(v, 4) for k, v in f.items()}


def make(path, keys=DEFAULT_KEYS):
    meta, body = read_poem(path)
    title, author = meta.get("title", path.stem), meta.get("author", "")
    seed = int(hashlib.sha256(path.read_bytes()).hexdigest(), 16) % 2**32
    ops, end = plan(title, body, author, seed)
    finale = finale_times(end, author)
    seconds = finale["reveal"] + 3.0  # hold on the finished poem
    font, line_height, title_font = sizes(title, body, author)

    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=BUILD if BUILD.exists() else None) as tmp:
        tmp = Path(tmp)
        timeline = {
            "mood": meta.get("mood", "dusk"), "fontSize": font, "lineHeight": line_height,
            "ops": ops, "finale": finale,
            "clock": meta.get("clock", "Tue 22 Sep  21:14"), "day": meta.get("day", "22"),
        }
        page = (HERE / "scene.html").read_text(encoding="utf-8")
        uri = lambda f: "data:image/png;base64," + base64.b64encode(f.read_bytes()).decode()
        page = page.replace("__ICON__", uri(HERE.parent / "docs" / "icon.png"))
        icons = mac_icons()
        page = re.sub(r"__(?:APP|SYM)_([a-z-]+)__", lambda m: uri(icons / f"{m.group(1)}.png"), page)
        page = page.replace("<script>", f"<script>window.TIMELINE = {json.dumps(timeline, ensure_ascii=False)}</script>\n<script>", 1)
        page = page.replace(".title { font-weight: 700; font-size: 21px;", f".title {{ font-weight: 700; font-size: {title_font}px;")
        (tmp / "scene.html").write_text(page, encoding="utf-8")
        write_wav(tmp / "keys.wav", SOUNDS[keys](ops, seconds, seed, finale))

        print(f"{path.stem}: {seconds:.1f}s, {len(ops)} keystrokes, text {font}px", flush=True)
        video = OUT / f"{path.stem}.mp4"
        # Frames stream from the renderer straight into the encoder, no files between.
        capture = subprocess.Popen([str(capture_tool()), str(tmp / "scene.html"), str(FPS), str(seconds)],
                                   stdout=subprocess.PIPE)
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "rawvideo", "-pix_fmt", "rgba", "-s", "1080x1920", "-r", str(FPS), "-i", "-",
            "-i", str(tmp / "keys.wav"),
            "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
            str(video),
        ], stdin=capture.stdout, check=True)
        if capture.wait() != 0:
            raise SystemExit("capture failed")
    print(f"  -> {video.relative_to(HERE.parent)}")


if __name__ == "__main__":
    BUILD.mkdir(exist_ok=True)
    args = sys.argv[1:]
    keys = DEFAULT_KEYS
    if "--keys" in args:
        i = args.index("--keys")
        keys = args[i + 1]
        del args[i:i + 2]
    for arg in args or sorted(str(p) for p in (HERE / "poems").glob("*.md")):
        make(Path(arg), keys)
