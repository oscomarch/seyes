#!/usr/bin/env python3
"""
Turn a poem into a vertical video of it being typed into Seyes.

    python3 promo/make.py promo/poems/hope.md        # one poem
    python3 promo/make.py promo/poems/*.md           # all of them

Writes promo/out/<poem>.mp4: 1080 x 1920, 30 fps, with a soft key sound
under every keystroke and no music (music goes on in TikTok or Instagram,
where it's licensed). The same seed always gives the same video.

How it works: the typing is planned first, as a list of timed keystrokes
with human rhythm (faster inside words, pauses at commas and line ends, the
odd typo caught and fixed). That one plan drives both the picture, drawn
frame by frame by scene.html, and the sound, placed at the same instants.
"""
import hashlib
import json
import random
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

def key_sound(kind, rng):
    """One keystroke: a bright tick as the key hits, a soft wooden thud under
    it, and a faint click as it comes back up."""
    n = int(0.16 * RATE)
    tt = np.arange(n) / RATE
    out = np.zeros(n)

    def tick(at, amp, tau, lo, hi):
        start = int(at * RATE)
        m = n - start
        noise = rng.standard_normal(m)
        spec = np.fft.rfft(noise)
        freqs = np.fft.rfftfreq(m, 1 / RATE)
        spec[(freqs < lo) | (freqs > hi)] = 0
        burst = np.fft.irfft(spec, m)
        burst /= np.max(np.abs(burst)) + 1e-9
        out[start:] += amp * burst * np.exp(-np.arange(m) / RATE / tau)

    thud = {"key": 230, "space": 150, "enter": 125, "back": 200}[kind] * rng.uniform(0.93, 1.07)
    weight = {"key": 1.0, "space": 1.25, "enter": 1.35, "back": 1.0}[kind]
    tick(0.0, 0.55 * weight, 0.0016, 1800, 7500)
    tick(rng.uniform(0.007, 0.012), 0.28 * weight, 0.0022, 900, 4500)
    out += 0.32 * weight * np.sin(2 * np.pi * thud * tt) * np.exp(-tt / 0.014)
    tick(rng.uniform(0.07, 0.1), 0.12, 0.0012, 2500, 8000)
    return out * rng.uniform(0.8, 1.1)


def soundtrack(ops, seconds, seed):
    rng = np.random.default_rng(seed)
    bank = {kind: [key_sound(kind, rng) for _ in range(16)] for kind in ("key", "space", "enter", "back")}
    track = np.zeros(int((seconds + 0.5) * RATE))
    for t, _field, op, ch in ops:
        kind = "back" if op == "-" else "enter" if ch == "\n" else "space" if ch == " " else "key"
        s = bank[kind][rng.integers(len(bank[kind]))]
        i = int(t * RATE)
        track[i:i + len(s)] += s[: len(track) - i]
    # A small room around the keyboard, so it doesn't sound pasted on.
    ir_len = int(0.22 * RATE)
    ir = rng.standard_normal(ir_len) * np.exp(-np.arange(ir_len) / RATE / 0.05) * 0.05
    ir[0] = 1.0
    track = np.convolve(track, ir)[: len(track)]
    track *= 0.5 / (np.max(np.abs(track)) + 1e-9)  # peaks at about -6 dB, room for music
    return track


def write_wav(path, samples):
    data = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
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


def capture_tool():
    tool = BUILD / "capture"
    source = HERE / "capture.swift"
    if not tool.exists() or tool.stat().st_mtime < source.stat().st_mtime:
        BUILD.mkdir(exist_ok=True)
        subprocess.run(["swiftc", "-O", "-o", str(tool), str(source), "-framework", "AppKit", "-framework", "WebKit"],
                       check=True, stderr=subprocess.DEVNULL)
    return tool


def make(path):
    meta, body = read_poem(path)
    title, author = meta.get("title", path.stem), meta.get("author", "")
    seed = int(hashlib.sha256(path.read_bytes()).hexdigest(), 16) % 2**32
    ops, end = plan(title, body, author, seed)
    seconds = end + 2.8  # hold on the finished poem
    font, line_height, title_font = sizes(title, body, author)

    OUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=BUILD if BUILD.exists() else None) as tmp:
        tmp = Path(tmp)
        timeline = {"mood": meta.get("mood", "dusk"), "fontSize": font, "lineHeight": line_height, "end": end, "ops": ops}
        page = (HERE / "scene.html").read_text(encoding="utf-8")
        page = page.replace("<script>", f"<script>window.TIMELINE = {json.dumps(timeline, ensure_ascii=False)}</script>\n<script>", 1)
        page = page.replace(".title { font-weight: 700; font-size: 21px;", f".title {{ font-weight: 700; font-size: {title_font}px;")
        (tmp / "scene.html").write_text(page, encoding="utf-8")
        write_wav(tmp / "keys.wav", soundtrack(ops, seconds, seed))

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
    for arg in sys.argv[1:] or sorted(str(p) for p in (HERE / "poems").glob("*.md")):
        make(Path(arg))
