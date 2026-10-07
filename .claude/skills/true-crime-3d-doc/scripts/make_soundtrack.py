# Soundtrack builder: synthesizes each chapter's score (drones, pads, piano, ambience, SFX) with numpy, lays the
# narration at its acts.json cues, ducks music under the voice, and loudness-normalizes to -14 LUFS -> parts/aN_audio.wav.
# The instruments (Track class) are reusable; the "ACT N" blocks at the bottom are per-film scoring: rewrite them per film.
# usage: PROJ=/path/to/project python3 make_soundtrack.py   (needs numpy, soundfile, ffmpeg)
import numpy as np, soundfile as sf, json, subprocess, sys
SR = 44100
import os
ROOT = os.environ.get('PROJ', os.getcwd())  # project root
ACTS = json.load(open(f'{ROOT}/f3d/assets/acts.json'))

def mk(n): return np.zeros(n)
def lp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= 1 / (1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))
def hp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); X *= (f / fc) ** 4 / (1 + (f / fc) ** 4); return np.fft.irfft(X, len(x))
class Track:
    def __init__(s, dur, seed):
        s.n = int(dur * SR); s.t = np.arange(s.n) / SR; s.b = np.zeros(s.n); s.R = np.random.default_rng(seed); s.dur = dur
    def env(s, a, b, fi, fo):
        e = np.zeros(s.n); i0, i1 = int(max(0, a) * SR), min(s.n, int(b * SR)); L = max(0, i1 - i0); x = np.ones(L)
        k = min(L, int(fi * SR)); x[:k] = np.linspace(0, 1, k) if k else x[:k]
        k = min(L, int(fo * SR));
        if k: x[L - k:] *= np.linspace(1, 0, k)
        e[i0:i1] = x; return e
    def place(s, snd, at, g=1.0):
        i = int(at * SR)
        if i >= s.n or i + len(snd) <= 0: return
        j = min(s.n, i + len(snd)); s.b[max(0, i):j] += snd[max(0, -i):j - i] * g
    def noise(s, n=None): return s.R.standard_normal(n or s.n)
    # ---- instruments ----
    def drone(s, a, b, freqs, amp, fi=3, fo=3, wob=0.05):
        t = s.t; x = sum(np.sin(2 * np.pi * f * t + i) * (0.6 ** i) for i, f in enumerate(freqs))
        x *= (0.75 + 0.25 * np.sin(2 * np.pi * wob * t)); s.b += x * s.env(a, b, fi, fo) * amp
    def pad(s, a, b, freqs, amp, fi=3, fo=3, bright=1500):
        t = s.t; x = np.zeros(s.n)
        for f in freqs: x += np.sin(2 * np.pi * f * t + s.R.random() * 6) + 0.35 * np.sin(2 * np.pi * f * 2.003 * t) + 0.2 * np.sin(2 * np.pi * f * 0.997 * t)
        s.b += lp(x, bright) * s.env(a, b, fi, fo) * amp
    def piano(s, at, f, amp=0.08, dur=3.5):
        L = int(dur * SR); x = np.arange(L) / SR
        s.place((np.sin(2 * np.pi * f * x) + 0.45 * np.sin(4 * np.pi * f * x) + 0.18 * np.sin(6 * np.pi * f * x) + 0.08 * np.sin(8 * np.pi * f * x)) * np.exp(-x * 1.4) * np.clip(x / 0.004, 0, 1), at, amp)
    def melody(s, start, notes, step, amp=0.07):
        for i, f in enumerate(notes):
            if f: s.piano(start + i * step, f, amp)
    def ambience(s, a, b, amp, fc=350, fi=2, fo=2):
        s.b += (lp(s.noise(), fc) * 0.6 + lp(s.noise(), 120)) * s.env(a, b, fi, fo) * amp
    def click(s, at, amp=0.4, fc=2500, dec=0.007, dur=0.05):
        L = int(dur * SR); s.place(hp(s.noise(L), fc) * np.exp(-np.arange(L) / (dec * SR)), at, amp)
    def thump(s, at, f=60, amp=0.6, dur=0.4):
        L = int(dur * SR); x = np.arange(L) / SR; s.place(np.sin(2 * np.pi * f * x) * np.exp(-x * 12) + lp(s.noise(L), 400) * np.exp(-x * 30) * 0.5, at, amp)
    def boom(s, at, amp=0.5, dur=4.5):
        L = int(dur * SR); x = np.arange(L) / SR
        s.place(np.sin(2 * np.pi * np.cumsum(55 * np.exp(-x * 0.8) + 26) / SR) * np.exp(-x * 0.9) * 0.6 + lp(s.noise(L), 300) * np.exp(-x * 2.5) * 0.4, at, amp)
    def sting(s, at, freqs, amp=0.05, dur=3.0):
        L = int(dur * SR); x = np.arange(L) / SR; y = np.zeros(L)
        for f in freqs: y += np.sign(np.sin(2 * np.pi * f * x + s.R.random() * 6)) * 0.3 + np.sin(2 * np.pi * f * 1.004 * x)
        s.place(lp(y, 2400) * np.exp(-x * 1.3) * np.clip(x / 0.02, 0, 1), at, amp)
    def engine(s, a, b, f0, f1, amp, fi=1.0, fo=0.5):
        i0, i1 = int(a * SR), int(b * SR); L = i1 - i0; f = np.linspace(f0, f1, L); ph = 2 * np.cumsum(np.pi * f) / SR
        sig = np.sign(np.sin(ph)) * 0.5 + np.sin(2 * ph) * 0.3; sig = lp(np.concatenate([sig, np.zeros(1000)]), 380)[:L] + lp(s.noise(L), 900) * 0.4
        e = np.ones(L); k = int(fi * SR); e[:k] = np.linspace(0, 1, k); k = int(fo * SR); e[-k:] *= np.linspace(1, 0, k)
        s.place(sig * e * amp, a)
    def steps(s, a, b, rate, amp=0.5, heavy=False):
        k = a
        while k < b:
            if heavy: s.thump(k, 90, amp * 0.6, 0.15)
            else: s.click(k, amp, 2200, 0.007)
            k += rate
    def heartbeat(s, a, b, bpm0, bpm1, amp=0.8):
        k = a
        while k < b:
            bpm = bpm0 + (bpm1 - bpm0) * (k - a) / max(1e-3, b - a)
            s.thump(k, 48, amp, 0.25); s.thump(k + 0.16, 42, amp * 0.65, 0.25); k += 60 / bpm
    def siren(s, a, b, amp=0.04, pan=1.0):
        t = s.t; f = 700 + 350 * np.sin(2 * np.pi * 0.5 * t); ph = 2 * np.pi * np.cumsum(f) / SR
        s.b += (np.sin(ph) + 0.3 * np.sin(2 * ph)) * s.env(a, b, 1.5, 3) * amp
    def typing(s, a, b, amp=0.3, dens=9):
        k = a
        while k < b:
            s.click(k, amp * (0.6 + s.R.random() * 0.4), 1800, 0.004, 0.03); k += s.R.exponential(1 / dens)
            if s.R.random() < 0.03: s.click(k, amp * 1.2, 1500, 0.02, 0.15); k += 0.25
    def bell(s, at, amp=0.06, dur=1.2):
        L = int(dur * SR); x = np.arange(L) / SR; s.place((np.sin(2 * np.pi * 1500 * x) + np.sin(2 * np.pi * 1520 * x)) * (np.sin(2 * np.pi * 20 * x) > 0) * np.exp(-x * 1.5), at, amp)
    def hum(s, a, b, f=60, amp=0.02):
        s.b += (np.sin(2 * np.pi * f * s.t) + 0.5 * np.sin(2 * np.pi * 2 * f * s.t)) * s.env(a, b, 0.5, 0.5) * amp
    def tick(s, a, b, amp=0.12):
        k = a
        while k < b: s.click(k, amp, 3500, 0.003, 0.02); k += 1.0
    def jukebox(s, a, b, amp=0.035):
        chords = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]]
        k, i = a, 0
        while k < b:
            for f in chords[i % 4]:
                L = int(0.45 * SR); x = np.arange(L) / SR
                for rep in range(4): s.place(np.sin(2 * np.pi * f * x) * np.exp(-x * 5) * 0.5, k + rep * 0.5, amp)
            k += 2.0; i += 1
    def reverb(s, sec=2.4, wet=0.25):
        L = int(sec * SR); ir = s.noise(L) * np.exp(-np.arange(L) / (SR * sec / 6)); ir = lp(ir, 4000); ir /= np.abs(ir).sum() ** 0.5 * 8
        N = s.n + L; y = np.fft.irfft(np.fft.rfft(s.b, N) * np.fft.rfft(ir, N), N)[:s.n]; s.b = s.b * (1 - wet) + y * wet * 3

def finish(act, tr, extra_duck=0.38):
    A = ACTS[act]; cues = A['cues']
    tr.reverb()
    duck = np.ones(tr.n)
    for c in cues: duck -= extra_duck * tr.env(c['s'] - 0.25, c['s'] + c['d'] + 0.35, 0.25, 0.4)
    music = tr.b * duck
    vo = np.zeros(tr.n)
    for c in cues:
        x, sr = sf.read(f"{ROOT}/f3d/{c['f']}");
        if x.ndim > 1: x = x.mean(1)
        if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)
        i = int(c['s'] * SR); j = min(tr.n, i + len(x)); vo[i:j] += x[:j - i] * 1.7
    mix = np.tanh((music * 1.6 + vo) * 1.0) * 0.9
    st = np.stack([mix, np.roll(mix, int(0.011 * SR))], 1).astype(np.float32)
    raw = f"{ROOT}/parts/{act}_raw.wav"; sf.write(raw, st, SR)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', f"{ROOT}/parts/{act}_audio.wav"], check=True)
    print(act, 'done', A['dur'])

A_ = ACTS
C = {k: [c['s'] for c in v['cues']] for k, v in A_.items()}
Am, C3_, E3, G3, A3, C4, D4, E4, F4, G4 = 110, 130.8, 164.8, 196, 220, 261.6, 293.7, 329.6, 349.2, 392

# ---------------- ACT 1: KITTY ----------------
c = C['a1']; tr = Track(A_['a1']['dur'], 101)
tr.pad(0, c[3] - 0.5, [A3, C4, E4, G4 / 2], 0.03, 4, 2)                 # memories
tr.melody(1.0, [E4, None, D4, C4, None, A3, None, C4, E4, None, D4, None, C4, A3, None, G3, A3, None, None, None, E4, D4, C4, None, A3], 1.1, 0.06)
tr.ambience(0, c[3] - 0.5, 0.06, 900)
tr.ambience(c[3] - 0.6, c[4] - 0.6, 0.12, 500); tr.jukebox(c[3] - 0.5, c[4] - 0.8, 0.03)
for k in range(8): tr.click(c[3] + 1.2 + k * 1.6 + tr.R.random() * 0.5, 0.15, 3200, 0.004, 0.03)   # glasses
tr.pad(c[4] - 0.6, c[5] - 0.6, [Am, C3_, E3, A3], 0.028, 2, 2, 900)            # apartment
tr.melody(c[4] + 0.5, [A3, C4, E4, None, D4, C4, None, A3], 1.5, 0.05)
tr.tick(c[4] - 0.4, c[5] - 0.7, 0.05)
tr.ambience(c[5] - 0.6, c[6] - 0.6, 0.08, 300)                                   # closing
for k in range(4): tr.click(c[5] + 1.5 + k * 0.7, 0.3, 1200, 0.01, 0.08)           # switches
tr.steps(c[5] + 3.5, c[6] - 1.4, 0.52, 0.35)
tr.thump(c[6] - 1.2, 60, 0.5)
tr.engine(c[6] - 0.8, A_['a1']['dur'], 36, 30, 0.2)                            # drive
tr.drone(c[6], A_['a1']['dur'], [55, 82.4, 116.5], 0.06, 2, 2)
tr.heartbeat(c[6] + 4, A_['a1']['dur'] - 1, 55, 80, 0.5)
tr.sting(c[6] + 6.2, [233.1, 246.9, 349.2], 0.05)
finish('a1', tr)

# ---------------- ACT 2: THE NIGHT ----------------
c = C['a2']; D = A_['a2']['dur']; tr = Track(D, 202)
tr.drone(0, D - 2, [55, 82.4, 116.5], 0.055, 3, 3)
tr.ambience(0, c[7] - 0.5, 0.07, 300)
tr.click(c[0] + 2.5, 0.35, 900, 0.03, 0.2)                                     # window
tr.boom(c[1] - 0.05, 0.25)
tr.steps(c[2] - 0.1, c[2] + 2.8, 0.29, 0.6); tr.click(c[2] + 2.4, 0.4, 700, 0.03, 0.15); tr.engine(c[2] + 2.5, c[3], 30, 48, 0.24, 0.4, 1.0)
tr.steps(c[3] + 0.3, c[4] - 0.5, 0.95, 0.3)                                      # staggering
tr.pad(c[3], c[5], [Am, C3_, E3], 0.02, 3, 3, 700)
tr.engine(c[5] - 0.6, c[6] - 0.5, 40, 24, 0.22, 2.0, 0.4)                          # return
tr.steps(c[6] + 0.2, c[7] - 0.6, 0.62, 0.4, True)
tr.heartbeat(c[6], c[7] + 3.8, 60, 120, 0.6)
tr.click(c[7] + 0.3, 0.35, 600, 0.04, 0.4)                                       # door
tr.hum(c[7] - 0.3, c[10] + 12, 120, 0.012)
tr.sting(c[7] + 4.4, [311.1, 329.6, 466.2], 0.06, 2.5); tr.boom(c[7] + 4.5, 0.3)
tr.click(c[8] + 0.9, 0.3, 500, 0.05, 0.4); tr.click(c[8] + 6.5, 0.6, 400, 0.02, 0.3); tr.thump(c[8] + 6.9, 70, 0.5)
for k in range(7): tr.click(c[9] + 1.2 + k * 0.32, 0.18, 2000, 0.01, 0.08)        # rotary dial
tr.pad(c[10] - 0.4, c[12] + 6, [A3, C4, E4, Am], 0.035, 3, 4, 1200)              # Sophia
tr.melody(c[10] + 1, [E4, D4, C4, None, A3, None, C4, D4, E4, None, None, A3], 1.2, 0.055)
tr.siren(c[11] - 0.5, c[12] + 3, 0.035); tr.engine(c[11] - 0.2, c[12] - 0.5, 38, 24, 0.2, 1.5, 0.6)
tr.siren(c[12], D - 1, 0.03); tr.engine(c[12], D - 1, 26, 44, 0.18, 1.0, 2.5)
finish('a2', tr)

# ---------------- ACT 3: THE HUNT ----------------
c = C['a3']; D = A_['a3']['dur']; tr = Track(D, 303)
tr.ambience(0, c[3] - 0.4, 0.08, 1200)
for k in range(10): tr.click(2 + k * 2.7 + tr.R.random(), 0.05, 5000, 0.002, 0.05)   # birds-ish chirps
tr.drone(0, D - 1, [49, 73.4, 103.8], 0.05, 3, 2)
tr.steps(c[0] + 1.0, c[0] + 4.5, 0.6, 0.35, True)
tr.click(c[1] + 6.0, 0.3, 800, 0.03, 0.2)                                            # hood
tr.siren(c[2] - 0.4, c[3], 0.03); tr.engine(c[2] - 0.4, c[3] - 0.5, 36, 24, 0.18, 1.0, 0.6)
tr.hum(c[3] - 0.4, D, 60, 0.02); tr.tick(c[3], D - 0.5, 0.1)
tr.boom(c[3] + 7.4, 0.25); tr.boom(c[3] + 9.0, 0.25)
tr.pad(c[4], D, [Am / 2, 82.4, 116.5], 0.03, 2, 2, 600)
finish('a3', tr)

# ---------------- ACT 4: THIRTY-EIGHT ----------------
c = C['a4']; D = A_['a4']['dur']; tr = Track(D, 404)
tr.ambience(0, c[4] - 0.4, 0.06, 1500)
tr.typing(0.3, c[1], 0.18, 6); tr.typing(c[3], c[4] - 0.6, 0.22, 10)
tr.bell(c[0] + 6, 0.04); tr.bell(c[3] + 4, 0.04); tr.bell(c[3] + 7.3, 0.035)
tr.pad(0, c[4] - 0.4, [Am, C3_, E3, G3], 0.025, 3, 2, 1000)
tr.boom(c[1] + 0.3, 0.28); tr.sting(c[2] + 0.4, [220, 233.1, 329.6], 0.035, 3)
tr.drone(c[3], c[4], [55, 82.4], 0.05, 2, 2)
tr.hum(c[4] - 0.4, D, 120, 0.015)
for k in range(30): tr.click(c[4] + 0.5 + k * 0.5, 0.06, 3000, 0.003, 0.02)
tr.pad(c[4], D, [A3, C4, E4], 0.03, 3, 3, 1400)
tr.piano(c[5] + 0.6, A4 := 440, 0.07); tr.piano(c[5] + 2.2, 349.2, 0.07)
tr.boom(c[6] + 0.5, 0.3)
finish('a4', tr)

# ---------------- ACT 5: WHAT REALLY HAPPENED ----------------
c = C['a5']; D = A_['a5']['dur']; tr = Track(D, 505)
tr.pad(0, c[4] - 0.4, [Am, E3, A3, 246.9], 0.03, 3, 2, 1600)
k = 0.0
while k < c[4] - 0.4: tr.click(k + 1, 0.06, 3000, 0.003, 0.02); k += 0.5
for at in [c[1] + 0.5, c[2] + 0.3]:
    L = int(1.6 * SR); x = np.arange(L) / SR; tr.place(hp(tr.noise(L), 900) * np.sin(np.pi * x / 1.6) * 0.25, at)
tr.boom(c[2] + 0.4, 0.2)
tr.melody(c[3] + 0.5, [C4, E4, A3 * 2 / 2, None, G3, A3, C4, None], 1.4, 0.05)
tr.ambience(c[4] - 0.4, c[6] - 0.4, 0.04, 800)
for k in range(3): tr.click(c[4] + 0.6 + k * 0.4, 0.15, 1500, 0.02, 0.15); tr.click(c[5] + 0.6 + k * 0.4, 0.15, 1500, 0.02, 0.15)
tr.pad(c[4] - 0.4, D, [A3, C4, E4, G4], 0.03, 3, 3, 1300)
tr.hum(c[6] - 0.4, D, 50, 0.025)
finish('a5', tr)

# ---------------- ACT 6: ACCOUNTABILITY ----------------
c = C['a6']; D = A_['a6']['dur']; tr = Track(D, 606)
tr.ambience(0, c[1] - 0.4, 0.05, 600)
tr.thump(c[0] + 8.0, 140, 0.7, 0.3); tr.thump(c[0] + 8.35, 140, 0.6, 0.3)          # gavel
tr.drone(0, c[3], [49, 73.4, 103.8], 0.05, 3, 2)
tr.heartbeat(c[1], c[2] - 0.6, 90, 130, 0.5); tr.steps(c[1] - 0.2, c[2] - 1, 0.3, 0.5); tr.siren(c[1] + 3.5, c[2], 0.03)
for k in range(9): tr.click(c[2] + 0.8 + k * 1.3 + tr.R.random() * 0.4, 0.12, 2500, 0.02, 0.2)   # drips
tr.pad(c[2], c[3], [Am / 2, 82.4, 98], 0.03, 2, 2, 500)
tr.pad(c[3] - 0.4, D - 1, [A3, C4, E4, G4], 0.03, 4, 5, 1300)
tr.melody(c[3] + 0.5, [E4, None, D4, C4, None, A3, None, None, C4, D4, E4, None, None, None, A3, None, E4, D4, C4, A3], 1.3, 0.065)
tr.boom(c[4] + 8.6, 0.25)
finish('a6', tr)
