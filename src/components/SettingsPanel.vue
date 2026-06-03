<template>
  <section>
    <p class="right-section-title">Pengaturan Suara</p>
    <div class="settings-group">
      <div v-for="key in paramKeys" :key="key" class="setting-item">
        <div class="setting-header">
          <span class="setting-label">{{ getLabel(key) }}</span>
          <span class="setting-value">{{ fmt(key) }}</span>
        </div>
        <input
          type="range"
          class="setting-range"
          :min="getRange(key).min"
          :max="getRange(key).max"
          :step="getRange(key).step"
          :value="params[key]"
          @input="(e) => $emit('update', key, parseFloat(e.target.value))"
        />
      </div>
    </div>
  </section>
</template>

<script>
import { computed } from 'vue'

const LABELS = {
  resonance:  'Resonansi',
  gain:       'Volume',
  ombak:      'Ombak (Detuning)',
  release_ms: 'Release (ms)',
  depth:      'Kedalaman Tung',
  dryness:    'Kekeringan Pak',
  breath:     'Hembusan Nafas',
  attack_ms:  'Attack (ms)',
}

const RANGES = {
  resonance:  { min: 0,   max: 1,    step: 0.01 },
  gain:       { min: 0,   max: 1,    step: 0.01 },
  ombak:      { min: 0,   max: 20,   step: 0.5  },
  release_ms: { min: 100, max: 3000, step: 100  },
  depth:      { min: 0,   max: 1,    step: 0.05 },
  dryness:    { min: 0,   max: 1,    step: 0.05 },
  breath:     { min: 0,   max: 1,    step: 0.05 },
  attack_ms:  { min: 20,  max: 300,  step: 10   },
}

export default {
  props: {
    instrument: Object,
    params: Object,
  },
  emits: ['update'],
  setup(props) {
    // Iterate over KEYS so the template directly accesses props.params[key]
    // — this is the reactive form Vue 3 can track per-property.
    const paramKeys = computed(() => Object.keys(props.params ?? {}))

    const getLabel = (key) => LABELS[key] ?? key
    const getRange = (key) => RANGES[key] ?? { min: 0, max: 1, step: 0.01 }
    const fmt      = (key) => {
      const v = props.params?.[key]
      return v == null ? '—' : Number(v).toFixed(2)
    }

    return { paramKeys, getLabel, getRange, fmt }
  },
}
</script>
