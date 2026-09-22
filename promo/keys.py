#!/usr/bin/env python3
"""
Build the key-sound bank from a real recording of a keyboard.

    python3 promo/keys.py ~/Downloads/typing.m4a

Writes promo/keys/bank.npz, which make.py uses for --keys real (the default
once it exists). The recording is cleaned of its background hiss, cut into
single keystrokes (each with its release click), and sorted into the big
keys (space, return) and the rest. Only keystrokes with room around them are
kept, so no sample carries the start of the next one.
"""
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
RATE = 48000


def load(path):
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "in.wav"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(path), "-ac", "1", "-ar", str(RATE),
                        "-c:a", "pcm_s16le", str(wav)], check=True)
        with wave.open(str(wav)) as w:
            return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(float) / 32768


def denoise(x, n_fft=1024, hop=256):
    """Spectral gating: learn the steady background from the quietest moments
    at each frequency, then turn down whatever sits near it. Clicks are far
    above it and pass through untouched."""
    win = np.hanning(n_fft)
    pad = np.concatenate([np.zeros(n_fft), x, np.zeros(n_fft)])
    frames = np.lib.stride_tricks.sliding_window_view(pad, n_fft)[::hop] * win
    spec = np.fft.rfft(frames, axis=1)
    power = np.abs(spec) ** 2
    # Most of a typing recording is the gaps between keys, so the median at
    # each frequency is the background itself.
    noise = np.median(power, axis=0)
    gain = np.clip(1 - 3.0 * noise / (power + 1e-12), 0.02, 1.0)
    # Smooth the gain across time so it doesn't warble.
    kernel = np.ones(3) / 3
    gain = np.apply_along_axis(lambda g: np.convolve(g, kernel, mode="same"), 0, gain)
    frames = np.fft.irfft(spec * gain, n_fft, axis=1) * win
    out = np.zeros(len(pad))
    norm = np.zeros(len(pad))
    for i, f in enumerate(frames):
        out[i * hop:i * hop + n_fft] += f
        norm[i * hop:i * hop + n_fft] += win ** 2
    out = out / np.maximum(norm, 1e-6)
    return out[n_fft:n_fft + len(x)]


def onsets(x):
    hp = np.diff(x, prepend=0)
    win = int(0.004 * RATE)
    env = np.sqrt(np.convolve(hp ** 2, np.ones(win) / win, mode="same"))
    threshold = np.median(env) * 6
    found, i, gap = [], 0, int(0.035 * RATE)
    while i < len(env):
        if env[i] > threshold:
            j = i + int(np.argmax(env[i:i + int(0.01 * RATE)]))
            found.append((j, env[j]))
            i = j + gap
        else:
            i += 1
    return found


def gate(s, floor):
    """Fade to silence wherever the sound has sunk to the background, so the
    click and its release stay whole and the hiss between them goes."""
    win = int(0.003 * RATE)
    env = np.sqrt(np.convolve(s ** 2, np.ones(win) / win, mode="same"))
    gain = np.clip((env / (floor * 3.0)) ** 2, 0, 1)
    # Open instantly, close over ~25 ms, like a gentle expander.
    out, g, fall = np.empty_like(gain), 0.0, np.exp(-1 / (0.025 * RATE))
    for i, v in enumerate(gain):
        g = v if v > g else g * fall + v * (1 - fall)
        out[i] = g
    return s * out


def build(source):
    x = denoise(load(source))
    hits = onsets(x)
    floor = np.sqrt(np.median(x ** 2))  # the background left after cleaning
    # A press is a click that isn't a quieter echo 40-200 ms after a louder one.
    presses = []
    for k, (i, level) in enumerate(hits):
        if presses and 0.04 * RATE < i - presses[-1][0] < 0.2 * RATE and level < presses[-1][1] * 0.5:
            continue  # the release of the previous key: it stays inside that key's sample
        presses.append((i, level))
    # Keep real keystrokes only: cleaning lowers the background so much that
    # small knocks and rustles would otherwise pass for keys.
    typical = np.median([level for _, level in presses])
    presses = [(i, level) for i, level in presses if level > typical * 0.35]

    samples = []
    for k, (i, level) in enumerate(presses):
        nxt = presses[k + 1][0] if k + 1 < len(presses) else len(x)
        room = (nxt - i) / RATE
        if room < 0.16:
            continue  # the next key came too soon to hear this one out
        start = i - int(0.004 * RATE)
        end = i + int(min(room - 0.01, 0.3) * RATE)
        s = gate(x[start:end].copy(), floor)
        fade = int(0.02 * RATE)
        s[-fade:] *= np.linspace(1, 0, fade)
        s[: int(0.001 * RATE)] *= np.linspace(0, 1, int(0.001 * RATE))
        samples.append(s)

    # Big keys (space, return) are lower and fuller than letters.
    def low_share(s):
        spec = np.abs(np.fft.rfft(s[: int(0.05 * RATE)], 4096)) ** 2
        f = np.fft.rfftfreq(4096, 1 / RATE)
        return spec[f < 700].sum() / spec.sum()

    lows = np.array([low_share(s) for s in samples])
    cut = np.percentile(lows, 82)
    big = [s for s, l in zip(samples, lows) if l >= cut]
    small = [s for s, l in zip(samples, lows) if l < cut]
    # Even out the loudest and softest, keeping some of the natural variation.
    def level(group):
        peaks = np.array([np.max(np.abs(s)) for s in group])
        target = np.median(peaks)
        return [s * (target / p) ** 0.7 for s, p in zip(group, peaks)]

    small, big = level(small), level(big)
    out = HERE / "keys"
    out.mkdir(exist_ok=True)
    np.savez_compressed(out / "bank.npz",
                        small=np.array([np.pad(s, (0, int(0.31 * RATE) - len(s))) for s in small], dtype=np.float32),
                        big=np.array([np.pad(s, (0, int(0.31 * RATE) - len(s))) for s in big], dtype=np.float32))
    print(f"{len(hits)} clicks, {len(presses)} real keystrokes, kept {len(samples)}: {len(small)} letters, {len(big)} big keys")
    return out / "bank.npz"


if __name__ == "__main__":
    build(Path(sys.argv[1]).expanduser())
