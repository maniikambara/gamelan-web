/**
 * useChartLoader.js — Mode Permainan Ritme · Pemuat & validator chart
 *
 * Memuat seluruh berkas chart JSON dari src/charts/ memakai import.meta.glob
 * agar lagu baru otomatis terdaftar cukup dengan menambah berkas .json,
 * tanpa mengubah kode program (Bagian 5 rancangan). Setiap chart divalidasi:
 * noteIndex dan noteName pada tiap entri notes harus benar-benar cocok
 * dengan INSTRUMENTS[instrument].notes di src/instruments.js (Bagian 4.3
 * langkah 2), agar tile selalu dapat dipetakan ke tombol yang valid.
 */

import { INSTRUMENTS } from '../instruments'

const chartModules = import.meta.glob('../charts/*.json', { eager: true })

export function validateChart(chart) {
  const errors = []
  if (!chart || typeof chart !== 'object') return ['Berkas chart bukan objek JSON yang valid']
  if (!chart.songId) errors.push('Field "songId" tidak ada')
  if (!chart.title) errors.push('Field "title" tidak ada')

  const instDef = INSTRUMENTS[chart.instrument]
  if (!instDef) {
    errors.push(`Instrumen "${chart.instrument}" tidak dikenal pada INSTRUMENTS`)
    return errors
  }
  if (!Array.isArray(chart.notes) || chart.notes.length === 0) {
    errors.push('Field "notes" kosong atau bukan array')
    return errors
  }

  const nameByIndex = new Map(instDef.notes.map(n => [n.index, n.name]))
  chart.notes.forEach((n, i) => {
    if (!nameByIndex.has(n.noteIndex)) {
      errors.push(`notes[${i}]: noteIndex ${n.noteIndex} tidak ada pada instrumen "${chart.instrument}"`)
    } else if (nameByIndex.get(n.noteIndex) !== n.noteName) {
      errors.push(
        `notes[${i}]: noteName "${n.noteName}" tidak cocok untuk noteIndex ${n.noteIndex} ` +
        `(seharusnya "${nameByIndex.get(n.noteIndex)}")`
      )
    }
    if (typeof n.timeMs !== 'number' || n.timeMs < 0) {
      errors.push(`notes[${i}]: timeMs tidak valid`)
    }
  })

  for (let i = 1; i < chart.notes.length; i++) {
    if (chart.notes[i].timeMs < chart.notes[i - 1].timeMs) {
      errors.push(`notes tidak terurut menaik berdasarkan timeMs pada indeks ${i}`)
      break
    }
  }

  return errors
}

export function useChartLoader() {
  const charts = []
  const invalid = []

  for (const [path, mod] of Object.entries(chartModules)) {
    const chart = mod?.default ?? mod
    const errors = validateChart(chart)
    if (errors.length === 0) {
      charts.push(chart)
    } else {
      invalid.push({ path, errors })
      console.warn(`[useChartLoader] Chart "${path}" dilewati karena tidak valid:`, errors)
    }
  }

  charts.sort((a, b) => a.title.localeCompare(b.title))

  return { charts, invalid }
}
