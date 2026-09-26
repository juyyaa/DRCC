/* ============================================
   DRCC — predictions.js
   AI Engine: scoring formulas & output calculations
   Digunakan oleh ai-command.js dan predictions page
   ============================================ */
'use strict';

const AIEngine = {

  /* ============ RISK SCORER ============
     Output: { score:0-100, level, label }
  ========================================*/
  calcRisk({ type, magnitude, population }) {
    const magMax = { gempa:9, banjir:8, longsor:8, kebakaran:5000 };
    const magNorm = Math.min(magnitude / (magMax[type] || 5), 1);
    // 40% magnitude, 35% population, 25% type multiplier
    const magScore = magNorm * 40;
    const popScore = Math.min(Math.log10(population + 1) / 7 * 35, 35);
    const typeMult = { gempa:1.25, banjir:1.05, longsor:1.10, kebakaran:0.90 }[type] ?? 1.0;
    let raw = (magScore + popScore) * typeMult;
    raw += (Math.random() * 4 - 2); // slight model variability
    const score = Math.max(0, Math.min(100, Math.round(raw)));
    const level = score >= 75 ? 'BAHAYA'
                : score >= 50 ? 'SIAGA'
                : score >= 25 ? 'WASPADA'
                : 'NORMAL';
    const labels = { BAHAYA:'Bahaya Tinggi — Respons Segera', SIAGA:'Siaga — Respons Diperkuat', WASPADA:'Waspada — Pantau Ketat', NORMAL:'Normal — Pemantauan Rutin' };
    return { score, level, label: labels[level] };
  },

  /* ============ AFFECTED AREA ============ */
  calcArea({ type, magnitude, population }) {
    const km2 = Math.max(1, Math.round({
      gempa:     () => Math.pow(10, 0.78 * magnitude - 2.3) * 75,
      banjir:    () => magnitude * 42 + population / 9000,
      longsor:   () => Math.pow(magnitude, 1.7) * 0.38,
      kebakaran: () => magnitude,   // input sudah dalam ha, konversi ke km²: ha/100
    }[type]?.() ?? magnitude * 18));
    return { km2, ha: Math.round(km2 * 100), radius: Math.round(Math.sqrt(km2 / Math.PI)) };
  },

  /* ============ CASUALTY FORECAST ============ */
  calcCasualties({ type, magnitude, population, area }) {
    const rate   = { gempa:0.020, banjir:0.0012, longsor:0.032, kebakaran:0.003 }[type] ?? 0.010;
    const refMag = { gempa:5,     banjir:2,       longsor:3,     kebakaran:100   }[type] ?? 3;
    const factor = Math.min(magnitude / refMag, 3.5);
    const base   = Math.round(population * rate * factor);
    return {
      light:   Math.round(base * 2.4),
      severe:  Math.round(base * 0.75),
      missing: Math.round(base * 0.22),
      dead:    Math.round(base * 0.048),
    };
  },

  /* ============ AID PRIORITY RANKING ============ */
  calcAidPriority({ type, magnitude, population, casualties }) {
    const s = casualties.severe;
    const pool = [
      { item:'Tim Medis & Paramedis',    base: 55, bonus: Math.min(30, Math.round(s/population*4000)) },
      { item:'Makanan & Air Bersih',     base: 52, bonus: Math.round(Math.log10(population+1)*6) },
      { item:'Obat-obatan & Alkes',      base: 50, bonus: Math.round(s/100) },
      { item:'Transportasi Evakuasi',    base: 46, bonus: type==='banjir'?20:type==='gempa'?15:8 },
      { item:'Tenda & Shelter Darurat',  base: 44, bonus: Math.round(population/4000) },
      { item:'Tim SAR (Search & Rescue)',base: 42, bonus: type==='longsor'?28:type==='gempa'?20:5 },
      { item:'Komunikasi & Radio Darurat',base:35, bonus: magnitude>5?14:5 },
      { item:'Genset & Sumber Listrik',  base: 30, bonus: type==='banjir'?12:5 },
    ];
    return pool
      .map(i => ({ item:i.item, score:Math.min(100, i.base+i.bonus+Math.round(Math.random()*6-3)) }))
      .sort((a,b) => b.score - a.score);
  },

  /* ============ EVACUATION ROUTES ============ */
  calcEvacuation({ type, location, magnitude }) {
    const templates = {
      gempa: {
        primary:  'Evakuasi segera ke lapangan terbuka terdekat, jauh dari gedung, pohon, dan tiang listrik.',
        alternate:'Titik kumpul darurat di alun-alun, GOR, atau stadion kecamatan terdekat.',
        avoid:    'Hindari jembatan, gedung bertingkat, lereng bukit, dan bantaran sungai.',
        time:     '0–15 menit setelah guncangan berhenti.',
        direction:'Menuju area terbuka bebas struktur bangunan.',
      },
      banjir: {
        primary:  'Evakuasi ke dataran lebih tinggi min. 10 m di atas permukaan genangan.',
        alternate:'Gunakan perahu karet atau tunggu helikopter untuk daerah terisolir.',
        avoid:    'Hindari jalan tergenang, aliran sungai, gorong-gorong, dan area cekungan.',
        time:     'Segera, sebelum ketinggian air mencapai 50 cm.',
        direction:'Menuju dataran tinggi atau lantai 2+ bangunan permanen bertulang beton.',
      },
      longsor: {
        primary:  'Evakuasi menjauhi lereng dan tebing, bergerak tegak lurus arah longsor.',
        alternate:'Gunakan jalur evakuasi resmi BPBD yang telah dipasang rambu.',
        avoid:    'Hindari daerah lereng terjal, sungai kecil, dan zona merah longsor.',
        time:     '15–60 menit sebelum hujan intensitas tinggi berlanjut.',
        direction:'Tegak lurus dari lereng, menuju dataran rendah yang stabil.',
      },
      kebakaran: {
        primary:  'Evakuasi berlawanan arah angin dominan, minimal 500 m dari titik api.',
        alternate:'Helicopter landing zone di koordinat titik kumpul yang telah ditetapkan.',
        avoid:    'Hindari arah searah angin, vegetasi kering, dan jalur sempit.',
        time:     'Segera setelah api terdeteksi dalam radius 2 km.',
        direction:'Berlawanan arah angin, menuju jalan aspal / lapangan terbuka.',
      },
    };
    const tpl = templates[type] || templates.gempa;
    return {
      ...tpl,
      location,
      teams:    Math.ceil(magnitude * 2.2 + 3),
      vehicles: Math.ceil(Math.random() * 4 + 4),
    };
  },

  /* ============ LOGISTICS PLAN ============ */
  calcLogistics({ population, days = 7 }) {
    const p = Math.max(population, 1);
    return {
      days,
      food: {
        rice:      Math.round(p * 0.4  * days),
        water:     Math.round(p * 3    * days),
        readyMeal: Math.round(p * 3    * days),
      },
      medical: {
        kits:      Math.ceil(p / 50),
        doctors:   Math.ceil(p / 500),
        nurses:    Math.ceil(p / 200),
        ambulances:Math.ceil(p / 1000),
      },
      shelter: {
        tents:     Math.ceil(p / 6),
        blankets:  Math.round(p * 1.2),
        mattresses:Math.round(p * 0.8),
      },
      transport: {
        trucks:     Math.ceil(p / 150),
        buses:      Math.ceil(p / 50),
        helicopters:Math.ceil(p / 8000),
      },
    };
  },

  /* ============ 7-DAY RISK TREND (Predictions Page) ============ */
  calcTrend({ type, magnitude, population }) {
    const base = this.calcRisk({ type, magnitude, population }).score;
    const days  = ['H+1','H+2','H+3','H+4','H+5','H+6','H+7'];
    const decay = type === 'gempa' ? 0.82 : type === 'kebakaran' ? 0.90 : 0.93;
    let v = base;
    return {
      labels: days,
      data:   days.map(() => { v = Math.max(5, Math.round(v * decay + (Math.random()*6-3))); return v; }),
    };
  },
};

window.AIEngine = AIEngine;
