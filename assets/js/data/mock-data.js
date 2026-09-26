/* ============================================
   DRCC — mock-data.js
   Centralized simulation data for all pages
   ============================================ */

'use strict';

const MockData = {

  /* ---- STATS ---- */
  getStats() {
    return {
      incidents: { value: 47,      change: 3,    changeText: '+3 dari kemarin',    trend: 'up',   status: 'danger'  },
      affected:  { value: 128450,  change: 8200, changeText: '+8.200 warga baru',  trend: 'up',   status: 'warning' },
      shelters:  { value: 23,      change: 2,    changeText: '+2 posko dibuka',    trend: 'up',   status: 'info'    },
      personnel: { value: 1247,    change: 15,   changeText: '−15 rotasi selesai', trend: 'down', status: 'success' },
    };
  },

  /* ---- INCIDENT TREND (multi-period) ---- */
  getTrend(period = '7d') {
    const map = {
      '7d': {
        labels: ['Sen','Sel','Rab','Kam','Jum','Sab','Min'],
        data:   [31, 38, 42, 35, 40, 44, 47],
      },
      '14d': {
        labels: ['23/11','24/11','25/11','26/11','27/11','28/11','29/11','30/11','01/12','02/12','03/12','04/12','05/12','06/12'],
        data:   [22, 25, 28, 31, 33, 29, 26, 31, 38, 42, 35, 40, 44, 47],
      },
      '30d': {
        labels: Array.from({length:30}, (_, i) => {
          const d = new Date(2024, 10, 7 + i);
          return `${d.getDate()}/${d.getMonth()+1}`;
        }),
        data: [15,18,14,20,22,19,16,18,22,25,28,24,26,29,31,33,29,26,28,31,35,38,42,35,40,44,47,45,43,47],
      },
    };
    return map[period] || map['7d'];
  },

  /* ---- INCIDENT TYPES (doughnut) ---- */
  getIncidentTypes() {
    return {
      labels: ['Banjir', 'Gempa Bumi', 'Tanah Longsor', 'Kebakaran', 'Kekeringan', 'Lainnya'],
      data:   [22, 8, 7, 6, 2, 2],
      colors: ['#3498DB', '#E74C3C', '#F39C12', '#B5651D', '#E67E22', '#6C757D'],
    };
  },

  /* ---- LIVE ALERT STREAM ---- */
  getAlerts() {
    return [
      { id:1, severity:'high',    icon:'fa-water',                title:'Banjir Bandang',        desc:'Cianjur, Jawa Barat',              time:2,  label:'KRITIS'  },
      { id:2, severity:'info',    icon:'fa-people-carry-box',     title:'Evakuasi Berhasil',     desc:'45 korban dievakuasi — Palu',       time:5,  label:'INFO'    },
      { id:3, severity:'success', icon:'fa-boxes-stacking',       title:'Logistik Tiba',         desc:'Kiriman ke Lombok selesai',         time:8,  label:'OK'      },
      { id:4, severity:'warning', icon:'fa-cloud-showers-heavy',  title:'Cuaca Ekstrem',         desc:'Hujan >200mm/jam — Kal. Selatan',   time:11, label:'WASPADA' },
      { id:5, severity:'high',    icon:'fa-circle-radiation',     title:'Aktivitas Seismik',     desc:'M4.2 terdeteksi di Maluku',         time:15, label:'PANTAU'  },
      { id:6, severity:'success', icon:'fa-tent',                 title:'Posko Baru Aktif',      desc:'Lokasi di Merauke, Papua',          time:19, label:'INFO'    },
      { id:7, severity:'high',    icon:'fa-fire',                 title:'Kebakaran Meluas',      desc:'Riau — 2.400 ha terdampak',         time:23, label:'KRITIS'  },
      { id:8, severity:'warning', icon:'fa-person-running',       title:'Evakuasi Pesisir',      desc:'Bengkulu — 1.200 warga dipindah',   time:28, label:'WASPADA' },
    ];
  },

  /* ---- RESOURCES ---- */
  getResources() {
    return [
      { label:'Logistik Pangan',        pct:72, unit:'2.160 ton tersedia',  icon:'fa-wheat-awn',     colorKey:'copper'  },
      { label:'Tenaga Medis',           pct:85, unit:'425 personel aktif',  icon:'fa-user-nurse',    colorKey:'success' },
      { label:'Kendaraan Operasional',  pct:61, unit:'183 armada siap',     icon:'fa-truck-medical', colorKey:'info'    },
      { label:'Peralatan SAR',          pct:78, unit:'312 set lengkap',     icon:'fa-life-ring',     colorKey:'warning' },
      { label:'Tempat Penampungan',     pct:58, unit:'17.400 kapasitas',    icon:'fa-tent',          colorKey:'danger'  },
      { label:'Dana Tanggap Darurat',   pct:43, unit:'Rp 2,1 M tersisa',   icon:'fa-coins',         colorKey:'gold'    },
    ];
  },

  /* ---- AI AGENTS ---- */
  getAIAgents() {
    return [
      {
        id: 'aria',  name: 'ARIA',  color: 'copper',  icon: 'fa-shield-halved',
        fullName:    'Analisis Risiko Infrastruktur AI',
        status:      'online',  statusLabel: 'Online',
        task:        'Memindai 23 titik kerentanan infrastruktur',
        confidence:  94, processed: '1.247', lastRun: '2 mnt lalu',
      },
      {
        id: 'crest', name: 'CREST', color: 'info',    icon: 'fa-people-arrows',
        fullName:    'Koordinasi Respons & Evakuasi Strategis Terpadu',
        status:      'active',  statusLabel: 'Aktif Sekarang',
        task:        'Mengoptimalkan rute evakuasi Cianjur–Bandung',
        confidence:  88, processed: '347',   lastRun: 'Berjalan…',
      },
      {
        id: 'atlas', name: 'ATLAS', color: 'success', icon: 'fa-map',
        fullName:    'Analisis Topografi, Lokasi & Ancaman Spasial',
        status:      'online',  statusLabel: 'Online',
        task:        'Memperbarui peta dampak banjir real-time',
        confidence:  91, processed: '8.830', lastRun: '7 mnt lalu',
      },
      {
        id: 'pulse', name: 'PULSE', color: 'warning', icon: 'fa-chart-line',
        fullName:    'Prediksi Urgency & Lanskap Situasi Eksogen',
        status:      'warning', statusLabel: 'Akurasi Rendah',
        task:        'Model cuaca ekstrem 7 hari ke depan',
        confidence:  76, processed: '523',   lastRun: '12 mnt lalu',
      },
    ];
  },

  /* ---- ALERT GENERATOR (live simulation) ---- */
  _alertPool: [
    { severity:'high',    icon:'fa-water',          title:'Banjir Baru',           desc:'Laporan masuk dari posko lapangan',     label:'KRITIS'  },
    { severity:'warning', icon:'fa-wind',            title:'Angin Kencang',         desc:'Kecepatan >80 km/jam terdeteksi',       label:'WASPADA' },
    { severity:'info',    icon:'fa-helicopter',      title:'Helikopter SAR',        desc:'Tim udara diberangkatkan',              label:'INFO'    },
    { severity:'success', icon:'fa-circle-check',    title:'Insiden Tertangani',    desc:'Ditutup — Koordinator Lapangan',        label:'OK'      },
    { severity:'high',    icon:'fa-house-crack',     title:'Bangunan Rusak Berat',  desc:'Laporan kerusakan struktural masuk',    label:'KRITIS'  },
    { severity:'warning', icon:'fa-mountain',        title:'Potensi Longsor',       desc:'Kewaspadaan tinggi di lereng terjal',   label:'WASPADA' },
    { severity:'info',    icon:'fa-truck-medical',   title:'Ambulans Diberangkatkan','desc':'5 unit menuju titik evakuasi',       label:'INFO'    },
    { severity:'success', icon:'fa-droplet-slash',   title:'Banjir Surut',          desc:'Ketinggian air kembali normal',         label:'OK'      },
  ],

  generateAlert() {
    const t = this._alertPool[Math.floor(Math.random() * this._alertPool.length)];
    return { ...t, id: Date.now(), time: 0 };
  },

  /* ---- REGIONAL STATUS (for future map) ---- */
  getRegions() {
    return [
      { name:'Jawa Barat',         level:4, type:'Banjir',      incidents:12 },
      { name:'Sulawesi Tengah',    level:3, type:'Gempa',       incidents:6  },
      { name:'Kalimantan Selatan', level:3, type:'Karhutla',    incidents:5  },
      { name:'Riau',               level:3, type:'Karhutla',    incidents:5  },
      { name:'Nusa Tenggara Timur',level:2, type:'Kekeringan',  incidents:4  },
      { name:'Bengkulu',           level:2, type:'Banjir',      incidents:3  },
      { name:'Maluku',             level:2, type:'Gempa',       incidents:3  },
      { name:'Papua',              level:1, type:'Banjir',      incidents:2  },
      { name:'Aceh',               level:2, type:'Banjir',      incidents:4  },
      { name:'Sumatera Barat',     level:3, type:'Longsor',     incidents:3  },
    ];
  },
};

window.MockData = MockData;
