<template>
  <div class="suling-panel" style="display: flex; flex-direction: column; align-items: center; width: 100%;">

    <!-- Top Section: Image and Octave Indicators -->
    <div
      style="display: flex; align-self: stretch; justify-content: center; align-items: center; flex-direction: row; gap: 40px; padding-top: 20px; padding-bottom: 30px; border-radius: 0px">
      <!-- Suling Icon -->
      <div style="width: 120px; display: flex; justify-content: center;">
        <img
          :src="instrument.image"
          alt="Suling Icon"
          style="display: block; height: 104px; object-fit: contain; transform: rotate(-90deg);" />
      </div>
      
      <!-- Nada Rendah / Tinggi Indicators -->
      <div
        style="display: flex; justify-content: flex-start; align-items: flex-start; flex-direction: column; gap: 12px; border-radius: 0px">
        <div
          style="width: 187px; display: flex; justify-content: flex-start; align-items: flex-start; flex-direction: column; padding: 11.2px 16px; background: #261D07; border: 1px solid #C8960C; border-radius: 12px">
          <p
            style="color: #C8960C; font-size: 14.1px; font-family: Cinzel; text-align: center; font-weight: 700; width: 100%; margin: 0;">
            Nada Rendah
          </p>
        </div>
        <div
          style="width: 187px; display: flex; justify-content: flex-start; align-items: flex-start; flex-direction: column; padding: 11.2px 16px; background: #261D07; border: 1px solid #C8960C; border-radius: 12px">
          <p
            style="color: #C8960C; font-size: 14.1px; font-family: Cinzel; text-align: center; font-weight: 700; width: 100%; margin: 0;">
            Nada Tinggi
          </p>
        </div>
      </div>
    </div>

    <!-- Hidden img used for drawImage -->
    <img
      ref="imgRef"
      :src="instrument.image"
      style="display:none"
      @load="drawBothSulings"
    />

    <div style="display: flex; flex-direction: column; gap: 32px; width: 100%; align-items: center; padding-bottom: 20px;">
      
      <!-- Group 8: Nada Rendah Block -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%;">
        <div class="suling-kbd-strip" style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; max-width: 600px;">
          <button v-for="note in notesRendah" :key="note.index"
            class="suling-kbd-chip"
            :class="{ active: activeNote === note.index }"
            @mousedown="playNote(note.index)"
            @touchstart.prevent="playNote(note.index)">
            <span class="suling-chip-note">{{ note.name }}</span>
            <kbd class="suling-chip-key">{{ KEYS[note.index] }}</kbd>
          </button>
        </div>
        <div class="suling-canvas-wrap" style="background: rgba(0,0,0,0.25); border: 1px solid rgba(200,150,12,0.18); border-radius: 12px; padding: 16px;">
          <canvas
            ref="canvasRefRendah"
            class="suling-canvas"
            :width="canvasW"
            :height="canvasH"
          />
        </div>
      </div>

      <!-- Group 9: Nada Tinggi Block -->
      <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%;">
        <div class="suling-kbd-strip" style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; max-width: 600px;">
          <button v-for="note in notesTinggi" :key="note.index"
            class="suling-kbd-chip"
            :class="{ active: activeNote === note.index }"
            @mousedown="playNote(note.index)"
            @touchstart.prevent="playNote(note.index)">
            <span class="suling-chip-note">{{ note.name }}</span>
            <kbd class="suling-chip-key">{{ KEYS[note.index] }}</kbd>
          </button>
        </div>
        <div class="suling-canvas-wrap" style="background: rgba(0,0,0,0.25); border: 1px solid rgba(200,150,12,0.18); border-radius: 12px; padding: 16px;">
          <canvas
            ref="canvasRefTinggi"
            class="suling-canvas"
            :width="canvasW"
            :height="canvasH"
          />
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
    const canvasRefRendah = ref(null)
    const canvasRefTinggi = ref(null)
    const imgRef          = ref(null)
    const activeNote      = ref(null)

    const notesRendah = computed(() => props.instrument.notes.slice(0, 5))
    const notesTinggi = computed(() => props.instrument.notes.slice(5, 10))

    // Canvas is landscape: (imgH × imgW) 
    const canvasW = computed(() => props.instrument.imgH ?? 688)   // 688
    const canvasH = computed(() => props.instrument.imgW ?? 387)   // 387

    const drawSingleCanvas = (canvas, isActiveOctave) => {
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
      // Only show closed holes if the note belongs to this octave's canvas
      const closedHoles = (note && isActiveOctave) ? note.closedHoles : []

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

    const drawBothSulings = () => {
      const isRendah = activeNote.value !== null && activeNote.value < 5
      const isTinggi = activeNote.value !== null && activeNote.value >= 5

      drawSingleCanvas(canvasRefRendah.value, isRendah)
      drawSingleCanvas(canvasRefTinggi.value, isTinggi)
    }

    watch(activeNote, () => drawBothSulings())

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
        if (imgRef.value?.complete) drawBothSulings()
      })
    })

    onUnmounted(() => {
      window.removeEventListener('keydown', onKeyDown)
    })

    return { 
      canvasRefRendah, canvasRefTinggi, imgRef, 
      canvasW, canvasH, KEYS, activeNote, 
      notesRendah, notesTinggi, playNote, drawBothSulings 
    }
  },
}
</script>
