/* ============================================
   DRCC — map.js (Fullstack API + Real-time WebSocket version)
   Leaflet map + markers dari backend + sinkronisasi real-time
   antar semua user yang sedang online (via Socket.io)
   ============================================ */
'use strict';

let mapInstance  = null;
let markerLayers = {};       // id -> Leaflet marker/circle
let allMarkers   = [];       // cache dari backend
let allIncidents = [];
let activeLayers = { heatmap:true, gempa:true, banjir:true, longsor:true, kebakaran:true, posko:true, sumberdaya:true, custom:true };
let addMode      = false;
let listFilter   = 'semua';

const TYPE_COLOR = { gempa:'#E74C3C', banjir:'#2980B9', longsor:'#D35400', kebakaran:'#922B21', posko:'#27AE60', sumberdaya:'#8E6030', custom:'#6C757D' };
const SEV_COLOR   = { BAHAYA:'#E74C3C', SIAGA:'#E67E22', WASPADA:'#F39C12', NORMAL:'#27AE60' };

/* ============================================================ INIT */
async function initMap() {
  buildAppShell('map', 'Situation Map', 'Peta bencana interaktif · Real-time · Indonesia');
  startClock();
  initLeaflet();

  await Promise.all([loadIncidents(), loadMarkers()]);
  renderAll();

  /* ── REAL-TIME: setiap penambahan/penghapusan titik oleh user lain
        langsung muncul di peta tanpa reload (syarat utama proyek) ── */
  if (window.State) {
    State.on('marker:created',   (m) => { upsertMarkerCache(m); plotMarker(m); refreshStats(); Toast.info('Marker Baru', `${m.name} ditambahkan`); });
    State.on('marker:updated',   (m) => { upsertMarkerCache(m); plotMarker(m); refreshStats(); });
    State.on('marker:deleted',   ({id}) => { removeMarkerCache(id); removeMarkerLayer(id); refreshStats(); });
    State.on('incident:created', (i) => { upsertIncidentCache(i); plotIncident(i); refreshStats(); renderIncidentList(); });
    State.on('incident:updated', (i) => { upsertIncidentCache(i); plotIncident(i); refreshStats(); renderIncidentList(); });
    State.on('incident:deleted', ({id}) => { allIncidents = allIncidents.filter(x=>x.id!==id); removeMarkerLayer('inc-'+id); refreshStats(); renderIncidentList(); });
  }
}

function startClock() {
  const el = document.getElementById('navbar-clock');
  if (!el) return;
  const tick = () => { el.textContent = new Date().toLocaleTimeString('id-ID'); };
  tick(); setInterval(tick, 1000);
}

/* ============================================================ LEAFLET SETUP */
function initLeaflet() {
  mapInstance = L.map('map', { zoomControl: true }).setView([-2.5, 118], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 18,
  }).addTo(mapInstance);

  mapInstance.on('click', (e) => {
    if (!addMode) return;
    openAddMarkerModal(e.latlng.lat, e.latlng.lng);
  });
}

/* ============================================================ DATA LOADING */
async function loadIncidents() {
  try { const data = await ApiClient.get('/incidents'); allIncidents = data.incidents; }
  catch (e) { Toast.error('Gagal Memuat Insiden', e.message); }
}

async function loadMarkers() {
  try { const data = await ApiClient.get('/map-markers'); allMarkers = data.markers; }
  catch (e) { Toast.error('Gagal Memuat Marker', e.message); }
}

function upsertMarkerCache(m)   { const i = allMarkers.findIndex(x=>x.id===m.id); if (i>=0) allMarkers[i]=m; else allMarkers.unshift(m); }
function removeMarkerCache(id)  { allMarkers = allMarkers.filter(x=>x.id!==id); }
function upsertIncidentCache(i) { const idx = allIncidents.findIndex(x=>x.id===i.id); if (idx>=0) allIncidents[idx]=i; else allIncidents.unshift(i); }

/* ============================================================ RENDER ALL */
function renderAll() {
  Object.values(markerLayers).forEach(l => mapInstance.removeLayer(l));
  markerLayers = {};
  allIncidents.forEach(plotIncident);
  allMarkers.forEach(plotMarker);
  refreshStats();
  renderIncidentList();
}

/* ============================================================ PLOT INCIDENT (sebagai circle marker prioritas/heatmap) */
function plotIncident(inc) {
  const key = 'inc-' + inc.id;
  removeMarkerLayer(key);
  if (!activeLayers[inc.type] && !activeLayers.heatmap) return;

  const col = SEV_COLOR[inc.severity] || '#6C757D';
  const radius = inc.severity === 'BAHAYA' ? 14 : inc.severity === 'SIAGA' ? 11 : 8;

  const marker = L.circleMarker([inc.lat, inc.lng], {
    radius, color: col, fillColor: col, fillOpacity: 0.55, weight: 2,
  }).addTo(mapInstance);

  marker.bindPopup(buildIncidentPopup(inc));
  markerLayers[key] = marker;
}

/* ============================================================ PLOT CUSTOM MARKER (posko/depot/custom) */
function plotMarker(m) {
  const key = 'mrk-' + m.id;
  removeMarkerLayer(key);
  if (!activeLayers[m.type] && !activeLayers.custom) return;

  const col = TYPE_COLOR[m.type] || TYPE_COLOR.custom;
  const icon = L.divIcon({
    className: '', html: `<div style="width:26px;height:26px;border-radius:50%;background:${col};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center"><i class="fas fa-map-marker-alt" style="color:#fff;font-size:11px"></i></div>`,
    iconSize: [26,26], iconAnchor: [13,13],
  });
  const marker = L.marker([m.lat, m.lng], { icon }).addTo(mapInstance);
  marker.bindPopup(buildMarkerPopup(m));
  markerLayers[key] = marker;
}

function removeMarkerLayer(key) {
  if (markerLayers[key]) { mapInstance.removeLayer(markerLayers[key]); delete markerLayers[key]; }
}

/* ============================================================ POPUPS */
function buildIncidentPopup(inc) {
  const col = SEV_COLOR[inc.severity] || '#6C757D';
  return `<div style="min-width:200px;font-family:inherit">
    <div style="font-weight:800;font-size:13px;margin-bottom:4px">${inc.title}</div>
    <div style="font-size:11px;color:#666;margin-bottom:6px">${inc.location}, ${inc.province}</div>
    <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${col}22;color:${col}">${inc.severity}</span>
    <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:#eee;color:#555;margin-left:4px">${inc.status}</span>
    <div style="font-size:11px;margin-top:6px">👥 ${(inc.affected_population||0).toLocaleString('id-ID')} terdampak</div>
    <a href="incidents.html" style="font-size:11px;color:#B5651D;font-weight:700">Kelola insiden →</a>
  </div>`;
}

function buildMarkerPopup(m) {
  const col = TYPE_COLOR[m.type] || TYPE_COLOR.custom;
  return `<div style="min-width:180px">
    <div style="font-weight:800;font-size:13px;margin-bottom:4px">${m.name}</div>
    <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${col}22;color:${col}">${m.type}</span>
    ${m.description ? `<div style="font-size:11px;color:#666;margin-top:6px">${m.description}</div>` : ''}
    ${Auth.can('map','manage') ? `<button onclick="deleteMarker('${m.id}')" style="margin-top:8px;background:#E74C3C;color:#fff;border:none;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer">Hapus</button>` : ''}
  </div>`;
}

/* ============================================================ STATS */
function refreshStats() {
  const set = (id,v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('stat-total',   allIncidents.length);
  set('stat-bahaya',  allIncidents.filter(i=>i.severity==='BAHAYA').length);
  set('stat-waspada', allIncidents.filter(i=>i.severity==='WASPADA' || i.severity==='SIAGA').length);
  set('stat-normal',  allIncidents.filter(i=>i.severity==='NORMAL').length);
}

/* ============================================================ LAYER TOGGLE */
function toggleLayer(key, on) {
  activeLayers[key] = on;
  renderAll();
}

/* ============================================================ INCIDENT LIST (side panel) */
function filterList(f) {
  listFilter = f;
  document.querySelectorAll('.list-filter-tab').forEach(t => t.classList.toggle('active', t.dataset.f === f));
  renderIncidentList();
}

function renderIncidentList() {
  const list = document.getElementById('incident-list');
  const countEl = document.getElementById('incident-count');
  if (!list) return;

  let items = allIncidents;
  if (listFilter !== 'semua') {
    items = listFilter === 'BAHAYA' ? items.filter(i=>i.severity==='BAHAYA') : items.filter(i=>i.type===listFilter);
  }
  if (countEl) countEl.textContent = items.length;

  list.innerHTML = items.length ? items.map(i => {
    const col = SEV_COLOR[i.severity] || '#6C757D';
    return `<div class="incident-list-item" onclick="focusIncident(${i.lat},${i.lng})" style="cursor:pointer;padding:10px 12px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:${col};flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${i.title}</div>
          <div style="font-size:10px;color:var(--text-muted)">${i.location}, ${i.province}</div>
        </div>
        <span style="font-size:9px;font-weight:700;color:${col}">${i.severity}</span>
      </div>
    </div>`;
  }).join('') : '<div style="text-align:center;color:var(--text-muted);padding:30px;font-size:12px">Tidak ada insiden</div>';
}

function focusIncident(lat, lng) { mapInstance.setView([lat, lng], 12); }

/* ============================================================ ADD MARKER MODE */
function toggleAddMode() {
  if (!Auth.can('map', 'manage')) { Toast.warning('Akses Ditolak', 'Role Anda tidak bisa menambah marker.'); return; }
  addMode = !addMode;
  const btn = document.getElementById('btn-add-marker');
  if (btn) btn.classList.toggle('active', addMode);
  mapInstance.getContainer().style.cursor = addMode ? 'crosshair' : '';
  if (addMode) Toast.info('Mode Tambah Aktif', 'Klik di peta untuk menambahkan marker baru');
}

function openAddMarkerModal(lat, lng) {
  document.getElementById('f-lat').value = lat.toFixed(6);
  document.getElementById('f-lng').value = lng.toFixed(6);
  document.getElementById('f-name').value = '';
  document.getElementById('f-desc').value = '';
  document.getElementById('add-marker-modal').classList.remove('hidden');
}

function hideAddMarkerModal() {
  document.getElementById('add-marker-modal').classList.add('hidden');
  addMode = false;
  document.getElementById('btn-add-marker')?.classList.remove('active');
  mapInstance.getContainer().style.cursor = '';
}

async function submitAddMarker() {
  const name = document.getElementById('f-name').value.trim();
  if (!name) { Toast.warning('Lengkapi Form', 'Nama wajib diisi.'); return; }

  const payload = {
    name,
    type: document.getElementById('f-type').value,
    category: 'disaster',
    severity: document.getElementById('f-severity').value,
    lat: parseFloat(document.getElementById('f-lat').value),
    lng: parseFloat(document.getElementById('f-lng').value),
    description: document.getElementById('f-desc').value.trim() || null,
  };

  try {
    const data = await ApiClient.post('/map-markers', payload);
    // Tidak perlu manual plot — WebSocket broadcast 'marker:created' akan otomatis trigger render
    // (juga berlaku utk diri sendiri karena server broadcast ke semua termasuk pengirim)
    upsertMarkerCache(data.marker); plotMarker(data.marker); refreshStats();
    Toast.success('Marker Ditambahkan', `${name} berhasil ditambahkan ke peta`);
    hideAddMarkerModal();
  } catch (e) {
    Toast.error('Gagal Menambahkan', e.message);
  }
}

async function deleteMarker(id) {
  showConfirm('Hapus marker ini?', async () => {
    try {
      await ApiClient.delete(`/map-markers/${id}`);
      removeMarkerCache(id); removeMarkerLayer('mrk-'+id); refreshStats();
      Toast.success('Dihapus', 'Marker berhasil dihapus');
    } catch (e) { Toast.error('Gagal Menghapus', e.message); }
  });
}

Object.assign(window, {
  initMap, toggleLayer, filterList, focusIncident,
  toggleAddMode, hideAddMarkerModal, submitAddMarker, deleteMarker,
});
