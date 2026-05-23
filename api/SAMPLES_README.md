# Gamelan Bali Synthesizer - Default Samples Directory

## Struktur Directory

```
api/
├── samples/
│   ├── gangsa/
│   │   ├── Ding.wav
│   │   ├── Dong.wav
│   │   ├── Deng.wav
│   │   ├── Deung.wav
│   │   ├── Dung.wav
│   │   ├── Dang.wav
│   │   ├── Daing.wav
│   │   ├── Ding².wav
│   │   ├── Dong².wav
│   │   └── Deng².wav
│   ├── kendang/
│   │   ├── Tung Tengah · Muka.wav
│   │   ├── Pak Pinggir · Muka.wav
│   │   ├── Tung Tengah · Belakang.wav
│   │   └── Pak Pinggir · Belakang.wav
│   └── suling/
│       ├── 1 Do.wav
│       ├── 3 Mi.wav
│       ├── 4 Fa.wav
│       ├── 5 Sol.wav
│       ├── 7 Si.wav
│       └── 1 Do (octave).wav
├── index.py
└── SAMPLES_README.md (file ini)
```

## Setup Default Samples

### Untuk Production (Vercel)

1. Siapkan file WAV untuk setiap instrumen sesuai struktur di atas
2. Upload ke `/api/samples/` dalam repository
3. Deploy ke Vercel

### Untuk Local Development

1. Buat folder `api/samples` di dalam project root
2. Tambahkan file WAV sesuai struktur direktori di atas
3. Backend akan secara otomatis memuat default samples saat startup

## Format File

- **Format Audio**: WAV (WAVE PCM 44100 Hz, 16-bit, mono atau stereo)
- **Durasi**: 1-5 detik per sample (akan ter-loop otomatis jika diperlukan)
- **Level Audio**: -12dB sampai -6dB RMS (hindari clipping)

## API Endpoint untuk Samples

### GET /api/samples/{instrument}/{note}
Mengambil sample audio. Backend akan:
1. Cek database in-memory terlebih dahulu
2. Jika tidak ada, cek folder `api/samples/{instrument}/`
3. Jika ada, kembalikan file WAV
4. Jika tidak ada sama sekali, client akan fall-back ke sintesis procedural

### POST /api/samples/{instrument}/{note}
User dapat upload custom sample untuk override default atau menambahkan sample baru

## Catatan Teknis

- Default samples dimuat otomatis pada startup (satu kali)
- Tidak perlu commit file WAV besar ke git — gunakan Git LFS atau exclude dari repo
- Untuk Vercel: pastikan total size semua samples < 50MB (limit function size)
- Client-side synthesis (fallback) akan tetap bekerja jika samples tidak tersedia
