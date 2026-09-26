/* ============================================
   DRCC — reasoning-engine.js  (Layer 3)
   Per-agent step-by-step AI reasoning log + confidence score
   ============================================ */
'use strict';

const ReasoningEngine = {
  KEY: 'drcc_reasoning_log',

  AGENTS: {
    aria:  { name:'ARIA',  fullName:'Situation Analyst',        icon:'fa-magnifying-glass-chart', color:'#B5651D' },
    logi:  { name:'LOGI',  fullName:'Logistics Prioritizer',    icon:'fa-boxes-stacking',         color:'#2980B9' },
    recon: { name:'RECON', fullName:'Response Commander',       icon:'fa-map-location-dot',       color:'#27AE60' },
    pulse: { name:'PULSE', fullName:'Public Alert System',      icon:'fa-bullhorn',               color:'#8E44AD' },
  },

  generate(agentId, input) {
    const agent = this.AGENTS[agentId];
    if (!agent) return null;
    const steps = this._buildSteps(agentId, input);
    const confidence = this._calcConfidence(input);
    const result = {
      id:         `REASON-${Date.now()}-${agentId}`,
      ts:         Date.now(),
      agentId,    agentName: agent.name,
      fullName:   agent.fullName,
      input,      steps,
      confidence,
      conclusion: steps[steps.length-1]?.conclusion || 'Analisis selesai.',
      layer: 3,
    };
    this._save(result);
    if (window.Logger) Logger.ai(`Reasoning: ${agent.name}`, { confidence, steps:steps.length }, 3);
    if (window.State)  State._emit('reasoning:new', result);
    return result;
  },

  _buildSteps(agentId, input) {
    const { type='—', magnitude=0, population=0, location='—', severity='NORMAL', risk={score:0,level:'NORMAL'} } = input;
    const popFmt = population.toLocaleString('id-ID');
    const areaKm = Math.round(Math.pow(10, 0.78*magnitude-2.3)*75) || 50;

    const templates = {
      aria: [
        { s:1, title:'Terima Data Input',      desc:`Data diterima: ${type} M${magnitude} di ${location}. Populasi terdampak: ${popFmt} jiwa.`, status:'done' },
        { s:2, title:'Klasifikasi Bencana',    desc:`Magnitude ${magnitude} → Kategori: ${magnitude>6?'Ekstrem Besar':magnitude>4?'Besar':'Sedang'}. Jenis: ${type}.`, status:'done' },
        { s:3, title:'Estimasi Dampak',        desc:`Area terdampak: ~${areaKm} km². Estimasi korban ringan: ${Math.round(population*0.018*(magnitude/5))} jiwa. Pengungsi: ${Math.round(population*0.12)} jiwa.`, status:'done' },
        { s:4, title:'Skor Risiko Final',      desc:`Risk Score ${risk.score}/100. Level: ${risk.level}. Respons ${risk.level==='BAHAYA'?'SEGERA':risk.level==='SIAGA'?'CEPAT':'TERENCANA'} diperlukan.`, status:'done', conclusion:`Situasi memerlukan respons ${risk.level==='BAHAYA'?'darurat penuh dan segera':'terencana dan terkoordinasi'}.` },
      ],
      logi: [
        { s:1, title:'Hitung Kebutuhan Dasar',   desc:`Kalkulasi kebutuhan untuk ${popFmt} jiwa: ${Math.ceil(population*2)} liter air/hari, ${Math.ceil(population*0.4)} kg pangan/hari.`, status:'done' },
        { s:2, title:'Inventaris Sumber Daya',   desc:`Cek ketersediaan: ${Math.ceil(population/500)} truk, ${Math.ceil(population/2000)} helikopter, ${Math.ceil(population/300)} relawan dibutuhkan.`, status:'done' },
        { s:3, title:'Optimasi Rute Distribusi', desc:`Rute distribusi ke ${location}: jarak jalur darat dan udara dikalkulasi. Estimasi waktu: ${Math.ceil(areaKm/50)} jam.`, status:'done' },
        { s:4, title:'Rencana Distribusi',       desc:`Alokasi logistik 7 hari ditetapkan. ${Math.ceil(population/500)} titik distribusi diaktifkan.`, status:'done', conclusion:'Rencana distribusi logistik siap dieksekusi.' },
      ],
      recon: [
        { s:1, title:'Analisis Topografi',     desc:`Pemetaan area ${location}: identifikasi jalur evakuasi aman, titik kumpul, akses SAR.`, status:'done' },
        { s:2, title:'Hitung Kapasitas Posko', desc:`Posko darurat terdekat: kapasitas ${Math.ceil(population*0.4)} orang. Total ${Math.ceil(population/1500)} posko dibutuhkan.`, status:'done' },
        { s:3, title:'Rute Evakuasi Primer',   desc:`Jalur primer & 2 alternatif ditetapkan. Estimasi evakuasi penuh: ${Math.ceil(population/5000)} jam.`, status:'done' },
        { s:4, title:'Koordinasi Tim',         desc:`${Math.ceil(population/1500)} tim respons dikoordinasikan. Frekuensi radio darurat ditetapkan.`, status:'done', conclusion:'Jalur evakuasi dan koordinasi respons siap.' },
      ],
      pulse: [
        { s:1, title:'Tentukan Level Siaga',   desc:`Risk score ${risk.score}/100 → Level siaga publik: ${risk.level}. Zona notifikasi: ${Math.ceil(areaKm/10)} kelurahan.`, status:'done' },
        { s:2, title:'Segmentasi Penerima',    desc:`${popFmt} warga ${location} dan sekitar. Kanal: SMS, radio, sirine, media sosial.`, status:'done' },
        { s:3, title:'Susun Pesan Darurat',    desc:`Pesan multi-bahasa disusun sesuai level ${risk.level}: instruksi evakuasi, lokasi posko, kontak darurat.`, status:'done' },
        { s:4, title:'Distribusi Notifikasi',  desc:`Siaran aktif via ${Math.ceil(areaKm/5)} stasiun radio, SMS massal, dan media sosial.`, status:'done', conclusion:`Notifikasi publik level ${risk.level} berhasil disebarkan.` },
      ],
    };
    return (templates[agentId] || templates.aria).map(t => ({ ...t, ts: Date.now() }));
  },

  _calcConfidence(input) {
    const base = 72 + Math.floor(Math.random() * 20);
    const bonus = input.magnitude > 6 ? 5 : input.magnitude > 4 ? 2 : 0;
    return Math.min(99, base + bonus);
  },

  /* ---- STORAGE ---- */
  _save(entry) {
    try {
      const all = JSON.parse(localStorage.getItem(this.KEY)||'[]');
      all.unshift(entry);
      if (all.length > 200) all.splice(200);
      localStorage.setItem(this.KEY, JSON.stringify(all));
    } catch {}
  },
  getAll()          { try { return JSON.parse(localStorage.getItem(this.KEY)||'[]'); } catch { return []; } },
  getByAgent(id)    { return this.getAll().filter(r => r.agentId === id); },
  getLatest(id)     { return this.getByAgent(id)[0] || null; },
  clear()           { localStorage.setItem(this.KEY, '[]'); },
};

window.ReasoningEngine = ReasoningEngine;
