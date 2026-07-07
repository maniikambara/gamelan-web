#!/usr/bin/env python3
"""
visualize_synthesis.py — Visualisasi hasil sintesis Gamelan Bali Synthesizer

Menggunakan fungsi sintesis yang identik dengan api/index.py (synth_gangsa,
synth_kendang_*, synth_suling) sehingga hasil visualisasi konsisten dengan
audio yang dihasilkan oleh backend, lalu menghasilkan gambar (PNG):

  1. waveform_<instrumen>.png    Bentuk gelombang seluruh nada per instrumen
  2. fft_spectrum_gangsa_dong.png  Spektrum FFT Gangsa nada Dong (261 Hz)
  3. adsr_comparison.png          Perbandingan selubung ADSR antar instrumen
  4. spectrogram_suling.png       Spektrogram nada Suling (vibrato + noise hembusan)
  5. gangsa_partial_ratios.png    Rasio parsial inharmonik: bilah besar vs kecil

Jalankan:
    cd api
    python visualize_synthesis.py

Output tersimpan di api/visualizations/*.png
"""

import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.fft import fft, fftfreq
from scipy.signal import spectrogram

sys.path.insert(0, str(Path(__file__).parent))
from index import (  # noqa: E402
    INSTRUMENTS,
    synth_gangsa, synth_kendang_tengah, synth_kendang_pinggir,
    synth_dag, synth_dug, synth_suling,
    _from_audio,
)

OUT_DIR = Path(__file__).parent / "visualizations"
OUT_DIR.mkdir(exist_ok=True)


def synthesize_all_notes():
    """Sintesis seluruh nada dari ketiga instrumen menggunakan fungsi sintesis backend."""
    results = {}
    for inst, info in INSTRUMENTS.items():
        results[inst] = []
        for note in info["notes"]:
            name, freq, idx = note["name"], note["freq"], note["index"]
            if inst == "gangsa":
                wav = synth_gangsa(freq, note_name=name)
            elif inst == "kendang":
                if idx == 0:
                    wav = synth_kendang_tengah(freq, note_name=name)
                elif idx == 1:
                    wav = synth_kendang_pinggir(freq, note_name=name)
                elif idx == 2:
                    wav = synth_dag(freq, note_name=name)
                else:
                    wav = synth_dug(freq, note_name=name)
            else:
                wav = synth_suling(freq, note_name=name)
            audio, sr = _from_audio(wav)
            results[inst].append((name, freq, audio, sr))
    return results


def plot_all_waveforms(results):
    """Grid waveform seluruh nada, satu gambar per instrumen."""
    for inst, notes in results.items():
        n = len(notes)
        cols = 5
        rows = int(np.ceil(n / cols))
        fig, axes = plt.subplots(rows, cols, figsize=(4 * cols, 2.5 * rows), squeeze=False)
        fig.suptitle(f"Waveform Hasil Sintesis — {INSTRUMENTS[inst]['label']}",
                     fontsize=14, fontweight="bold")
        for i, (name, freq, audio, sr) in enumerate(notes):
            ax = axes[i // cols][i % cols]
            display_len = min(len(audio), int(sr * 1.0))
            t = np.arange(display_len) / sr
            ax.plot(t, audio[:display_len], linewidth=0.5, color="#2b6cb0")
            ax.set_title(f"{name} ({freq:.0f} Hz)", fontsize=9)
            ax.set_xlabel("Waktu (s)", fontsize=7)
            ax.set_ylabel("Amplitudo", fontsize=7)
            ax.tick_params(labelsize=6)
        for j in range(n, rows * cols):
            axes[j // cols][j % cols].axis("off")
        fig.tight_layout(rect=[0, 0, 1, 0.96])
        out = OUT_DIR / f"waveform_{inst}.png"
        fig.savefig(out, dpi=150)
        plt.close(fig)
        print(f"[saved] {out}")


def plot_fft_spectrum_gangsa_dong(results):
    """Spektrum FFT sampel Gangsa nada Dong (261 Hz), menandai puncak parsial inharmonik."""
    name, freq, audio, sr = next(n for n in results["gangsa"] if n[0] == "Dong")
    N = len(audio)
    windowed = audio * np.hanning(N)
    spectrum = np.abs(fft(windowed))[:N // 2]
    freqs = fftfreq(N, 1 / sr)[:N // 2]

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(freqs, spectrum, color="#2b6cb0", linewidth=0.8)
    ax.set_xlim(0, freq * 8)
    ax.set_title(f"Spektrum FFT — Gangsa nada Dong ({freq:.0f} Hz)", fontsize=13, fontweight="bold")
    ax.set_xlabel("Frekuensi (Hz)")
    ax.set_ylabel("Magnitudo")

    ratios = [1.0, 2.76, 5.18]
    labels = ["f0", "2,76·f0", "5,18·f0"]
    ymax = spectrum.max()
    for r, lbl in zip(ratios, labels):
        fr = freq * r
        ax.axvline(fr, color="crimson", linestyle="--", linewidth=0.8, alpha=0.7)
        ax.text(fr, ymax * 0.92, lbl, rotation=90, fontsize=8, color="crimson", va="top")

    fig.tight_layout()
    out = OUT_DIR / "fft_spectrum_gangsa_dong.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"[saved] {out}")


def _adsr_curve_ms(atk, dec, sus, rel, total_ms):
    n = int(total_ms)
    env = np.zeros(n)
    ai, di = int(atk), int(atk + dec)
    env[:min(ai, n)] = np.linspace(0, 1, min(ai, n))
    if ai < min(di, n):
        env[ai:min(di, n)] = np.linspace(1, sus, min(di, n) - ai)
    se = max(di, n - int(rel))
    if di < se:
        env[di:se] = sus
    if se < n:
        env[se:] = np.linspace(sus, 0, n - se)
    return np.arange(n), env


def plot_adsr_comparison():
    """Perbandingan selubung ADSR Gangsa, Kendang Tut, dan Suling."""
    profiles = {
        "Gangsa (attack 12 / decay 100 / sustain 45% / release 2000 ms)": (12, 100, 0.45, 2000, 2200),
        "Kendang Tut (attack 3 / decay 50 / sustain 8% / release 180 ms)": (3, 50, 0.08, 180, 260),
        "Suling (attack 100 / decay 80 / sustain 88% / release 600 ms)": (100, 80, 0.88, 600, 900),
    }
    colors = ["#2b6cb0", "#d69e2e", "#38a169"]

    fig, ax = plt.subplots(figsize=(10, 5))
    for (label, (a, d, s, r, tot)), c in zip(profiles.items(), colors):
        t, env = _adsr_curve_ms(a, d, s, r, tot)
        ax.plot(t, env, label=label, color=c, linewidth=1.5)
    ax.set_title("Perbandingan Selubung ADSR Gangsa dan Suling", fontsize=13, fontweight="bold")
    ax.set_xlabel("Waktu (ms)")
    ax.set_ylabel("Amplitudo relatif")
    ax.legend(fontsize=8, loc="upper right")
    fig.tight_layout()
    out = OUT_DIR / "adsr_comparison.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"[saved] {out}")


def plot_suling_spectrogram(results):
    """Spektrogram nada Suling, menampilkan modulasi vibrato dan noise hembusan."""
    name, freq, audio, sr = results["suling"][4]  # Dong 1, 1024 Hz
    f, t, Sxx = spectrogram(audio, sr, nperseg=2048, noverlap=1536)
    mask = f <= freq * 4

    fig, ax = plt.subplots(figsize=(10, 5))
    pcm = ax.pcolormesh(t, f[mask], 10 * np.log10(Sxx[mask] + 1e-12), shading="auto", cmap="magma")
    ax.set_title(f"Spektrogram — Suling nada {name} ({freq:.0f} Hz)", fontsize=13, fontweight="bold")
    ax.set_xlabel("Waktu (s)")
    ax.set_ylabel("Frekuensi (Hz)")
    fig.colorbar(pcm, ax=ax, label="Intensitas (dB)")
    fig.tight_layout()
    out = OUT_DIR / "spectrogram_suling.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"[saved] {out}")


def plot_gangsa_partial_ratios():
    """Perbandingan rasio parsial Gangsa: bilah nada besar vs bilah nada kecil."""
    besar = [1.0, 2.76, 5.18]
    kecil = [1.0, 2.61, 4.80]
    x = np.arange(3)
    width = 0.35

    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(x - width / 2, besar, width, label="Bilah nada besar (indeks 0-4)", color="#2b6cb0")
    ax.bar(x + width / 2, kecil, width, label="Bilah nada kecil (indeks 5-9)", color="#d69e2e")
    ax.set_xticks(x)
    ax.set_xticklabels(["Parsial 1 (f0)", "Parsial 2", "Parsial 3"])
    ax.set_ylabel("Rasio terhadap f0")
    ax.set_title("Rasio Parsial Inharmonik Gangsa", fontsize=13, fontweight="bold")
    ax.legend(fontsize=9)
    for i, v in enumerate(besar):
        ax.text(i - width / 2, v + 0.1, f"{v:.2f}", ha="center", fontsize=8)
    for i, v in enumerate(kecil):
        ax.text(i + width / 2, v + 0.1, f"{v:.2f}", ha="center", fontsize=8)
    fig.tight_layout()
    out = OUT_DIR / "gangsa_partial_ratios.png"
    fig.savefig(out, dpi=150)
    plt.close(fig)
    print(f"[saved] {out}")


def main():
    print("[1/5] Mensintesis seluruh nada (Gangsa, Kendang, Suling)...")
    results = synthesize_all_notes()

    print("[2/5] Membuat waveform seluruh nada per instrumen...")
    plot_all_waveforms(results)

    print("[3/5] Membuat spektrum FFT Gangsa nada Dong...")
    plot_fft_spectrum_gangsa_dong(results)

    print("[4/5] Membuat perbandingan selubung ADSR...")
    plot_adsr_comparison()

    print("[5/5] Membuat spektrogram Suling dan rasio parsial Gangsa...")
    plot_suling_spectrogram(results)
    plot_gangsa_partial_ratios()

    print(f"\nSelesai. Seluruh visualisasi tersimpan di: {OUT_DIR}")


if __name__ == "__main__":
    main()
