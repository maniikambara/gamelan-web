# Gamelan Bali Synthesizer

Sintetisator interaktif berbasis web yang dibangun dengan VueJS dan Python untuk mereproduksi suara tiga instrumen tradisional Bali yaitu Gangsa, Kendang, dan Suling. Proyek ini menggabungkan pemodelan instrumen autentik dengan antarmuka VueJS dan backend FastAPI Python untuk sintesis audio waktu nyata dan perekaman sesi.

## Ringkasan

Proyek ini merupakan karya akademis oleh Kelompok 1 dari Program Studi Teknik Informatika, Fakultas Matematika dan Ilmu Pengetahuan Alam, Universitas Udayana tahun 2026. Sintetisator ini memberikan pengalaman interaktif yang mendalam terhadap tradisi musik Bali melalui pemodelan akustik yang akurat dan respons visual yang responsif.

## Fitur

### Instrumen

1. Gangsa
Instrumen metalofon mirip silofon dengan sepuluh bilah logam yang diselaraskan dengan laras pelog Bali. Memiliki timbre logam realistis dengan efek penataan nada ombak untuk menciptakan efek resonansi dan denyut suara yang khas.

2. Kendang
Gendang bermembran ganda dengan empat teknik pukulan yaitu pukulan tengah dan pinggir pada muka depan dan belakang. Menghasilkan timbre tonal dan perkusif yang menjadi fondasi ritmis dalam ansambel gamelan Bali.

3. Suling Bali
Seruling bambu dengan enam lubang nada yang dilengkapi dengan artikulasi tiupan halus dan vibrato tipis. Menghasilkan melodi dengan karakter hangat dan organik khas instrumen bambu tradisional. Suling dikonfigurasi dengan sepuluh nada yang terdiri dari lima nada rendah dan lima nada tinggi.

### Kapabilitas Utama

1. Sintesis Sisi Klien
Semua suara disintesis secara instan di peramban menggunakan Web Audio API tanpa latensi. Setiap instrumen memiliki osilator dan filter yang ditala secara cermat mendekati timbre instrumen tradisional Bali.

2. Penyesuaian Parameter Waktu Nyata
Pengguna dapat mengatur karakteristik akustik instrumen seperti resonansi, volume, hembusan nafas, waktu serang, durasi pelepasan, dan efek ombak melalui pengaturan interaktif. Perubahan langsung diterapkan pada nada berikutnya.

3. Perekaman Audio
Sesi bermain dapat direkam dan diunduh dalam format WAV menggunakan pencampuran sisi klien untuk pemutaran ulang yang akurat.

4. Sampel Audio Kustom
Pengguna dapat mengunggah file audio berformat WAV, MP3, OGG, atau FLAC untuk nada tertentu. Sampel yang diunggah akan tersedia di backend untuk alur kerja lanjutan.

5. Umpan Balik Visual
Antarmuka responsif yang menyoroti area interaksi instrumen dan menampilkan nama nada secara waktu nyata.

6. Desain Responsif
Dioptimalkan untuk peramban desktop dan tablet, serta menyesuaikan dengan baik pada layar yang lebih kecil.

## Arsitektur

### Frontend VueJS

Frontend VueJS dirancang sebagai aplikasi satu halaman berbasis komponen yang mengelola antarmuka pengguna dan mensintesis audio langsung di peramban menggunakan Web Audio API.

1. App.vue adalah komponen utama yang mengelola status global seperti instrumen aktif, parameter sintesis, dan nada yang sedang dimainkan.
2. Header.vue menampilkan judul aplikasi, logo, dan nada terakhir yang dimainkan.
3. Sidebar.vue menyediakan navigasi dan pemilihan instrumen.
4. InstrumentPanel.vue adalah antarmuka dinamis yang menampilkan instrumen terpilih.
5. Komponen Instrumen meliputi GangsaPanel, KendangPanel, dan SulingPanel yang mengimplementasikan interaksi pengguna. SulingPanel menampilkan sepuluh tombol nada dan visualisasi lubang yang ditutup.
6. SettingsPanel.vue memuat pengaturan parameter audio.
7. RecordingPanel.vue memuat kontrol perekaman dan pemutaran.

### Backend Python FastAPI

Backend FastAPI menyediakan opsi sintesis audio tingkat lanjut, pengelolaan sampel, dan fungsi ekspor rekaman.

1. Endpoint Sintesis pada rute synthesize dan play_note menghasilkan audio sesuai kebutuhan menggunakan modul NumPy dan SciPy dengan pemrosesan filter tingkat lanjut dan konversi laju sampel.
2. Manajemen Sampel pada rute samples untuk mengunggah dan mengambil sampel audio.
3. Ekspor Rekaman pada rute export_recording mencampur dan mengekspor rangkaian ketukan menjadi file WAV tunggal.
4. Penyimpanan dalam Memori digunakan untuk menyimpan sampel yang diunggah selama masa pakai fungsi server agar pemutaran menjadi cepat.

## Pengembangan Lokal

1. Kloning atau unduh repositori ini ke komputer lokal Anda.
2. Instal dependensi Node menggunakan perintah npm install pada terminal Anda.
3. Jalankan server pengembangan Vite menggunakan perintah npm run dev.
4. Buka terminal baru dan masuk ke direktori api.
5. Instal dependensi Python menggunakan perintah pip install requirements txt pada terminal.
6. Jalankan server backend menggunakan perintah python uvicorn index app pada terminal.
7. Aplikasi siap digunakan dan dikembangkan secara lokal melalui peramban web Anda.

## Kredit

Gamelan Bali Synthesizer oleh Kelompok 1.
Program Studi Teknik Informatika, Fakultas Matematika dan Ilmu Pengetahuan Alam, Universitas Udayana, 2026.
Dibangun dengan memanfaatkan VueJS, Vite, FastAPI, NumPy, dan SciPy.
