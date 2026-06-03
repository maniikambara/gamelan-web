<template>
  <div class="suling-panel">

    <!-- Keyboard hint strip -->
    <div class="suling-kbd-strip">
      <span v-for="(k, i) in KEYS" :key="i"
        class="suling-kbd-chip"
        :class="{ active: holeStates[i] }">
        <span class="suling-chip-note">{{ instrument.notes[i]?.name }}</span>
        <kbd class="suling-chip-key">{{ k }}</kbd>
      </span>
    </div>

    <!-- Suling image displayed horizontally via canvas -->
    <div class="suling-canvas-wrap">
      <canvas
        ref="canvasRef"
        class="suling-canvas"
        :width="canvasW"
        :height="canvasH"
        @click="onCanvasClick"
        @touchstart.prevent="onCanvasTouch"
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
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'

const KEYS = ['Z', 'X', 'C', 'V', 'B', 'N']
const KEY_TO_IDX = Object.fromEntries(KEYS.map((k, i) => [k.toLowerCase(), i]))

export default {
  props: {
    instrument: Object,
  },
  emits: ['play-note'],
  setup(props, { emit }) {
    const canvasRef = ref(null)
    const imgRef    = ref(null)
    const holeStates = reactive({})

    // Canvas is landscape: (imgH × imgW) 
    const canvasW = computed(() => props.instrument.imgH ?? 688)   // 688
    const canvasH = computed(() => props.instrument.imgW ?? 387)   // 387

    // Draw suling image rotated -90° into the landscape canvas
    // Transform: translate(0, canvasH) rotate(-90°)
    // → point (ox, oy) in original image lands at screen (oy, canvasH - ox)
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

      props.instrument.holeY.forEach((hy, i) => {
        // Original (holeCX, hy) → display (hy*scaleW, (imgW-holeCX)*scaleH)
        const dx = hy * scaleW
        const dy = (img.naturalWidth - holeCX) * scaleH
        const r  = props.instrument.hitRadius * Math.min(scaleW, scaleH)

        const isActive = !!holeStates[i]
        ctx.beginPath()
        ctx.arc(dx, dy, r, 0, Math.PI * 2)
        ctx.fillStyle   = isActive ? 'rgba(126,200,80,0.65)' : 'rgba(126,200,80,0.18)'
        ctx.strokeStyle = isActive ? 'rgba(126,200,80,1)'    : 'rgba(126,200,80,0.5)'
        ctx.lineWidth   = isActive ? 2 : 1
        ctx.fill()
        ctx.stroke()

        // Note label
        ctx.fillStyle  = isActive ? '#7EC850' : 'rgba(126,200,80,0.8)'
        ctx.font       = 'bold 13px Cinzel, serif'
        ctx.textAlign  = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(props.instrument.notes[i]?.name ?? String(i + 1), dx, dy)
      })
    }

    // Click → convert display → original image coords → hole detection
    const hitFromDisplay = (vx, vy) => {
      const canvas = canvasRef.value
      const img    = imgRef.value
      if (!canvas || !img) return null
      const rect = canvas.getBoundingClientRect()
      // Display pixel position on canvas
      const cx = (vx - rect.left) / rect.width  * canvas.width
      const cy = (vy - rect.top)  / rect.height * canvas.height
      // Invert the rotation: original (ox, oy) = (canvasH - cy, cx) (for -90° rotation)
      const ox = img.naturalWidth - cy * (img.naturalWidth  / canvas.height)
      const oy = cx               * (img.naturalHeight / canvas.width)
      // Find closest hole
      let bestI = -1, bestD = Infinity
      props.instrument.holeY.forEach((hy, i) => {
        const d = Math.hypot(ox - props.instrument.holeCX, oy - hy)
        if (d < bestD) { bestD = d; bestI = i }
      })
      return bestD <= props.instrument.hitRadius ? bestI : null
    }

    const playHole = (i) => {
      if (i == null || i < 0) return
      const note = props.instrument.notes[i]
      emit('play-note', { noteIndex: note.index, noteName: note.name, freq: note.freq })
      holeStates[i] = true
      drawSuling()
      setTimeout(() => {
        holeStates[i] = false
        drawSuling()
      }, 400)
    }

    const onCanvasClick = (e) => {
      playHole(hitFromDisplay(e.clientX, e.clientY))
    }

    const onCanvasTouch = (e) => {
      const t = e.changedTouches[0]
      playHole(hitFromDisplay(t.clientX, t.clientY))
    }

    // Keyboard
    const onKeyDown = (e) => {
      if (e.repeat) return
      const idx = KEY_TO_IDX[e.key.toLowerCase()]
      if (idx == null) return
      e.preventDefault()
      playHole(idx)
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

    return { canvasRef, imgRef, canvasW, canvasH, KEYS, holeStates, onCanvasClick, onCanvasTouch, drawSuling }
  },
}
</script>
