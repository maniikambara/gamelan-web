<template>
  <div class="gangsa-panel">

    <!-- Full instrument with bars overlaid -->
    <div class="gangsa-instrument" ref="instrumentRef">
      <!-- Gangsa body (background) -->
      <img
        src="/assets/gangsa.png"
        alt="Gangsa Bali"
        class="gangsa-body-img"
        draggable="false"
        @load="onBodyLoad"
        ref="bodyImgRef"
      />

      <!-- Clickable bar overlays positioned on top of the body -->
      <div
        v-for="(note, i) in instrument.notes"
        :key="note.index"
        class="gangsa-bar-overlay"
        :class="{
          'bar--active': barStates[i] === 'play',
          'bar--mute':   barStates[i] === 'mute',
        }"
        :style="barPositions[i]"
        :title="`${note.name} · ${KEYS[i]} · Klik bawah = mute`"
        @mousedown="onBarDown($event, i)"
        @touchstart.prevent="onBarTouch($event, i)"
      >
        <img
          :src="`/assets/gangsa/${i + 1}.png`"
          :alt="note.name"
          class="gangsa-bar-img"
          draggable="false"
        />
        <!-- Glow overlay -->
        <div class="gangsa-bar-glow" />
        <!-- Mute zone indicator -->
        <div class="gangsa-bar-mute-zone">
          <span class="gangsa-mute-icon">■</span>
        </div>
        <!-- Note name label -->
        <div class="gangsa-bar-note">{{ note.name }}</div>
        <!-- Key badge -->
        <div class="gangsa-bar-key">{{ KEYS[i] }}</div>
      </div>
    </div>

    <!-- Keyboard guide strip -->
    <div class="gangsa-keys-row">
      <div v-for="(note, i) in instrument.notes" :key="'k'+i" class="gangsa-key-cell">
        <kbd class="gangsa-key-badge"
          :class="{ 'key--active': barStates[i] === 'play', 'key--mute': barStates[i] === 'mute' }"
        >{{ KEYS[i] }}</kbd>
        <span class="gangsa-key-note">{{ note.name }}</span>
      </div>
    </div>

    <!-- Zone legend -->
    <div class="gangsa-legend">
      <span class="legend-play">&#9654; Klik = pukul</span>
      <span class="legend-sep">&#183;</span>
      <span class="legend-mute">&#9632; Klik bawah = mute</span>
      <span class="legend-sep">&#183;</span>
      <span class="legend-kbd">Keyboard Q&ndash;P</span>
    </div>

  </div>
</template>

<script>
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue'

const KEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
const KEY_TO_IDX = Object.fromEntries(KEYS.map((k, i) => [k.toLowerCase(), i]))

// Y threshold (relative to element height) below which = mute zone
const MUTE_ZONE_RATIO = 0.75

// Bar positions mapped from the original gangsa.png (3799 x 2129).
// Each bar is defined by its left%, top%, width%, height% relative to the full image.
// These were measured from the instrument photo: bars span from ~7.5% to ~94.5% horizontally,
// and from ~12% to ~68% vertically. Bars are progressively narrower toward the right.
const BAR_LAYOUT = [
  { left: 7.5,  top: 15, width: 8.7, height: 53 },
  { left: 16.4, top: 14, width: 8.6, height: 53 },
  { left: 25.2, top: 13, width: 8.5, height: 53 },
  { left: 33.9, top: 12, width: 8.4, height: 53 },
  { left: 42.5, top: 12, width: 8.3, height: 52 },
  { left: 51.0, top: 12, width: 8.2, height: 51 },
  { left: 59.4, top: 12, width: 8.0, height: 50 },
  { left: 67.6, top: 12, width: 7.8, height: 49 },
  { left: 75.6, top: 13, width: 7.6, height: 48 },
  { left: 83.4, top: 13, width: 7.5, height: 48 },
]

export default {
  props: {
    instrument: Object,
  },
  emits: ['play-note', 'mute-note'],
  setup(props, { emit }) {
    const barStates = reactive({})
    const heldKeys = new Set()
    const instrumentRef = ref(null)
    const bodyImgRef = ref(null)

    const barPositions = computed(() =>
      BAR_LAYOUT.map(b => ({
        left:   `${b.left}%`,
        top:    `${b.top}%`,
        width:  `${b.width}%`,
        height: `${b.height}%`,
      }))
    )

    const onBodyLoad = () => {
      // Force re-render once the image dimensions are known
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

    return {
      KEYS, barStates, barPositions,
      instrumentRef, bodyImgRef,
      onBodyLoad, onBarDown, onBarTouch,
    }
  },
}
</script>
