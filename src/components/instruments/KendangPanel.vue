<template>
  <div>
    <div class="kendang-body-wrap">
      <img :src="instrument.image" class="kendang-body-img" draggable="false" alt="Kendang Bali" />
    </div>

    <div class="drums-row">
      <div class="drum-cell">
        <div class="drum-label drum-label-muka">MUKA</div>
        <div class="snare-wrap">
          <img ref="imgMukaRef" :src="instrument.snareImage" class="snare-img" alt="Kendang Muka" draggable="false" />
          <canvas ref="canvasMukaRef" class="hit-canvas"></canvas>
        </div>
        <div class="zone-hints">
          <span class="zone-inner">Tengah = Tung</span>
          <span class="zone-sep">·</span>
          <span class="zone-outer">Tepi = Pak</span>
        </div>
      </div>

      <div class="drum-cell">
        <div class="drum-label drum-label-belakang">BELAKANG</div>
        <div class="snare-wrap">
          <img ref="imgBelakangRef" :src="instrument.snareImage" class="snare-img" alt="Kendang Belakang" draggable="false" />
          <canvas ref="canvasBelakangRef" class="hit-canvas"></canvas>
        </div>
        <div class="zone-hints">
          <span class="zone-inner">Tengah = Tung</span>
          <span class="zone-sep">·</span>
          <span class="zone-outer">Tepi = Pak</span>
        </div>
      </div>
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
    const imgMukaRef = ref(null)
    const imgBelakangRef = ref(null)
    const canvasMukaRef = ref(null)
    const canvasBelakangRef = ref(null)
    const highlights = ref({ muka: null, belakang: null })

    const drawOverlay = (bagian, activeIndex = null) => {
      const canvasRef = bagian === 'muka' ? canvasMukaRef : canvasBelakangRef
      if (!canvasRef.value) return

      const canvas = canvasRef.value
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const cx = props.instrument.snareCX
      const cy = props.instrument.snareCY
      const inner = props.instrument.innerR
      const outer = props.instrument.outerR

      const scale = canvas.width / props.instrument.snareW

      if (activeIndex !== null) {
        const isInner = (bagian === 'muka' && activeIndex === 0) || (bagian === 'belakang' && activeIndex === 2)
        const r = isInner ? inner : outer
        ctx.fillStyle = 'rgba(200,150,12,0.35)'
        ctx.beginPath()
        ctx.arc(cx * scale, cy * scale, r * scale, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,200,50,0.7)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(200,150,12,0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx * scale, cy * scale, inner * scale, 0, Math.PI * 2)
      ctx.stroke()

      ctx.strokeStyle = 'rgba(200,150,12,0.25)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx * scale, cy * scale, outer * scale, 0, Math.PI * 2)
      ctx.stroke()
    }

    const setupCanvas = (bagian, imgRef, canvasRef) => {
      if (!canvasRef.value || !imgRef) return

      const canvas = canvasRef.value
      canvas.width = imgRef.offsetWidth
      canvas.height = imgRef.offsetHeight
      canvas.style.position = 'absolute'
      canvas.style.top = '0'
      canvas.style.left = '0'

      drawOverlay(bagian)

      canvas.addEventListener('click', async (e) => {
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const noteIndex = props.instrument.detectHit(x, y, props.instrument.snareW, canvas.width, bagian)
        if (noteIndex === null) return

        const note = props.instrument.notes[noteIndex]
        await emit('play-note', { noteIndex: note.index, noteName: note.name, freq: note.freq })

        highlights.value[bagian] = noteIndex
        drawOverlay(bagian, noteIndex)

        setTimeout(() => {
          if (highlights.value[bagian] === noteIndex) {
            highlights.value[bagian] = null
            drawOverlay(bagian, null)
          }
        }, 400)
      })

      const observer = new ResizeObserver(() => {
        canvas.width = imgRef.offsetWidth
        canvas.height = imgRef.offsetHeight
        drawOverlay(bagian, highlights.value[bagian])
      })
      observer.observe(imgRef)
    }

    onMounted(() => {
      if (imgMukaRef.value && imgMukaRef.value.complete) {
        setupCanvas('muka', imgMukaRef.value, canvasMukaRef)
      }
      if (imgBelakangRef.value && imgBelakangRef.value.complete) {
        setupCanvas('belakang', imgBelakangRef.value, canvasBelakangRef)
      }

      imgMukaRef.value?.addEventListener('load', () => {
        setupCanvas('muka', imgMukaRef.value, canvasMukaRef)
      })
      imgBelakangRef.value?.addEventListener('load', () => {
        setupCanvas('belakang', imgBelakangRef.value, canvasBelakangRef)
      })
    })

    return {
      imgMukaRef,
      imgBelakangRef,
      canvasMukaRef,
      canvasBelakangRef,
    }
  },
}
</script>
