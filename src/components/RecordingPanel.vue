<template>
  <section>
    <p class="right-section-title">Rekaman</p>
    <div class="rec-controls">
      <button
        v-if="!isRecording"
        class="rec-btn rec-btn-start"
        @click="startRec"
      >
        Mulai Rekam
      </button>
      <button
        v-if="isRecording"
        class="rec-btn rec-btn-stop"
        @click="stopRec"
      >
        Hentikan Rekaman
      </button>

      <div v-if="isRecording" class="rec-indicator">
        <div class="rec-dot"></div>
        <span>REC</span>
        <span>{{ elapsedTime.toFixed(1) }}s</span>
      </div>

      <div v-if="recordedUrl" class="rec-output">
        <audio :src="recordedUrl" controls></audio>
        <a :href="recordedUrl" download="rekaman_gamelan.wav" class="rec-dl-btn">
          Unduh Rekaman (WAV)
        </a>
        <button class="rec-clear-btn" @click="clearRec">Hapus Rekaman</button>
      </div>
    </div>
  </section>
</template>

<script>
import { ref } from 'vue'

export default {
  emits: ['record-start', 'record-stop'],
  setup(props, { emit }) {
    const isRecording = ref(false)
    const recordedUrl = ref(null)
    const elapsedTime = ref(0)
    let timerInterval = null

    const startRec = () => {
      isRecording.value = true
      elapsedTime.value = 0
      emit('record-start')

      timerInterval = setInterval(() => {
        elapsedTime.value += 0.1
      }, 100)
    }

    const stopRec = () => {
      isRecording.value = false
      clearInterval(timerInterval)
      emit('record-stop', (result) => {
        if (result && result.url) {
          recordedUrl.value = result.url
        }
      })
    }

    const clearRec = () => {
      if (recordedUrl.value) {
        URL.revokeObjectURL(recordedUrl.value)
      }
      recordedUrl.value = null
      elapsedTime.value = 0
    }

    return {
      isRecording,
      recordedUrl,
      elapsedTime,
      startRec,
      stopRec,
      clearRec,
    }
  },
}
</script>
