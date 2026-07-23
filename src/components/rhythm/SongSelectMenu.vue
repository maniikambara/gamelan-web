<template>
  <div class="rhythm-song-select">
    <p class="hint-text">Pilih lagu untuk memulai mode permainan ritme.</p>
    <div class="rhythm-song-list">
      <button
        v-for="chart in charts"
        :key="chart.songId"
        class="rhythm-song-card"
        @click="$emit('select', chart)"
      >
        <span class="rhythm-song-title">{{ chart.title }}</span>
        <span class="rhythm-song-meta">
          {{ instrumentLabel(chart.instrument) }} · {{ chart.bpm }} BPM · {{ difficultyLabel(chart.difficulty) }}
        </span>
        <span class="rhythm-song-notes-count">{{ chart.notes.length }} ketukan</span>
      </button>
    </div>
    <p v-if="!charts.length" class="hint-text">
      Belum ada chart lagu yang tersedia di src/charts/.
    </p>
  </div>
</template>

<script>
import { INSTRUMENTS } from '../../instruments'

const DIFFICULTY_LABELS = { pemula: 'Pemula', menengah: 'Menengah', mahir: 'Mahir' }

export default {
  name: 'SongSelectMenu',
  props: {
    charts: { type: Array, required: true },
  },
  emits: ['select'],
  setup() {
    const difficultyLabel = (d) => DIFFICULTY_LABELS[d] || d
    const instrumentLabel = (key) => INSTRUMENTS[key]?.label || key
    return { difficultyLabel, instrumentLabel }
  },
}
</script>
