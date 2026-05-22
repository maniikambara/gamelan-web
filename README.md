# Gamelan Bali Synthesizer

A web-based interactive synthesizer that recreates the sounds of three traditional Balinese instruments: Gangsa, Kendang, and Suling. Built with zero-latency Web Audio API synthesis and client-side sample playback, featuring real-time audio recording capabilities.

## Overview

This project is an academic work by Group 1 from the Department of Computer Science, Faculty of Mathematics and Natural Sciences, Udayana University (2026). The synthesizer combines authentic instrument modeling with interactive visual feedback to provide an immersive experience of Balinese musical tradition.

## Features

### Instruments

**Gangsa** — A metallic xylophone-like instrument with ten metal bars tuned to the Balinese pelog scale. Features realistic metallic timbre with detuning effects (ombak) that create the characteristic beating and resonance of the physical instrument.

**Kendang** — A two-faced drum with four distinct playing techniques: center and rim strikes on both front and back faces. Produces tonal and percussive timbres that serve as the rhythmic foundation in Balinese ensembles.

**Suling Bali** — A six-hole bamboo flute with gentle breath articulation and subtle vibrato. Produces melodic lines with the warm, organic character of traditional bamboo instruments.

### Core Capabilities

- **Real-time Synthesis** — All sounds are generated on the client using Web Audio API oscillators, filters, and noise generators. No server round-trip required for playback.
- **Sample Playback** — Upload custom WAV, MP3, OGG, or FLAC audio samples for any note. Samples are decoded and cached in memory for immediate playback.
- **Audio Recording** — Record entire sessions in WebM format and download the resulting audio file.
- **Parameter Control** — Fine-tune each instrument's acoustic characteristics (resonance, attack time, release duration, breath intensity, etc.) via interactive sliders.
- **Visual Feedback** — Click-responsive overlays highlight playing zones and display note names in real-time.
- **Responsive Design** — Optimized for desktop and tablet browsers; adapts gracefully to smaller screens.

## Project Structure

```
gamelan-web/
├── index.html              # Main HTML page
├── css/
│   └── style.css          # Complete styling (2-column to single-column responsive)
├── js/
│   ├── instruments.js     # Instrument definitions and hit-zone detection
│   ├── audio.js           # Web Audio API engine (synthesis, recording, playback)
│   └── main.js            # UI orchestration and state management
├── api/
│   └── index.py           # FastAPI backend for advanced sample processing
├── assets/
│   ├── logo.svg           # Application logo
│   ├── gangsa.png         # Gangsa instrument image
│   ├── kendang.png        # Kendang instrument image
│   ├── suling.png         # Suling instrument image
│   └── snare.png          # Kendang snare hit-zone reference
├── vercel.json            # Vercel deployment configuration
└── .gitignore
```

## Architecture

### Frontend (Client-Side)

The application is entirely static on the frontend. Three JavaScript modules work together:

- **instruments.js** — Defines instrument parameters (frequencies, image dimensions, hit zones) and implements hit detection for canvas-based interaction.
- **audio.js** — Encapsulates the Web Audio API context, synthesis functions, sample buffering, and recording logic. Deferred context initialization respects browser autoplay policies.
- **main.js** — Manages UI state, renders dynamic panels for each instrument, handles event listeners, and coordinates synthesis parameter updates.

### Backend (Optional)

The FastAPI backend (`api/index.py`) provides optional advanced features:

- Sample upload and caching
- Server-side synthesis (advanced DSP processing)
- Audio export with mixing

The backend is entirely optional for the core synthesizer experience and is used primarily for production deployments on Vercel.

## Getting Started

### Local Development

1. Clone or download the repository.
2. Serve the directory with any HTTP server:
   ```bash
   python -m http.server 8000
   # or
   npx http-server -p 8000
   ```
3. Open `http://localhost:8000` in a modern web browser.

### Browser Requirements

- Modern browser with Web Audio API support (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Audio permission for recording (if using recording feature)

## Usage

### Playing Instruments

1. Select an instrument from the left sidebar (Gangsa, Kendang, or Suling).
2. Click on the displayed instrument image to trigger sounds:
   - **Gangsa**: Click on any metal bar; detected by horizontal position.
   - **Kendang**: Click on the drum face; center (Tung) vs. rim (Pak) based on distance from center.
   - **Suling**: Click on any of the six finger holes.

### Customizing Sound

1. Adjust parameters in the right panel under "Pengaturan Suara" (Sound Settings):
   - **Volume** — Master output level.
   - **Instrument-Specific Controls**:
     - Gangsa: Resonance, ombak (beating) frequency, release duration.
     - Kendang: Tung depth (tonal vs. noise), Pak dryness (click vs. resonance).
     - Suling: Attack time, breath intensity.

### Recording

1. Click "Mulai Rekam" (Start Recording) in the right panel.
2. Play the instruments to record your session.
3. Click "Hentikan Rekaman" (Stop Recording) to finalize.
4. Download the WebM file or play it back immediately.
5. Click "Hapus Rekaman" (Clear Recording) to discard and start over.

### Using Custom Samples

1. Under "Upload Sampel Audio", select the note you wish to replace.
2. Click "Pilih File Audio" and select a WAV, MP3, OGG, or FLAC file.
3. Click "Muat Sampel" (Load Sample).
4. The status list shows a green dot for uploaded samples; yellow for synthesized notes.
5. Playing a note with a loaded sample uses the sample instead of synthesis.

## Technical Details

### Synthesis Algorithm

**Gangsa** — Five inharmonic partials at ratios [1.0, 2.756, 5.404, 8.933, 13.35] create the metallic ring. A detuned copy at +ombak frequency (default 6 Hz) is mixed at lower amplitude to produce beating effects. Bandpass resonance filter emphasizes the fundamental, controlled by the resonance parameter.

**Kendang Tengah (Center)** — A pitched sine component (fundamental) dominates with bandpass-filtered noise for body resonance. The depth parameter blends between tonal and noisy character.

**Kendang Pinggir (Rim)** — Highpass-filtered noise with an exponentially decaying square wave click. The dryness parameter controls the balance between click and resonance.

**Suling** — Three harmonics (fundamental, 2x, 3x) with amplitude envelope controlled by attack time. Optional breath noise (bandpass-filtered at 1.5x fundamental) adds realism. Subtle sine-wave vibrato (5.5 Hz) modulates the fundamental frequency above the attack phase.

All synthesis uses ADSR (Attack-Decay-Sustain-Release) envelopes calibrated to the physical characteristics of each instrument.

### Recording and Sample Handling

- Recording uses `MediaRecorder` on the `AudioContext` output stream, producing WebM audio.
- Uploaded samples are decoded using `ctx.decodeAudioData()` and stored in memory indexed by `"instrument/note_name"`.
- Playback prioritizes samples over synthesis; if no sample exists, synthesis functions are invoked.

### Hit Detection

Each instrument implements a `detectHit(x, y, imgNaturalW, displayW)` method:

- **Gangsa** — Maps x-coordinate to one of 10 bars based on horizontal span.
- **Kendang** — Calculates distance from snare center; inner radius = Tengah, outer ring = Pinggir.
- **Suling** — Finds nearest hole within hit radius; no hit if all holes exceed radius.

Coordinates are scaled from display pixels to original image pixel space to maintain accuracy across responsive layout changes.

## Deployment

### Vercel Deployment

This project is configured for serverless deployment on Vercel using the `vercel.json` configuration. The static frontend is served as-is, and the Python backend is invoked on-demand via `/api/*` routes.

1. Link your repository to Vercel.
2. Vercel automatically detects and deploys using the configuration file.
3. The application is accessible at your Vercel URL.

### Local Testing Before Deployment

Verify that all features work locally before pushing to production:

```bash
python -m http.server 8000
```

Then test each instrument, parameter, recording, and sample upload functionality.

## Performance Considerations

- **Latency** — Web Audio synthesis has sub-50ms latency on modern hardware, providing immediate tactile feedback.
- **Memory** — Uploaded samples are held in memory for the session. Large samples or many uploads may affect performance on devices with limited RAM.
- **CPU** — Real-time synthesis is compute-efficient; multiple simultaneous notes are practical on modern machines.

## Browser Compatibility

- Chrome/Chromium: Full support
- Firefox: Full support
- Safari 14+: Full support (older versions have limited Web Audio API features)
- Edge: Full support

## Credits

Gamelan Bali Synthesizer — Kelompok 1 (Group 1)  
Program Studi Teknik Informatika (Department of Computer Science)  
FMIPA Universitas Udayana (Faculty of Mathematics and Natural Sciences, Udayana University)  
2026

## License

This project is provided as-is for educational and academic purposes.

## Troubleshooting

**No Sound?**
- Ensure browser audio is not muted (check volume icon in browser tab or system settings).
- Verify JavaScript is enabled and all script files load without errors (check browser console).
- On first interaction, browsers require user gesture to enable Web Audio; click any instrument to initialize audio context.

**Sample Won't Load?**
- Ensure the file format is supported (WAV, MP3, OGG, FLAC).
- Check browser console for decoding errors; corrupted or unsupported files will show messages.
- Verify file size is reasonable; extremely large files may cause memory issues.

**Recording Not Working?**
- Check browser permissions; you may need to grant microphone/audio access (though this app records synthesizer output, not microphone input).
- Verify browser supports WebM codec (most modern browsers do).
- Check browser console for MediaRecorder errors.

**Responsive Layout Issues?**
- Test on intended device/screen size (tablet at ~768px width, phone at ~640px or smaller).
- The right panel hides below 900px width; content moves to single-column below 640px.

## Future Enhancements

Potential directions for expansion:

- MIDI input support for external controllers
- Preset system for saving/loading instrument configurations
- Multi-instrument layering and sequencing
- Touch gesture support for mobile devices
- Additional Balinese instruments (Reyong, Ugal, etc.)
- Spectral analysis and visualization
- Improved sample quality with spectral processing
