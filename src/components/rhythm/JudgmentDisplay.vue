<template>
  <div class="rhythm-judgment-display">
    <div class="rhythm-score-row">
      <div class="rhythm-score-block">
        <span class="rhythm-score-label">Skor</span>
        <span class="rhythm-score-value">{{ Math.round(score) }}</span>
      </div>
      <div class="rhythm-score-block">
        <span class="rhythm-score-label">Kombo</span>
        <span class="rhythm-score-value" :class="{ 'rhythm-combo-hot': combo >= 10 }">{{ combo }}×</span>
      </div>
      <div class="rhythm-score-block">
        <span class="rhythm-score-label">Akurasi</span>
        <span class="rhythm-score-value">{{ accuracyPercent.toFixed(1) }}%</span>
      </div>
    </div>
    <div class="rhythm-flash-slot">
      <transition name="rhythm-flash">
        <div v-if="flashText" :key="flashKey" class="rhythm-flash-text" :style="{ color: flashColor }">
          {{ flashText }}
        </div>
      </transition>
    </div>
  </div>
</template>

<script>
import { ref, watch } from 'vue'

const LABELS = { sempurna: 'SEMPURNA', baik: 'BAIK', kurang: 'KURANG', terlewat: 'TERLEWAT' }
const COLORS = { sempurna: '#7EC850', baik: '#4FA8E0', kurang: '#E0954F', terlewat: '#D8524F' }

export default {
  name: 'JudgmentDisplay',
  props: {
    score: { type: Number, default: 0 },
    combo: { type: Number, default: 0 },
    accuracyPercent: { type: Number, default: 100 },
    lastJudgment: { type: Object, default: null },
  },
  setup(props) {
    const flashText = ref('')
    const flashColor = ref('#C8960C')
    const flashKey = ref(0)
    let timer = null

    watch(() => props.lastJudgment, (j) => {
      if (!j) return
      flashText.value = LABELS[j.judgment] || ''
      flashColor.value = COLORS[j.judgment] || '#C8960C'
      flashKey.value++
      clearTimeout(timer)
      timer = setTimeout(() => { flashText.value = '' }, 550)
    })

    return { flashText, flashColor, flashKey }
  },
}
</script>
