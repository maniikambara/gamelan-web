# Gamelan Bali Synthesizer

A web-based interactive synthesizer built with Vue.js and Python that recreates the sounds of three traditional Balinese instruments: Gangsa, Kendang, and Suling. The synthesizer combines authentic instrument modeling with an interactive Vue.js frontend and a Python FastAPI backend for real-time audio synthesis and recording.

## Overview

This project is an academic work by Group 1 from the Department of Computer Science, Faculty of Mathematics and Natural Sciences, Udayana University (2026). The synthesizer provides an immersive, interactive experience of Balinese musical tradition through accurate acoustic modeling and responsive visual feedback.

## Features

### Instruments

**Gangsa** — A metallic xylophone-like instrument with ten metal bars tuned to the Balinese pelog scale. Features realistic metallic timbre with detuning effects (ombak) that create characteristic beating and resonance effects.

**Kendang** — A two-faced drum with four distinct playing techniques: center and rim strikes on both front and back faces. Produces tonal and percussive timbres that serve as the rhythmic foundation in Balinese ensembles.

**Suling Bali** — A six-hole bamboo flute with gentle breath articulation and subtle vibrato. Produces melodic lines with the warm, organic character of traditional bamboo instruments.

### Core Capabilities

- **Client-side Synthesis** — All sounds are synthesized instantly in the browser using the Web Audio API with zero latency. Each instrument has carefully tuned oscillators and filters to approximate traditional Balinese instrument timbre.
- **Real-time Parameter Adjustment** — Fine-tune each instrument's acoustic characteristics (resonance, gain, breath intensity, attack time, release duration, detuning effects) via interactive sliders. Changes apply immediately to the next note.
- **Audio Recording** — Record entire sessions and download as WAV format with client-side synthesis and mixing for accurate playback.
- **Custom Audio Samples** — Upload WAV, MP3, OGG, or FLAC audio files for any note. Uploaded samples are available on the backend for advanced workflows.
- **Visual Feedback** — Click-responsive overlays highlight playing zones and display note names in real-time.
- **Responsive Design** — Optimized for desktop and tablet browsers; adapts gracefully to smaller screens.

## Project Structure

```text
gamelan-web/
├── public/                 # Static assets
│   ├── index.html         # HTML entry point
│   ├── logo.svg           # Application logo
│   ├── gangsa.png         # Gangsa instrument image
│   ├── kendang.png        # Kendang instrument image
│   ├── suling.png         # Suling instrument image
│   └── snare.png          # Kendang snare hit-zone reference
├── src/                    # Vue.js source code
│   ├── main.js            # Application entry point
│   ├── App.vue            # Root component with state management
│   ├── style.css          # Global styles
│   ├── instruments.js     # Instrument definitions and hit-zone detection
│   ├── audio.js           # API client for backend synthesis and recording
│   └── components/        # Vue components
│       ├── Header.vue         # Header with title and note display
│       ├── Sidebar.vue        # Instrument navigation
│       ├── InstrumentPanel.vue    # Main instrument display router
│       ├── SettingsPanel.vue      # Audio parameter controls
│       ├── RecordingPanel.vue     # Recording controls and playback
│       ├── SampleUpload.vue       # Sample file upload interface
│       └── instruments/       # Instrument-specific panels
│           ├── GangsaPanel.vue    # Interactive gangsa display
│           ├── KendangPanel.vue   # Dual-drum interface
│           └── SulingPanel.vue    # Flute hole selector
├── api/                    # Python FastAPI backend
│   ├── index.py           # FastAPI server with synthesis endpoints
│   ├── requirements.txt    # Python dependencies
│   └── samples/           # [OPTIONAL] Default sample directory
│       ├── gangsa/        # Gangsa note samples
│       ├── kendang/       # Kendang sound samples
│       └── suling/        # Suling note samples
├── vite.config.js         # Vite build configuration
├── vercel.json            # Vercel deployment configuration
├── package.json           # Node.js dependencies
└── README.md              # This file
```

## Architecture

### Frontend (Vue.js 3)

The Vue.js frontend is a component-based single-page application that manages the user interface and synthesizes audio entirely in the browser using the Web Audio API.

- **App.vue** — Root component that manages global state (current instrument, synthesis parameters, currently playing note)
- **Header.vue** — Displays application title, logo, and last played note
- **Sidebar.vue** — Instrument navigation and selection
- **InstrumentPanel.vue** — Dynamic component router that displays the selected instrument interface
- **Instrument Components** — GangsaPanel, KendangPanel, SulingPanel implement canvas-based hit detection and note triggering
- **SettingsPanel.vue** — Parameter sliders for instrument customization (resonance, gain, breath, attack, release, etc.)
- **RecordingPanel.vue** — Controls for recording sessions and downloading WAV files
- **SampleUpload.vue** — File upload interface for audio samples
- **audio.js** — Web Audio API synthesis engine with tuned oscillators and filters for each instrument; handles recording and client-side mixing

### Backend (Python FastAPI)

The FastAPI backend provides optional advanced audio synthesis, sample management, and recording export capabilities:

- **Synthesis Endpoints** — `/api/synthesize` and `/api/play-note` generate audio on-demand using NumPy and SciPy with sophisticated filtering and sample rate conversion
- **Sample Management** — `/api/samples/{instrument}/{note}` for uploading and retrieving audio samples
- **Recording Export** — `/api/export-recording` mixes and exports recorded synthesis events to WAV
- **Metadata** — `/api/instruments` returns instrument and note definitions, `/api/health` for health checks
- **In-Memory Caching** — Uploaded samples are cached during the serverless function lifetime for fast playback

### Synthesis Architecture

**Frontend (Web Audio API)** — The primary audio engine uses the Web Audio API to synthesize all sounds directly in the browser, providing zero-latency playback:

**Gangsa** — Five oscillators at inharmonic ratios [1.0, 2.756, 5.404, 8.933, 13.35] create the metallic ring. A detuned copy is mixed at lower amplitude to produce beating (ombak) effects. A bandpass filter emphasizes the fundamental frequency.

**Kendang Tengah (Center)** — A pitched oscillator combined with highpass-filtered noise for body resonance. Pitch decays exponentially to create the characteristic pitch-drop effect.

**Kendang Pinggir (Rim)** — Highpass-filtered noise with an exponentially decaying click component, creating the sharp percussive attack.

**Suling Bali** — A sine oscillator with a slow attack envelope to simulate breath onset. Optional breath noise adds realism.

**Backend (NumPy/SciPy, Optional)** — Available for advanced workflows:

**Gangsa** — Five inharmonic partials at ratios [1.0, 2.756, 5.404, 8.933, 13.35] create the metallic ring. A detuned copy (ombak frequency, default 6 Hz) is mixed at lower amplitude to produce beating effects. Bandpass resonance filter emphasizes the fundamental.

**Kendang Tengah (Center)** — A pitched sine component (fundamental) combined with bandpass-filtered noise for body resonance. The depth parameter blends between tonal and noisy character.

**Kendang Pinggir (Rim)** — Highpass-filtered noise with an exponentially decaying square wave click. The dryness parameter controls the balance between click and resonance.

**Suling Bali** — Three harmonics (fundamental, 2x, 3x) with amplitude envelope controlled by attack time. Optional breath noise (bandpass-filtered at 1.5x fundamental) adds realism.

All synthesis uses ADSR (Attack-Decay-Sustain-Release) envelopes calibrated to the physical characteristics of each instrument.

## Getting Started

### Prerequisites

- Node.js 18+ and npm (for frontend development and building)
- Python 3.8+ (for running the backend locally)
- Modern web browser with Web Audio API support

### Local Development

1. Clone or download the repository.

2. Install Node.js dependencies:

   ```bash
   npm install
   ```

3. Start the Vite development server:

   ```bash
   npm run dev
   ```

   The frontend is now accessible at `http://localhost:5173`.

4. In a separate terminal, start the Python backend:

   ```bash
   cd api
   pip install -r requirements.txt
   python -m uvicorn index:app --host 0.0.0.0 --port 8000 --reload
   ```

   The backend API is now available at `http://localhost:8000`.

5. Open `http://localhost:5173` in your browser and begin playing instruments. The development server automatically proxies `/api/*` requests to the backend on port 8000.

### Building for Production

Build the Vue.js frontend for production:

```bash
npm run build
```

The compiled frontend is output to the `dist/` directory. For Vercel deployment, the `vercel.json` configuration automatically builds and deploys both the frontend and backend.

## Usage

### Playing Instruments

1. Select an instrument from the left sidebar (Gangsa, Kendang, or Suling).
2. Click on the displayed instrument image to trigger sounds:
   - **Gangsa**: Click on any metal bar; detected by horizontal position.
   - **Kendang**: Click on the drum face; center (Tung) vs. rim (Pak) based on distance from center.
   - **Suling**: Click on any of the six finger holes.

### Adjusting Sound Parameters

Use the sliders in the "Pengaturan Suara" (Sound Settings) panel on the right to fine-tune each instrument's characteristics. Changes apply immediately to the next note played. Parameters persist during the session but reset on page reload.

**Available parameters:**

- **Volume** — Master output level
- **Resonance** — Emphasis on fundamental frequency
- **Gangsa-Specific**:
  - Ombak (Detuning) — Frequency offset for beating effects
  - Release (ms) — Duration of decay tail
- **Kendang-Specific**:
  - Depth — Blend between tonal and noisy character (Tung)
  - Dryness — Balance between click and resonance (Pak)
- **Suling-Specific**:
  - Breath — Intensity of breath noise
  - Attack (ms) — Time to reach full volume

### Recording Sessions

1. Click "Mulai Rekam" (Start Recording) to begin recording.
2. Play the instruments; all synthesized audio is captured.
3. Click "Hentikan Rekaman" (Stop Recording) to finalize.
4. Download the resulting WAV file or play it back in the browser.
5. Click "Hapus Rekaman" (Clear Recording) to discard and start a new session.

### Uploading Custom Samples

1. In the "Upload Sampel Audio" section, select the note you wish to replace from the dropdown.
2. Click "Pilih atau seret file" and select a WAV, MP3, OGG, or FLAC file.
3. The sample is uploaded to the backend and cached in memory.
4. The next time you play that note, the custom sample plays instead of synthesized audio.
5. To return to synthesis, reload the page (samples are per-session).

### Default Samples (Optional)

To set up default samples:

1. Create directory structure in `api/samples/`:

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
       └── 1 Do (octave).wav
   ```

2. Backend automatically loads samples on startup.
3. Samples are cached in memory for fast playback.
4. If a sample is not available, the synthesizer falls back to procedural synthesis.

## Deployment

### Vercel (Recommended)

The project is preconfigured for serverless deployment on Vercel.

1. Push your repository to GitHub.
2. Connect the repository to Vercel via the Vercel dashboard.
3. Vercel automatically detects the build configuration and deploys both frontend and backend.
4. The application is accessible at your Vercel project URL.

### Self-Hosted

To run on your own server:

1. Build the frontend: `npm run build`
2. Deploy the `dist/` folder as a static website.
3. Run the backend as a Python application:

   ```bash
   python -m uvicorn api.index:app --host 0.0.0.0 --port 8000
   ```

## Browser Compatibility

- **Chrome/Chromium** — Full support
- **Firefox** — Full support
- **Safari 14+** — Full support
- **Edge** — Full support

Requires Web Audio API support and JavaScript enabled.

## Performance

The Web Audio API frontend provides instant, zero-latency audio synthesis directly in the browser. The application has been tested on modern desktop and tablet browsers and maintains smooth performance during normal use with simultaneous synthesis and recording. Synthesis, recording, and parameter changes all respond immediately without network round-trip delay.

The optional backend synthesis (for advanced workflows) typically completes within 50-200ms depending on system load and NumPy/SciPy compilation overhead.

## Troubleshooting

**No sound output** — Verify Web Audio API is supported in your browser. The browser may require user interaction to initialize the audio context. Click any instrument once to enable audio. Check browser console for errors. Ensure JavaScript is enabled.

**Recording not working** — The browser may be preventing audio recording due to security restrictions. This is typically browser/OS specific. Verify that microphone permissions are allowed (even though the application does not use microphone input).

**Sample upload fails** — Ensure the file is in a supported format (WAV, MP3, OGG, FLAC) and that a note is selected in the dropdown before uploading. If backend sample playback is desired, ensure the backend API is running and accessible at `/api/samples/`.

**Audio permission issues** — Browsers require user interaction to enable Web Audio API. Click any instrument once to initialize the audio context.

**Backend synthesis endpoint not responding** — If using the backend for advanced synthesis, verify the API is running via `python -m uvicorn api/index:app --host 0.0.0.0 --port 8000`. Cold starts on Vercel may cause brief delays on the first request.

## Future Enhancements

Potential directions for expansion:

- MIDI input support for external controllers
- Preset system for saving and loading instrument configurations
- Multi-instrument layering and sequencing
- Touch gesture support for mobile devices
- Additional Balinese instruments (Reyong, Ugal, etc.)
- Spectral analysis and visualization
- Client-side synthesis option for zero-latency playback
- Improved sample quality with spectral processing

## Credits

Gamelan Bali Synthesizer — Kelompok 1 (Group 1)
Program Studi Teknik Informatika (Department of Computer Science)
FMIPA Universitas Udayana (Faculty of Mathematics and Natural Sciences, Udayana University)
2026

Built with Vue.js 3, Vite, FastAPI, NumPy, and SciPy.

## License

This project is provided as-is for educational and academic purposes.
