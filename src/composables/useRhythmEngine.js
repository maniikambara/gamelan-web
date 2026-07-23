/**
 * useRhythmEngine.js — Mode Permainan Ritme · Composable inti
 *
 * Logika murni (tanpa DOM): game loop berbasis requestAnimationFrame,
 * penjadwalan posisi tile, deteksi input per lajur, penilaian judgment,
 * dan perhitungan skor/kombo. Lihat rancangan-mode-permainan-ritme-gamelan.md
 * Bagian 4.3 (alur data) dan Bagian 7 (timing, judgment, skor).
 *
 * Sumber waktu tunggal: audioContext.currentTime (Bagian 8.1), BUKAN
 * Date.now(), supaya posisi tile dan penilaian ketepatan ketukan tidak
 * menyimpang dari jam internal Web Audio API pada sesi yang berjalan lama.
 *
 * Sintesis suara TIDAK diimplementasikan di sini — pemanggil (RhythmGamePanel)
 * tetap memanggil AudioEngine.playNote() seperti mode bebas, terlepas dari
 * hasil judgment, sesuai Bagian 4.3 langkah 5.
 */

import { ref, reactive, computed } from 'vue'

// Bagian 7.1 — jendela penilaian dasar (ms), sebelum dikalikan windowMultiplier
export const JUDGMENT_WINDOWS_MS = {
  sempurna: 50,
  baik: 120,
  kurang: 200,
}

// Bagian 7.1 — poin dasar per kategori judgment
export const JUDGMENT_POINTS = {
  sempurna: 100,
  baik: 60,
  kurang: 20,
  terlewat: 0,
}

export function useRhythmEngine(audioEngine) {
  const tiles = ref([])
  const score = ref(0)
  const combo = ref(0)
  const maxCombo = ref(0)
  const judgmentCounts = reactive({ sempurna: 0, baik: 0, kurang: 0, terlewat: 0 })
  const lastJudgment = ref(null)
  const isPlaying = ref(false)
  const isFinished = ref(false)
  const currentTimeMs = ref(0)
  const noteTravelTimeMs = ref(1800)
  const windowMultiplier = ref(1.0)
  // Bagian 8.2 — kalibrasi offset latensi input (ms), hanya memengaruhi
  // penilaian judgment, bukan posisi visual tile, agar animasi tetap akurat.
  const latencyOffsetMs = ref(0)
  const chartMeta = ref(null)

  let rafId = null
  let startCtxTime = 0
  let chart = null

  const totalNotes = computed(() => chart?.notes?.length ?? 0)

  // Bagian 7.2 — akurasi_persen
  const accuracyPercent = computed(() => {
    const total = totalNotes.value
    if (!total) return 100
    const j = judgmentCounts
    return ((j.sempurna * 100 + j.baik * 60 + j.kurang * 20) / (total * 100)) * 100
  })

  function loadChart(parsedChart) {
    stop(false)
    chart = parsedChart
    chartMeta.value = {
      songId: parsedChart.songId,
      title: parsedChart.title,
      instrument: parsedChart.instrument,
      bpm: parsedChart.bpm,
      difficulty: parsedChart.difficulty,
      sourceNote: parsedChart.sourceNote,
    }
    noteTravelTimeMs.value = parsedChart.noteTravelTimeMs ?? 1800
    // Bagian 9 — tingkat Pemula melonggarkan seluruh jendela judgment x1.5
    windowMultiplier.value = parsedChart.difficulty === 'pemula' ? 1.5 : 1.0
    tiles.value = parsedChart.notes.map((n, i) => ({
      id: i,
      timeMs: n.timeMs,
      noteIndex: n.noteIndex,
      noteName: n.noteName,
      hit: false,
      missed: false,
      judgment: null,
    }))
    score.value = 0
    combo.value = 0
    maxCombo.value = 0
    judgmentCounts.sempurna = 0
    judgmentCounts.baik = 0
    judgmentCounts.kurang = 0
    judgmentCounts.terlewat = 0
    lastJudgment.value = null
    currentTimeMs.value = 0
    isFinished.value = false
  }

  function start() {
    if (!chart || !tiles.value.length) return
    audioEngine.ensureContext()
    audioEngine.resume()
    startCtxTime = audioEngine.ctx.currentTime
    isPlaying.value = true
    isFinished.value = false
    tick()
  }

  function stop(finished = false) {
    isPlaying.value = false
    isFinished.value = finished
    if (rafId != null) cancelAnimationFrame(rafId)
    rafId = null
  }

  function tick() {
    if (!isPlaying.value) return
    const rawMs = (audioEngine.ctx.currentTime - startCtxTime) * 1000
    currentTimeMs.value = rawMs

    const missWindowMs = JUDGMENT_WINDOWS_MS.kurang * windowMultiplier.value
    for (const t of tiles.value) {
      if (!t.hit && !t.missed && rawMs - t.timeMs > missWindowMs) {
        t.missed = true
        t.judgment = 'terlewat'
        judgmentCounts.terlewat++
        combo.value = 0
        lastJudgment.value = { judgment: 'terlewat', at: rawMs }
      }
    }

    const lastTimeMs = chart.notes.length ? chart.notes[chart.notes.length - 1].timeMs : 0
    if (rawMs > lastTimeMs + missWindowMs + 800) {
      stop(true)
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  /**
   * Proses tekanan tombol/tap pada satu lajur (noteIndex). Mengembalikan
   * kategori judgment ('sempurna'|'baik'|'kurang') jika ada tile yang
   * berhasil dinilai, atau null jika tidak ada tile yang cocok dalam
   * jendela waktu (mis. tekan bebas di luar chart). AudioEngine.playNote()
   * TIDAK dipanggil di sini secara sengaja — pemanggil bertanggung jawab
   * memutar suara terlepas dari hasil judgment (Bagian 4.3 langkah 5).
   */
  function pressLane(noteIndex) {
    if (!isPlaying.value) return null
    const adjustedMs = currentTimeMs.value + latencyOffsetMs.value
    const windowMs = JUDGMENT_WINDOWS_MS.kurang * windowMultiplier.value

    let best = null
    let bestDiff = Infinity
    for (const t of tiles.value) {
      if (t.hit || t.missed) continue
      if (t.noteIndex !== noteIndex) continue
      const diff = Math.abs(adjustedMs - t.timeMs)
      if (diff < bestDiff) { bestDiff = diff; best = t }
    }
    if (!best || bestDiff > windowMs) return null

    let judgment
    if (bestDiff <= JUDGMENT_WINDOWS_MS.sempurna * windowMultiplier.value) judgment = 'sempurna'
    else if (bestDiff <= JUDGMENT_WINDOWS_MS.baik * windowMultiplier.value) judgment = 'baik'
    else judgment = 'kurang'

    best.hit = true
    best.judgment = judgment
    judgmentCounts[judgment]++

    if (judgment === 'kurang') {
      combo.value = 0
    } else {
      combo.value++
      if (combo.value > maxCombo.value) maxCombo.value = combo.value
    }

    // Bagian 7.2 — pengali_kombo = min(1 + floor(kombo/10) * 0.1, 2.0)
    const multiplier = Math.min(1 + Math.floor(combo.value / 10) * 0.1, 2.0)
    score.value += JUDGMENT_POINTS[judgment] * multiplier
    lastJudgment.value = { judgment, at: currentTimeMs.value }
    return judgment
  }

  function setLatencyOffset(ms) {
    latencyOffsetMs.value = ms
  }

  return {
    tiles, score, combo, maxCombo, judgmentCounts, lastJudgment,
    isPlaying, isFinished, currentTimeMs, noteTravelTimeMs, chartMeta,
    latencyOffsetMs, accuracyPercent, totalNotes, windowMultiplier,
    loadChart, start, stop, pressLane, setLatencyOffset,
  }
}
