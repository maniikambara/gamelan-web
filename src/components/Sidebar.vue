<template>
  <aside class="app-sidebar">
    <p class="sidebar-section-title">Instrumen</p>
    <nav id="inst-nav">
      <button
        v-for="inst in instruments"
        :key="inst.key"
        class="nav-btn"
        :class="{ active: currentView === 'instrument' && inst.key === activeInstrument }"
        @click="$emit('select', inst.key)"
      >
        <span class="nav-btn-name">{{ inst.label }}</span>
        <span class="nav-btn-desc">{{ inst.notes.length }} {{ inst.key === 'kendang' ? 'suara' : 'nada' }}</span>
      </button>
    </nav>

    <p class="sidebar-section-title" style="margin-top: 1.5rem;">Lainnya</p>
    <nav>
      <button
        class="nav-btn"
        :class="{ active: currentView === 'rhythm' }"
        @click="$emit('select-rhythm')"
      >
        <span class="nav-btn-name">Mode Permainan</span>
        <span class="nav-btn-desc">ritme gamelan</span>
      </button>
    </nav>
  </aside>
</template>

<script>
export default {
  props: {
    instruments: Object,
    activeInstrument: String,
    currentView: { type: String, default: 'instrument' },
  },
  emits: ['select', 'select-rhythm'],
}
</script>
