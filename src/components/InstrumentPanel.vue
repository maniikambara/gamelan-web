<template>
  <div>
    <div class="panel-header">
      <h2 class="panel-title">{{ instrument.label }}</h2>
      <p class="panel-desc">{{ instrument.description }}</p>
    </div>

    <component 
      :is="panelComponent"
      :instrument="instrument"
      @play-note="$emit('play-note', $event)"
    />

    <p class="hint-text">{{ hintText }}</p>
  </div>
</template>

<script>
import { computed, defineAsyncComponent } from 'vue'

// Lazy-load instrument panels for faster initial load
const GangsaPanel = defineAsyncComponent(() => import('./instruments/GangsaPanel.vue'))
const KendangPanel = defineAsyncComponent(() => import('./instruments/KendangPanel.vue'))
const SulingPanel = defineAsyncComponent(() => import('./instruments/SulingPanel.vue'))

export default {
  components: {
    GangsaPanel,
    KendangPanel,
    SulingPanel,
  },
  props: {
    instrument: Object,
  },
  emits: ['play-note'],
  setup(props) {
    const panelComponent = computed(() => {
      switch (props.instrument.key) {
        case 'gangsa':
          return 'GangsaPanel'
        case 'kendang':
          return 'KendangPanel'
        case 'suling':
          return 'SulingPanel'
        default:
          return 'GangsaPanel'
      }
    })

    const hintText = computed(() => {
      switch (props.instrument.key) {
        case 'gangsa':
          return 'Klik pada bilah untuk memainkan nada'
        case 'kendang':
          return 'Klik pada membran drum — bagian dalam (Tung) atau tepi (Pak)'
        case 'suling':
          return 'Klik pada lubang untuk memainkan nada'
        default:
          return ''
      }
    })

    return {
      panelComponent,
      hintText,
    }
  },
}
</script>
