/* ============================================
   DRCC — map.js
   Situation Map: Leaflet, markers, heatmap, filter, LocalStorage
   ============================================ */
'use strict';

/* ============================================================
   MAP DATA — Incidents, Posko, Sumber Daya
   ============================================================ */
const MAP_INCIDENTS = [
  { id:'INC-001', type:'gempa',    name:'Gempa M5.8 Cianjur',       lat:-6.822, lng:107.146, province:'Jawa Barat',          severity:'BAHAYA',  desc:'Gempa bumi 5.8 SR merusak ratusan bangunan.',      date:'2024-12-06', reported:2480 },
  { id:'INC-002', type:'gempa',    name:'Gempa M4.2 Palu',           lat:-0.892, lng:119.871, province:'Sulawesi Tengah',      severity:'WASPADA', desc:'Getaran dirasakan hingga radius 50 km.',           date:'2024-12-06', reported:120  },
  { id:'INC-003', type:'gempa',    name:'Gempa M3.9 Lombok',         lat:-8.583, lng:116.117, province:'Nusa Tenggara Barat',  severity:'NORMAL',  desc:'Gempa ringan, tidak menimbulkan kerusakan besar.', date:'2024-12-05', reported:15   },
  { id:'INC-004', type:'banjir',   name:'Banjir Ciliwung Jakarta',   lat:-6.186, lng:106.835, province:'DKI Jakarta',          severity:'BAHAYA',  desc:'Luapan Kali Ciliwung merendam 3 kelurahan, ketinggian 1.8 m.', date:'2024-12-06', reported:8900 },
  { id:'INC-005', type:'banjir',   name:'Banjir Aceh Utara',         lat:5.184,  lng:97.000,  province:'Aceh',                 severity:'BAHAYA',  desc:'Ribuan warga mengungsi akibat curah hujan ekstrem.', date:'2024-12-06', reported:3200 },
  { id:'INC-006', type:'banjir',   name:'Banjir Sungai Mahakam',     lat:-0.502, lng:117.154, province:'Kalimantan Timur',     severity:'WASPADA', desc:'Kenaikan muka air sungai akibat hujan di hulu.',   date:'2024-12-05', reported:450  },
  { id:'INC-007', type:'banjir',   name:'Banjir Rob Semarang',       lat:-6.967, lng:110.417, province:'Jawa Tengah',          severity:'WASPADA', desc:'Banjir rob dan hujan deras merendam kawasan pesisir.', date:'2024-12-05', reported:820  },
  { id:'INC-008', type:'longsor',  name:'Longsor Bogor Selatan',     lat:-6.600, lng:106.820, province:'Jawa Barat',           severity:'BAHAYA',  desc:'Longsor menutup jalan utama, beberapa rumah tertimbun.', date:'2024-12-06', reported:48   },
  { id:'INC-009', type:'longsor',  name:'Longsor Padang Pariaman',   lat:-0.750, lng:100.120, province:'Sumatera Barat',       severity:'WASPADA', desc:'Lereng bukit longsor akibat curah hujan tinggi.',  date:'2024-12-05', reported:27   },
  { id:'INC-010', type:'longsor',  name:'Longsor NTT',               lat:-10.17, lng:123.607, province:'Nusa Tenggara Timur',  severity:'NORMAL',  desc:'Longsor kecil di lereng perbukitan, akses normal.', date:'2024-12-04', reported:8   },
  { id:'INC-011', type:'kebakaran',name:'Karhutla Riau',             lat:0.533,  lng:101.450, province:'Riau',                 severity:'BAHAYA',  desc:'Kebakaran hutan & lahan gambut 2.400 ha.',         date:'2024-12-05', reported:0    },
  { id:'INC-012', type:'kebakaran',name:'Karhutla Kalimantan',       lat:-2.213, lng:113.921, province:'Kalimantan Tengah',    severity:'WASPADA', desc:'Lahan gambut terbakar, asap mengganggu penerbangan.', date:'2024-12-04', reported:0   },
  { id:'INC-013', type:'kebakaran',name:'Kebakaran Permukiman Makassar', lat:-5.148, lng:119.433, province:'Sulawesi Selatan', severity:'WASPADA', desc:'Kebakaran rumah padat penduduk.',                  date:'2024-12-06', reported:124  },
];

const MAP_POSCOS = [
  { id:'POS-001', name:'Posko Utama Cianjur',   lat:-6.855, lng:107.120, province:'Jawa Barat',      capacity:800,  current:612, resources:'Medis, Logistik, SAR, Psikososial' },
  { id:'POS-002', name:'Posko Terpadu Jakarta',  lat:-6.213, lng:106.820, province:'DKI Jakarta',     capacity:1500, current:1124,resources:'Logistik, Medis, Evakuasi' },
  { id:'POS-003', name:'Posko Palu',             lat:-0.895, lng:119.860, province:'Sulawesi Tengah', capacity:400,  current:187, resources:'Medis, Logistik' },
  { id:'POS-004', name:'Posko Merauke',          lat:-8.493, lng:140.401, province:'Papua',           capacity:250,  current:43,  resources:'Logistik Dasar' },
];

const MAP_RESOURCES = [
  { id:'RES-001', name:'Gudang Logistik Nasional', lat:-6.181, lng:106.821, province:'DKI Jakarta',      stock:'85%', items:'Beras 12t · Air 5000L · Kit Medis',  lastUpdate:'2024-12-06' },
  { id:'RES-002', name:'Gudang Regional Jatim',    lat:-7.584, lng:112.210, province:'Jawa Timur',       stock:'62%', items:'Beras 8t · Selimut 200 · Tenda 15',  lastUpdate:'2024-12-05' },
  { id:'RES-003', name:'Gudang Regional Kaltim',   lat:1.110,  lng:116.920, province:'Kalimantan Timur', stock:'73%', items:'Logistik Darurat Lengkap',            lastUpdate:'2024-12-05' },
];

/* ============================================================
   STATE
   ============================================================ */
let mapInstance  = null;
const layers     = {};      // { type: L.layerGroup }
const markerRefs = {};      // { id: L.Marker }
let customMarkers = [];     // from localStorage
let addMode       = false;
let pendingLatLng = null;

const STORAGE_KEY_MAP = 'drcc_map_markers';

/* Type config */
const TYPE_CFG = {
  gempa:      { color:'#E74C3C', icon:'fa-wave-square',    label:'Gempa Bumi'        },
  banjir:     { color:'#2980B9', icon:'fa-water',          label:'Banjir'            },
  longsor:    { color:'#D35400', icon:'fa-mountain',       label:'Tanah Longsor'     },
  kebakaran:  { color:'#922B21', icon:'fa-fire',           label:'Kebakaran'         },
  posko:      { color:'#27AE60', icon:'fa-tent',           label:'Posko Pengungsian' },
  sumberdaya: { color:'#8E6030', icon:'fa-boxes-stacking', label:'Sumber Daya'       },
};

const SEV_CFG = {
  BAHAYA:  { bgCls:'#FADBD8', txtCls:'#8b1c14' },
  WASPADA: { bgCls:'#FDEBD0', txtCls:'#8b6200' },
  NORMAL:  { bgCls:'#D5F5E3', txtCls:'#1a7a4e' },
};

/* ============================================================
   INIT
   ============================================================ */
function initMap() {
  buildAppShell('map', 'Situation Map', 'Peta situasi bencana real-time');

  // Override page-content for full-height map
  const pc = document.getElementById('page-content');
  if (pc) pc.className = 'page-content map-page';

  loadCustomMarkersFromStorage();
  buildLeafletMap();
  buildLayers();
  buildHeatmap();
  buildIncidentList();
  updateStats();
}

/* ============================================================
   LEAFLET MAP
   ============================================================ */
function buildLeafletMap() {
  mapInstance = L.map('map', {
    center: [-2.5, 118],
    zoom: 5,
    zoomControl: false,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(mapInstance);

  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

  // Map click → add marker
  mapInstance.on('click', onMapClick);
}

/* ============================================================
   LAYER GROUPS & MARKERS
   ============================================================ */
function buildLayers() {
  ['heatmap','gempa','banjir','longsor','kebakaran','posko','sumberdaya','custom'].forEach(t => {
    layers[t] = L.layerGroup().addTo(mapInstance);
  });

  /* Incident markers */
  MAP_INCIDENTS.forEach(inc => addIncidentMarker(inc, layers[inc.type]));

  /* Posko markers */
  MAP_POSCOS.forEach(p => {
    const m = L.marker([p.lat, p.lng], { icon: createIcon('posko') })
      .bindPopup(buildPoskoPopup(p), { className:'drcc-popup', maxWidth:280 });
    markerRefs[p.id] = m;
    layers['posko'].addLayer(m);
  });

  /* Resource markers */
  MAP_RESOURCES.forEach(r => {
    const m = L.marker([r.lat, r.lng], { icon: createIcon('sumberdaya') })
      .bindPopup(buildResourcePopup(r), { className:'drcc-popup', maxWidth:260 });
    markerRefs[r.id] = m;
    layers['sumberdaya'].addLayer(m);
  });

  /* Custom markers (from localStorage) */
  customMarkers.forEach(cm => addCustomMarkerToMap(cm));
}

function addIncidentMarker(inc, layer) {
  const m = L.marker([inc.lat, inc.lng], { icon: createIcon(inc.type, inc.severity) })
    .bindPopup(buildIncidentPopup(inc), { className:'drcc-popup', maxWidth:280 });
  markerRefs[inc.id] = m;
  (layer || layers[inc.type])?.addLayer(m);
}

/* ============================================================
   HEATMAP (priority circles overlay)
   ============================================================ */
function buildHeatmap() {
  const all = [
    ...MAP_INCIDENTS,
    ...customMarkers.filter(cm => cm.severity),
  ];
  all.forEach(inc => {
    const cfg = {
      BAHAYA:  { fillColor:'#E74C3C', radius:130000, opacity:0.18 },
      WASPADA: { fillColor:'#F39C12', radius:90000,  opacity:0.14 },
      NORMAL:  { fillColor:'#2ECC71', radius:60000,  opacity:0.09 },
    }[inc.severity] || { fillColor:'#2ECC71', radius:60000, opacity:0.09 };

    L.circle([inc.lat, inc.lng], {
      radius:      cfg.radius,
      color:       'none',
      fillColor:   cfg.fillColor,
      fillOpacity: cfg.opacity,
      interactive: false,
    }).addTo(layers['heatmap']);
  });
}

/* ============================================================
   CUSTOM MARKER ICONS
   ============================================================ */
function createIcon(type, severity) {
  const cfg  = TYPE_CFG[type] || { color:'#6C757D', icon:'fa-circle' };
  const high = severity === 'BAHAYA';
  const sz   = high ? 40 : 34;

  const ring = high
    ? `<div style="position:absolute;inset:-8px;border:3px solid ${cfg.color};border-radius:50%;opacity:0.45;animation:mapPing 1.6s cubic-bezier(0,0,.2,1) infinite;pointer-events:none"></div>`
    : '';

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:${sz}px;height:${sz}px">
        ${ring}
        <div style="width:${sz}px;height:${sz}px;background:${cfg.color};border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.3)">
          <i class="fas ${cfg.icon}" style="color:#fff;font-size:${Math.floor(sz*.38)}px"></i>
        </div>
      </div>`,
    iconSize:   [sz, sz],
    iconAnchor: [sz/2, sz/2],
    popupAnchor:[0, -(sz/2+6)],
  });
}

/* ============================================================
   POPUP BUILDERS
   ============================================================ */
function buildIncidentPopup(inc) {
  const tc  = TYPE_CFG[inc.type] || {};
  const sc  = SEV_CFG[inc.severity] || SEV_CFG.NORMAL;
  const del = inc.custom
    ? `<button onclick="deleteCustomMarker('${inc.id}')"
         style="margin-top:10px;width:100%;padding:6px;background:#FADBD8;color:#8b1c14;
                border:1px solid rgba(231,76,60,.2);border-radius:6px;cursor:pointer;
                font-size:11px;font-weight:700;font-family:Inter,sans-serif">
         <i class="fas fa-trash"></i> Hapus Marker
       </button>` : '';

  return `
    <div style="font-family:Inter,sans-serif;min-width:240px">
      <div style="background:${tc.color};padding:12px 16px;color:#fff">
        <div style="font-size:10px;font-weight:800;opacity:.8;text-transform:uppercase;letter-spacing:.5px">${tc.label||inc.type}</div>
        <div style="font-size:15px;font-weight:800;margin:3px 0">${inc.name}</div>
        <div style="font-size:11px;opacity:.85"><i class="fas fa-location-dot"></i> ${inc.province}</div>
      </div>
      <div style="padding:12px 16px">
        <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;border-radius:20px;font-size:10px;font-weight:800;background:${sc.bgCls};color:${sc.txtCls};margin-bottom:8px">${inc.severity}</span>
        <p style="font-size:12px;color:#495057;line-height:1.5;margin:0 0 9px">${inc.desc}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:11px;color:#6C757D">
          <div><i class="fas fa-calendar" style="color:${tc.color}"></i> ${inc.date}</div>
          <div><i class="fas fa-people-group" style="color:${tc.color}"></i> ${inc.reported} terdampak</div>
          <div style="grid-column:1/-1;font-family:monospace;font-size:10px;color:#ADB5BD;margin-top:2px">${inc.lat.toFixed(5)}, ${inc.lng.toFixed(5)}</div>
        </div>
        ${del}
      </div>
    </div>`;
}

function buildPoskoPopup(p) {
  const pct = Math.round(p.current / p.capacity * 100);
  const bar = pct > 90 ? '#E74C3C' : pct > 70 ? '#F39C12' : '#27AE60';
  return `
    <div style="font-family:Inter,sans-serif;min-width:240px">
      <div style="background:#27AE60;padding:12px 16px;color:#fff">
        <div style="font-size:10px;font-weight:800;opacity:.8;text-transform:uppercase;letter-spacing:.5px">Posko Pengungsian</div>
        <div style="font-size:15px;font-weight:800;margin:3px 0">${p.name}</div>
        <div style="font-size:11px;opacity:.85"><i class="fas fa-location-dot"></i> ${p.province}</div>
      </div>
      <div style="padding:12px 16px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span>Kapasitas terisi</span><strong>${p.current}/${p.capacity} (${pct}%)</strong>
        </div>
        <div style="height:6px;background:#DEE2E6;border-radius:3px;overflow:hidden;margin-bottom:10px">
          <div style="height:100%;width:${pct}%;background:${bar};border-radius:3px;transition:width .5s ease"></div>
        </div>
        <div style="font-size:11px;color:#6C757D;line-height:1.7">
          <i class="fas fa-boxes-stacking" style="color:#27AE60"></i> ${p.resources}
        </div>
      </div>
    </div>`;
}

function buildResourcePopup(r) {
  const pct = parseInt(r.stock);
  const bar = pct > 70 ? '#27AE60' : pct > 40 ? '#F39C12' : '#E74C3C';
  return `
    <div style="font-family:Inter,sans-serif;min-width:220px">
      <div style="background:#8E6030;padding:12px 16px;color:#fff">
        <div style="font-size:10px;font-weight:800;opacity:.8;text-transform:uppercase;letter-spacing:.5px">Sumber Daya / Gudang</div>
        <div style="font-size:15px;font-weight:800;margin:3px 0">${r.name}</div>
        <div style="font-size:11px;opacity:.85"><i class="fas fa-location-dot"></i> ${r.province}</div>
      </div>
      <div style="padding:12px 16px;font-size:12px;color:#495057">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Stok tersedia</span><strong>${r.stock}</strong></div>
        <div style="height:6px;background:#DEE2E6;border-radius:3px;overflow:hidden;margin-bottom:10px">
          <div style="height:100%;width:${pct}%;background:${bar};border-radius:3px"></div>
        </div>
        <div style="color:#6C757D;font-size:11px;line-height:1.7">
          <i class="fas fa-cubes" style="color:#8E6030"></i> ${r.items}<br>
          <i class="fas fa-clock" style="color:#8E6030"></i> Update: ${r.lastUpdate}
        </div>
      </div>
    </div>`;
}

/* ============================================================
   LAYER TOGGLE (Filter per type)
   ============================================================ */
function toggleLayer(type, visible) {
  if (!mapInstance) return;
  if (visible) mapInstance.addLayer(layers[type]);
  else         mapInstance.removeLayer(layers[type]);
}

/* ============================================================
   ADD MARKER FLOW
   ============================================================ */
function toggleAddMode() {
  addMode = !addMode;
  const btn = document.getElementById('btn-add-marker');
  const container = document.querySelector('.map-body');

  if (addMode) {
    mapInstance.getContainer().style.cursor = 'crosshair';
    btn?.classList.add('active');
    container?.classList.add('map-add-mode');
    Toast.info('Mode Tambah Aktif', 'Klik lokasi di peta untuk menambah marker baru', 3000);
  } else {
    mapInstance.getContainer().style.cursor = '';
    btn?.classList.remove('active');
    container?.classList.remove('map-add-mode');
    pendingLatLng = null;
  }
}

function onMapClick(e) {
  if (!addMode) return;
  pendingLatLng = e.latlng;

  const latEl = document.getElementById('f-lat');
  const lngEl = document.getElementById('f-lng');
  if (latEl) latEl.value = e.latlng.lat.toFixed(5);
  if (lngEl) lngEl.value = e.latlng.lng.toFixed(5);

  showAddMarkerModal();
}

function showAddMarkerModal() {
  document.getElementById('add-marker-modal')?.classList.remove('hidden');
}

function hideAddMarkerModal() {
  document.getElementById('add-marker-modal')?.classList.add('hidden');
  document.getElementById('add-marker-form')?.reset();
  pendingLatLng = null;

  // Exit add mode
  addMode = false;
  if (mapInstance) mapInstance.getContainer().style.cursor = '';
  document.getElementById('btn-add-marker')?.classList.remove('active');
  document.querySelector('.map-body')?.classList.remove('map-add-mode');
}

function submitAddMarker() {
  if (!pendingLatLng) { Toast.error('Lokasi Belum Dipilih', 'Klik lokasi di peta terlebih dahulu'); return; }

  const name     = document.getElementById('f-name')?.value.trim();
  const type     = document.getElementById('f-type')?.value;
  const severity = document.getElementById('f-severity')?.value;
  const desc     = document.getElementById('f-desc')?.value.trim() || 'Marker ditambahkan secara manual.';

  if (!name) { Toast.error('Nama Wajib Diisi','Masukkan nama untuk marker ini'); return; }

  const newMarker = {
    id:       `CUSTOM-${Date.now()}`,
    type, name, severity, desc,
    lat:      pendingLatLng.lat,
    lng:      pendingLatLng.lng,
    province: 'Input Manual',
    date:     new Date().toISOString().split('T')[0],
    reported: 0,
    custom:   true,
  };

  customMarkers.push(newMarker);
  saveCustomMarkersToStorage();
  addCustomMarkerToMap(newMarker);
  buildIncidentList();
  updateStats();
  hideAddMarkerModal();
  Toast.success('Marker Ditambahkan', `"${name}" berhasil ditambahkan ke peta`);

  // Fly to new marker
  mapInstance.flyTo([newMarker.lat, newMarker.lng], 10, { duration:1.2 });
  setTimeout(() => markerRefs[newMarker.id]?.openPopup(), 1400);
}

function addCustomMarkerToMap(cm) {
  const m = L.marker([cm.lat, cm.lng], { icon: createIcon(cm.type, cm.severity) })
    .bindPopup(buildIncidentPopup(cm), { className:'drcc-popup', maxWidth:280 });
  markerRefs[cm.id] = m;
  layers['custom']?.addLayer(m);
}

function deleteCustomMarker(id) {
  showConfirm('Hapus marker ini dari peta?', () => {
    customMarkers = customMarkers.filter(m => m.id !== id);
    saveCustomMarkersToStorage();

    if (markerRefs[id]) {
      layers['custom']?.removeLayer(markerRefs[id]);
      markerRefs[id].closePopup();
      delete markerRefs[id];
    }

    buildIncidentList();
    updateStats();
    Toast.info('Marker Dihapus','Marker custom berhasil dihapus dari peta');
  });
}

/* ============================================================
   LOCAL STORAGE
   ============================================================ */
function loadCustomMarkersFromStorage() {
  customMarkers = AppStorage.get(STORAGE_KEY_MAP, []);
}

function saveCustomMarkersToStorage() {
  AppStorage.set(STORAGE_KEY_MAP, customMarkers);
}

/* ============================================================
   INCIDENT LIST (side panel)
   ============================================================ */
function buildIncidentList(filter = 'semua') {
  const list = document.getElementById('incident-list');
  if (!list) return;

  const all = [
    ...MAP_INCIDENTS,
    ...MAP_POSCOS.map(p=>({...p, type:'posko', severity:'NORMAL', desc:`Kapasitas: ${p.current}/${p.capacity}`})),
    ...MAP_RESOURCES.map(r=>({...r, type:'sumberdaya', severity:'NORMAL', desc:`Stok: ${r.stock}`})),
    ...customMarkers,
  ];

  const shown = filter === 'semua' ? all : all.filter(i => i.type === filter || i.severity === filter.toUpperCase());

  list.innerHTML = shown.map(inc => {
    const tc = TYPE_CFG[inc.type] || { color:'#6C757D', icon:'fa-circle', label:inc.type };
    const sc = SEV_CFG[inc.severity] || SEV_CFG.NORMAL;
    return `
      <div class="incident-item" onclick="focusMarker('${inc.id}','${inc.lat}','${inc.lng}')">
        <div class="inc-icon" style="background:${tc.color}">
          <i class="fas ${tc.icon}"></i>
        </div>
        <div class="inc-body">
          <div class="inc-name">${inc.name}</div>
          <div class="inc-province">${inc.province}</div>
        </div>
        <span class="inc-sev" style="background:${sc.bgCls};color:${sc.txtCls}">${inc.severity||'—'}</span>
      </div>`;
  }).join('') || `<div class="empty-state" style="padding:30px 20px"><i class="fas fa-map-pin"></i><p>Tidak ada data untuk filter ini.</p></div>`;

  // Update count
  const countEl = document.getElementById('incident-count');
  if (countEl) countEl.textContent = shown.length;
}

function focusMarker(id, lat, lng) {
  mapInstance.flyTo([parseFloat(lat), parseFloat(lng)], 11, { duration:1.2 });
  setTimeout(() => markerRefs[id]?.openPopup(), 1300);
  document.querySelectorAll('.incident-item').forEach(el => el.classList.remove('active'));
  event?.currentTarget?.classList.add('active');
}

function filterList(val) {
  document.querySelectorAll('.list-filter-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.f === val)
  );
  buildIncidentList(val);
}

/* ============================================================
   STATS
   ============================================================ */
function updateStats() {
  const all = [...MAP_INCIDENTS, ...customMarkers.filter(c=>c.severity)];
  const bahaya  = all.filter(i=>i.severity==='BAHAYA').length;
  const waspada = all.filter(i=>i.severity==='WASPADA').length;
  const normal  = all.filter(i=>i.severity==='NORMAL').length;

  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('stat-total',   all.length);
  set('stat-bahaya',  bahaya);
  set('stat-waspada', waspada);
  set('stat-normal',  normal);
}

/* ============================================================
   EXPOSE
   ============================================================ */
Object.assign(window, {
  initMap, toggleLayer, toggleAddMode,
  showAddMarkerModal, hideAddMarkerModal, submitAddMarker,
  deleteCustomMarker, focusMarker, filterList,
});
