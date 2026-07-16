<template>
  <div class="gangsa-panel">

    <!-- Gangsa image container with bilah overlays -->
    <div class="gangsa-stage">
      <!-- Base gangsa body image -->
      <img
        src="/assets/gangsa.png"
        alt="Gangsa Bali"
        class="gangsa-body"
        draggable="false"
      />

      <!-- Overlay layer: note labels + bilah images -->
      <div class="gangsa-overlay">
        <!-- Per-bilah: label + image + glow -->
        <div
          v-for="(note, i) in instrument.notes"
          :key="note.index"
          class="gangsa-bilah-wrap"
          :class="{
            'gangsa-bilah-wrap--play': barStates[i] === 'play',
            'gangsa-bilah-wrap--mute': barStates[i] === 'mute',
          }"
          :style="BAR_STYLES[i]"
          @mousedown="onBarDown($event, i)"
          @touchstart.prevent="onBarTouch($event, i)"
        >
          <img
            :src="`/assets/gangsa/${i + 1}.png`"
            :alt="note.name"
            class="gangsa-bilah-img"
            draggable="false"
          />
          <div class="gangsa-bilah-glow" />
        </div>

        <!-- Note labels (positioned above each bilah) -->
        <span
          v-for="(note, i) in instrument.notes"
          :key="'lbl'+i"
          class="gangsa-note-lbl"
          :class="{
            'gangsa-note-lbl--play': barStates[i] === 'play',
            'gangsa-note-lbl--mute': barStates[i] === 'mute',
          }"
          :style="LABEL_STYLES[i]"
        >{{ note.name }}</span>
      </div>
    </div>

    <!-- Help text -->
    <p class="gangsa-hint">Klik pada bilah untuk memainkan nada</p>

  </div>
</template>

<script>
import { reactive, onMounted, onUnmounted } from 'vue'

const KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
const KEY_TO_IDX = Object.fromEntries(KEYS.map((k, i) => [k.toLowerCase(), i]))
// Dampening keys — same order/position as KEYS, one row below on a QWERTY
// keyboard, mirroring how a gamelan player mutes a bar with the other hand.
const MUTE_KEYS = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/']
const MUTE_KEY_TO_IDX = Object.fromEntries(MUTE_KEYS.map((k, i) => [k.toLowerCase(), i]))
const MUTE_ZONE_RATIO = 0.75

// Per-bilah positions derived from the reference design (1365×765 container).
// Converted to percentages for responsive scaling.
const BAR_LAYOUT = [
  { left: 17.07, top: 23.14, width: 10.84, height: 35.29 },
  { left: 24.54, top: 23.27, width: 10.33, height: 35.56 },
  { left: 32.09, top: 24.05, width:  9.30, height: 34.25 },
  { left: 39.85, top: 24.44, width:  8.21, height: 33.46 },
  { left: 47.40, top: 25.23, width:  6.45, height: 31.11 },
  { left: 54.58, top: 25.23, width:  5.93, height: 31.11 },
  { left: 60.95, top: 25.62, width:  6.67, height: 29.93 },
  { left: 66.52, top: 26.27, width:  6.81, height: 28.63 },
  { left: 72.16, top: 26.67, width:  6.59, height: 28.10 },
  { left: 77.66, top: 27.45, width:  6.96, height: 27.19 },
]

// Pre-computed inline styles for each bar
const BAR_STYLES = BAR_LAYOUT.map(b => ({
  left:   `${b.left}%`,
  top:    `${b.top}%`,
  width:  `${b.width}%`,
  height: `${b.height}%`,
}))

// Label positions: centered horizontally above each bilah, at ~19% from top
const LABEL_STYLES = BAR_LAYOUT.map(b => ({
  left: `${b.left + b.width / 2}%`,
  top:  `${b.top - 4}%`,
}))

export default {
  props: {
    instrument: Object,
  },
  emits: ['play-note', 'mute-note'],
  setup(props, { emit }) {
    const barStates = reactive({})

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

    // Tap Q-P: strike the bar, it rings out naturally (no need to hold the
    // key down for a long note — a real metallophone keeps ringing after
    // the mallet lifts). Tap Z-/ (same column) to dampen that same bar,
    // mirroring the two-handed strike-then-damp technique on a real gangsa.
    const onKeyDown = (e) => {
      if (e.repeat) return
      const key = e.key.toLowerCase()
      const playIdx = KEY_TO_IDX[key]
      if (playIdx != null && playIdx < props.instrument.notes.length) {
        e.preventDefault()
        playBar(playIdx)
        return
      }
      const muteIdx = MUTE_KEY_TO_IDX[key]
      if (muteIdx != null && muteIdx < props.instrument.notes.length) {
        e.preventDefault()
        muteBar(muteIdx)
      }
    }

    onMounted(() => {
      window.addEventListener('keydown', onKeyDown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', onKeyDown)
    })

    return { BAR_STYLES, LABEL_STYLES, barStates, onBarDown, onBarTouch }
  },
}
</script>
