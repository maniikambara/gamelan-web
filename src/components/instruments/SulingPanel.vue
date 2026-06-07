<template>
  <div class="suling-panel">

    <!-- Keyboard hint strip -->
    <div class="suling-kbd-strip">
      <button v-for="(note, i) in instrument.notes" :key="i"
        class="suling-kbd-chip"
        :class="{ active: activeNote === i }"
        @mousedown="playNote(i)"
        @touchstart.prevent="playNote(i)">
        <span class="suling-chip-note">{{ note.name }}</span>
        <kbd class="suling-chip-key">{{ KEYS[i] }}</kbd>
      </button>
    </div>

    <!-- Suling image displayed horizontally via canvas -->
    <div class="suling-canvas-wrap">
      <canvas
        ref="canvasRef"
        class="suling-canvas"
        :width="canvasW"
        :height="canvasH"
      />
      <!-- Hidden img used for drawImage -->
      <img
        ref="imgRef"
        :src="instrument.image"
        style="display:none"
        @load="drawSuling"
      />
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
  emits: ['play-note'],
  setup(props, { emit }) {
    const canvasRef = ref(null)
    const imgRef    = ref(null)
    const activeNote = ref(null)

    // Canvas is landscape: (imgH × imgW) 
    const canvasW = computed(() => props.instrument.imgH ?? 688)   // 688
    const canvasH = computed(() => props.instrument.imgW ?? 387)   // 387

    // Draw suling image rotated -90° into the landscape canvas
    const drawSuling = () => {
      const canvas = canvasRef.value
      const img    = imgRef.value
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
        const r  = props.instrument.hitRadius * Math.min(scaleW, scaleH)

        const isClosed = closedHoles.includes(i)
        
        ctx.beginPath()
        ctx.arc(dx, dy, r, 0, Math.PI * 2)
        
        if (isClosed) {
          ctx.fillStyle   = 'rgba(126,200,80,0.65)'
          ctx.strokeStyle = 'rgba(126,200,80,1)'
        } else {
          ctx.fillStyle   = 'rgba(126,200,80,0.05)'
          ctx.strokeStyle = 'rgba(126,200,80,0.2)'
        }
        
        ctx.lineWidth = isClosed ? 2 : 1
        ctx.fill()
        ctx.stroke()
      })
    }

    watch(activeNote, () => drawSuling())

    const playNote = (i) => {
      if (i == null || i < 0) return
      const note = props.instrument.notes[i]
      emit('play-note', { noteIndex: note.index, noteName: note.name, freq: note.freq })
      
      activeNote.value = i
      setTimeout(() => {
        if (activeNote.value === i) {
          activeNote.value = null
        }
      }, 400)
    }

    // Keyboard
    const onKeyDown = (e) => {
      if (e.repeat) return
      const idx = KEY_TO_IDX[e.key.toLowerCase()]
      if (idx == null) return
      e.preventDefault()
      playNote(idx)
    }

    onMounted(() => {
      window.addEventListener('keydown', onKeyDown)
      nextTick(() => {
        if (imgRef.value?.complete) drawSuling()
      })
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', onKeyDown)
    })

    return { canvasRef, imgRef, canvasW, canvasH, KEYS, activeNote, playNote, drawSuling }
  },
}
</script>
