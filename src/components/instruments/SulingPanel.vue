<template>
  <div class="suling-wrap">
    <div style="position: relative">
      <img ref="imgRef" :src="instrument.image" class="instrument-img" draggable="false" alt="Suling Bali" />
      <canvas ref="canvasRef" class="hit-canvas"></canvas>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  props: {
    instrument: Object,
  },
  emits: ['play-note'],
  setup(props, { emit }) {
    const imgRef = ref(null)
    const canvasRef = ref(null)
    let highlightedHole = null

    const drawOverlay = (activeIndex = null) => {
      if (!canvasRef.value || !imgRef.value) return

      const canvas = canvasRef.value
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const scale = canvas.width / props.instrument.imgW
      const holeCX = props.instrument.holeCX * scale
      const hitRadius = props.instrument.hitRadius * scale

      props.instrument.holeY.forEach((hy, i) => {
        const y = hy * scale
        const isActive = activeIndex === i

        ctx.fillStyle = isActive ? 'rgba(126,200,80,0.6)' : 'rgba(126,200,80,0.2)'
        ctx.beginPath()
        ctx.arc(holeCX, y, hitRadius, 0, Math.PI * 2)
        ctx.fill()

        if (isActive) {
          ctx.strokeStyle = 'rgba(126,200,80,0.9)'
          ctx.lineWidth = 2
          ctx.stroke()
        }

        ctx.fillStyle = isActive ? '#7EC850' : 'rgba(126,200,80,0.7)'
        ctx.font = `bold 12px 'Cinzel', serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(`${i + 1}`, holeCX, y)
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

        const holeIndex = props.instrument.detectHit(x, y, props.instrument.imgW, canvas.width)
        if (holeIndex === null) return

        const note = props.instrument.notes[holeIndex]
        await emit('play-note', { noteIndex: note.index, noteName: note.name, freq: note.freq })

        highlightedHole = holeIndex
        drawOverlay(holeIndex)

        setTimeout(() => {
          if (highlightedHole === holeIndex) {
            highlightedHole = null
            drawOverlay(null)
          }
        }, 400)
      })

      const observer = new ResizeObserver(() => {
        canvas.width = img.offsetWidth
        canvas.height = img.offsetHeight
        drawOverlay(highlightedHole)
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

    return {
      imgRef,
      canvasRef,
    }
  },
}
</script>
