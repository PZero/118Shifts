# Tappeto musicale originale (sintetizzato da zero): nessun diritto di terzi.
import json, wave, numpy as np
SR = 44100
TOT = json.load(open('voceA.json'))['totale'] + 0.2
N = int(TOT * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
f = lambda m: 440 * 2 ** ((m - 69) / 12)
BPM = 96; BEAT = 60 / BPM; BAR = 4 * BEAT
# Re maggiore: Dmaj9 - Bm7 - Gmaj7 - Asus4 (2 battute ciascuno)
ACC = [[50, 57, 62, 66, 69, 76], [47, 54, 62, 66, 69, 73], [43, 55, 59, 62, 66, 71], [45, 57, 62, 64, 69, 74]]
DUR = 2 * BAR
nacc = int(np.ceil(TOT / DUR))
FINE_MUSICA = TOT - 4.5           # ultimo accordo: risoluzione su Re

def accordo(i, s):
    return ACC[0] if s >= FINE_MUSICA - 0.01 else ACC[i % 4]

def inviluppo(a, d, att, rel):
    e = np.zeros(N); i0, i1 = int(a * SR), min(N, int((a + d) * SR))
    x = t[i0:i1] - a
    e[i0:i1] = np.minimum(1, x / att) * np.minimum(1, np.maximum(0, (d - x) / rel))
    return e

# pad
starts = [i * DUR for i in range(nacc) if i * DUR < FINE_MUSICA] + [FINE_MUSICA]
for j, s in enumerate(starts):
    d = (starts[j + 1] - s if j + 1 < len(starts) else TOT - s) + 1.2
    env = inviluppo(s, d, 1.4, 1.6) if j + 1 < len(starts) else inviluppo(s, d, 1.0, 4.0)
    for k, m in enumerate(accordo(j, s)):
        fr = f(m + 12 if m < 52 else m)
        g = 0.05 / (1 + k * 0.15)
        for det, side in ((-0.18, 0), (0.0, 2), (0.21, 1)):
            w = np.sin(2 * np.pi * (fr + det) * t + rng.uniform(0, 6)) + 0.18 * np.sin(4 * np.pi * (fr + det) * t)
            if side in (0, 2): L += g * env * w
            if side in (1, 2): R += g * env * w

# basso: radice ogni battuta
for b in range(int(TOT / BAR) + 1):
    s = b * BAR
    if s > TOT - 3: break
    m = accordo(int(s // DUR), s)[0] - 12
    i0 = int(s * SR); n = min(N - i0, int(BAR * SR))
    x = np.arange(n) / SR
    w = (np.sin(2 * np.pi * f(m) * x) + 0.25 * np.sin(4 * np.pi * f(m) * x)) * np.exp(-x * 1.1) * np.minimum(1, x / 0.02)
    w *= 0.0 if s < 6.5 else 0.12
    L[i0:i0 + n] += w; R[i0:i0 + n] += w

# arpeggio pizzicato (crotali/piano morbido)
ord_ = [0, 2, 3, 4, 3, 5, 4, 2]
nota = BEAT / 2
k = 0; s = 3.0
while s < FINE_MUSICA - 0.2:
    ac = accordo(int(s // DUR), s)
    m = ac[1:][ord_[k % 8] % 5] + 12
    i0 = int(s * SR); n = min(N - i0, int(1.6 * SR)); x = np.arange(n) / SR
    w = sum((0.6 ** h) * np.sin(2 * np.pi * f(m) * (h + 1) * x) * np.exp(-x * (3 + 3 * h)) for h in range(4))
    w *= np.minimum(1, x / 0.004) * (0.05 if s < 7 else 0.075) * (1.0 if k % 2 == 0 else 0.7)
    pan = 0.5 + 0.3 * np.sin(k * 0.7)
    L[i0:i0 + n] += w * (1 - pan) * 1.4; R[i0:i0 + n] += w * pan * 1.4
    k += 1; s += nota

# percussioni leggere: cassa morbida e shaker, dalla scena 2
for b in range(int(TOT / BEAT)):
    s = b * BEAT
    if s < 13 or s > FINE_MUSICA - 0.1: continue
    i0 = int(s * SR); n = min(N - i0, int(0.35 * SR)); x = np.arange(n) / SR
    if b % 4 in (0, 2):
        kick = np.sin(2 * np.pi * (48 + 70 * np.exp(-x * 30)) * x) * np.exp(-x * 9) * 0.16
        L[i0:i0 + n] += kick; R[i0:i0 + n] += kick
    j0 = int((s + BEAT / 2) * SR); n2 = min(N - j0, int(0.12 * SR))
    if n2 > 0:
        nz = rng.normal(0, 1, n2); nz = nz - np.convolve(nz, np.ones(6) / 6, 'same')
        sh = nz * np.exp(-np.arange(n2) / SR * 40) * 0.025
        L[j0:j0 + n2] += sh * 0.8; R[j0:j0 + n2] += sh

# riverbero (convoluzione con coda esponenziale)
def riverbero(x, seed):
    n = int(2.4 * SR); g = np.random.default_rng(seed).normal(0, 1, n) * np.exp(-np.arange(n) / SR / 0.55)
    g = np.convolve(g, np.ones(8) / 8, 'same'); g /= np.sqrt((g ** 2).sum())
    m = len(x) + n; F = 1 << int(np.ceil(np.log2(m)))
    return np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(g, F), F)[:len(x)]
L = L + 0.35 * riverbero(L, 1); R = R + 0.35 * riverbero(R, 2)

# dissolvenze e normalizzazione
fade = np.minimum(1, t / 1.5) * np.minimum(1, np.maximum(0, (TOT - t) / 3.0))
st = np.stack([L * fade, R * fade], 1)
st = np.tanh(st / np.abs(st).max() * 1.2) * 0.8
pcm = (st * 32767).astype('<i2')
with wave.open('musica.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', TOT)
