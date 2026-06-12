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

## Model Sintesis Instrumen

### 1. Sintesis Instrumen Gangsa
Sintesis Gangsa pada backend menggunakan penjumlahan aditif parsial inharmonik yang mencerminkan karakter akustik bronzephone gamelan Bali. Berdasarkan penelitian Jones et al. (Journal of the Acoustical Society of America, 2010), rasio parsial bilah gangsa bervariasi per register: untuk nada besar (bilah rendah) digunakan rasio [1.0, 2.76, 5.18] hingga lebih banyak parsial, sedangkan bilah nada kecil (tinggi) memiliki lebih sedikit parsial [1.0, 2.61, 4.80]. Parameter ombak diimplementasikan sebesar default 8 Hz (rentang 5-10 Hz sesuai data Toth Archives, Vitale & Sethares 2021) dengan mencampurkan salinan frekuensi yang di-detune sebesar nilai ombak. Octave stretching sebesar +8 hingga +12 cents diterapkan pada nada kecil agar ombak tetap konstan di seluruh rentang. Filter bandpass IIR orde pertama diterapkan di sekitar frekuensi fundamental untuk menambah resonansi.

Ketika pengguna mengklik salah satu bilah Gangsa, sistem akan menghasilkan suara berdasarkan frekuensi nada yang sudah ditentukan sebelumnya. Selain itu, sistem juga memberikan efek sustain dan resonansi agar suara terdengar lebih mirip dengan instrumen aslinya. Karakteristik sintesis Gangsa:
- **Attack sangat cepat:** 1–5 ms (mallet/panggul keras menghasilkan attack terang).
- **Decay:** 80–150 ms, sustain 40–50% (bilah bronzephone beresonansi bebas hingga 4 detik jika tidak diredam).
- **Release:** dikontrol pengguna melalui slider damping (simulasi teknik tangan meredam bilah).
- **Efek ombak:** frekuensi denyutan konstan 8 Hz (default; slider 5–10 Hz) pada seluruh pasangan bilah pengisep-pengumbang, dijaga konstan agar karakteristik ombak autentik terhadap semua register.

### 2. Sintesis Instrumen Kendang
Sintesis Kendang Bali menggunakan terminologi pukulan autentik berdasarkan glossary Andrew McGraw (Balinese Music Glossary, 2013). Terdapat empat jenis pukulan yang dimodelkan: Tut (pukulan tengah kepala kecil lanang, nada tinggi tonal), Pak (pukulan tepi/slap kepala lanang, karakter tajam impulsif), Dag (pukulan terbuka kepala besar wadon, nada rendah resonan), Dug (pukulan dalam kepala wadon, nada sangat rendah). Tut dan Pak disintesiskan dengan campuran komponen tonal sin(2πft) + 0.4·sin(2π·1.5ft) dengan noise Gaussian yang difilter bandpass dari 0.4f hingga 2.2f (parameter depth/dryness mengontrol perbandingan). Dag dan Dug menggunakan komponen tonal dominan dengan pitch-glide menurun yang mencirikan membran besar yang meluruh setelah dipukul.

Tut menghasilkan suara nada tinggi yang jernih (ADSR: 3ms/50ms/8%/180ms). Pak menghasilkan suara tajam impulsif seperti slap (ADSR: 2ms/18ms/2%/80ms). Dag menghasilkan suara rendah dan resonan (ADSR: 5ms/60ms/12%/200ms). Dug menghasilkan suara bass paling dalam (ADSR: 4ms/40ms/5%/120ms).
- **Attack sangat cepat:** 2–5 ms (karakteristik instrumen perkusi membran).
- **Sustain sangat pendek:** 2–12% (sesuai karakter perkusif, suara langsung meluruh).
- **Karakter suara:** Tut/Pak bersifat perkusif tonal (kepala lanang/kecil); Dag/Dug bersifat perkusif bass resonan (kepala wadon/besar).
- **Release:** dikontrol pengguna melalui slider parameter; Dag/Dug memiliki release lebih panjang untuk suara resonan wadon.

### 3. Sintesis Instrumen Suling Bali
Sintesis Suling Bali menggunakan model akustik tabung bambu silindris dalam laras pelog selisir. Berdasarkan revisi yang dilakukan menggunakan referensi video YouTube sebagai patokan akustik, sistem kini mendukung 10 nada dalam dua oktaf pelog selisir: Deng 1 (558 Hz), Dung 1 (621 Hz), Dang 1 (764 Hz), Ding 1 (800 Hz), Dong 1 (1024 Hz) untuk oktaf pertama; Deng 2 (1116 Hz), Dung 2 (1242 Hz), Dang 2 (1528 Hz), Ding 2 (1600 Hz), Dong 2 (2048 Hz) untuk oktaf kedua. Frekuensi-frekuensi ini menggunakan interval pelog selisir yang sama dengan gangsa, sehingga suling dan gangsa selaras dalam satu sistem pelog. Model suara menggunakan tiga komponen harmonik (fundamental f, 2f dengan amplitudo 22%, 3f dengan amplitudo 5%) ditambah noise hembusan Gaussian yang difilter bandpass dari 0,7f hingga min(4f, 8.000 Hz) dengan standar deviasi 0,18.
- **Attack lembut:** 100–120 ms (karakteristik instrumen tiup bambu end-blown dengan embouchure halus).
- **Sustain panjang:** 88% (nada dipertahankan selama ditiup).
- **Tiga harmonik:** fundamental (f), oktaf kedua (2f, 22%), twelfth/duodecim (3f, 5%) — mencirikan bore silindris bambu.
- **Noise hembusan:** σ = 0,18, filter bandpass Gaussian dari 0,7f hingga min(4f, 8.000 Hz); suling bambu memiliki karakter breathy yang khas dibanding flute Barat. Intensitas noise dikontrol parameter breath yang tersedia di panel pengaturan.

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
