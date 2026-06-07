# Gamelan Bali Synthesizer

Sintetisator interaktif berbasis web yang dibangun dengan Vue.js dan Python untuk mereproduksi suara tiga instrumen tradisional Bali: Gangsa, Kendang, dan Suling. Proyek ini menggabungkan pemodelan instrumen autentik dengan antarmuka Vue.js dan backend FastAPI Python untuk sintesis audio waktu nyata dan perekaman sesi.

## Ringkasan

Proyek ini merupakan karya akademis oleh Kelompok 1 dari Program Studi Teknik Informatika, Fakultas Matematika dan Ilmu Pengetahuan Alam, Universitas Udayana (2026). Sintetisator ini memberikan pengalaman interaktif yang mendalam terhadap tradisi musik Bali melalui pemodelan akustik yang akurat dan respons visual yang responsif.

## Fitur

### Instrumen

**Gangsa** — Instrumen metalofon mirip silofon dengan sepuluh bilah logam yang diselaraskan dengan laras pelog Bali. Memiliki timbre logam realistis dengan efek penataan nada (ombak) untuk menciptakan efek resonansi dan denyut suara yang khas.

**Kendang** — Gendang bermembran ganda dengan empat teknik pukulan: pukulan tengah dan pinggir pada muka depan dan belakang. Menghasilkan timbre tonal dan perkusif yang menjadi fondasi ritmis dalam ansambel gamelan Bali.

**Suling Bali** — Seruling bambu dengan enam lubang nada yang dilengkapi dengan artikulasi tiupan halus dan vibrato tipis. Menghasilkan melodi dengan karakter hangat dan organik khas instrumen bambu tradisional.

### Kapabilitas Utama

- **Sintesis Sisi Klien** — Semua suara disintesis secara instan di peramban menggunakan Web Audio API tanpa latensi. Setiap instrumen memiliki osilator dan filter yang ditala secara cermat mendekati timbre instrumen tradisional Bali.
- **Penyesuaian Parameter Waktu Nyata** — Pengguna dapat mengatur karakteristik akustik instrumen seperti resonansi, volume, hembusan nafas, waktu serang (attack), durasi pelepasan (release), dan efek ombak melalui slider interaktif. Perubahan langsung diterapkan pada nada berikutnya.
- **Perekaman Audio** — Sesi bermain dapat direkam dan diunduh dalam format WAV menggunakan pencampuran sisi klien untuk pemutaran ulang yang akurat.
- **Sampel Audio Kustom** — Pengguna dapat mengunggah file audio berformat WAV, MP3, OGG, atau FLAC untuk nada tertentu. Sampel yang diunggah akan tersedia di backend untuk alur kerja lanjutan.
- **Umpan Balik Visual** — Antarmuka responsif yang menyoroti area interaksi instrumen dan menampilkan nama nada secara waktu nyata.
- **Desain Responsif** — Dioptimalkan untuk peramban desktop dan tablet, serta menyesuaikan dengan baik pada layar yang lebih kecil.

## Struktur Proyek

```text
gamelan-web/
├── public/                 # Aset statis
│   ├── index.html         # Titik masuk HTML
│   ├── logo.svg           # Logo aplikasi
│   ├── gangsa.png         # Gambar instrumen Gangsa
│   ├── kendang.png        # Gambar instrumen Kendang
│   ├── suling.png         # Gambar instrumen Suling
│   └── snare.png          # Referensi zona pukul snare Kendang
├── src/                    # Kode sumber Vue.js
│   ├── main.js            # Titik masuk aplikasi
│   ├── App.vue            # Komponen utama dengan manajemen status
│   ├── style.css          # Gaya global
│   ├── instruments.js     # Definisi instrumen dan deteksi zona pukul
│   ├── audio.js           # Klien API untuk sintesis sisi backend dan perekaman
│   └── components/        # Komponen Vue
│       ├── Header.vue         # Header dengan judul dan tampilan nada
│       ├── Sidebar.vue        # Navigasi instrumen
│       ├── InstrumentPanel.vue    # Router tampilan instrumen utama
│       ├── SettingsPanel.vue      # Kontrol parameter audio
│       ├── RecordingPanel.vue     # Kontrol perekaman dan pemutaran
│       ├── SampleUpload.vue       # Antarmuka unggah file sampel
│       └── instruments/       # Panel spesifik instrumen
│           ├── GangsaPanel.vue    # Tampilan interaktif Gangsa
│           ├── KendangPanel.vue   # Antarmuka kendang ganda
│           └── SulingPanel.vue    # Selektor lubang suling
├── api/                    # Backend Python FastAPI
│   ├── index.py           # Server FastAPI dengan endpoint sintesis
│   ├── requirements.txt    # Dependensi Python
│   └── samples/           # Direktori sampel default (opsional)
│       ├── gangsa/        # Sampel nada Gangsa
│       ├── kendang/       # Sampel suara Kendang
│       └── suling/        # Sampel nada Suling
├── vite.config.js         # Konfigurasi build Vite
├── vercel.json            # Konfigurasi penyebaran Vercel
├── package.json           # Dependensi Node.js
└── README.md              # File ini
```

## Arsitektur

### Frontend (Vue.js 3)

Frontend Vue.js dirancang sebagai aplikasi satu halaman berbasis komponen yang mengelola antarmuka pengguna dan mensintesis audio langsung di peramban menggunakan Web Audio API.

- **App.vue** — Komponen utama yang mengelola status global (instrumen aktif, parameter sintesis, nada yang sedang dimainkan).
- **Header.vue** — Menampilkan judul aplikasi, logo, dan nada terakhir yang dimainkan.
- **Sidebar.vue** — Navigasi dan pemilihan instrumen.
- **InstrumentPanel.vue** — Router komponen dinamis yang menampilkan antarmuka instrumen terpilih.
- **Komponen Instrumen** — GangsaPanel, KendangPanel, dan SulingPanel mengimplementasikan deteksi ketukan berbasis kanvas dan pemicu nada.
- **SettingsPanel.vue** — Slider parameter untuk kustomisasi instrumen (resonansi, volume, hembusan, attack, release, dll).
- **RecordingPanel.vue** — Kontrol untuk merekam sesi dan mengunduh file WAV.
- **SampleUpload.vue** — Antarmuka unggah untuk sampel audio eksternal.
- **audio.js** — Mesin sintesis Web Audio API dengan osilator dan filter terkalibrasi untuk setiap instrumen, serta menangani perekaman dan pencampuran sisi klien.

### Backend (Python FastAPI)

Backend FastAPI menyediakan opsi sintesis audio tingkat lanjut, pengelolaan sampel, dan fungsi ekspor rekaman:

- **Endpoint Sintesis** — `/api/synthesize` dan `/api/play-note` menghasilkan audio sesuai kebutuhan menggunakan NumPy dan SciPy dengan pemrosesan filter tingkat lanjut dan konversi laju sampel.
- **Manajemen Sampel** — `/api/samples/{instrument}/{note}` untuk mengunggah dan mengambil sampel audio.
- **Ekspor Rekaman** — `/api/export-recording` mencampur dan mengekspor rangkaian ketukan menjadi file WAV tunggal.
- **Metadata** — `/api/instruments` mengembalikan daftar instrumen beserta nada, dan `/api/health` untuk pemeriksaan status server.
- **Penyimpanan dalam Memori** — Sampel yang diunggah akan disimpan dalam cache memori selama masa pakai fungsi serverless untuk memastikan pemutaran cepat.

### Arsitektur Sintesis

**Sisi Klien (Web Audio API)** — Mesin audio utama mensintesis suara secara langsung di peramban untuk menghasilkan pemutaran tanpa latensi:

**Gangsa** — Lima osilator dengan rasio inharmonis [1.0, 2.756, 5.404, 8.933, 13.35] digunakan untuk membentuk karakter suara logam. Salinan yang ditata ulang (detuned) dicampur pada amplitudo rendah untuk menghasilkan efek ombak (denyut suara). Filter bandpass digunakan untuk memperkuat frekuensi fundamental.

**Kendang Tengah (Tung)** — Osilator bernada dipadukan dengan derau (noise) yang disaring highpass untuk resonansi rongga gendang. Frekuensi nada menurun secara eksponensial untuk menciptakan efek penurunan nada yang khas.

**Kendang Pinggir (Pak)** — Derau disaring highpass dengan komponen klik yang meluruh secara eksponensial untuk meniru serangan pukulan tajam pada tepi kulit kendang.

**Suling Bali** — Osilator sinus dengan amplop attack lambat untuk meniru permulaan tiupan nafas. Derau tiupan opsional ditambahkan untuk meningkatkan realisme.

**Sisi Server (NumPy/SciPy, Opsional)** — Digunakan untuk alur kerja tingkat lanjut:

**Gangsa** — Lima parsial inharmonis pada rasio [1.0, 2.756, 5.404, 8.933, 13.35] membentuk suara logam. Salinan dengan frekuensi ombak (bawaan 6 Hz) dicampur pada amplitudo lebih rendah. Filter resonansi bandpass memperkuat frekuensi fundamental.

**Kendang Tengah (Tung)** — Komponen sinus bernada (fundamental) dipadukan dengan derau tersaring bandpass untuk resonansi badan gendang. Parameter kedalaman mengontrol keseimbangan antara karakter tonal dan desis derau.

**Kendang Pinggir (Pak)** — Derau tersaring bandpass dipadukan dengan gelombang kotak klik yang meluruh secara eksponensial. Parameter kekeringan (dryness) mengontrol proporsi antara klik dan resonansi.

**Suling Bali** — Tiga harmonik (fundamental, 2x, 3x) dengan amplop amplitudo yang dikontrol oleh waktu attack. Derau tiupan nafas (disaring bandpass pada 1.5x fundamental) ditambahkan untuk hasil yang lebih alami.

Semua proses sintesis menggunakan amplop ADSR (Attack, Decay, Sustain, Release) yang dikalibrasi sesuai dengan karakteristik fisik asli masing-masing instrumen.

## Memulai

### Prasyarat

- Node.js versi 18 ke atas dan npm (untuk pengembangan frontend dan build)
- Python versi 3.8 ke atas (untuk menjalankan server backend secara lokal)
- Peramban web modern dengan dukungan Web Audio API

### Pengembangan Lokal

1. Kloning atau unduh repositori ini.

2. Instal dependensi Node.js:

   ```bash
   npm install
   ```

3. Jalankan server pengembangan Vite:

   ```bash
   npm run dev
   ```

   Frontend sekarang dapat diakses melalui alamat `http://localhost:5173`.

4. Di terminal terpisah, jalankan server Python backend:

   ```bash
   cd api
   pip install -r requirements.txt
   python -m uvicorn index:app --host 0.0.0.0 --port 8000 --reload
   ```

   Backend API sekarang berjalan di `http://localhost:8000`.

5. Buka `http://localhost:5173` di peramban Anda. Server pengembangan secara otomatis mengarahkan permintaan `/api/*` ke backend pada port 8000.

### Membangun untuk Produksi

Membangun frontend Vue.js untuk siap dirilis:

```bash
npm run build
```

Hasil kompilasi akan diletakkan di direktori `dist/`. Untuk deployment menggunakan Vercel, file konfigurasi `vercel.json` sudah disiapkan untuk mengompilasi dan menyebarkan frontend serta backend secara otomatis.

## Penggunaan

### Memainkan Instrumen

1. Pilih instrumen dari sidebar kiri (Gangsa, Kendang, atau Suling Bali).
2. Klik pada gambar instrumen untuk memicu suara:
   - **Gangsa**: Klik pada bilah logam; terdeteksi berdasarkan posisi horizontal.
   - **Kendang**: Klik pada muka drum; bagian tengah (Tung) dan pinggir (Pak) ditentukan berdasarkan jarak klik dari titik tengah.
   - **Suling**: Klik pada salah satu dari enam lubang nada.

### Mengatur Parameter Suara

Gunakan slider di panel "Pengaturan Suara" di sebelah kanan untuk menyesuaikan karakter suara. Perubahan diterapkan langsung pada ketukan berikutnya. Parameter disimpan selama sesi berlangsung, namun akan diatur ulang saat halaman dimuat kembali.

**Parameter yang tersedia:**

- **Volume** — Tingkat kekuatan suara output utama
- **Resonansi** — Penguatan pada frekuensi fundamental
- **Parameter Gangsa**:
  - Ombak (Detuning) — Pergeseran frekuensi untuk efek denyut suara
  - Release (ms) — Durasi peluruhan ekor suara setelah bilah dipukul
- **Parameter Kendang**:
  - Kedalaman Tung — Keseimbangan antara karakter tonal dan desis pada bagian tengah
  - Kekeringan Pak — Keseimbangan antara suara klik tajam dan resonansi kulit tepi
- **Parameter Suling**:
  - Hembusan Nafas — Intensitas derau tiupan nafas
  - Attack (ms) — Waktu yang dibutuhkan untuk mencapai volume maksimal

### Perekaman Sesi

1. Klik tombol "Mulai Rekam" untuk mulai merekam permainan Anda.
2. Mainkan instrumen seperti biasa; semua audio sintesis akan ditangkap.
3. Klik tombol "Hentikan Rekaman" untuk menyelesaikan perekaman.
4. Putar ulang hasil rekaman atau unduh file berformat WAV langsung dari peramban.
5. Klik "Hapus Rekaman" jika ingin menghapus hasil sebelumnya dan memulai sesi baru.

### Mengunggah Sampel Kustom

1. Pada bagian "Upload Sampel Audio", pilih nada yang ingin diganti dari dropdown menu.
2. Klik tombol "Pilih atau seret file" lalu pilih file WAV, MP3, OGG, atau FLAC Anda.
3. Sampel audio akan diunggah ke backend dan disimpan sementara dalam memori.
4. Nada tersebut akan menggunakan sampel baru Anda saat dimainkan, menggantikan suara sintesis.
5. Muat ulang halaman peramban untuk kembali menggunakan suara sintesis standar.

### Sampel Default (Opsional)

Untuk mengatur sampel bawaan pada server:

1. Siapkan struktur folder di dalam `api/samples/`:

   ```text
   api/samples/
   ├── gangsa/
   │   ├── Ding.wav, Dong.wav, Deng.wav, Deung.wav, Dung.wav,
   │   ├── Dang.wav, Daing.wav, Ding².wav, Dong².wav, Deng².wav
   ├── kendang/
   │   ├── Tung Tengah · Muka.wav
   │   ├── Pak Pinggir · Muka.wav
   │   ├── Tung Tengah · Belakang.wav
   │   └── Pak Pinggir · Belakang.wav
   └── suling/
       ├── 1 Do.wav, 3 Mi.wav, 4 Fa.wav, 5 Sol.wav, 7 Si.wav
       └── 1 Do (oktaf).wav
   ```

2. Server backend akan memuat sampel ini secara otomatis saat startup.
3. Sampel akan disimpan dalam memori cache untuk mempercepat akses pemutaran.
4. Jika file sampel tidak ditemukan, sintetisator akan otomatis beralih menggunakan sintesis prosedural.

## Penyebaran

### Vercel (Direkomendasikan)

Proyek ini telah dikonfigurasi untuk penyebaran tanpa server (serverless) di Vercel.

1. Unggah repositori Anda ke GitHub.
2. Hubungkan repositori tersebut melalui dasbor Vercel.
3. Vercel secara otomatis mendeteksi konfigurasi dan menyebarkan frontend serta backend Anda.
4. Aplikasi dapat diakses langsung melalui URL proyek Vercel Anda.

### Hosting Mandiri

Untuk menjalankan aplikasi pada server mandiri:

1. Bangun proyek frontend: `npm run build`
2. Sebarkan folder `dist/` sebagai situs web statis di server web Anda.
3. Jalankan backend Python menggunakan perintah:

   ```bash
   python -m uvicorn api.index:app --host 0.0.0.0 --port 8000
   ```

## Kompatibilitas Peramban

- **Chrome / Chromium** — Didukung penuh
- **Firefox** — Didukung penuh
- **Safari 14+** — Didukung penuh
- **Edge** — Didukung penuh

Aplikasi memerlukan dukungan Web Audio API dan JavaScript yang aktif pada peramban.

## Kinerja

Web Audio API pada frontend menyediakan sintesis audio instan tanpa latensi secara langsung di peramban. Aplikasi ini telah diuji pada peramban desktop dan tablet modern, menunjukkan performa stabil saat memainkan beberapa instrumen sekaligus sembari melakukan perekaman. Semua respons tombol dan pemutaran nada bekerja tanpa jeda transmisi jaringan.

Sintesis backend opsional (untuk pemrosesan lanjutan) umumnya diselesaikan dalam waktu 50 hingga 200 ms, tergantung pada beban server serta kecepatan kompilasi pustaka NumPy dan SciPy.

## Pemecahan Masalah

**Tidak ada suara yang keluar** — Periksa apakah peramban Anda mendukung Web Audio API. Peramban modern umumnya meminta interaksi pengguna pertama kali sebelum mengizinkan pemutaran audio. Klik sekali pada salah satu bagian instrumen untuk mengaktifkan konteks audio. Periksa log konsol peramban untuk melihat kesalahan yang terjadi.

**Fungsi perekaman tidak berjalan** — Beberapa peramban membatasi perekaman audio karena alasan keamanan. Pastikan izin akses audio telah diizinkan pada pengaturan peramban Anda.

**Gagal mengunggah sampel** — Pastikan format file didukung (WAV, MP3, OGG, atau FLAC) dan pastikan nada telah dipilih di dropdown menu sebelum mengunggah file. Pastikan server backend berjalan pada rute `/api/samples/` jika ingin memutar sampel sisi server.

**Layanan backend tidak merespons** — Jika Anda menggunakan sintesis sisi server, periksa kembali apakah server uvicorn telah aktif menggunakan perintah `python -m uvicorn api.index:app --host 0.0.0.0 --port 8000`. Saat pertama kali dijalankan di Vercel, fungsi serverless mungkin membutuhkan beberapa detik tambahan untuk inisialisasi awal (cold start).

## Pengembangan Masa Depan

Beberapa rencana pengembangan fitur selanjutnya:

- Dukungan input instrumen MIDI untuk kontroler eksternal.
- Sistem preset untuk menyimpan dan memuat konfigurasi suara instrumen.
- Penggabungan beberapa instrumen dan fitur pengurut nada (sequencer).
- Peningkatan sensitivitas gestur sentuhan untuk perangkat seluler.
- Penambahan instrumen gamelan Bali lainnya seperti Reyong dan Ugal.
- Analisis spektral dan visualisasi bentuk gelombang secara waktu nyata.
- Peningkatan kualitas pemrosesan sampel suara dengan pemrosesan spektral.

## Kredit

Gamelan Bali Synthesizer — Kelompok 1
Program Studi Teknik Informatika
Fakultas Matematika dan Ilmu Pengetahuan Alam, Universitas Udayana
2026

Dibangun dengan memanfaatkan Vue.js 3, Vite, FastAPI, NumPy, dan SciPy.

## Lisensi

Proyek ini disediakan apa adanya untuk kepentingan akademis, penelitian, dan pembelajaran edukatif.
