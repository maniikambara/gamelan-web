<template>
  <aside class="app-sidebar">
    <p class="sidebar-section-title">Instrumen</p>
    <nav id="inst-nav">
      <button
        v-for="inst in instruments"
        :key="inst.key"
        class="nav-btn"
        :class="{ active: inst.key === activeInstrument }"
        @click="$emit('select', inst.key)"
      >
        <span class="nav-btn-name">{{ inst.label }}</span>
        <span class="nav-btn-desc">{{ inst.notes.length }} {{ inst.key === 'kendang' ? 'suara' : 'nada' }}</span>
      </button>
    </nav>
  </aside>
</template>

<script>
import { INSTRUMENTS } from '../instruments'

export default {
  props: {
    instruments: Object,
    activeInstrument: String,
  },
  emits: ['select'],
  setup() {
    return {
      instruments: INSTRUMENTS,
    }
  },
}
</script>
