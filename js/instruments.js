/**
 * instruments.js — Instrument definitions and hit-zone detection
 * All coordinates are in original image pixel space.
 * streamlit-image-coordinates style: clicks return original image coords.
 */

const INSTRUMENTS = {
  gangsa: {
    key: 'gangsa',
    label: 'Gangsa',
    description: 'Metalofon bilah logam · 10 nada laras pelog Bali',
    image: 'assets/gangsa.png',
    imgW: 3799, imgH: 2129,
    color: '#C8960C',
    colorDim: 'rgba(200,150,12,0.15)',
    notes: [
      { index: 0, name: 'Ding',  freq: 253 },
      { index: 1, name: 'Dong',  freq: 283 },
      { index: 2, name: 'Deng',  freq: 318 },
      { index: 3, name: 'Deung', freq: 345 },
      { index: 4, name: 'Dung',  freq: 395 },
      { index: 5, name: 'Dang',  freq: 444 },
      { index: 6, name: 'Daing', freq: 496 },
      { index: 7, name: 'Ding²', freq: 506 },
      { index: 8, name: 'Dong²', freq: 567 },
      { index: 9, name: 'Deng²', freq: 637 },
    ],
    // X range of keys in original pixels
    xStart: 285,
    xEnd:   3593,
    // Detect hit: returns note index 0-9 or null
    detectHit(x, y, imgNaturalW, displayW) {
      const scaleX = imgNaturalW / displayW;
      const ox = x * scaleX;
      if (ox < this.xStart || ox > this.xEnd) return null;
      const span  = this.xEnd - this.xStart;
      const index = Math.floor(((ox - this.xStart) / span) * 10);
      return Math.min(index, 9);
    },
  },

  kendang: {
    key: 'kendang',
    label: 'Kendang',
    description: 'Drum bermembran dua muka · 4 variasi suara perkusif',
    image: 'assets/kendang.png',
    imgW: 978, imgH: 550,
    snareImage: 'assets/snare.png',
    snareW: 668, snareH: 667,
    color: '#E05C00',
    colorDim: 'rgba(224,92,0,0.15)',
    notes: [
      { index: 0, name: 'Tung Tengah · Muka',     freq: 80,  type: 'tengah', bagian: 'muka' },
      { index: 1, name: 'Pak Pinggir · Muka',     freq: 130, type: 'pinggir', bagian: 'muka' },
      { index: 2, name: 'Tung Tengah · Belakang', freq: 95,  type: 'tengah', bagian: 'belakang' },
      { index: 3, name: 'Pak Pinggir · Belakang', freq: 160, type: 'pinggir', bagian: 'belakang' },
    ],
    // Snare hit zones (original snare.png pixel space)
    snareCX: 334, snareCY: 334,
    innerR: 185,  // center area → Tengah (Tung)
    outerR: 310,  // rim ring → Pinggir (Pak)
    detectHit(x, y, imgNaturalW, displayW, bagian) {
      const scale = imgNaturalW / displayW;
      const ox = x * scale;
      const oy = y * scale;
      const dist = Math.hypot(ox - this.snareCX, oy - this.snareCY);
      if (dist > this.outerR) return null;
      const isInner  = dist <= this.innerR;
      const offset   = bagian === 'muka' ? 0 : 2;
      return isInner ? offset : offset + 1;
    },
  },

  suling: {
    key: 'suling',
    label: 'Suling Bali',
    description: 'Seruling bambu 6 lubang · laras pelog Bali · hembusan halus',
    image: 'assets/suling.png',
    imgW: 387, imgH: 688,
    color: '#7EC850',
    colorDim: 'rgba(126,200,80,0.12)',
    notes: [
      { index: 0, name: 'Ding',  freq: 523  },
      { index: 1, name: 'Dong',  freq: 587  },
      { index: 2, name: 'Deng',  freq: 659  },
      { index: 3, name: 'Dung',  freq: 784  },
      { index: 4, name: 'Dang',  freq: 880  },
      { index: 5, name: 'Daing', freq: 1047 },
    ],
    // Hole Y positions in original image px, x center ~196
    holeY: [286, 320, 359, 440, 479, 526],
    holeCX: 196,
    hitRadius: 42,  // px in original image space
    detectHit(x, y, imgNaturalW, displayW) {
      const scale = imgNaturalW / displayW;
      const ox = x * scale;
      const oy = y * scale;
      let bestI = -1, bestD = Infinity;
      this.holeY.forEach((hy, i) => {
        const d = Math.hypot(ox - this.holeCX, oy - hy);
        if (d < bestD) { bestD = d; bestI = i; }
      });
      return bestD <= this.hitRadius ? bestI : null;
    },
  },
};

window.INSTRUMENTS = INSTRUMENTS;
