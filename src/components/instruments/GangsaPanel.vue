<template>
  <div class="gangsa-panel">

    <!-- Full gangsa instrument image with clickable bar zones -->
    <div class="gangsa-stage">
      <img
        src="/assets/gangsa.png"
        alt="Gangsa Bali"
        class="gangsa-body"
        draggable="false"
      />

      <!-- Invisible clickable zones over each bar -->
      <div
        v-for="(note, i) in instrument.notes"
        :key="note.index"
        class="gangsa-hit"
        :class="{
          'gangsa-hit--play': barStates[i] === 'play',
          'gangsa-hit--mute': barStates[i] === 'mute',
        }"
        :style="getBarStyle(i)"
        :title="`${note.name} · ${KEYS[i]}`"
        @mousedown="onBarDown($event, i)"
        @touchstart.prevent="onBarTouch($event, i)"
      >
        <!-- Glow overlay -->
        <div class="gangsa-glow" />
        <!-- Note label -->
        <span class="gangsa-note-label">{{ note.name }}</span>
        <!-- Key badge -->
        <span class="gangsa-key-label">{{ KEYS[i] }}</span>
      </div>
    </div>

    <!-- Keyboard guide row -->
    <div class="gangsa-keys-row">
      <div v-for="(note, i) in instrument.notes" :key="'k'+i" class="gangsa-key-cell"
        :class="{
          'gangsa-key-cell--play': barStates[i] === 'play',
          'gangsa-key-cell--mute': barStates[i] === 'mute',
        }"
      >
        <kbd>{{ KEYS[i] }}</kbd>
        <span>{{ note.name }}</span>
      </div>
    </div>

    <!-- Legend -->
    <div class="gangsa-legend">
      <span class="legend-play">&#9654; Klik tengah bilah = pukul</span>
      <span class="legend-sep">&#183;</span>
      <span class="legend-mute">&#9632; Klik bawah bilah = mute</span>
      <span class="legend-sep">&#183;</span>
      <span class="legend-kbd">Keyboard Q&#8211;P</span>
    </div>

  </div>
</template>

<script>
import { reactive, onMounted, onUnmounted } from 'vue'

const KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
const KEY_TO_IDX = Object.fromEntries(KEYS.map((k, i) => [k.toLowerCase(), i]))
const MUTE_ZONE_RATIO = 0.75

// Derived from gangsa.png (3799 × 2129)
// xStart=285  xEnd=3593 (from instruments.js)
const IMG_W = 3799
const IMG_H = 2129
const X_START = 285
const X_END   = 3593
const BAR_COUNT = 10
const BAR_SLOT  = (X_END - X_START) / BAR_COUNT  // ~330.8 px

// Vertical bar region in the photo (measured from gangsa.png)
const BAR_TOP    = 250   // where bar tops begin
const BAR_BOTTOM = 1380  // where bar bottoms end

export default {
  props: {
    instrument: Object,
  },
  emits: ['play-note', 'mute-note'],
  setup(props, { emit }) {
    const barStates = reactive({})
    const heldKeys = new Set()

    const getBarStyle = (i) => {
      const left   = ((X_START + i * BAR_SLOT) / IMG_W) * 100
      const width  = (BAR_SLOT / IMG_W) * 100
      const top    = (BAR_TOP / IMG_H) * 100
      const height = ((BAR_BOTTOM - BAR_TOP) / IMG_H) * 100
      return {
        left:   `${left}%`,
        width:  `${width}%`,
        top:    `${top}%`,
        height: `${height}%`,
      }
    }

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

    return { KEYS, barStates, getBarStyle, onBarDown, onBarTouch }
  },
}
</script>
