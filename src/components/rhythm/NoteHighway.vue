<template>
  <div class="rhythm-highway-wrap">
    <div class="rhythm-progress-bar">
      <div class="rhythm-progress-fill" :style="{ width: progressPercent + '%' }" />
    </div>
    <canvas ref="canvasRef" class="rhythm-highway-canvas" />
  </div>
</template>

<script>
/**
 * NoteHighway.vue — merender lajur nada, tile yang jatuh, dan indikator
 * progres lagu memakai Canvas 2D untuk tile (Bagian 8.3 rancangan:
 * direkomendasikan untuk menjaga frame rate stabil dibanding elemen DOM
 * per-tile) dan elemen HTML untuk progress bar (Bagian 6, "indikator
 * progres horizontal di bagian atas layar"). Posisi tiap tile dihitung dari
 * properti reaktif yang berasal dari useRhythmEngine (currentTimeMs,
 * noteTravelTimeMs), bukan dihitung ulang secara independen di sini.
 *
 * Gaya tile (lingkaran bertepi emas, glyph di tengah, label kecil di bawah)
 * meniru gaya tombol nada yang sudah ada pada SulingPanel.vue/GangsaPanel.vue
 * (Bagian 6 rancangan), bukan bentuk baru, agar tile terasa sebagai
 * kelanjutan visual dari tombol yang sudah dikenal pengguna.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

const JUDGMENT_MISS_COLOR = 'rgba(216,82,79,0.9)'

function hexToRgba(hex, alpha) {
  const h = (hex || '#C8960C').replace('#', '')
  const r = parseInt(h.substring(0, 2), 16) || 0
  const g = parseInt(h.substring(2, 4), 16) || 0
  const b = parseInt(h.substring(4, 6), 16) || 0
  return `rgba(${r},${g},${b},${alpha})`
}

export default {
  name: 'NoteHighway',
  props: {
    tiles: { type: Array, required: true },
    currentTimeMs: { type: Number, required: true },
    noteTravelTimeMs: { type: Number, required: true },
    laneIndices: { type: Array, required: true },
    accentColor: { type: String, default: '#C8960C' },
    isPlaying: { type: Boolean, default: false },
    // { [noteIndex]: { main: string, sub: string } } — glyph utama (angka utk
    // Suling, nama nada utk Gangsa) dan label kecil pelengkap, lihat Bagian 6.
    tileLabels: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const canvasRef = ref(null)
    let ctx = null
    let rafId = null
    let ro = null
    const dpr = window.devicePixelRatio || 1

    // Indikator progres horizontal keseluruhan lagu (Bagian 6). Total durasi
    // diturunkan dari tile terakhir pada chart yang sedang dimuat -- tiles
    // sudah dijamin terurut menaik oleh validateChart di useChartLoader.js.
    const progressPercent = computed(() => {
      if (!props.tiles.length) return 0
      const totalMs = props.tiles[props.tiles.length - 1].timeMs
      if (totalMs <= 0) return 0
      const pct = (props.currentTimeMs / totalMs) * 100
      return Math.max(0, Math.min(100, pct))
    })

    function draw() {
      if (ctx && canvasRef.value) {
        const cssW = canvasRef.value.clientWidth
        const cssH = canvasRef.value.clientHeight
        if (cssW && cssH) {
          renderFrame(cssW, cssH)
        }
      }
      if (props.isPlaying) {
        rafId = requestAnimationFrame(draw)
      } else {
        rafId = null
      }
    }

    function renderFrame(cssW, cssH) {
      ctx.clearRect(0, 0, cssW, cssH)
      const n = Math.max(props.laneIndices.length, 1)
      const laneW = cssW / n
      const hitY = cssH - 26

      ctx.save()
      ctx.strokeStyle = 'rgba(200,150,12,0.14)'
      ctx.lineWidth = 1
      for (let i = 1; i < n; i++) {
        const x = Math.round(i * laneW) + 0.5
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, cssH)
        ctx.stroke()
      }
      ctx.restore()

      ctx.save()
      ctx.strokeStyle = props.accentColor
      ctx.globalAlpha = 0.85
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(0, hitY)
      ctx.lineTo(cssW, hitY)
      ctx.stroke()
      ctx.restore()

      const travel = props.noteTravelTimeMs || 1
      const now = props.currentTimeMs
      const radius = Math.max(14, Math.min(laneW * 0.32, 26))

      for (const t of props.tiles) {
        if (t.hit) continue
        const spawnMs = t.timeMs - travel
        const ratio = (now - spawnMs) / travel
        if (ratio < -0.05 || ratio > 1.15) continue

        const pos = props.laneIndices.indexOf(t.noteIndex)
        if (pos < 0) continue
        const cx = pos * laneW + laneW / 2
        const cy = ratio * hitY

        const label = props.tileLabels[t.noteIndex] || { main: '?', sub: '' }
        const strokeColor = t.missed ? JUDGMENT_MISS_COLOR : props.accentColor

        // Lingkaran bertepi emas (atau warna aksen instrumen), meniru gaya
        // tombol nada fisik: border solid, isian semi-transparan.
        ctx.save()
        if (!t.missed) {
          ctx.shadowColor = props.accentColor
          ctx.shadowBlur = 12
        }
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fillStyle = t.missed ? 'rgba(216,82,79,0.12)' : hexToRgba(props.accentColor, 0.18)
        ctx.fill()
        ctx.lineWidth = 2.5
        ctx.strokeStyle = strokeColor
        ctx.globalAlpha = t.missed ? 0.6 : 1
        ctx.stroke()
        ctx.restore()

        // Glyph utama (angka keyboard utk Suling, nama nada utk Gangsa)
        ctx.save()
        ctx.globalAlpha = t.missed ? 0.55 : 1
        ctx.fillStyle = strokeColor
        ctx.font = `700 ${Math.round(radius * 0.85)}px Cinzel, serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(label.main, cx, cy + 1)
        ctx.restore()

        // Label kecil pelengkap di bawah lingkaran
        if (label.sub) {
          ctx.save()
          ctx.globalAlpha = t.missed ? 0.45 : 0.75
          ctx.fillStyle = '#dddddd'
          ctx.font = '600 10px Lato, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillText(label.sub, cx, cy + radius + 4)
          ctx.restore()
        }
      }
    }

    function resize() {
      if (!canvasRef.value) return
      const cssW = canvasRef.value.clientWidth
      const cssH = canvasRef.value.clientHeight
      if (!cssW || !cssH) return
      canvasRef.value.width = Math.round(cssW * dpr)
      canvasRef.value.height = Math.round(cssH * dpr)
      ctx = canvasRef.value.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!props.isPlaying) renderFrame(cssW, cssH)
    }

    watch(() => props.isPlaying, (playing) => {
      if (playing && rafId == null) {
        rafId = requestAnimationFrame(draw)
      }
    })

    onMounted(() => {
      ctx = canvasRef.value.getContext('2d')
      resize()
      ro = new ResizeObserver(resize)
      ro.observe(canvasRef.value)
      rafId = requestAnimationFrame(draw)
    })

    onBeforeUnmount(() => {
      if (rafId != null) cancelAnimationFrame(rafId)
      if (ro) ro.disconnect()
    })

    return { canvasRef, progressPercent }
  },
}
</script>
