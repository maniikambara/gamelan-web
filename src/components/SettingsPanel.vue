<template>
  <section>
    <p class="right-section-title">Pengaturan Suara</p>
    <div id="settings-container">
      <div class="settings-group">
        <label v-for="(value, key) in currentSettings" :key="key" class="setting-item">
          <span class="setting-label">{{ paramLabel(key) }}</span>
          <input
            type="range"
            class="setting-range"
            :min="paramRange(key).min"
            :max="paramRange(key).max"
            :step="paramRange(key).step"
            :value="value"
            @input="(e) => $emit('update', key, parseFloat(e.target.value))"
          />
          <span class="setting-value">{{ value.toFixed(2) }}</span>
        </label>
      </div>
    </div>
  </section>
</template>

<script>
import { computed } from 'vue'

export default {
  props: {
    instrument: Object,
    params: Object,
  },
  emits: ['update'],
  setup(props) {
    const currentSettings = computed(() => props.params)

    const paramLabel = (key) => {
      const labels = {
        resonance: 'Resonansi',
        gain: 'Volume',
        ombak: 'Ombak (Detuning)',
        release_ms: 'Release (ms)',
        depth: 'Kedalaman',
        dryness: 'Kekeringan',
        breath: 'Nafas (%)',
        attack_ms: 'Attack (ms)',
      }
      return labels[key] || key
    }

    const paramRange = (key) => {
      const ranges = {
        resonance: { min: 0, max: 1, step: 0.01 },
        gain: { min: 0, max: 1, step: 0.01 },
        ombak: { min: 0, max: 20, step: 0.5 },
        release_ms: { min: 100, max: 3000, step: 100 },
        depth: { min: 0, max: 1, step: 0.05 },
        dryness: { min: 0, max: 1, step: 0.05 },
        breath: { min: 0, max: 1, step: 0.05 },
        attack_ms: { min: 20, max: 300, step: 10 },
      }
      return ranges[key] || { min: 0, max: 1, step: 0.01 }
    }

    return {
      currentSettings,
      paramLabel,
      paramRange,
    }
  },
}
</script>
