<template>
  <div class="suling-panel">

    <!-- Top Section: Canvas and Indicators -->
    <div class="suling-top-row">

      <!-- Suling Canvas -->
      <div class="suling-canvas-wrap">
        <canvas
          ref="canvasRef"
          class="suling-canvas"
          :width="canvasW"
          :height="canvasH"
        />
      </div>

      <!-- Nada Rendah / Tinggi Indicators -->
      <div class="suling-indicators">
        <div class="suling-indicator" :class="{ 'suling-indicator--active': isRendahActive }">
          <p class="suling-indicator-label">NADA RENDAH</p>
        </div>
        <div class="suling-indicator" :class="{ 'suling-indicator--active': isTinggiActive }">
          <p class="suling-indicator-label">NADA TINGGI</p>
        </div>
      </div>
    </div>

    <!-- Hidden img used for drawImage -->
    <img
      ref="imgRef"
      :src="instrument.image"
      class="suling-hidden-img"
      @load="drawSuling"
    />

    <!-- Bottom Section: Buttons -->
    <div class="suling-note-groups">

      <!-- Nada Rendah Buttons (1-5) -->
      <div class="suling-kbd-strip">
        <div v-for="note in notesRendah" :key="note.index" class="suling-note-key">
          <button
            class="suling-kbd-chip"
            :class="{ active: activeNote === note.index }"
            @mousedown="playNote(note.index)"
            @mouseup="stopNote(note.index)"
            @mouseleave="stopNote(note.index)"
            @touchstart.prevent="playNote(note.index)"
            @touchend.prevent="stopNote(note.index)">
            {{ KEYS[note.index] }}
          </button>
          <span class="suling-note-key-label">{{ note.name.split(' ')[0].toUpperCase() }}</span>
        </div>
      </div>

      <!-- Nada Tinggi Buttons (6-0) -->
      <div class="suling-kbd-strip">
        <div v-for="note in notesTinggi" :key="note.index" class="suling-note-key">
          <button
            class="suling-kbd-chip"
            :class="{ active: activeNote === note.index }"
            @mousedown="playNote(note.index)"
            @mouseup="stopNote(note.index)"
            @mouseleave="stopNote(note.index)"
            @touchstart.prevent="playNote(note.index)"
            @touchend.prevent="stopNote(note.index)">
            {{ KEYS[note.index] }}
          </button>
          <span class="suling-note-key-label">{{ note.name.split(' ')[0].toUpperCase() }}</span>
        </div>
      </div>

    </div>

  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const KEY_TO_IDX = Object.fromEntries(KEYS.map((k, i) => [k.toLowerCase(), i]))

export default {
  props: {
    instrument: Object,
  },
  emits: ['play-note', 'mute-note'],
  setup(props, { emit }) {
    const canvasRef = ref(null)
    const imgRef    = ref(null)
    const activeNote = ref(null)

    const notesRendah = computed(() => props.instrument.notes.slice(0, 5))
    const notesTinggi = computed(() => props.instrument.notes.slice(5, 10))

    const isRendahActive = computed(() => activeNote.value !== null && activeNote.value < 5)
    const isTinggiActive = computed(() => activeNote.value !== null && activeNote.value >= 5)

    // Canvas is landscape: (imgH × imgW)
    const canvasW = computed(() => props.instrument.imgH ?? 688)   // 688
    const canvasH = computed(() => props.instrument.imgW ?? 387)   // 387

    const drawSuling = () => {
      const canvas = canvasRef.value
      const img = imgRef.value
      if (!canvas || !img) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw rotated image
      ctx.save()
      ctx.translate(0, canvas.height)
      ctx.rotate(-Math.PI / 2)
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight)
      ctx.restore()

      // Draw hole indicators
      const scaleW = canvas.width  / img.naturalHeight   // 688/688 = 1
      const scaleH = canvas.height / img.naturalWidth    // 387/387 = 1
      const holeCX = props.instrument.holeCX             // 196 in original image

      const note = activeNote.value !== null ? props.instrument.notes[activeNote.value] : null
      const closedHoles = note ? note.closedHoles : []

      props.instrument.holeY.forEach((hy, i) => {
        // Original (holeCX, hy) → display (hy*scaleW, (imgW-holeCX)*scaleH)
        const dx = hy * scaleW
        const dy = (img.naturalWidth - holeCX) * scaleH
        const baseR = props.instrument.hitRadius * Math.min(scaleW, scaleH)

        const isClosed = closedHoles.includes(i)

        ctx.beginPath()

        if (isClosed) {
          // Indikator lubangnya ditekan buat warna merah dengan ukuran yang kecil
          const r = baseR * 0.4
          ctx.arc(dx, dy, r, 0, Math.PI * 2)
          ctx.fillStyle   = 'rgba(220, 38, 38, 0.9)' // Red color
          ctx.strokeStyle = 'rgba(220, 38, 38, 1)'
          ctx.lineWidth = 2
        } else {
          // Not pressed: faint outline or nothing
          const r = baseR * 0.8
          ctx.arc(dx, dy, r, 0, Math.PI * 2)
          ctx.fillStyle   = 'rgba(0, 0, 0, 0.0)'
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
          ctx.lineWidth = 1
        }

        ctx.fill()
        ctx.stroke()
      })
    }

    watch(activeNote, () => drawSuling())

    // Suling is held to sound (like actually blowing into it): press = start,
    // release = stop immediately. No fixed-duration auto-reset — the note
    // rings for as long as the key/button stays down.
    const playNote = (i) => {
      if (i == null || i < 0) return
      const note = props.instrument.notes[i]
      emit('play-note', { noteIndex: note.index, noteName: note.name, freq: note.freq })
      activeNote.value = i
    }

    const stopNote = (i) => {
      if (i == null || i < 0 || activeNote.value !== i) return
      const note = props.instrument.notes[i]
      emit('mute-note', { noteIndex: note.index, noteName: note.name })
      activeNote.value = null
    }

    // Keyboard
    const onKeyDown = (e) => {
      if (e.repeat) return
      const idx = KEY_TO_IDX[e.key.toLowerCase()]
      if (idx == null) return
      e.preventDefault()
      playNote(idx)
    }

    const onKeyUp = (e) => {
      const idx = KEY_TO_IDX[e.key.toLowerCase()]
      if (idx == null) return
      e.preventDefault()
      stopNote(idx)
    }

    onMounted(() => {
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
      nextTick(() => {
        if (imgRef.value?.complete) drawSuling()
      })
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    })

    return {
      canvasRef, imgRef,
      canvasW, canvasH, KEYS, activeNote,
      notesRendah, notesTinggi, isRendahActive, isTinggiActive, playNote, stopNote, drawSuling
    }
  },
}
</script>
