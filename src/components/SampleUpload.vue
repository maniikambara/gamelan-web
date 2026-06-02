<template>
  <section>
    <p class="right-section-title">Upload Sampel Audio</p>
    <p style="font-size:0.72rem;color:var(--text-dim);margin-bottom:0.75rem;line-height:1.5;">
      Upload file .wav atau .mp3 per nada. Tanpa sampel, suara sintetis otomatis digunakan.
    </p>
    <div class="upload-form">
      <select v-model="selectedNote" class="upload-select">
        <option value="">Pilih nada...</option>
        <option v-for="inst in instruments" :key="inst.key" :value="inst.key" disabled>
          ─── {{ inst.label }} ───
        </option>
        <template v-for="inst in instruments" :key="`group-${inst.key}`">
          <option v-for="note in inst.notes" :key="`${inst.key}-${note.name}`" :value="`${inst.key}/${note.name}`">
            {{ inst.label }}: {{ note.name }}
          </option>
        </template>
      </select>

      <button class="upload-btn" @click="triggerFileInput" :class="{ dragging: isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
      >
        {{ isDragging ? 'Lepaskan file di sini' : 'Pilih atau seret file' }}
      </button>

      <input
        ref="fileInput"
        type="file"
        accept=".wav,.mp3,.ogg,.flac"
        style="display:none"
        @change="handleFileChange"
      />

      <div v-if="statusMessage" :class="['upload-status', statusType]">
        {{ statusMessage }}
      </div>
    </div>
  </section>
</template>

<script>
import { ref } from 'vue'

export default {
  props: {
    instruments: Object,
  },
  emits: ['sample-loaded'],
  setup(props, { emit }) {
    const selectedNote = ref('')
    const fileInput = ref(null)
    const isDragging = ref(false)
    const statusMessage = ref('')
    const statusType = ref('')

    const triggerFileInput = () => {
      fileInput.value?.click()
    }

    const handleFileChange = async (e) => {
      const file = e.target.files?.[0]
      if (!file || !selectedNote.value) {
        statusMessage.value = 'Pilih nada terlebih dahulu'
        statusType.value = 'error'
        return
      }

      await uploadFile(file)
    }

    const handleDrop = async (e) => {
      isDragging.value = false
      const file = e.dataTransfer?.files?.[0]
      if (!file) return

      if (!selectedNote.value) {
        statusMessage.value = 'Pilih nada terlebih dahulu'
        statusType.value = 'error'
        return
      }

      await uploadFile(file)
    }

    const uploadFile = async (file) => {
      try {
        const [instrument, noteName] = selectedNote.value.split('/')
        const arrayBuffer = await file.arrayBuffer()

        emit('sample-loaded', instrument, noteName, arrayBuffer)

        statusMessage.value = `Sampel "${noteName}" berhasil dimuat`
        statusType.value = 'success'

        setTimeout(() => {
          statusMessage.value = ''
          selectedNote.value = ''
        }, 3000)
      } catch (error) {
        statusMessage.value = `Error: ${error.message}`
        statusType.value = 'error'
      }
    }

    return {
      selectedNote,
      fileInput,
      isDragging,
      statusMessage,
      statusType,
      triggerFileInput,
      handleFileChange,
      handleDrop,
      instruments: Object.values(props.instruments),
    }
  },
}
</script>
