<template>
  <div class="img-wrap gangsa-wrap">
    <img ref="imgRef" :src="instrument.image" class="instrument-img" draggable="false" alt="Gangsa" />
    <canvas ref="canvasRef" class="hit-canvas"></canvas>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'

export default {
  props: {
    instrument: Object,
  },
  emits: ['play-note'],
  setup(props, { emit }) {
    const imgRef = ref(null)
    const canvasRef = ref(null)
    let highlightedNote = null

    const drawOverlay = (activeIndex = null) => {
      if (!canvasRef.value || !imgRef.value) return

      const canvas = canvasRef.value
      const img = imgRef.value
      const ctx = canvas.getContext('2d')

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const W = canvas.width
      const H = canvas.height
      const scaleX = W / props.instrument.imgW
      const xStart = props.instrument.xStart * scaleX
      const xEnd = props.instrument.xEnd * scaleX
      const keyW = (xEnd - xStart) / 10

      props.instrument.notes.forEach((note, i) => {
        const kx = xStart + i * keyW
        const isActive = activeIndex === i

        if (isActive) {
          ctx.fillStyle = 'rgba(200,150,12,0.55)'
          ctx.fillRect(kx + 1, H * 0.05, keyW - 2, H * 0.85)
          ctx.strokeStyle = 'rgba(255,200,50,0.9)'
          ctx.lineWidth = 2
          ctx.strokeRect(kx + 1, H * 0.05, keyW - 2, H * 0.85)
        }

        const noteNum = i + 1
        const numSize = Math.max(18, Math.floor(keyW * 0.35))
        ctx.font = `bold ${numSize}px 'Cinzel', serif`
        ctx.fillStyle = isActive ? '#FFD700' : 'rgba(200,150,12,0.7)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(noteNum, kx + keyW / 2, H * 0.35)

        const lx = kx + keyW / 2
        const ly = H * 0.12
        const text = note.name
        const lblSize = Math.max(9, Math.floor(keyW * 0.16))
        ctx.font = `bold ${lblSize}px 'Cinzel', serif`
        const tw = ctx.measureText(text).width

        ctx.fillStyle = isActive ? 'rgba(255,200,50,0.95)' : 'rgba(0,0,0,0.7)'
        const pad = 4
        const x = lx - tw / 2 - pad
        const y = ly - 9
        const w = tw + pad * 2
        const h = 18
        const r = 3
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
        ctx.fill()

        ctx.fillStyle = isActive ? '#1a0f0a' : 'rgba(200,150,12,0.9)'
        ctx.fillText(text, lx, ly)

        if (i > 0) {
          ctx.strokeStyle = isActive ? 'rgba(255,200,50,0.4)' : 'rgba(200,150,12,0.35)'
          ctx.lineWidth = i % 2 === 0 ? 1.5 : 1
          ctx.beginPath()
          ctx.moveTo(kx, H * 0.05)
          ctx.lineTo(kx, H * 0.9)
          ctx.stroke()
        }
      })
    }

    const setupCanvas = () => {
      if (!imgRef.value || !canvasRef.value) return

      const canvas = canvasRef.value
      const img = imgRef.value
      canvas.width = img.offsetWidth
      canvas.height = img.offsetHeight
      canvas.style.position = 'absolute'
      canvas.style.top = '0'
      canvas.style.left = '0'

      drawOverlay()

      canvas.addEventListener('click', async (e) => {
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const noteIndex = props.instrument.detectHit(x, y, props.instrument.imgW, canvas.width)
        if (noteIndex === null) return

        const note = props.instrument.notes[noteIndex]
        await emit('play-note', { noteIndex: note.index, noteName: note.name, freq: note.freq })

        highlightedNote = noteIndex
        drawOverlay(noteIndex)

        setTimeout(() => {
          if (highlightedNote === noteIndex) {
            highlightedNote = null
            drawOverlay(null)
          }
        }, 400)
      })

      const observer = new ResizeObserver(() => {
        canvas.width = img.offsetWidth
        canvas.height = img.offsetHeight
        drawOverlay(highlightedNote)
      })
      observer.observe(img)
    }

    onMounted(() => {
      if (imgRef.value && imgRef.value.complete) {
        setupCanvas()
      } else if (imgRef.value) {
        imgRef.value.addEventListener('load', setupCanvas)
      }
    })

    watch(() => props.instrument.key, () => {
      highlightedNote = null
    })

    return {
      imgRef,
      canvasRef,
    }
  },
}
</script>
