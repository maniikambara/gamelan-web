"""
api/index.py  —  Gamelan Bali Synthesizer · Backend
FastAPI serverless function untuk Vercel.

Endpoints:
  POST /api/samples/{instrument}/{note}   Upload sampel audio
  GET  /api/samples/{instrument}/{note}   Download/get sampel audio (default atau uploaded)
  POST /api/synthesize                    Sintesis server-side (alternatif)
  POST /api/export-recording              Mixing dan export WAV
  GET  /api/instruments                   Daftar instrumen dan nada
  GET  /api/health                        Health check
"""

from __future__ import annotations
import io, time, base64
from typing import Dict, Optional
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, Response
import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter

# ─── App init ────────────────────────────────────────────────────────────────
app = FastAPI(title="Gamelan Bali Synthesizer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory sample store (per serverless instance lifecycle) ───────────────
# Key: "{instrument}/{note}" → raw audio bytes
_SAMPLE_STORE: Dict[str, bytes] = {}

def _load_default_samples():
    """Load default samples from api/samples directory if available."""
    samples_dir = Path(__file__).parent / "samples"
    if not samples_dir.exists():
        return
    
    for inst_dir in samples_dir.iterdir():
        if not inst_dir.is_dir():
            continue
        inst_name = inst_dir.name
        for wav_file in inst_dir.glob("*.wav"):
            note_name = wav_file.stem  # Filename without .wav extension
            key = f"{inst_name}/{note_name}"
            try:
                with open(wav_file, 'rb') as f:
                    _SAMPLE_STORE[key] = f.read()
            except Exception as e:
                print(f"Warning: Could not load sample {key}: {e}")

# Load default samples on startup
_load_default_samples()

# ─── Instrument definitions ───────────────────────────────────────────────────
INSTRUMENTS = {
    "gangsa": {
        "label": "Gangsa",
        "description": "Metalofon bilah logam, laras pelog Bali",
        "notes": [
            {"index": 0, "name": "Ding",  "freq": 253},
            {"index": 1, "name": "Dong",  "freq": 283},
            {"index": 2, "name": "Deng",  "freq": 318},
            {"index": 3, "name": "Deung", "freq": 345},
            {"index": 4, "name": "Dung",  "freq": 395},
            {"index": 5, "name": "Dang",  "freq": 444},
            {"index": 6, "name": "Daing", "freq": 496},
            {"index": 7, "name": "Ding²", "freq": 506},
            {"index": 8, "name": "Dong²", "freq": 567},
            {"index": 9, "name": "Deng²", "freq": 637},
        ],
    },
    "kendang": {
        "label": "Kendang",
        "description": "Drum bermembran dua bagian, 4 variasi suara",
        "notes": [
            {"index": 0, "name": "Tung Tengah · Muka",     "freq": 80},
            {"index": 1, "name": "Pak Pinggir · Muka",     "freq": 130},
            {"index": 2, "name": "Tung Tengah · Belakang", "freq": 95},
            {"index": 3, "name": "Pak Pinggir · Belakang", "freq": 160},
        ],
    },
    "suling": {
        "label": "Suling Bali",
        "description": "Seruling bambu 6 lubang, laras pelog Bali",
        "notes": [
            {"index": 0, "name": "1 Do",  "freq": 523},
            {"index": 1, "name": "3 Mi",  "freq": 587},
            {"index": 2, "name": "4 Fa",  "freq": 659},
            {"index": 3, "name": "5 Sol", "freq": 784},
            {"index": 4, "name": "7 Si",  "freq": 880},
            {"index": 5, "name": "1 Do (octave)", "freq": 1047},
        ],
    },
}

SAMPLE_RATE = 44100

# ─── DSP helpers ─────────────────────────────────────────────────────────────

def _normalize(a: np.ndarray) -> np.ndarray:
    p = np.max(np.abs(a))
    return a / p if p > 1e-7 else a

def _adsr(a: np.ndarray, sr: int,
          atk: float, dec: float, sus: float, rel: float) -> np.ndarray:
    n = len(a); env = np.ones(n, dtype=np.float32)
    ai, di, ri = int(atk*sr/1000), int(dec*sr/1000), int(rel*sr/1000)
    if ai: env[:min(ai,n)] = np.linspace(0,1,min(ai,n))
    de = min(ai+di, n)
    if ai < de: env[ai:de] = np.linspace(1, sus, de-ai)
    se = max(0, n-ri)
    if de < se: env[de:se] = sus
    if ri and se < n: env[se:] = np.linspace(sus, 0, n-se)
    return a * env

def _bandpass(a: np.ndarray, lo: float, hi: float, sr: int) -> np.ndarray:
    """1st-order IIR bandpass: highpass at lo Hz, then lowpass at hi Hz."""
    nyq = sr / 2
    if lo <= 0 or hi <= 0 or lo >= nyq or hi >= nyq or lo >= hi:
        return a.astype(np.float32)

    x = a.astype(np.float32)

    # Highpass: y[n] = alpha * (y[n-1] + x[n] - x[n-1])
    alpha_hp = 2 * np.pi * (lo / sr) / (1 + 2 * np.pi * (lo / sr))
    hp = lfilter([alpha_hp, -alpha_hp], [1.0, -alpha_hp], x).astype(np.float32)

    # Lowpass applied to highpass output: y[n] = alpha * x[n] + (1-alpha) * y[n-1]
    alpha_lp = 2 * np.pi * (hi / sr) / (1 + 2 * np.pi * (hi / sr))
    lp = lfilter([alpha_lp], [1.0, -(1 - alpha_lp)], hp).astype(np.float32)

    return lp

def _lowpass(a: np.ndarray, cut: float, sr: int) -> np.ndarray:
    """1st-order IIR lowpass filter: y[n] = alpha * x[n] + (1-alpha) * y[n-1]."""
    if cut <= 0 or cut >= sr / 2:
        return a.astype(np.float32)

    x = a.astype(np.float32)
    alpha = 2 * np.pi * (cut / sr) / (1 + 2 * np.pi * (cut / sr))
    return lfilter([alpha], [1.0, -(1 - alpha)], x).astype(np.float32)

def _to_wav(audio: np.ndarray, sr: int = SAMPLE_RATE) -> bytes:
    pcm = (np.clip(audio, -1, 1) * 32767).astype(np.int16)
    buf = io.BytesIO(); wavfile.write(buf, sr, pcm); return buf.getvalue()

def _from_wav(raw: bytes) -> tuple[np.ndarray, int]:
    buf = io.BytesIO(raw)
    sr, data = wavfile.read(buf)
    if data.dtype == np.int16: data = data.astype(np.float32)/32768
    elif data.dtype == np.int32: data = data.astype(np.float32)/2**31
    if data.ndim > 1: data = data.mean(axis=1)
    return data.astype(np.float32), sr

# ─── Synthesis ───────────────────────────────────────────────────────────────

def synth_gangsa(freq: float, resonance: float = 0.5, gain: float = 0.8,
                 ombak: float = 6, release_ms: float = 2000) -> bytes:
    dur = 3.0 + release_ms/1000
    t   = np.linspace(0, dur, int(SAMPLE_RATE*dur), endpoint=False)
    ratios = [1.0, 2.756, 5.404, 8.933, 13.35]
    amps   = [1.0, 0.55,  0.28,  0.14,  0.07 ]
    audio  = sum(a*np.sin(2*np.pi*freq*r*t) for r,a in zip(ratios,amps))
    audio += 0.45*sum(a*np.sin(2*np.pi*(freq*r+ombak)*t)
                      for r,a in zip(ratios[:3],amps[:3]))
    bw = max(60, (1-resonance)*1800+60)
    filt = _bandpass(audio, max(30,freq-bw), freq+bw, SAMPLE_RATE)
    audio = (1-resonance*0.6)*audio + resonance*0.6*filt
    audio = _adsr(audio, SAMPLE_RATE, 12, 100, 0.45, release_ms)
    return _to_wav(_normalize(audio)*gain)

def synth_kendang_tengah(freq: float, gain: float = 0.8,
                         depth: float = 0.6, release_ms: float = 180) -> bytes:
    dur = 1.2; t = np.linspace(0, dur, int(SAMPLE_RATE*dur), endpoint=False)
    tonal = np.sin(2*np.pi*freq*t)+0.4*np.sin(2*np.pi*freq*1.5*t)
    noise = np.random.normal(0,1,len(t)).astype(np.float32)
    noise = _bandpass(noise, max(20,freq*0.4), freq*2.2, SAMPLE_RATE)
    audio = depth*tonal+(1-depth)*noise
    audio = _adsr(audio, SAMPLE_RATE, 3, 50, 0.08, release_ms)
    return _to_wav(_normalize(audio)*gain)

def synth_kendang_pinggir(freq: float, gain: float = 0.8,
                          dryness: float = 0.7, release_ms: float = 80) -> bytes:
    dur = 0.5; t = np.linspace(0, dur, int(SAMPLE_RATE*dur), endpoint=False)
    noise = np.random.normal(0,1,len(t)).astype(np.float32)
    noise = _bandpass(noise, freq*0.8, min(freq*3.5,8000), SAMPLE_RATE)
    click = np.exp(-t*60)*np.sin(2*np.pi*freq*2*t)
    audio = dryness*noise+(1-dryness)*click
    audio = _adsr(audio, SAMPLE_RATE, 2, 18, 0.02, release_ms)
    return _to_wav(_normalize(audio)*gain)

def synth_suling(freq: float, gain: float = 0.8,
                 breath: float = 0.2, attack_ms: float = 90,
                 release_ms: float = 600) -> bytes:
    dur = 4.0; t = np.linspace(0, dur, int(SAMPLE_RATE*dur), endpoint=False)
    audio = (np.sin(2*np.pi*freq*t) +
             0.22*np.sin(2*np.pi*freq*2*t) +
             0.05*np.sin(2*np.pi*freq*3*t)).astype(np.float32)
    noise = np.random.normal(0,0.12,len(t)).astype(np.float32)
    noise = _bandpass(noise, max(30,freq*0.7), min(freq*4,6000), SAMPLE_RATE)
    audio += breath*noise
    audio = _adsr(audio, SAMPLE_RATE, attack_ms, 80, 0.88, release_ms)
    return _to_wav(_normalize(audio)*gain)

def process_sample(raw_wav: bytes, freq: float, instrument: str, params: dict) -> bytes:
    audio, sr = _from_wav(raw_wav)
    audio = _normalize(audio)
    res = params.get("resonance", 0.5)
    bw  = max(50, (1-res)*1800+50)
    if res > 0.02:
        filt  = _bandpass(audio, max(20,freq-bw), freq+bw, sr)
        audio = (1-res*0.65)*audio + res*0.65*filt
    if instrument == "suling":
        breath = params.get("breath", 0.0)
        if breath > 0.01:
            noise = np.random.normal(0,0.1,len(audio)).astype(np.float32)
            noise = _lowpass(noise, 4000, sr)
            audio += breath*noise
    audio = _adsr(audio, sr,
                  params.get("attack_ms", 20),
                  params.get("decay_ms",  120),
                  params.get("sustain",   0.7),
                  params.get("release_ms",400))
    return _to_wav(_normalize(audio)*params.get("gain",0.8))

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": time.time()}

@app.get("/api/instruments")
def get_instruments():
    return INSTRUMENTS

@app.post("/api/samples/{instrument}/{note}")
async def upload_sample(instrument: str, note: str, file: UploadFile = File(...)):
    if instrument not in INSTRUMENTS:
        raise HTTPException(404, f"Instrument '{instrument}' not found")
    raw = await file.read()
    key = f"{instrument}/{note}"
    _SAMPLE_STORE[key] = raw
    return {"status": "ok", "key": key, "size": len(raw)}

@app.get("/api/samples/{instrument}/{note}")
def get_sample(instrument: str, note: str):
    key = f"{instrument}/{note}"
    if key not in _SAMPLE_STORE:
        raise HTTPException(404, "Sample not found")
    return Response(content=_SAMPLE_STORE[key], media_type="audio/wav")

@app.post("/api/play-note")
async def play_note(request: Request):
    """
    Play a note and return audio as WAV stream.
    Body: { instrument, note_index, note_name, freq, params }
    """
    body = await request.json()
    inst  = body.get("instrument")
    freq  = float(body.get("freq", 440))
    idx   = int(body.get("note_index", 0))
    note_name = body.get("note_name", "")
    p     = body.get("params", {})

    key = f"{inst}/{note_name}"
    if key in _SAMPLE_STORE:
        wav = process_sample(_SAMPLE_STORE[key], freq, inst, p)
    elif inst == "gangsa":
        wav = synth_gangsa(freq,
                           resonance=p.get("resonance",0.5),
                           gain=p.get("gain",0.8),
                           ombak=p.get("ombak",6),
                           release_ms=p.get("release_ms",2000))
    elif inst == "kendang":
        if idx % 2 == 0:
            wav = synth_kendang_tengah(freq, p.get("gain",0.8),
                                       p.get("depth",0.6), p.get("release_ms",180))
        else:
            wav = synth_kendang_pinggir(freq, p.get("gain",0.8),
                                        p.get("dryness",0.7), p.get("release_ms",80))
    elif inst == "suling":
        wav = synth_suling(freq, p.get("gain",0.8),
                           p.get("breath",0.2), p.get("attack_ms",90),
                           p.get("release_ms",600))
    else:
        raise HTTPException(400, f"Unknown instrument: {inst}")

    return Response(content=wav, media_type="audio/wav")

@app.post("/api/synthesize")
async def synthesize(request: Request):
    """
    Synthesize a note server-side and return WAV bytes as base64.
    Body: { instrument, note_index, freq, params }
    """
    body = await request.json()
    inst  = body.get("instrument")
    freq  = float(body.get("freq", 440))
    idx   = int(body.get("note_index", 0))
    p     = body.get("params", {})

    key = f"{inst}/{body.get('note_name','')}"
    if key in _SAMPLE_STORE:
        wav = process_sample(_SAMPLE_STORE[key], freq, inst, p)
    elif inst == "gangsa":
        wav = synth_gangsa(freq,
                           resonance=p.get("resonance",0.5),
                           gain=p.get("gain",0.8),
                           ombak=p.get("ombak",6),
                           release_ms=p.get("release_ms",2000))
    elif inst == "kendang":
        if idx % 2 == 0:
            wav = synth_kendang_tengah(freq, p.get("gain",0.8),
                                       p.get("depth",0.6), p.get("release_ms",180))
        else:
            wav = synth_kendang_pinggir(freq, p.get("gain",0.8),
                                        p.get("dryness",0.7), p.get("release_ms",80))
    elif inst == "suling":
        wav = synth_suling(freq, p.get("gain",0.8),
                           p.get("breath",0.2), p.get("attack_ms",90),
                           p.get("release_ms",600))
    else:
        raise HTTPException(400, f"Unknown instrument: {inst}")

    return JSONResponse({
        "audio_b64": base64.b64encode(wav).decode(),
        "instrument": inst,
        "note_index": idx,
        "freq": freq,
    })

@app.post("/api/export-recording")
async def export_recording(request: Request):
    """
    Receive list of { timestamp_ms, audio_b64 } events, mix them, return WAV.
    """
    body   = await request.json()
    events = body.get("events", [])
    if not events:
        raise HTTPException(400, "No events provided")

    # Decode all clips
    clips = []
    for ev in events:
        raw = base64.b64decode(ev["audio_b64"])
        audio, sr = _from_wav(raw)
        clips.append({"t": ev["timestamp_ms"] / 1000.0, "audio": audio})

    max_end = max(c["t"] + len(c["audio"])/SAMPLE_RATE for c in clips)
    total   = int((max_end + 0.5) * SAMPLE_RATE)
    mix     = np.zeros(total, dtype=np.float32)
    for c in clips:
        s = int(c["t"]*SAMPLE_RATE)
        e = s + len(c["audio"])
        if e > total:
            c["audio"] = c["audio"][:total-s]; e = total
        mix[s:e] += c["audio"]

    pk = np.max(np.abs(mix))
    if pk > 1e-6: mix = mix/pk*0.9

    wav_bytes = _to_wav(mix)
    return Response(content=wav_bytes, media_type="audio/wav",
                    headers={"Content-Disposition": 'attachment; filename="rekaman_gamelan.wav"'})

# Vercel entrypoint
handler = app
