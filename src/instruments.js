export const INSTRUMENTS = {
  gangsa: {
    key: 'gangsa',
    label: 'Gangsa',
    description: 'Metalofon bilah logam · 10 nada laras pelog Bali',
    image: '/assets/gangsa.png',
    imgW: 3799,
    imgH: 2129,
    color: '#C8960C',
    colorDim: 'rgba(200,150,12,0.15)',
    notes: [
      { index: 0, name: 'Dong',  freq: 261 },
      { index: 1, name: 'Deng',  freq: 292 },
      { index: 2, name: 'Dung',  freq: 368 },
      { index: 3, name: 'Dang',  freq: 413 },
      { index: 4, name: 'Ling',  freq: 465 },
      { index: 5, name: "Dong'", freq: 525 },
      { index: 6, name: "Deng'", freq: 588 },
      { index: 7, name: "Dung'", freq: 740 },
      { index: 8, name: "Dang'", freq: 832 },
      { index: 9, name: 'Ding',  freq: 936 },
    ],
    xStart: 285,
    xEnd: 3593,
    detectHit(x, y, imgNaturalW, displayW) {
      const scaleX = imgNaturalW / displayW
      const ox = x * scaleX
      if (ox < this.xStart || ox > this.xEnd) return null
      const span = this.xEnd - this.xStart
      const index = Math.floor(((ox - this.xStart) / span) * 10)
      return Math.min(index, 9)
    },
  },

  kendang: {
    key: 'kendang',
    label: 'Kendang',
    description: 'Drum bermembran dua muka · 4 variasi suara perkusif',
    image: '/assets/kendang.png',
    imgW: 978,
    imgH: 550,
    snareImage: '/assets/snare.png',
    snareW: 668,
    snareH: 667,
    color: '#E05C00',
    colorDim: 'rgba(224,92,0,0.15)',
    notes: [
      { index: 0, name: 'Tut · Muka',      freq: 150, type: 'tengah',  bagian: 'muka' },
      { index: 1, name: 'Pak · Muka',      freq: 200, type: 'pinggir', bagian: 'muka' },
      { index: 2, name: 'Dag · Belakang',  freq: 80,  type: 'tengah',  bagian: 'belakang' },
      { index: 3, name: 'Dug · Belakang',  freq: 110, type: 'pinggir', bagian: 'belakang' },
    ],
    snareCX: 334,
    snareCY: 334,
    innerR: 185,
    outerR: 310,
    detectHit(x, y, imgNaturalW, displayW, bagian) {
      const scale = imgNaturalW / displayW
      const ox = x * scale
      const oy = y * scale
      const dist = Math.hypot(ox - this.snareCX, oy - this.snareCY)
      if (dist > this.outerR) return null
      const isInner = dist <= this.innerR
      const offset = bagian === 'muka' ? 0 : 2
      return isInner ? offset : offset + 1
    },
  },

  suling: {
    key: 'suling',
    label: 'Suling Bali',
    description: 'Seruling bambu 6 lubang · laras pelog Bali · hembusan halus',
    image: '/assets/suling.png',
    imgW: 387,
    imgH: 688,
    color: '#7EC850',
    colorDim: 'rgba(126,200,80,0.12)',
    notes: [
      { index: 0, name: 'Dong',  freq: 558  },
      { index: 1, name: 'Deng',  freq: 621  },
      { index: 2, name: 'Dung',  freq: 764  },
      { index: 3, name: 'Dang',  freq: 800  },
      { index: 4, name: 'Ding',  freq: 1024 },
      { index: 5, name: "Deng'", freq: 1250 },
    ],
    holeY: [286, 320, 359, 440, 479, 526],
    holeCX: 196,
    hitRadius: 42,
    detectHit(x, y, imgNaturalW, displayW) {
      const scale = imgNaturalW / displayW
      const ox = x * scale
      const oy = y * scale
      let bestI = -1
      let bestD = Infinity
      this.holeY.forEach((hy, i) => {
        const d = Math.hypot(ox - this.holeCX, oy - hy)
        if (d < bestD) {
          bestD = d
          bestI = i
        }
      })
      return bestD <= this.hitRadius ? bestI : null
    },
  },
}
