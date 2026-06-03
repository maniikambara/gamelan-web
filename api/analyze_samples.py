#!/usr/bin/env python3
"""
analyze_samples.py — Analisis Akustik Sampel Gamelan Bali
==========================================================
Membaca file WAV dari api/samples/, mengekstrak parameter akustik setiap nada,
dan menyimpan hasilnya ke api/synthesis_params.json.

Penggunaan:
    python api/analyze_samples.py           # analisis semua sampel
    python api/analyze_samples.py --verbose # tampilkan grafik spektrum ASCII
    python api/analyze_samples.py --check   # hanya cek file yang tersedia

Output:
    api/synthesis_params.json  — parameter per instrumen per nada
    Console — laporan ringkasan
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import warnings
from pathlib import Path
from typing import Optional

import numpy as np
from scipy.fft import fft, fftfreq
from scipy.io import wavfile
from scipy.signal import butter, find_peaks, filtfilt, lfilter, medfilt

warnings.filterwarnings("ignore", category=wavfile.WavFileWarning)

# ─── Constants ────────────────────────────────────────────────────────────────

SAMPLE_RATE_TARGET = 44100
INSTRUMENTS = {
    "gangsa": [
        "Ding", "Dong", "Deng", "Deung", "Dung",
        "Dang", "Daing", "Ding²", "Dong²", "Deng²",
    ],
    "kendang": [
        "Tung Tengah · Muka",
        "Pak Pinggir · Muka",
        "Tung Tengah · Belakang",
        "Pak Pinggir · Belakang",
    ],
    "suling": [
        "1 Do", "3 Mi", "4 Fa", "5 Sol", "7 Si", "1 Do (octave)",
    ],
}

# Frequency bounds for F0 detection per instrument type
F0_BOUNDS = {
    "gangsa":  (200,  800),
    "kendang": ( 50,  300),
    "suling":  (400, 1200),
}


# ─── I/O ──────────────────────────────────────────────────────────────────────

def load_wav(path: Path) -> tuple[np.ndarray, int]:
    """Load WAV file, normalize to float32 [-1, 1], downmix to mono."""
    sr, data = wavfile.read(path)
    if data.dtype == np.int16:
        data = data.astype(np.float32) / 32768.0
    elif data.dtype == np.int32:
        data = data.astype(np.float32) / 2**31
    elif data.dtype == np.uint8:
        data = (data.astype(np.float32) - 128.0) / 128.0
    else:
        data = data.astype(np.float32)
    if data.ndim > 1:
        data = data.mean(axis=1)
    return data, sr


def resample_to(signal: np.ndarray, sr_in: int, sr_out: int) -> np.ndarray:
    """Naive integer-ratio resampling (good enough for analysis)."""
    if sr_in == sr_out:
        return signal
    ratio = sr_out / sr_in
    n_out = int(len(signal) * ratio)
    indices = np.linspace(0, len(signal) - 1, n_out)
    i0 = np.floor(indices).astype(int)
    i1 = np.minimum(i0 + 1, len(signal) - 1)
    frac = indices - i0
    return signal[i0] * (1 - frac) + signal[i1] * frac


# ─── Envelope ─────────────────────────────────────────────────────────────────

def rms_envelope(signal: np.ndarray, sr: int,
                 frame_ms: float = 5.0, hop_ms: float = 2.5) -> tuple[np.ndarray, np.ndarray]:
    """Compute RMS amplitude envelope. Returns (envelope, times_ms)."""
    frame = max(1, int(sr * frame_ms / 1000))
    hop   = max(1, int(sr * hop_ms / 1000))
    n     = (len(signal) - frame) // hop + 1
    env = np.array([
        np.sqrt(np.mean(signal[i * hop: i * hop + frame] ** 2))
        for i in range(n)
    ])
    times = np.arange(n) * hop / sr * 1000  # ms
    return env, times


def measure_adsr(signal: np.ndarray, sr: int) -> dict:
    """Extract ADSR envelope parameters from a monophonic recording."""
    env, times = rms_envelope(signal, sr, frame_ms=5, hop_ms=2.5)
    if len(env) == 0:
        return {"attack_ms": 10, "decay_ms": 50, "sustain": 0.7, "release_ms": 300}

    peak_idx  = int(np.argmax(env))
    peak_val  = env[peak_idx]
    peak_time = float(times[peak_idx])

    # Attack — rise from noise floor to peak
    noise_floor = np.percentile(env[:max(1, peak_idx)], 10) if peak_idx > 0 else 0
    threshold   = noise_floor + 0.1 * (peak_val - noise_floor)
    onset_arr   = np.where(env[:peak_idx] < threshold)[0]
    onset_idx   = int(onset_arr[-1]) if len(onset_arr) > 0 else 0
    attack_ms   = float(times[peak_idx] - times[onset_idx])

    # Decay — fall from peak to stable sustain level
    # Find the sustain region: where envelope stabilizes (slope ≈ 0)
    if peak_idx < len(env) - 5:
        post_peak = env[peak_idx:]
        diffs     = np.diff(post_peak)
        stable    = np.where(np.abs(diffs) < 0.02 * peak_val)[0]
        if len(stable) > 3:
            sus_start_idx   = peak_idx + int(stable[0])
            sustain_level   = float(np.mean(env[sus_start_idx: sus_start_idx + 20]))
            sustain_ratio   = float(np.clip(sustain_level / peak_val, 0.01, 1.0))
            decay_ms        = float(times[sus_start_idx] - peak_time)
        else:
            # No clear sustain — percussive: find -6 dB point
            db6_val  = peak_val * 0.5
            db6_arr  = np.where(post_peak < db6_val)[0]
            sus_start_idx   = peak_idx + (int(db6_arr[0]) if len(db6_arr) else len(post_peak) // 2)
            sustain_ratio   = 0.1
            decay_ms        = float(times[min(sus_start_idx, len(times)-1)] - peak_time)
    else:
        sus_start_idx = peak_idx
        sustain_ratio = 0.5
        decay_ms      = 0.0

    # Release — fall from sustain level to near silence
    tail_threshold = 0.05 * peak_val
    tail_arr = np.where(env > tail_threshold)[0]
    if len(tail_arr) > 0:
        tail_end_idx = int(tail_arr[-1])
        release_start_idx = max(sus_start_idx, tail_end_idx - int(500 * sr / 1000 / 2.5))
        release_ms = float(times[tail_end_idx] - times[max(0, release_start_idx)])
    else:
        release_ms = 100.0

    return {
        "attack_ms":   float(np.clip(attack_ms,  1, 300)),
        "decay_ms":    float(np.clip(decay_ms,   1, 1000)),
        "sustain":     float(np.clip(sustain_ratio, 0.02, 1.0)),
        "release_ms":  float(np.clip(release_ms, 20, 5000)),
    }


# ─── Pitch / F0 detection ─────────────────────────────────────────────────────

def detect_f0(signal: np.ndarray, sr: int,
              f_min: float = 50, f_max: float = 4000) -> Optional[float]:
    """
    YIN-inspired F0 detection using normalized autocorrelation.
    Uses the steady-state portion of the signal to avoid transient confusion.
    """
    # Use steady-state: skip first 10%, use next 40% of duration
    n      = len(signal)
    start  = max(0, int(0.1 * n))
    end    = min(n, int(0.5 * n))
    seg    = signal[start:end]

    # Limit segment length for speed
    win_size = min(len(seg), 8192)
    seg = seg[:win_size]

    if len(seg) < 64:
        return None

    # Window to reduce spectral leakage
    seg = seg * np.hanning(len(seg))

    tau_min = max(1, int(sr / f_max))
    tau_max = min(len(seg) - 1, int(sr / f_min))

    if tau_min >= tau_max:
        return None

    # Normalized autocorrelation via FFT
    n_fft = 2 ** int(np.ceil(np.log2(2 * len(seg))))
    X     = np.fft.rfft(seg, n=n_fft)
    acf   = np.fft.irfft(X * np.conj(X))[:len(seg)]
    if acf[0] < 1e-12:
        return None
    acf /= acf[0]

    # Find highest peak in valid lag range
    region = acf[tau_min:tau_max]
    if len(region) == 0:
        return None

    peaks, props = find_peaks(region, height=0.25)
    if len(peaks) == 0:
        peaks, props = find_peaks(region, height=0.1)
    if len(peaks) == 0:
        return None

    best_peak = peaks[np.argmax(props["peak_heights"])]
    tau = best_peak + tau_min

    # Parabolic interpolation for sub-sample accuracy
    if 0 < tau < len(acf) - 1:
        a, b, c = acf[tau - 1], acf[tau], acf[tau + 1]
        denom = 2 * (2 * b - a - c)
        if abs(denom) > 1e-12:
            tau += (a - c) / denom

    return float(sr / tau)


def refine_f0_with_fft(signal: np.ndarray, sr: int, f0_estimate: float,
                        tolerance: float = 0.15) -> float:
    """Refine F0 estimate using FFT peak in a narrow band."""
    n     = len(signal)
    seg   = signal[:min(n, 32768)] * np.hanning(min(n, 32768))
    spec  = np.abs(np.fft.rfft(seg))
    freqs = np.fft.rfftfreq(len(seg), 1 / sr)

    lo = f0_estimate * (1 - tolerance)
    hi = f0_estimate * (1 + tolerance)
    mask = (freqs >= lo) & (freqs <= hi)
    if not np.any(mask):
        return f0_estimate

    local_spec = spec[mask]
    local_freq = freqs[mask]
    peak_idx   = int(np.argmax(local_spec))

    # Parabolic refinement
    if 0 < peak_idx < len(local_spec) - 1:
        a, b, c = local_spec[peak_idx-1], local_spec[peak_idx], local_spec[peak_idx+1]
        denom   = 2 * (2*b - a - c)
        if abs(denom) > 1e-12:
            delta = (a - c) / denom
            # interpolate frequency
            df = local_freq[1] - local_freq[0] if len(local_freq) > 1 else 0
            return float(local_freq[peak_idx] + delta * df)

    return float(local_freq[peak_idx])


# ─── Harmonic analysis ────────────────────────────────────────────────────────

def analyze_harmonics(signal: np.ndarray, sr: int, f0: float,
                      n_harmonics: int = 12) -> list[dict]:
    """
    Find harmonic partial amplitudes relative to the fundamental.
    Returns list of {n, ratio, freq, amplitude_rel, inharmonicity_cents}.
    """
    n_fft = min(len(signal), 65536)
    seg   = signal[:n_fft] * np.hanning(n_fft)
    spec  = np.abs(np.fft.rfft(seg))
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)

    freq_res = sr / n_fft  # Hz per FFT bin

    harmonics = []
    for k in range(1, n_harmonics + 1):
        expected  = f0 * k
        if expected > sr / 2 - freq_res * 10:
            break

        # Search window: ±5% of expected or ±10 Hz, whichever is larger
        window_hz = max(10, expected * 0.05)
        lo        = max(0, expected - window_hz)
        hi        = min(sr / 2, expected + window_hz)
        lo_idx    = int(lo / freq_res)
        hi_idx    = int(hi / freq_res) + 1
        hi_idx    = min(hi_idx, len(spec))

        if lo_idx >= hi_idx:
            continue

        local_peak_idx = lo_idx + int(np.argmax(spec[lo_idx:hi_idx]))
        actual_freq    = float(freqs[local_peak_idx])
        amplitude      = float(spec[local_peak_idx])

        # Inharmonicity: deviation of actual from ideal harmonic, in cents
        ideal_freq        = f0 * k
        if ideal_freq > 0:
            inharmonicity_c = 1200.0 * np.log2(actual_freq / ideal_freq) if actual_freq > 0 else 0.0
        else:
            inharmonicity_c = 0.0

        harmonics.append({
            "n":                   k,
            "ratio":               float(actual_freq / f0) if f0 > 0 else float(k),
            "freq_hz":             actual_freq,
            "amplitude":           amplitude,
            "inharmonicity_cents": float(inharmonicity_c),
        })

    if not harmonics:
        return harmonics

    # Normalize amplitudes relative to fundamental
    fund_amp = harmonics[0]["amplitude"]
    if fund_amp > 1e-10:
        for h in harmonics:
            h["amplitude_rel"] = float(h["amplitude"] / fund_amp)
    else:
        for h in harmonics:
            h["amplitude_rel"] = 0.0

    return harmonics


def find_spectral_partials(signal: np.ndarray, sr: int, f0: float,
                           n_partials: int = 8,
                           min_freq: float = 20,
                           threshold_rel: float = 0.04) -> tuple[list[float], list[float]]:
    """
    Instrument-agnostic partial detection: find all significant spectral peaks
    above a threshold, then express them as ratios to f0.

    This handles inharmonic instruments (gangsa, kendang) correctly because it
    does NOT assume integer harmonic relationships.

    Returns (ratios, amplitudes) normalised so the loudest partial = 1.0.
    """
    n_fft = min(len(signal), 65536)
    seg   = signal[:n_fft] * np.hanning(n_fft)
    spec  = np.abs(np.fft.rfft(seg))
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)

    # Restrict to audible range above min_freq
    lo_idx = int(min_freq * n_fft / sr)
    spec_region = spec[lo_idx:]
    freq_region = freqs[lo_idx:]

    # Dynamic threshold: relative to the global peak
    global_peak = float(np.max(spec_region))
    if global_peak < 1e-12:
        return [1.0], [1.0]

    threshold = threshold_rel * global_peak

    # Minimum distance between peaks: ~0.5 semitones at f0
    min_dist = max(2, int(f0 * 0.03 * n_fft / sr)) if f0 > 0 else 4

    peaks, props = find_peaks(
        spec_region,
        height=threshold,
        distance=min_dist,
        prominence=threshold * 0.5,
    )
    if len(peaks) == 0:
        return [1.0], [1.0]

    # Sort by amplitude and take top n_partials
    peak_amps  = spec_region[peaks]
    top_idx    = np.argsort(peak_amps)[::-1][:n_partials]
    top_peaks  = peaks[top_idx]
    top_amps   = peak_amps[top_idx]

    # Sort by frequency
    freq_order = np.argsort(freq_region[top_peaks])
    top_peaks  = top_peaks[freq_order]
    top_amps   = top_amps[freq_order]

    actual_freqs = freq_region[top_peaks]
    ref_freq = f0 if f0 > 0 else (actual_freqs[0] if len(actual_freqs) > 0 else 1)
    ratios = [float(f / ref_freq) for f in actual_freqs]
    amps   = [float(a) for a in top_amps]

    max_amp = max(amps)
    if max_amp > 1e-12:
        amps = [a / max_amp for a in amps]

    return ratios, amps


def harmonic_partials_for_synth(harmonics: list[dict],
                                 n_keep: int = 8) -> tuple[list[float], list[float]]:
    """
    Extract the strongest partials from integer-harmonic analysis.
    Returns (ratios, amplitudes) normalized so the loudest = 1.0.
    Used as a fallback when spectral peak detection is not run.
    """
    if not harmonics:
        return [1.0], [1.0]

    # Filter out partials with negligible amplitude
    meaningful = [h for h in harmonics if h.get("amplitude_rel", 0) > 0.02]
    if not meaningful:
        return [1.0], [1.0]

    partials = sorted(meaningful, key=lambda h: h["amplitude_rel"], reverse=True)[:n_keep]
    partials = sorted(partials, key=lambda h: h["n"])

    ratios = [h["ratio"] for h in partials]
    amps   = [h["amplitude_rel"] for h in partials]

    max_amp = max(amps) if amps else 1.0
    if max_amp > 1e-10:
        amps = [a / max_amp for a in amps]

    return ratios, amps


# ─── Ombak (beating) analysis — Gangsa specific ──────────────────────────────

def measure_ombak(signal: np.ndarray, sr: int, f0: float) -> Optional[float]:
    """
    Detect the beating frequency (ombak) in a Gangsa recording.

    Ombak appears as amplitude modulation (AM) at 1–15 Hz around the
    fundamental. We isolate the fundamental with a tight bandpass filter,
    extract the envelope, then FFT the envelope to find the beat frequency.
    """
    if f0 <= 0:
        return None

    # Tight bandpass around fundamental (±4% of f0)
    lo = f0 * 0.96
    hi = f0 * 1.04
    nyq = sr / 2
    if lo <= 0 or hi >= nyq:
        return None

    try:
        b, a = butter(4, [lo / nyq, hi / nyq], btype="bandpass")
        filtered = filtfilt(b, a, signal)
    except Exception:
        return None

    # Amplitude envelope via full-wave rectification + lowpass
    env = np.abs(filtered)
    lp_cutoff = 25  # Hz — passes AM frequencies up to 25 Hz
    alpha = 2 * np.pi * (lp_cutoff / sr) / (1 + 2 * np.pi * (lp_cutoff / sr))
    env_smooth = lfilter([alpha], [1.0, -(1 - alpha)], env)

    # Use steady-state region to reduce onset artefacts
    start = int(0.1 * len(env_smooth))
    end   = int(0.7 * len(env_smooth))
    seg   = env_smooth[start:end]
    if len(seg) < sr * 0.5:
        return None

    # Remove DC and apply window
    seg = seg - np.mean(seg)
    seg = seg * np.hanning(len(seg))

    # FFT of envelope
    n_fft  = 2 ** int(np.ceil(np.log2(len(seg))))
    env_spec = np.abs(np.fft.rfft(seg, n=n_fft))
    env_freq = np.fft.rfftfreq(n_fft, 1 / sr)

    # Look for peaks in 1–15 Hz (typical gamelan ombak range)
    lo_idx = np.searchsorted(env_freq, 1.0)
    hi_idx = np.searchsorted(env_freq, 15.0)
    if lo_idx >= hi_idx:
        return None

    region = env_spec[lo_idx:hi_idx]
    freqs  = env_freq[lo_idx:hi_idx]

    peaks, props = find_peaks(region, height=0.2 * np.max(region))
    if len(peaks) == 0:
        peak_idx = int(np.argmax(region))
    else:
        peak_idx = peaks[np.argmax(props["peak_heights"])]

    # Require minimum amplitude relative to background (signal quality check)
    if region[peak_idx] < 0.05 * np.max(env_spec):
        return None

    ombak_hz = float(freqs[peak_idx])
    return round(ombak_hz, 2)


# ─── Spectral features ────────────────────────────────────────────────────────

def spectral_centroid(signal: np.ndarray, sr: int) -> float:
    """Spectral centroid in Hz (weighted mean of frequencies)."""
    n_fft = min(len(signal), 16384)
    seg   = signal[:n_fft] * np.hanning(n_fft)
    spec  = np.abs(np.fft.rfft(seg))
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    total = np.sum(spec)
    if total < 1e-12:
        return 0.0
    return float(np.sum(spec * freqs) / total)


def inharmonicity_coefficient(harmonics: list[dict]) -> float:
    """
    Compute the mean absolute inharmonicity across all detected partials.
    A value of 0 means perfectly harmonic; larger values indicate more
    inharmonic character (typical for metallophones like gangsa).
    """
    if len(harmonics) < 2:
        return 0.0
    cents = [abs(h["inharmonicity_cents"]) for h in harmonics[1:]]
    return float(np.mean(cents))


def harmonic_decay_rate(harmonics: list[dict]) -> float:
    """
    Fit an exponential decay rate to amplitude vs. harmonic number.
    Returns the decay constant k where amplitude ≈ exp(-k * n).
    """
    if len(harmonics) < 3:
        return 0.5
    ns   = np.array([h["n"] for h in harmonics], dtype=float)
    amps = np.array([max(h["amplitude_rel"], 1e-6) for h in harmonics])
    log_amps = np.log(amps)
    # Linear fit: log(amp) = -k * n + const
    k, _ = np.polyfit(ns, log_amps, 1)
    return float(max(0.0, -k))


# ─── Main analysis pipeline ───────────────────────────────────────────────────

def analyze_note(wav_path: Path, instrument: str, note_name: str,
                 verbose: bool = False) -> dict:
    """Full analysis pipeline for a single WAV file."""
    signal, sr = load_wav(wav_path)
    if sr != SAMPLE_RATE_TARGET:
        signal = resample_to(signal, sr, SAMPLE_RATE_TARGET)
        sr = SAMPLE_RATE_TARGET

    duration_s = len(signal) / sr

    # ── F0 detection ──────────────────────────────────────────────
    f_min, f_max = F0_BOUNDS.get(instrument, (50, 2000))
    f0 = detect_f0(signal, sr, f_min, f_max)
    if f0 is not None:
        f0 = refine_f0_with_fft(signal, sr, f0, tolerance=0.12)
    f0 = f0 or 0.0

    # ── ADSR ──────────────────────────────────────────────────────
    adsr = measure_adsr(signal, sr)

    # ── Harmonics ─────────────────────────────────────────────────
    n_harm = 12 if instrument == "gangsa" else 8
    harmonics = analyze_harmonics(signal, sr, f0, n_harm) if f0 > 0 else []

    # For inharmonic instruments (gangsa, kendang), use peak-based detection
    # which finds ACTUAL partials regardless of harmonic relationship.
    # For suling (near-harmonic), fall back to integer-harmonic analysis.
    if f0 > 0:
        if instrument in ("gangsa", "kendang"):
            ratios, amps = find_spectral_partials(signal, sr, f0, n_partials=8)
        else:
            ratios, amps = harmonic_partials_for_synth(harmonics, n_keep=6)
            # If integer analysis found nothing meaningful, use peak detection
            if len(ratios) <= 1:
                ratios, amps = find_spectral_partials(signal, sr, f0, n_partials=6)
    else:
        ratios, amps = [1.0], [1.0]

    # ── Spectral features ─────────────────────────────────────────
    centroid     = spectral_centroid(signal, sr)
    inharmonicity = inharmonicity_coefficient(harmonics)
    decay_rate   = harmonic_decay_rate(harmonics)

    # ── Ombak (Gangsa only) ───────────────────────────────────────
    ombak_hz = None
    if instrument == "gangsa" and f0 > 0:
        ombak_hz = measure_ombak(signal, sr, f0)

    # ── Build result ──────────────────────────────────────────────
    result: dict = {
        "note":          note_name,
        "file":          str(wav_path.name),
        "duration_s":    round(duration_s, 3),
        "f0_hz":         round(f0, 2) if f0 else None,
        "adsr":          {k: round(v, 1) for k, v in adsr.items()},
        "harmonics":     [
            {
                "n":                   h["n"],
                "ratio":               round(h["ratio"], 4),
                "amplitude_rel":       round(h["amplitude_rel"], 4),
                "inharmonicity_cents": round(h["inharmonicity_cents"], 1),
            }
            for h in harmonics[:8]
        ],
        "synth_ratios":  [round(r, 4) for r in ratios],
        "synth_amps":    [round(a, 4) for a in amps],
        "centroid_hz":   round(centroid, 1),
        "inharmonicity": round(inharmonicity, 1),
        "harmonic_decay_rate": round(decay_rate, 4),
    }
    if ombak_hz is not None:
        result["ombak_hz"] = ombak_hz

    if verbose:
        _print_verbose(result, instrument)

    return result


def _print_verbose(result: dict, instrument: str):
    """Print an ASCII spectrum chart and detailed parameter table."""
    note   = result["note"]
    f0     = result["f0_hz"]
    print(f"\n  {'─'*52}")
    print(f"  {note}  (F0: {f0} Hz)")
    print(f"  {'─'*52}")

    # Harmonic bar chart
    if result["harmonics"]:
        print("  Harmonik (amplitudo relatif):")
        max_rel = max(h["amplitude_rel"] for h in result["harmonics"])
        for h in result["harmonics"][:8]:
            bar_len = int(h["amplitude_rel"] / max(max_rel, 1e-6) * 30)
            marker  = "█" * bar_len
            flag    = " ←" if abs(h["inharmonicity_cents"]) > 30 else ""
            print(f"    H{h['n']:2d} {h['ratio']:6.3f}×  {marker:<30}  "
                  f"{h['amplitude_rel']:.3f}{flag}")

    adsr = result["adsr"]
    print(f"  ADSR: att={adsr['attack_ms']}ms  dec={adsr['decay_ms']}ms  "
          f"sus={adsr['sustain']:.2f}  rel={adsr['release_ms']}ms")
    if "ombak_hz" in result:
        print(f"  Ombak:  {result['ombak_hz']} Hz")
    print(f"  Inharmonisitas: {result['inharmonicity']} sen  "
          f"|  Centroid: {result['centroid_hz']} Hz")


# ─── Entry point ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Analisis akustik sampel gamelan Bali")
    parser.add_argument("--verbose", action="store_true",
                        help="Tampilkan grafik harmonik ASCII per nada")
    parser.add_argument("--check",   action="store_true",
                        help="Hanya periksa file yang tersedia, tidak analisis")
    parser.add_argument("--samples-dir", default=None,
                        help="Override direktori sampel (default: api/samples/)")
    args = parser.parse_args()

    script_dir  = Path(__file__).parent
    samples_dir = Path(args.samples_dir) if args.samples_dir else script_dir / "samples"
    output_path = script_dir / "synthesis_params.json"

    print("=" * 60)
    print("  Analisis Akustik Sampel Gamelan Bali")
    print("=" * 60)

    if not samples_dir.exists():
        print(f"\n  TIDAK DITEMUKAN: direktori '{samples_dir}' belum ada.")
        print("  Buat direktori dan tambahkan file WAV dengan struktur:")
        for inst, notes in INSTRUMENTS.items():
            print(f"    {samples_dir}/{inst}/")
            for n in notes[:2]:
                print(f"      {n}.wav")
        sys.exit(1)

    # ── Discover files ────────────────────────────────────────────
    found:   dict[str, dict[str, Path]] = {}
    missing: dict[str, list[str]]       = {}

    for inst, note_list in INSTRUMENTS.items():
        inst_dir = samples_dir / inst
        found[inst]   = {}
        missing[inst] = []
        for note in note_list:
            # Try exact name, then sanitized (replace special chars)
            candidates = [
                inst_dir / f"{note}.wav",
                inst_dir / f"{note.replace('²', '2')}.wav",
                inst_dir / f"{note.replace(' · ', ' - ')}.wav",
                inst_dir / f"{note.replace(' · ', '_')}.wav",
                inst_dir / f"{note.replace(' (octave)', '_oct')}.wav",
            ]
            for c in candidates:
                if c.exists():
                    found[inst][note] = c
                    break
            else:
                missing[inst].append(note)

    # ── Status table ──────────────────────────────────────────────
    total_found   = sum(len(v) for v in found.values())
    total_expected = sum(len(v) for v in INSTRUMENTS.values())
    print(f"\n  Status sampel: {total_found}/{total_expected} ditemukan\n")

    for inst, note_list in INSTRUMENTS.items():
        found_count = len(found[inst])
        total       = len(note_list)
        bar         = "█" * found_count + "░" * (total - found_count)
        print(f"  {inst.upper():10s} [{bar}] {found_count}/{total}")
        for note in note_list:
            status = "✓" if note in found[inst] else "✗ TIDAK ADA"
            print(f"    {'':2s}{status:14s} {note}")
        print()

    if args.check:
        sys.exit(0 if len(missing) == 0 else 1)

    if total_found == 0:
        print("  Tidak ada file WAV ditemukan. Batalkan analisis.")
        sys.exit(1)

    # ── Analyze ───────────────────────────────────────────────────
    print("  Memulai analisis...\n")
    params: dict = {"generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "instruments": {}}

    for inst, notes_map in found.items():
        params["instruments"][inst] = {}
        inst_label = inst.upper()
        if notes_map:
            print(f"  [{inst_label}]")

        for note, wav_path in notes_map.items():
            sys.stdout.write(f"    Menganalisis: {note:<35} ... ")
            sys.stdout.flush()
            try:
                t0     = time.time()
                result = analyze_note(wav_path, inst, note, verbose=args.verbose)
                elapsed = time.time() - t0
                print(f"F0={result['f0_hz']} Hz  ({elapsed:.1f}s)")
                params["instruments"][inst][note] = result
            except Exception as ex:
                print(f"ERROR — {ex}")

        if notes_map:
            print()

    # ── Write JSON ────────────────────────────────────────────────
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(params, f, indent=2, ensure_ascii=False)

    print(f"  Hasil disimpan ke: {output_path}")
    print(f"  {total_found} nada dianalisis dari {total_expected} nada total.\n")

    # ── Per-instrument summary ────────────────────────────────────
    for inst in ("gangsa", "kendang", "suling"):
        inst_data = params["instruments"].get(inst, {})
        if not inst_data:
            continue
        print(f"  {inst.upper()} — ringkasan:")
        for note, data in inst_data.items():
            adsr = data.get("adsr", {})
            ombak_str = f"  ombak={data['ombak_hz']}Hz" if "ombak_hz" in data else ""
            print(f"    {note:<35}  "
                  f"F0={data.get('f0_hz','?'):>7}Hz  "
                  f"att={adsr.get('attack_ms','?'):>5}ms  "
                  f"rel={adsr.get('release_ms','?'):>6}ms"
                  f"{ombak_str}")
        print()

    print("  Selesai. Jalankan backend untuk menggunakan parameter ini.")
    print("=" * 60)


if __name__ == "__main__":
    main()
