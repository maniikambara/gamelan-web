# Gamelan Bali Synthesizer

Aplikasi web interaktif yang mereproduksi suara tiga instrumen tradisional Bali — Gangsa, Kendang, dan Suling — melalui sintesis prosedural penuh di sisi klien menggunakan Web Audio API. Parameter akustik (harmonik, ombak, envelope) dihasilkan dari analisis sampel audio nyata oleh backend Python dan disimpan dalam `synthesis_params.json`.

## Ringkasan Proyek

Proyek akademis oleh Kelompok 1, Program Studi Informatika, Fakultas Matematika dan Ilmu Pengetahuan Alam, Universitas Udayana, 2026. Sistem menyajikan pengalaman bermain instrumen gamelan secara virtual dengan pemodelan akustik berbasis data, antarmuka interaktif keyboard dan sentuh, serta kemampuan ekspor rekaman sesi ke format WAV.

## Fitur Utama

**Sintesis Audio Prosedural**
Seluruh suara dihasilkan secara real-time di peramban tanpa mengunduh file audio. Engine membaca parameter akustik dari backend (rasio harmonik, frekuensi ombak, ADSR per nada) dan merender suara menggunakan Web Audio API. Jika backend tidak tersedia, engine jatuh ke parameter default yang dikodekan di `audio.js`.

**Instrumen**

Gangsa: metalofon bilah logam dengan sepuluh nada laras pelog selisir. Mensintesis suara menggunakan penjumlahan parsial inharmonik dengan pasangan ombak (detuning). Keyboard Q-P.

Kendang: drum bermembran ganda dengan empat jenis pukulan autentik (Tut, Pak, Dag, Dug). Klik pada area lingkaran untuk memilih zona tengah atau tepi. Keyboard A, S, D, F.

Suling Bali: seruling bambu dengan sepuluh nada pelog dalam dua oktaf. Model suara mencakup tiga harmonik, noise hembusan Gaussian terfilter bandpass, dan vibrato 5.5 Hz. Keyboard 1-0.

**Parameter Real-Time**
Volume, resonansi, release, attack, kedalaman nada (Kendang Tut), kekeringan pukulan (Kendang Pak), intensitas hembusan napas (Suling). Semua perubahan langsung berlaku pada nada berikutnya.

**Rekaman dan Ekspor WAV**
Rekam sesi permainan secara langsung. Sistem me-render ulang seluruh nada secara prosedural dan mencampurnya ke dalam satu track, kemudian mengekspor sebagai file `.wav` yang dapat diunduh.

**Unggah Sampel Kustom**
Upload file `.wav` atau `.mp3` ke endpoint backend untuk menggantikan suara instrumen pada saat runtime.

## Arsitektur Sistem

```
Frontend (Vue 3 + Vite)                    Backend (Python + FastAPI)
┌─────────────────────────────┐            ┌──────────────────────────────┐
│ App.vue                     │  /api/     │ api/index.py                 │
│   Sidebar ── instrument nav │ ─────────▶ │   GET /api/analysis          │
│   InstrumentPanel           │            │   GET /api/instruments       │
│     GangsaPanel             │            │   POST /api/samples/{i}/{n}  │
│     KendangPanel            │            │   GET /api/samples/{i}/{n}   │
│     SulingPanel             │            │   POST /api/synthesize       │
│   SettingsPanel ── sliders  │            │   POST /api/export-recording │
│   RecordingPanel            │            │   GET /api/health            │
│                             │            │                              │
│ audio.js (AudioEngine)      │            │ analyze_samples.py           │
│   Web Audio API synthesis   │            │   analisis FFT sampel audio  │
│   WAV export (offline)      │            │   → synthesis_params.json    │
│   Recording event log       │            │                              │
│ instruments.js              │            │ api/samples/                 │
│   frekuensi, konfigurasi    │            │   gangsa/, kendang/, suling/ │
└─────────────────────────────┘            └──────────────────────────────┘
```

## Model Sintesis

### Gangsa
Penjumlahan aditif parsial inharmonik. Bilah nada besar (indeks 0-4) menggunakan rasio `[1.0, 2.76, 5.18]`; bilah nada kecil (indeks 5-9) menggunakan `[1.0, 2.61, 4.80]`. Ombak diimplementasikan sebagai salinan parsial yang di-detune sebesar `ombak_hz` (default 8 Hz). Resonansi dikontrol melalui peaking EQ terpusat di frekuensi fundamental. ADSR khas: attack 1-12 ms, sustain 40-50%, release dikontrol pengguna.

### Kendang
Empat pukulan dimodelkan terpisah berdasarkan terminologi McGraw (2013):

- **Tut** (kepala lanang, tengah): tonal `sin(2πft) + 0.28·sin(2π·1.5ft)` dicampur noise bandpass, dikontrol parameter `depth`. ADSR 3/50/8%/180 ms.
- **Pak** (kepala lanang, tepi): noise bandpass dikontrol `dryness` dengan komponen transien klik. ADSR 2/18/2%/80 ms.
- **Dag** (kepala wadon, terbuka): pitch-glide menurun dari f0 ke 0.6·f0 dengan lowpass filter. ADSR 5/60/12%/200 ms.
- **Dug** (kepala wadon, dalam): pitch-glide bass lebih curam dari f0 ke 0.5·f0. ADSR 4/40/5%/120 ms.

### Suling Bali
Model tabung bambu silindris, 10 nada pelog selisir dalam dua oktaf (558-2048 Hz). Tiga harmonik (f, 2f@22%, 3f@5%) ditambah noise Gaussian berfilter bandpass (0.7f hingga min(4f, 8000 Hz)) sebagai karakter hembusan. Vibrato 5.5 Hz, kedalaman ±1.2% f0. Attack lembut 100-120 ms, sustain 88%. Resonansi diterapkan sebagai lowpass filter yang menggeser cutoff relatif terhadap frekuensi dasar.

## Cara Menjalankan

### Prasyarat
- Node.js 18 ke atas
- Python 3.10 ke atas
- `ffmpeg` (opsional, untuk dukungan upload MP3)

### Frontend

```bash
npm install
npm run dev
```

Dev server Vite berjalan di `http://localhost:5173`. Semua request ke `/api` di-proxy otomatis ke `http://localhost:8000`.

### Backend

Buka terminal terpisah:

```bash
cd api
pip install -r requirements.txt
cd ..
python run_api.py
```

API berjalan di `http://localhost:8000`. Endpoint `/api/analysis` menyajikan `synthesis_params.json` yang dihasilkan oleh `analyze_samples.py`.

### Menghasilkan Parameter Sintesis dari Sampel

Jika ada sampel audio di `api/samples/{instrument}/`:

```bash
cd api
python analyze_samples.py
```

Output: `api/synthesis_params.json` berisi parameter FFT per nada (f0, rasio harmonik, amplitudo, ombak, ADSR).

### Visualisasi Hasil Sintesis

Skrip `api/visualize_synthesis.py` mensintesis seluruh nada dari ketiga instrumen menggunakan fungsi sintesis yang identik dengan `api/index.py`, lalu menghasilkan grafik analisis akustik dengan matplotlib:

```bash
cd api
python visualize_synthesis.py
```

Output tersimpan di `api/visualizations/`:

- `waveform_gangsa.png`, `waveform_kendang.png`, `waveform_suling.png` — bentuk gelombang seluruh nada per instrumen
- `fft_spectrum_gangsa_dong.png` — spektrum FFT Gangsa nada Dong (261 Hz), menandai puncak parsial inharmonik `[1,0; 2,76; 5,18]`
- `adsr_comparison.png` — perbandingan selubung ADSR antara Gangsa, Kendang (Tut), dan Suling
- `spectrogram_suling.png` — spektrogram nada Suling menampilkan modulasi vibrato dan noise hembusan
- `gangsa_partial_ratios.png` — perbandingan rasio parsial bilah nada besar vs bilah nada kecil

### Build Produksi

```bash
npm run build
```

Output di `dist/`. Untuk deployment ke Vercel, konfigurasi sudah tersedia di `vercel.json`.

## Struktur File

```
gamelan-web/
├── src/
│   ├── App.vue                          # Root komponen, state management
│   ├── audio.js                         # AudioEngine: sintesis, rekaman, WAV export
│   ├── instruments.js                   # Konfigurasi nada, frekuensi, deteksi klik
│   ├── main.js                          # Entry point Vue 3
│   ├── style.css                        # Global styles
│   └── components/
│       ├── Header.vue
│       ├── Sidebar.vue
│       ├── InstrumentPanel.vue          # Router ke panel per instrumen
│       ├── SettingsPanel.vue            # Slider parameter audio
│       ├── RecordingPanel.vue           # Kontrol rekaman + download WAV
│       └── instruments/
│           ├── GangsaPanel.vue          # Bilah gangsa interaktif dengan keyboard
│           ├── KendangPanel.vue         # Dua muka drum dengan canvas hit detection
│           └── SulingPanel.vue          # Canvas suling + tombol nada + visualisasi lubang
├── api/
│   ├── index.py                         # FastAPI: synthesis, sample management, export
│   ├── analyze_samples.py               # FFT analysis → synthesis_params.json
│   ├── visualize_synthesis.py           # Visualisasi matplotlib hasil sintesis (waveform, FFT, ADSR, spektrogram)
│   ├── synthesis_params.json            # Parameter akustik per nada (hasil analisis)
│   ├── requirements.txt                 # Dependensi Python
│   ├── samples/                         # Sampel audio default per instrumen
│   ├── visualizations/                  # Output PNG dari visualize_synthesis.py
│   └── SAMPLES_README.md
├── public/assets/                       # Gambar instrumen (PNG, SVG)
├── assets/                              # Source asset sebelum build
├── vite.config.js                       # Konfigurasi Vite + proxy dev
├── vercel.json                          # Konfigurasi deployment Vercel
└── run_api.py                           # Entry point uvicorn untuk dev
```

## Dependensi

**Frontend**: Vue 3.4, Vite 6.0, @vitejs/plugin-vue 5.0

**Backend**: FastAPI, uvicorn, numpy, scipy, pydub (opsional, untuk MP3), matplotlib (opsional, untuk `visualize_synthesis.py`)

## Kredit

Dikembangkan oleh Kelompok 1, Program Studi Informatika, Fakultas Matematika dan Ilmu Pengetahuan Alam, Universitas Udayana, 2026.
