<template>
  <div>
    <div class="kendang-body-wrap">
      <img :src="instrument.image" class="kendang-body-img" draggable="false" alt="Kendang Bali" />
    </div>

    <div class="drums-row">
      <div class="drum-cell">
        <div class="drum-label drum-label-muka">MUKA &nbsp;<kbd class="kbd-small">A</kbd> Tut · <kbd class="kbd-small">S</kbd> Pak</div>
        <div class="snare-wrap">
          <img ref="imgMukaRef" :src="instrument.snareImage" class="snare-img" alt="Kendang Muka" draggable="false" />
          <canvas ref="canvasMukaRef" class="hit-canvas"></canvas>
        </div>
        <div class="zone-hints">
          <span class="zone-inner">Tengah = Tut</span>
          <span class="zone-sep">·</span>
          <span class="zone-outer">Tepi = Pak</span>
        </div>
      </div>

      <div class="drum-cell">
        <div class="drum-label drum-label-belakang">BELAKANG &nbsp;<kbd class="kbd-small">D</kbd> Dag · <kbd class="kbd-small">F</kbd> Dug</div>
        <div class="snare-wrap">
          <img ref="imgBelakangRef" :src="instrument.snareImage" class="snare-img" alt="Kendang Belakang" draggable="false" />
          <canvas ref="canvasBelakangRef" class="hit-canvas"></canvas>
        </div>
        <div class="zone-hints">
          <span class="zone-inner">Tengah = Dag</span>
          <span class="zone-sep">·</span>
          <span class="zone-outer">Tepi = Dug</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'

const KENDANG_KEYS = ['a', 's', 'd', 'f']
const KEY_LABELS   = ['A', 'S', 'D', 'F']
// a/d → muka tengah/pinggir;  s/f → belakang tengah/pinggir
// note indices: 0=muka-tengah, 1=muka-pinggir, 2=belakang-tengah, 3=belakang-pinggir

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

      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        const noteIndex = props.instrument.detectHit(x, y, props.instrument.snareW, canvas.width, bagian)
        if (noteIndex === null) return

        const scale = props.instrument.snareW / canvas.width
        const ox = x * scale
        const oy = y * scale
        const dist = Math.hypot(ox - props.instrument.snareCX, oy - props.instrument.snareCY)

        let positionGain = 1.0
        if (noteIndex === 0 || noteIndex === 2) {
          // Inner zone: maximum at innerR * 0.6. Linear dropoff towards center and edge.
          const center = props.instrument.innerR * 0.6
          const diff = Math.abs(dist - center)
          positionGain = Math.max(0.4, 1.0 - diff / (props.instrument.innerR * 0.8))
        } else if (noteIndex === 1 || noteIndex === 3) {
          // Outer zone: maximum at (innerR + outerR) / 2
          const center = (props.instrument.innerR + props.instrument.outerR) / 2
          const diff = Math.abs(dist - center)
          const span = (props.instrument.outerR - props.instrument.innerR) / 2
          positionGain = Math.max(0.4, 1.0 - diff / (span * 1.5))
        }

        const note = props.instrument.notes[noteIndex]
        emit('play-note', { noteIndex: note.index, noteName: note.name, freq: note.freq, positionGain })

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

      window.addEventListener('keydown', onKeyDown)
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', onKeyDown)
    })

    const onKeyDown = (e) => {
      if (e.repeat) return
      const ki = KENDANG_KEYS.indexOf(e.key.toLowerCase())
      if (ki < 0 || ki >= props.instrument.notes.length) return
      e.preventDefault()
      const note = props.instrument.notes[ki]
      emit('play-note', { noteIndex: note.index, noteName: note.name, freq: note.freq })
      const bagian = ki < 2 ? 'muka' : 'belakang'
      const canvasRef = ki < 2 ? canvasMukaRef : canvasBelakangRef
      highlights.value[bagian] = note.index
      drawOverlay(bagian, note.index)
      setTimeout(() => {
        if (highlights.value[bagian] === note.index) {
          highlights.value[bagian] = null
          drawOverlay(bagian, null)
        }
      }, 400)
    }

    return {
      imgMukaRef, imgBelakangRef, canvasMukaRef, canvasBelakangRef,
      KEY_LABELS,
    }
  },
}
</script>
