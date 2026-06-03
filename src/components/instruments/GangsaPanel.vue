<template>
  <div class="gangsa-panel">

    <!-- Instrument display: gangsa body as background, bars on top -->
    <div class="gangsa-stage">
      <!-- Gangsa body background image -->
      <img
        src="/assets/gangsa.png"
        alt="Gangsa Bali"
        class="gangsa-bg"
        draggable="false"
      />

      <!-- Bars row overlaid on top -->
      <div class="gangsa-bars-row">
        <div
          v-for="(note, i) in instrument.notes"
          :key="note.index"
          class="g-bar"
          :class="{
            'g-bar--hit':  barStates[i] === 'play',
            'g-bar--mute': barStates[i] === 'mute',
          }"
          :title="`${note.name} · ${KEYS[i]}`"
          @mousedown="onBarDown($event, i)"
          @touchstart.prevent="onBarTouch($event, i)"
        >
          <!-- Note name -->
          <span class="g-bar-name">{{ note.name }}</span>

          <!-- Bar image wrapper -->
          <div class="g-bar-frame">
            <img
              :src="`/assets/gangsa/${i + 1}.png`"
              :alt="note.name"
              class="g-bar-img"
              draggable="false"
            />
            <!-- Hit glow -->
            <div class="g-bar-glow" />
            <!-- Mute zone indicator -->
            <div class="g-bar-mzone">
              <span>■</span>
            </div>
          </div>

          <!-- Key -->
          <kbd class="g-bar-kbd">{{ KEYS[i] }}</kbd>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="gangsa-legend">
      <span class="legend-play">&#9654; Klik = pukul</span>
      <span class="legend-sep">&#183;</span>
      <span class="legend-mute">&#9632; Klik bawah = mute</span>
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

export default {
  props: {
    instrument: Object,
  },
  emits: ['play-note', 'mute-note'],
  setup(props, { emit }) {
    const barStates = reactive({})
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

    return { KEYS, barStates, onBarDown, onBarTouch }
  },
}
</script>
