<template>
  <div class="gangsa-panel">

    <!-- Keyboard guide strip -->
    <div class="gangsa-kbd-strip">
      <span v-for="(k, i) in KEYS" :key="i" class="kbd-chip">{{ k }}</span>
    </div>

    <!-- 10 individual bars -->
    <div class="gangsa-bars">
      <div
        v-for="(note, i) in instrument.notes"
        :key="note.index"
        class="gangsa-bar"
        :class="{
          'bar--active': barStates[i] === 'play',
          'bar--mute':   barStates[i] === 'mute',
        }"
        :title="`${note.name} · ${KEYS[i]} · Klik bawah = mute`"
        @mousedown="onBarDown($event, i)"
        @touchstart.prevent="onBarTouch($event, i)"
      >
        <!-- Note label -->
        <div class="bar-label">
          <span class="bar-note-name">{{ note.name }}</span>
        </div>

        <!-- Bar image (fills available height) -->
        <div class="bar-img-wrap">
          <img
            :src="`/assets/gangsa/${i + 1}.png`"
            :alt="note.name"
            class="bar-img"
            draggable="false"
          />
          <!-- Mute-zone overlay at bottom 28% -->
          <div class="mute-zone">
            <span class="mute-zone-label">■</span>
          </div>
          <!-- Active glow overlay -->
          <div class="bar-glow" />
        </div>

        <!-- Keyboard key badge -->
        <div class="bar-kbd">{{ KEYS[i] }}</div>
      </div>
    </div>

    <!-- Zone legend -->
    <div class="gangsa-legend">
      <span class="legend-play">▶ Klik tengah = pukul</span>
      <span class="legend-sep">·</span>
      <span class="legend-mute">■ Klik bawah = mute (tahan)</span>
    </div>

  </div>
</template>

<script>
import { reactive, onMounted, onUnmounted } from 'vue'

const KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
const KEY_TO_IDX = Object.fromEntries(KEYS.map((k, i) => [k.toLowerCase(), i]))

// Y threshold (relative to element height) below which = mute zone
const MUTE_ZONE_RATIO = 0.72

export default {
  props: {
    instrument: Object,
  },
  emits: ['play-note', 'mute-note'],
  setup(props, { emit }) {
    // barStates: index → 'play' | 'mute' | null
    const barStates = reactive({})
    // Track keys currently held down (prevents auto-repeat)
    const heldKeys = new Set()

    const playBar = (i) => {
      const note = props.instrument.notes[i]
      emit('play-note', { noteIndex: note.index, noteName: note.name, freq: note.freq })
      barStates[i] = 'play'
      setTimeout(() => {
        if (barStates[i] === 'play') barStates[i] = null
      }, 350)
    }

    const muteBar = (i) => {
      const note = props.instrument.notes[i]
      emit('mute-note', { noteIndex: note.index, noteName: note.name })
      barStates[i] = 'mute'
      setTimeout(() => {
        if (barStates[i] === 'mute') barStates[i] = null
      }, 200)
    }

    // Click: check y position to determine play vs mute zone
    const onBarDown = (event, i) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const yRatio = (event.clientY - rect.top) / rect.height
      if (yRatio > MUTE_ZONE_RATIO) {
        muteBar(i)
      } else {
        playBar(i)
      }
    }

    const onBarTouch = (event, i) => {
      const touch = event.changedTouches[0]
      const rect  = event.currentTarget.getBoundingClientRect()
      const yRatio = (touch.clientY - rect.top) / rect.height
      if (yRatio > MUTE_ZONE_RATIO) {
        muteBar(i)
      } else {
        playBar(i)
      }
    }

    // Keyboard
    const onKeyDown = (e) => {
      if (e.repeat) return
      const idx = KEY_TO_IDX[e.key.toLowerCase()]
      if (idx == null || idx >= props.instrument.notes.length) return
      e.preventDefault()
      heldKeys.add(idx)
      playBar(idx)
    }

    const onKeyUp = (e) => {
      const idx = KEY_TO_IDX[e.key.toLowerCase()]
      if (idx == null || !heldKeys.has(idx)) return
      e.preventDefault()
      heldKeys.delete(idx)
      muteBar(idx)
    }

    onMounted(() => {
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    })

    return { KEYS, barStates, onBarDown, onBarTouch }
  },
}
</script>
