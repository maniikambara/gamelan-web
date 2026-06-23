<template>
  <div class="suling-panel" style="display: flex; flex-direction: column; align-items: center; width: 100%; gap: 40px; padding-top: 20px;">

    <!-- Top Section: Canvas and Indicators -->
    <div style="display: flex; align-items: center; justify-content: center; gap: 40px; width: 100%; flex-wrap: wrap;">
      
      <!-- Suling Canvas -->
      <div class="suling-canvas-wrap" style="position: relative;">
        <canvas
          ref="canvasRef"
          class="suling-canvas"
          :width="canvasW"
          :height="canvasH"
          style="display: block; max-width: 100%; height: auto;"
        />
      </div>

      <!-- Nada Rendah / Tinggi Indicators -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div
          style="width: 187px; padding: 12px 16px; border-radius: 12px; transition: all 0.2s;"
          :style="isRendahActive ? 'background: rgba(200,150,12,0.2); border: 1px solid #C8960C; box-shadow: 0 0 15px rgba(200,150,12,0.4);' : 'background: #261D07; border: 1px solid rgba(200,150,12,0.3);'"
        >
          <p style="color: #C8960C; font-size: 14px; font-family: Cinzel; text-align: center; font-weight: 700; margin: 0; letter-spacing: 1px;">
            NADA RENDAH
          </p>
        </div>
        <div
          style="width: 187px; padding: 12px 16px; border-radius: 12px; transition: all 0.2s;"
          :style="isTinggiActive ? 'background: rgba(200,150,12,0.2); border: 1px solid #C8960C; box-shadow: 0 0 15px rgba(200,150,12,0.4);' : 'background: #261D07; border: 1px solid rgba(200,150,12,0.3);'"
        >
          <p style="color: #C8960C; font-size: 14px; font-family: Cinzel; text-align: center; font-weight: 700; margin: 0; letter-spacing: 1px;">
            NADA TINGGI
          </p>
        </div>
      </div>
    </div>

    <!-- Hidden img used for drawImage -->
    <img
      ref="imgRef"
      :src="instrument.image"
      style="display:none"
      @load="drawSuling"
    />

    <!-- Bottom Section: Buttons -->
    <div style="display: flex; flex-direction: column; gap: 32px; align-items: center; width: 100%;">
      
      <!-- Nada Rendah Buttons (1-5) -->
      <div class="suling-kbd-strip" style="display: flex; justify-content: center; gap: 32px; flex-wrap: wrap;">
        <div v-for="note in notesRendah" :key="note.index" style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <button
            class="suling-kbd-chip"
            :class="{ active: activeNote === note.index }"
            style="width: 64px; height: 64px; border-radius: 50%; border: 2px solid #C8960C; background: transparent; color: #C8960C; font-size: 24px; font-family: Cinzel; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; transition: all 0.1s;"
            :style="activeNote === note.index ? 'background: rgba(200,150,12,0.2); box-shadow: 0 0 15px rgba(200,150,12,0.5); transform: scale(0.95);' : ''"
            @mousedown="playNote(note.index)"
            @touchstart.prevent="playNote(note.index)">
            {{ KEYS[note.index] }}
          </button>
          <span style="color: #aaa; font-family: Cinzel; font-size: 14px; letter-spacing: 1px;">{{ note.name.split(' ')[0].toUpperCase() }}</span>
        </div>
      </div>

      <!-- Nada Tinggi Buttons (6-0) -->
      <div class="suling-kbd-strip" style="display: flex; justify-content: center; gap: 32px; flex-wrap: wrap;">
        <div v-for="note in notesTinggi" :key="note.index" style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
          <button
            class="suling-kbd-chip"
            :class="{ active: activeNote === note.index }"
            style="width: 64px; height: 64px; border-radius: 50%; border: 2px solid #C8960C; background: transparent; color: #C8960C; font-size: 24px; font-family: Cinzel; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; transition: all 0.1s;"
            :style="activeNote === note.index ? 'background: rgba(200,150,12,0.2); box-shadow: 0 0 15px rgba(200,150,12,0.5); transform: scale(0.95);' : ''"
            @mousedown="playNote(note.index)"
            @touchstart.prevent="playNote(note.index)">
            {{ KEYS[note.index] }}
          </button>
          <span style="color: #aaa; font-family: Cinzel; font-size: 14px; letter-spacing: 1px;">{{ note.name.split(' ')[0].toUpperCase() }}</span>
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
  emits: ['play-note'],
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

    const playNote = (i) => {
      if (i == null || i < 0) return
      const note = props.instrument.notes[i]
      emit('play-note', { noteIndex: note.index, noteName: note.name, freq: note.freq })
      
      activeNote.value = i
      // Keep hole pattern visible for the full synthesis duration (~5s)
      setTimeout(() => {
        if (activeNote.value === i) {
          activeNote.value = null
        }
      }, 5000)
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

    return { 
      canvasRef, imgRef, 
      canvasW, canvasH, KEYS, activeNote, 
      notesRendah, notesTinggi, isRendahActive, isTinggiActive, playNote, drawSuling 
    }
  },
}
</script>
