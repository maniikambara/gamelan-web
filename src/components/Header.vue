<template>
  <header class="app-header">
    <div class="header-brand">
      <img src="/assets/logo.svg" alt="Logo" class="header-logo" />
      <div class="header-titles">
        <div class="header-title">GAMELAN BALI SYNTHESIZER</div>
        <div class="header-subtitle">Kelompok 1 · Teknik Informatika FMIPA UNUD · 2026</div>
      </div>
    </div>
    <div class="header-right">
      <div id="note-flash" class="note-flash">{{ lastNote || '—' }}</div>
      <span
        class="badge"
        :class="synthMode === 'sample' ? 'badge-sam' : 'badge-syn'"
        :title="synthMode === 'sample' ? 'Memainkan sampel rekaman asli' : 'Menggunakan sintesis prosedural'"
      >
        {{ synthMode === 'sample' ? 'Sampel Asli' : 'Sintetis' }}
      </span>
    </div>
  </header>
</template>

<script>
export default {
  props: {
    currentInstrument: String,
    lastNote:          String,
    synthMode:         { type: String, default: 'synth' },
    samplesReady:      { type: Boolean, default: false },
  },
}
</script>
