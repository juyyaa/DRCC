/* ============================================
   DRCC — demo-center.js (Fullstack API + Real Gemini)
   Jalankan 10 skenario UAS end-to-end via backend
   ============================================ */
'use strict';

const LAYER_COLORS = {1:'#2980B9',2:'#E67E22',3:'#B5651D',4:'#8E44AD',5:'#27AE60'};
let completedScenarios = [];
let isRunning = false;

/* ============================================================ INIT */
async function initDemoCenter() {
  buildAppShell('demo-center', 'Demo Center', '10 Skenario UAS · 5 Layer Architecture · Real Gemini AI');

  if (!Auth.can('demoCenter', 'view')) {
    document.getElementById('page-content').innerHTML = `<div style="text-align:center;padding:60px"><i class="fas fa-lock" style="font-size:40px;color:var(--text-light)"></i><h3 style="margin-top:12px;color:var(--text-muted)">Halaman ini khusus Admin & Operator</h3></div>`;
    return;
  }

  await refreshCompleted();
  renderScenarioGrid();
  await refreshLayerStatus();
  await refreshEvidenceSummary();

  if (window.State) {
    State.on('demo:scenario:complete', async () => {
      await refreshCompleted(); renderScenarioGrid(); refreshLayerStatus(); refreshEvidenceSummary();
    });
  }
}

async function refreshCompleted() {
  try { const data = await ApiClient.get('/evidence/scenarios/completed'); completedScenarios = data.completed; }
  catch (e) { completedScenarios = []; }
}

/* ============================================================ SCENARIO GRID */
function renderScenarioGrid() {
  const container = document.getElementById('scenario-grid');
  if (!container || !window.DEMO_SCENARIOS) return;
  document.getElementById('done-count').textContent = `${completedScenarios.length}/10`;

  container.innerHTML = DEMO_SCENARIOS.map(scn => {
    const done = completedScenarios.includes(scn.id);
    const lvlColor = {HIGH:'#E74C3C',MEDIUM:'#E67E22',LOW:'#27AE60'}[scn.level]||'#6C757D';
    return `
      <div class="demo-scenario-card ${done?'done':''}" onclick="runSingle('${scn.id}')" id="card-${scn.id}">
        <div class="scn-strip" style="background:${scn.color}"></div>
        <div style="display:flex;align-items:flex-start;gap:8px;padding-left:8px">
          <div style="width:30px;height:30px;border-radius:8px;background:${scn.color}22;color:${scn.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px"><i class="fas ${scn.icon}"></i></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:800;color:var(--text);line-height:1.3">${scn.no}. ${scn.name}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${scn.location}, ${scn.province}</div>
            <div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap">
              <span class="scn-badge" style="background:${lvlColor}18;color:${lvlColor}">${scn.level}</span>
              <span class="scn-badge" style="background:var(--border);color:var(--text-muted)">M${scn.magnitude}</span>
              <span class="scn-badge" style="background:var(--border);color:var(--text-muted)">${(scn.population/1000).toFixed(0)}k jiwa</span>
            </div>
          </div>
          <div style="flex-shrink:0">${done ? `<span style="color:var(--success);font-size:18px">✅</span>` : `<button onclick="event.stopPropagation();runSingle('${scn.id}')" style="background:var(--copper);color:#fff;border:none;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;cursor:pointer"><i class="fas fa-play"></i></button>`}</div>
        </div>
      </div>`;
  }).join('');
}

/* ============================================================ LAYER STATUS BAR */
async function refreshLayerStatus() {
  const bar = document.getElementById('layer-status-bar');
  if (!bar) return;
  let summary;
  try { summary = await ApiClient.get('/evidence/summary'); } catch (e) { return; }

  const layers = [
    {id:1,name:'Input Signal',icon:'fa-broadcast-tower'}, {id:2,name:'Processing',icon:'fa-microchip'},
    {id:3,name:'AI Agent',icon:'fa-brain'}, {id:4,name:'Decision',icon:'fa-scale-balanced'}, {id:5,name:'User Action',icon:'fa-user-shield'},
  ];
  const status = summary.layerCompleteness.layers;

  bar.innerHTML = `<span style="font-size:11px;font-weight:700;color:var(--text-muted);white-space:nowrap">5 LAYER:</span>` +
    layers.map((l,i) => {
      const done = status[l.id]; const col = LAYER_COLORS[l.id];
      return `${i>0?'<i class="fas fa-chevron-right" style="color:var(--text-light);font-size:9px;flex-shrink:0"></i>':''}
        <div style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;border:1.5px solid ${done?col:'var(--border)'};background:${done?col+'18':'var(--bg)'};flex:1;min-width:0">
          <i class="fas ${l.icon}" style="color:${done?col:'var(--text-light)'};font-size:12px"></i>
          <div style="min-width:0"><div style="font-size:9px;color:var(--text-muted)">Layer ${l.id}</div><div style="font-size:10px;font-weight:700;color:${done?col:'var(--text-light)'}">${l.name}</div></div>
          <span style="margin-left:auto;font-size:14px">${done?'✅':'○'}</span>
        </div>`;
    }).join('') +
    `<div style="padding:6px 12px;background:${summary.layerCompleteness.score===100?'rgba(39,174,96,.15)':'rgba(181,101,29,.15)'};border-radius:8px;flex-shrink:0;text-align:center">
      <div style="font-size:9px;color:var(--text-muted)">Completeness</div>
      <div style="font-size:18px;font-weight:900;color:${summary.layerCompleteness.score===100?'var(--success)':'var(--copper)'}">${summary.layerCompleteness.score}%</div>
    </div>`;
}

/* ============================================================ EVIDENCE SUMMARY */
async function refreshEvidenceSummary() {
  const el = document.getElementById('evidence-summary');
  if (!el) return;
  let s;
  try { s = await ApiClient.get('/evidence/summary'); } catch (e) { return; }
  const ev = s.evidence;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">5 Layer Completeness</div>
        <div style="font-size:36px;font-weight:900;color:${s.layerCompleteness.score===100?'var(--success)':'var(--copper)'}">${s.layerCompleteness.score}%</div>
        <div style="font-size:12px;color:var(--text-muted)">${s.layerCompleteness.filled}/5 layer aktif</div>
      </div>
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Bukti Terkumpul</div>
        <div style="font-size:32px;font-weight:900;color:var(--copper)">${ev.scenariosCompleted}<span style="font-size:16px;color:var(--text-muted)">/10</span></div>
        <div style="font-size:12px;color:var(--text-muted)">${ev.signalEventsProcessed} sinyal · ${ev.anomaliesDetected} anomali · ${ev.aiAnalysesRun} analisis AI</div>
        <div style="margin-top:8px;padding:6px;background:${s.readyForUAS?'rgba(39,174,96,.1)':'rgba(230,126,34,.1)'};border-radius:6px;text-align:center">
          <span style="font-size:11px;font-weight:800;color:${s.readyForUAS?'var(--success)':'var(--warning)'}">${s.readyForUAS?'✅ SIAP UAS':`⚡ ${ev.scenariosCompleted}/10 skenario`}</span>
        </div>
      </div>
    </div>`;
}

/* ============================================================ RUN SCENARIO (calls real Gemini via backend) */
async function runSingle(scenarioId) {
  if (isRunning) { Toast.warning('Sedang Berjalan', 'Tunggu skenario sebelumnya selesai.'); return; }
  const scn = DEMO_SCENARIOS.find(s => s.id === scenarioId);
  if (!scn) return;
  isRunning = true;

  const card = document.getElementById('card-'+scenarioId);
  if (card) card.classList.add('running');
  document.getElementById('running-scn').textContent = `▶ ${scn.name}`;
  for (let i=1;i<=5;i++) { const el=document.getElementById('pt-'+i); if(el) el.className='pt-step'; }
  addLog(`▶ Memulai: ${scn.name}`, null, 'info');

  try {
    const result = await ApiClient.post(`/evidence/scenarios/${scenarioId}/run`, { scenario: scn });

    result.steps.forEach(s => {
      addLog(s.desc, s.layer, 'processing');
      for (let i=1;i<=s.layer;i++) { const el=document.getElementById('pt-'+i); if(el) el.className='pt-step '+(i<s.layer?'done':'active'); }
    });
    for (let i=1;i<=5;i++) { const el=document.getElementById('pt-'+i); if(el) el.className='pt-step done'; }

    addLog(`✅ Trace selesai: ${scenarioId} → L1→L2→L3→L4→L5 ✓ (Risk: ${result.risk.score}/100 — ${result.risk.level})`, null, 'success');
    document.getElementById('running-scn').textContent = `✅ ${scn.name} — Selesai`;
    if (card) { card.classList.remove('running'); card.classList.add('done'); }

    renderTracePanel(result, scn);
    await refreshCompleted(); renderScenarioGrid(); await refreshLayerStatus(); await refreshEvidenceSummary();
  } catch (e) {
    addLog(`❌ Gagal: ${e.message}`, null, 'error');
    Toast.error('Skenario Gagal', e.message);
  } finally {
    isRunning = false;
    if (card) card.classList.remove('running');
  }
}

/* ============================================================ RUN ALL */
async function runAllScenarios() {
  const btn = document.getElementById('btn-run-all');
  if (btn) { btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Menjalankan...'; }

  for (const scn of DEMO_SCENARIOS) {
    if (completedScenarios.includes(scn.id)) continue;
    addLog(`─── Mulai Skenario ${scn.no}: ${scn.name} ───`, null, 'separator');
    await runSingle(scn.id);
    await new Promise(r => setTimeout(r, 300));
  }

  if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-check"></i> Semua Selesai!'; }
  Toast.success('🎓 Demo Selesai!', 'Semua skenario berhasil dijalankan — bukti UAS siap diekspor');
}

/* ============================================================ TRACE PANEL */
function renderTracePanel(result, scn) {
  const tp = document.getElementById('trace-panel');
  if (!tp) return;
  const reasoningHtml = (result.reasoning||[]).map(r => `
    <div style="padding:6px 10px;background:var(--bg);border-radius:6px;margin-bottom:4px;font-size:11px">
      <b style="color:var(--copper)">${r.agentName}</b> (${r.confidence}%): ${r.conclusion}
    </div>`).join('');
  tp.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">${scn.name} — ${result.incidentId}</div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Risk Score: <b style="color:var(--copper)">${result.risk.score}/100</b> — ${result.risk.level}</div>
    ${reasoningHtml}`;
}

/* ============================================================ LOG HELPER */
function addLog(msg, layer, type='info') {
  const log = document.getElementById('exec-log');
  if (!log) return;
  const now = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const colors = { info:'#94A3B8', success:'#4ADE80', processing:'#FB923C', separator:'#B5651D', error:'#F87171' };
  const lc = layer ? LAYER_COLORS[layer] : '#64748B';
  const layerTag = layer ? `<span class="layer-pill" style="background:${lc}33;color:${lc}">L${layer}</span>` : '';
  const div = document.createElement('div');
  div.className='exec-log-entry';
  div.innerHTML=`<span class="log-time">${now}</span>${layerTag}<span class="log-msg" style="color:${colors[type]||'#E2E8F0'}">${msg}</span>`;
  log.insertBefore(div, log.firstChild);
}

/* ============================================================ EXPORTS */
async function exportEvidenceJSON() {
  try {
    const data = await ApiClient.get('/evidence/export');
    const blob = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
    const a = Object.assign(document.createElement('a'), { href:URL.createObjectURL(blob), download:`drcc_evidence_uas_${Date.now()}.json` });
    a.click();
    Toast.success('Diekspor', 'Bukti UAS lengkap diekspor ke JSON');
  } catch (e) { Toast.error('Gagal', e.message); }
}

function resetAllDemos() {
  showConfirm('Reset tampilan demo? (Data di server tidak terhapus — hanya bukti tetap, ini hanya membersihkan log tampilan)', () => {
    document.getElementById('exec-log').innerHTML = '<div class="exec-log-entry"><span class="log-msg" style="color:#64748B">Log dibersihkan.</span></div>';
    document.getElementById('trace-panel').innerHTML = '<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:20px">Jalankan skenario untuk melihat trace</div>';
    Toast.success('Tampilan Direset', '');
  });
}

Object.assign(window, { initDemoCenter, runSingle, runAllScenarios, exportEvidenceJSON, resetAllDemos });
