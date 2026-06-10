# Gamelan Bali Synthesizer

Gamelan Bali Synthesizer adalah aplikasi interaktif berbasis web yang dibangun menggunakan Vue 3 dan Python (FastAPI). Aplikasi ini bertujuan untuk mereproduksi suara tiga instrumen tradisional Bali — Gangsa, Kendang, dan Suling — melalui kombinasi sampel audio dan sintesis prosedural di sisi klien (Web Audio API).

## Ringkasan Proyek

Proyek ini merupakan karya akademis oleh Kelompok 1, Program Studi Teknik Informatika, Fakultas Matematika dan Ilmu Pengetahuan Alam, Universitas Udayana (2026). Sistem ini menyajikan pengalaman bermain instrumen secara virtual dengan pemodelan akustik yang akurat, pengaturan waktu nyata, serta antarmuka yang responsif.

## Fitur Utama

1. **Sintesis Audio Prosedural & Sampel**
   Sistem mensintesis suara menggunakan *Web Audio API* di peramban tanpa latensi. Karakteristik suara didasarkan pada hasil analisis parameter akustik dari file sampel (dikelola oleh *backend* Python).

2. **Instrumen yang Tersedia**
   - **Gangsa:** Metalofon dengan sepuluh bilah berlaras pelog. Dilengkapi efek detuning (ombak) untuk menciptakan resonansi khas.
   - **Kendang:** Drum bermembran ganda dengan empat jenis pukulan autentik (Tut, Pak, Dag, Dug).
   - **Suling Bali:** Seruling bambu dengan sepuluh nada (lima rendah, lima tinggi). Mensimulasikan hembusan napas dan vibrato.

3. **Penyesuaian Parameter secara Waktu Nyata**
   Pengguna dapat menyesuaikan volume, resonansi, *release*, *attack*, *depth*, *dryness*, hingga intensitas hembusan napas (khusus suling). Efek akan langsung diterapkan pada nada yang dimainkan berikutnya.

4. **Rekaman Sesi (Export WAV)**
   Sesi permainan dapat direkam secara langsung di peramban. Sistem mencampur (*mix*) nada-nada yang dimainkan lalu menyediakannya dalam format berkas audio `.wav` untuk diunduh.

5. **Pengunggahan Sampel Kustom**
   Memungkinkan pengguna mengunggah berkas `.wav` atau `.mp3` ke server untuk digunakan sebagai suara instrumen pengganti pada saat berjalan (*runtime*).

## Struktur Arsitektur

- **Frontend (Vue 3 + Vite):** Mengelola antarmuka pengguna interaktif, menangani interaksi mouse/sentuh/papan ketik, memproses pengaturan audio, serta menjalankan sintesis suara lokal dengan Web Audio API.
- **Backend (Python + FastAPI):** Menjalankan fungsi analisis akustik dari sampel (`api/analyze_samples.py`), melayani endpoint pengambilan sampel, mengurus unggahan sampel kustom, serta mencampur hasil *export* rekaman di sisi server.

## Cara Menjalankan Aplikasi di Lingkungan Lokal

**1. Persiapan Frontend**
Pastikan Node.js telah terinstal, kemudian jalankan:
```bash
npm install
npm run dev
```

**2. Persiapan Backend**
Aplikasi backend membutuhkan Python versi terbaru. Buka terminal baru, masuk ke direktori `api`, pasang dependensi, lalu jalankan server pengembangan:
```bash
cd api
pip install -r requirements.txt
python ../run_api.py
```

Server frontend akan berjalan secara otomatis melalui Vite, dan backend API akan melayani pemintaan pada porta `8000`.

## Kredit

Dikembangkan oleh **Kelompok 1**, Program Studi Teknik Informatika, Fakultas Matematika dan Ilmu Pengetahuan Alam, Universitas Udayana, 2026.
Dibangun dengan Vue 3, Vite, FastAPI, NumPy, SciPy, dan Pydub.
