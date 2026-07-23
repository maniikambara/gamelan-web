<template>
  <div class="rhythm-game-panel">
    <div class="panel-header">
      <h2 class="panel-title">Mode Permainan</h2>
      <p class="panel-desc">
        Ketuk nada sesuai irama sambil tetap mendengar sintesis instrumen asli
        -- rekaman sesi tetap berjalan seperti pada mode bebas.
      </p>
    </div>

    <!-- Fase 1: pilih lagu -->
    <SongSelectMenu v-if="phase === 'select'" :charts="charts" @select="onSelectSong" />

    <!-- Fase 2: pratinjau lagu + kalibrasi -->
    <div v-else-if="phase === 'preview'" class="rhythm-preview">
      <h3 class="rhythm-preview-title">{{ activeChart.title }}</h3>
      <p class="hint-text">
        {{ instrumentLabel }} · {{ activeChart.bpm }} BPM · {{ difficultyLabel }} ·
        {{ activeChart.notes.length }} ketukan
      </p>
      <p v-if="activeChart.sourceNote" class="rhythm-source-note">{{ activeChart.sourceNote }}</p>

      <div class="rhythm-calibration">
        <label class="rhythm-calibration-label" for="rhythm-latency">
          Kalibrasi latensi input: {{ latencyOffsetMs }} ms
        </label>
        <input
          id="rhythm-latency"
          type="range"
          min="-150"
          max="150"
          step="5"
          v-model.number="latencyOffsetMs"
        />
        <p class="hint-text" style="margin: 0.25rem 0 0;">
          Geser ke kanan bila ketukan Anda selalu dinilai terlambat, ke kiri bila selalu dinilai terlalu cepat.
        </p>
      </div>

      <div class="rhythm-preview-actions">
        <button class="rhythm-btn rhythm-btn-primary" @click="beginPlaying">Mulai</button>
        <button class="rhythm-btn" @click="backToSelect">Pilih Lagu Lain</button>
      </div>
    </div>

    <!-- Fase 3: bermain -->
    <div v-else-if="phase === 'playing'" class="rhythm-playing">
      <div class="rhythm-playing-top">
        <JudgmentDisplay
          :score="score"
          :combo="combo"
          :accuracyPercent="accuracyPercent"
          :lastJudgment="lastJudgment"
        />
        <button class="rhythm-btn rhythm-btn-small" @click="cancelPlaying">Batalkan</button>
      </div>

      <NoteHighway
        :tiles="tiles"
        :currentTimeMs="currentTimeMs"
        :noteTravelTimeMs="noteTravelTimeMs"
        :laneIndices="laneIndices"
        :accentColor="instrumentColor"
        :isPlaying="isPlaying"
        :tileLabels="tileLabels"
      />

      <div class="rhythm-kbd-strip">
        <div v-for="note in laneNotes" :key="note.index" class="rhythm-kbd-col">
          <button
            class="rhythm-kbd-chip"
            :class="{ active: pressedLane === note.index }"
            :style="{ borderColor: instrumentColor, color: instrumentColor }"
            @mousedown="handleLane(note.index)"
            @touchstart.prevent="handleLane(note.index)"
          >
            {{ keyLabelFor(note.index) }}
          </button>
          <span class="rhythm-kbd-note-label">{{ note.name.split(' ')[0].toUpperCase() }}</span>
        </div>
      </div>
    </div>

    <!-- Fase 4: hasil -->
    <div v-else-if="phase === 'results'" class="rhythm-results">
      <h3 class="rhythm-preview-title">Selesai -- {{ activeChart.title }}</h3>
      <div class="rhythm-results-grid">
        <div class="rhythm-score-block">
          <span class="rhythm-score-label">Skor Akhir</span>
          <span class="rhythm-score-value">{{ Math.round(score) }}</span>
        </div>
        <div class="rhythm-score-block">
          <span class="rhythm-score-label">Akurasi</span>
          <span class="rhythm-score-value">{{ accuracyPercent.toFixed(1) }}%</span>
        </div>
        <div class="rhythm-score-block">
          <span class="rhythm-score-label">Kombo Maksimum</span>
          <span class="rhythm-score-value">{{ maxCombo }}×</span>
        </div>
      </div>
      <div class="rhythm-results-breakdown">
        <span>Sempurna: {{ judgmentCounts.sempurna }}</span>
        <span>Baik: {{ judgmentCounts.baik }}</span>
        <span>Kurang: {{ judgmentCounts.kurang }}</span>
        <span>Terlewat: {{ judgmentCounts.terlewat }}</span>
      </div>
      <div class="rhythm-preview-actions">
        <button class="rhythm-btn rhythm-btn-primary" @click="beginPlaying">Main Lagi</button>
        <button class="rhythm-btn" @click="backToSelect">Pilih Lagu Lain</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import { useRhythmEngine } from '../../composables/useRhythmEngine'
import { useChartLoader } from '../../composables/useChartLoader'
import NoteHighway from './NoteHighway.vue'
import JudgmentDisplay from './JudgmentDisplay.vue'
import SongSelectMenu from './SongSelectMenu.vue'

// Peta lajur -> tombol keyboard per instrumen (Lampiran A.2 laporan).
// Hanya suling dipakai pada chart yang tersedia saat ini; gangsa disiapkan
// agar mode ini siap diperluas (Bagian 4, "Tahap 4" rancangan) tanpa perlu
// mengubah komponen ini lagi.
const KEY_MAPS = {
  suling: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  gangsa: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
}
const DIFFICULTY_LABELS = { pemula: 'Pemula', menengah: 'Menengah', mahir: 'Mahir' }

export default {
  name: 'RhythmGamePanel',
  components: { NoteHighway, JudgmentDisplay, SongSelectMenu },
  props: {
    instruments: { type: Object, required: true },
    audioEngine: { type: Object, required: true },
  },
  emits: ['play-note', 'instrument-active'],
  setup(props, { emit }) {
    const { charts } = useChartLoader()
    const {
      tiles, score, combo, maxCombo, judgmentCounts, lastJudgment,
      isPlaying, isFinished, currentTimeMs, noteTravelTimeMs,
      latencyOffsetMs, accuracyPercent,
      loadChart, start, stop, pressLane,
    } = useRhythmEngine(props.audioEngine)

    const phase = ref('select') // 'select' | 'preview' | 'playing' | 'results'
    const activeChart = ref(null)
    const pressedLane = ref(null)
    let pressedTimer = null

    const instrumentDef = computed(() => props.instruments[activeChart.value?.instrument])
    const instrumentColor = computed(() => instrumentDef.value?.color || '#C8960C')
    const instrumentLabel = computed(() => instrumentDef.value?.label || activeChart.value?.instrument)
    const difficultyLabel = computed(() => DIFFICULTY_LABELS[activeChart.value?.difficulty] || activeChart.value?.difficulty)

    // Lajur yang benar-benar dipakai chart ini, terurut naik berdasarkan noteIndex
    const laneIndices = computed(() => {
      if (!activeChart.value) return []
      return [...new Set(activeChart.value.notes.map(n => n.noteIndex))].sort((a, b) => a - b)
    })
    const laneNotes = computed(() => {
      if (!instrumentDef.value) return []
      const byIndex = new Map(instrumentDef.value.notes.map(n => [n.index, n]))
      return laneIndices.value.map(i => byIndex.get(i)).filter(Boolean)
    })
    const keyLabelFor = (noteIndex) => {
      const keys = KEY_MAPS[activeChart.value?.instrument] || []
      return keys[noteIndex] ?? '?'
    }

    // Glyph tile mengikuti konvensi tombol yang SUDAH ADA per instrumen
    // (Bagian 6 rancangan): Suling memakai notasi angka sebagai glyph utama
    // (dengan nama nada sebagai label kecil di bawahnya), sedangkan Gangsa
    // tidak memakai notasi angka pada antarmuka saat ini sehingga glyph
    // utamanya adalah nama nada (dengan huruf keyboard sebagai label kecil).
    const tileLabels = computed(() => {
      const map = {}
      const isSuling = activeChart.value?.instrument === 'suling'
      for (const note of laneNotes.value) {
        const key = keyLabelFor(note.index)
        const nameWord = note.name.split(' ')[0].toUpperCase()
        map[note.index] = isSuling ? { main: key, sub: nameWord } : { main: note.name, sub: key }
      }
      return map
    })

    function onSelectSong(chart) {
      activeChart.value = chart
      emit('instrument-active', chart.instrument)
      loadChart(chart)
      phase.value = 'preview'
    }

    function beginPlaying() {
      loadChart(activeChart.value)
      phase.value = 'playing'
      start()
    }

    function cancelPlaying() {
      stop(false)
      phase.value = 'preview'
    }

    function backToSelect() {
      stop(false)
      activeChart.value = null
      phase.value = 'select'
    }

    function handleLane(noteIndex) {
      // Dicari dari instrumentDef PENUH (bukan laneNotes yang sudah difilter
      // ke lajur yang dipakai chart ini) supaya seluruh tombol nada instrumen
      // tetap berbunyi -- konsisten dengan mode bebas (Bagian 3 rancangan:
      // "karakter bunyi pada mode permainan identik dengan mode bermain
      // bebas"). pressLane() sendiri sudah aman dipanggil untuk lajur mana
      // pun; otomatis tidak berefek (return null) bila memang tidak ada tile
      // pada lajur tersebut untuk chart yang sedang dimuat.
      const note = instrumentDef.value?.notes.find(n => n.index === noteIndex)
      if (!note || !activeChart.value) return

      // Penilaian judgment (efek samping: skor/kombo). Suara TETAP diputar
      // di bawah terlepas dari hasilnya (Bagian 4.3 langkah 5 rancangan).
      pressLane(noteIndex)

      emit('play-note', {
        instrument: activeChart.value.instrument,
        noteIndex: note.index,
        noteName: note.name,
        freq: note.freq,
      })

      pressedLane.value = noteIndex
      clearTimeout(pressedTimer)
      pressedTimer = setTimeout(() => { pressedLane.value = null }, 160)
    }

    function handleKeyDown(e) {
      if (phase.value !== 'playing' || e.repeat) return
      const keys = KEY_MAPS[activeChart.value?.instrument] || []
      const idx = keys.findIndex(k => k.toLowerCase() === e.key.toLowerCase())
      if (idx === -1) return
      handleLane(idx)
    }
    onMounted(() => window.addEventListener('keydown', handleKeyDown))
    onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))

    watch(isFinished, (finished) => {
      if (finished) phase.value = 'results'
    })

    onBeforeUnmount(() => {
      stop(false)
      clearTimeout(pressedTimer)
    })

    return {
      charts, phase, activeChart, pressedLane,
      tiles, score, combo, maxCombo, judgmentCounts, lastJudgment,
      isPlaying, currentTimeMs, noteTravelTimeMs, latencyOffsetMs, accuracyPercent,
      instrumentColor, instrumentLabel, difficultyLabel, laneIndices, laneNotes, tileLabels,
      keyLabelFor, onSelectSong, beginPlaying, cancelPlaying, backToSelect, handleLane,
    }
  },
}
</script>
