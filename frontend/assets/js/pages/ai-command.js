/* ============================================
   DRCC — ai-command.js (Fullstack API + Real Gemini Integration)
   Layer 3 (AI Agent reasoning via Gemini) + Layer 4 (Decision Tree)
   ============================================ */
'use strict';

let aiHistory = [];
let lastResult = null;

const PROVINCES = ['Aceh','Sumatera Utara','Sumatera Barat','Riau','Jambi','Sumatera Selatan','Bengkulu','Lampung',
  'DKI Jakarta','Jawa Barat','Jawa Tengah','DI Yogyakarta','Jawa Timur','Banten','Bali',
  'Nusa Tenggara Barat','Nusa Tenggara Timur','Kalimantan Barat','Kalimantan Tengah','Kalimantan Selatan',
  'Kalimantan Timur','Kalimantan Utara','Sulawesi Utara','Sulawesi Tengah','Sulawesi Selatan',
  'Sulawesi Tenggara','Gorontalo','Maluku','Maluku Utara','Papua','Papua Barat'];

const AGENTS = {
  aria:  { name:'ARIA',  color:'#B5651D', icon:'fa-shield-halved' },
  logi:  { name:'LOGI',  color:'#2980B9', icon:'fa-boxes-stacking' },
  recon: { name:'RECON', color:'#27AE60', icon:'fa-people-arrows' },
  pulse: { name:'PULSE', color:'#9B59B6', icon:'fa-bullhorn' },
};
const LEVEL_COLOR = { BAHAYA:'#E74C3C', SIAGA:'#E67E22', WASPADA:'#F39C12', NORMAL:'#27AE60' };

/* ============================================================ INIT */
async function initAiCommand() {
  buildAppShell('ai-command', 'AI Command Panel', 'Analisis bencana multi-agent — Powered by Google Gemini');
  populateLocationOptions();
  await loadHistory();

  if (window.State) {
    State.on('ai:analysis:complete', () => loadHistory());
  }
}

function populateLocationOptions() {
  const sel = document.getElementById('f-lokasi');
  if (!sel) return;
  PROVINCES.forEach(p => sel.insertAdjacentHTML('beforeend', `<option value="${p}">${p}</option>`));
}

function updateMagnitudeLabel() {
  const jenis = document.getElementById('f-jenis').value;
  const label = document.getElementById('mag-label');
  const hint  = document.getElementById('mag-hint');
  const input = document.getElementById('f-magnitude');
  const map = {
    gempa:     { l:'Magnitudo (SR)', h:'Skala Richter 0–9', min:0.1, max:9, step:0.1, val:5.0 },
    banjir:    { l:'Tinggi Air (m)', h:'Estimasi ketinggian air 0–10m', min:0.1, max:10, step:0.1, val:1.5 },
    longsor:   { l:'Volume (ribu m³)', h:'Estimasi volume tanah bergerak', min:0.1, max:500, step:0.1, val:5 },
    kebakaran: { l:'Luas Area (ha)', h:'Estimasi luas area terbakar', min:0.1, max:5000, step:0.1, val:50 },
  };
  const cfg = map[jenis] || map.gempa;
  if (label) label.innerHTML = `${cfg.l} <span style="color:var(--danger)">*</span>`;
  if (hint)  hint.textContent = cfg.h;
  if (input) { input.min = cfg.min; input.max = cfg.max; input.step = cfg.step; input.value = cfg.val; }
}

/* ============================================================ RUN ANALYSIS (calls real Gemini via backend) */
async function runAIAnalysis() {
  const lokasi    = document.getElementById('f-lokasi').value;
  const jenis     = document.getElementById('f-jenis').value;
  const magnitude = parseFloat(document.getElementById('f-magnitude').value);
  const populasi  = parseInt(document.getElementById('f-populasi').value);
  const days      = parseInt(document.getElementById('f-days').value) || 7;

  if (!lokasi || !populasi) { Toast.warning('Lengkapi Form', 'Lokasi dan populasi wajib diisi.'); return; }

  const btn = document.getElementById('btn-analyze');
  btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menganalisis...';

  animateAgentsThinking();

  try {
    const result = await ApiClient.post('/ai/analyze', {
      type: jenis, magnitude, location: lokasi, province: lokasi, population: populasi, days,
    });
    lastResult = result;
    renderAgentResults(result);
    renderOutputPanel(result);
    renderReasoningPanel(result);
    renderDecisionTree(result);

    if (!result.geminiConfigured) {
      Toast.warning('Mode Fallback', 'GEMINI_API_KEY belum diset di backend .env — menggunakan estimasi lokal sederhana.');
    } else {
      Toast.success('Analisis Selesai', `Risk Score: ${result.risk.score}/100 — ${result.risk.level}`);
    }
    await loadHistory();
  } catch (e) {
    Toast.error('Analisis Gagal', e.message);
    resetAgentStatus();
  } finally {
    btn.disabled = false; btn.innerHTML = '<i class="fas fa-brain"></i> Analisis AI';
  }
}

/* ============================================================ AGENT CARD ANIMATION */
function animateAgentsThinking() {
  Object.keys(AGENTS).forEach((id, i) => {
    setTimeout(() => {
      const statusEl = document.getElementById(`${id}-status`);
      const card = document.getElementById(`agent-${id}`);
      if (statusEl) statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Berpikir...';
      if (card) card.dataset.state = 'thinking';
    }, i * 150);
  });
}

function renderAgentResults(result) {
  result.reasoning.forEach(r => {
    const statusEl = document.getElementById(`${r.agentId}-status`);
    const card = document.getElementById(`agent-${r.agentId}`);
    const confEl = card?.querySelector('.agent-conf');
    if (statusEl) statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Selesai';
    if (card) card.dataset.state = 'done';
    if (confEl) confEl.textContent = `${r.confidence}%`;
  });
}

function resetAgentStatus() {
  Object.keys(AGENTS).forEach(id => {
    const statusEl = document.getElementById(`${id}-status`);
    const card = document.getElementById(`agent-${id}`);
    if (statusEl) statusEl.innerHTML = '<i class="fas fa-circle"></i> Standby';
    if (card) card.dataset.state = 'idle';
  });
}

/* ============================================================ OUTPUT PANEL */
function renderOutputPanel(result) {
  document.getElementById('output-placeholder')?.classList.add('hidden');
  const panel = document.getElementById('output-panel');
  panel.classList.remove('hidden');

  const col = LEVEL_COLOR[result.risk.level] || '#6C757D';
  panel.innerHTML = `
    <div style="background:${col}11;border:1.5px solid ${col}44;border-radius:12px;padding:16px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Risk Score</div>
          <div style="font-size:36px;font-weight:900;color:${col}">${result.risk.score}<span style="font-size:16px">/100</span></div>
        </div>
        <span style="background:${col};color:#fff;padding:6px 16px;border-radius:20px;font-weight:800;font-size:13px">${result.risk.level}</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px" class="ai-out-3col">
      <div style="background:var(--bg);border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Area Terdampak</div><div style="font-size:20px;font-weight:800">${result.area.km2} km²</div></div>
      <div style="background:var(--bg);border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Korban Ringan (est.)</div><div style="font-size:20px;font-weight:800">${(result.casualties.light||0).toLocaleString('id-ID')}</div></div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Keputusan Otomatis</div>
      ${(result.decision?.firedRules||[]).map(r => `<div style="padding:8px 12px;background:var(--bg);border-radius:8px;margin-bottom:4px;border-left:3px solid ${LEVEL_COLOR[r.level]||'#6C757D'};font-size:12px"><b>${r.id}</b>: ${r.action}</div>`).join('') || '<div style="font-size:12px;color:var(--text-muted)">Tidak ada rule terpicu.</div>'}
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-secondary btn-sm" onclick="window.location.href='incidents.html'" type="button"><i class="fas fa-plus"></i> Buat Insiden dari Analisis Ini</button>
    </div>`;
}

/* ============================================================ REASONING PANEL (Layer 3) */
function renderReasoningPanel(result) {
  document.getElementById('reasoning-panel').style.display = '';
  window._currentReasoning = result.reasoning;
  showAgentReasoning(result.reasoning[0]?.agentId || 'aria');
}

function showAgentReasoning(agentId) {
  const reasoning = (window._currentReasoning || []).find(r => r.agentId === agentId);
  const content = document.getElementById('agent-reasoning-content');
  if (!content) return;

  ['aria','logi','recon','pulse','coord'].forEach(id => {
    const btn = document.getElementById('tab-'+id);
    if (btn) { btn.className = 'btn btn-' + (id===agentId?'primary':'secondary') + ' btn-sm'; btn.style.fontSize='11px'; }
  });

  if (!reasoning) { content.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:16px;text-align:center">Belum ada reasoning.</div>'; return; }

  const agent = AGENTS[agentId] || {};
  const confColor = reasoning.confidence >= 90 ? 'var(--success)' : reasoning.confidence >= 75 ? 'var(--copper)' : 'var(--warning)';
  const stepsHtml = (reasoning.steps||[]).map((s,i) => `
    <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="width:22px;height:22px;border-radius:50%;background:rgba(181,101,29,.15);color:var(--copper);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0">${i+1}</div>
      <div><div style="font-size:12px;font-weight:700;color:var(--text)">${s.title}</div><div style="font-size:11px;color:var(--text-muted);margin-top:2px">${s.desc}</div></div>
    </div>`).join('');

  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;padding:10px;background:var(--bg);border-radius:8px">
      <i class="fas ${agent.icon||'fa-robot'}" style="color:${agent.color||'var(--copper)'};font-size:20px"></i>
      <div style="flex:1"><div style="font-size:13px;font-weight:800;color:var(--text)">${reasoning.agentName} — ${reasoning.fullName}</div><div style="font-size:11px;color:var(--text-muted)">Powered by Gemini</div></div>
      <div style="text-align:center"><div style="font-size:22px;font-weight:900;color:${confColor}">${reasoning.confidence}%</div><div style="font-size:10px;color:var(--text-muted)">Confidence</div></div>
    </div>
    ${stepsHtml}
    <div style="margin-top:10px;padding:8px 12px;background:rgba(181,101,29,.06);border-radius:8px;font-size:12px;font-weight:600;color:var(--copper)">💡 ${reasoning.conclusion}</div>`;
}

function showCoordPanel() {
  ['aria','logi','recon','pulse'].forEach(id => { const b=document.getElementById('tab-'+id); if(b){b.className='btn btn-secondary btn-sm';b.style.fontSize='11px';} });
  const cb = document.getElementById('tab-coord'); if (cb) { cb.className='btn btn-primary btn-sm'; cb.style.fontSize='11px'; }

  const content = document.getElementById('agent-reasoning-content');
  if (!lastResult) { content.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:16px;text-align:center">Jalankan analisis dahulu.</div>'; return; }
  // Coordination summary tidak dikirim ulang dari /analyze response secara eksplisit — gunakan ringkasan decision
  const d = lastResult.decision;
  content.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Multi-Agent Coordination Summary</div>
    <div style="font-size:12px;color:var(--text);line-height:1.8">
      ARIA → LOGI: estimasi populasi & area terdampak dikirim untuk kalkulasi logistik<br>
      ARIA → RECON: severity level dikirim untuk perencanaan evakuasi<br>
      LOGI → RECON: ketersediaan transportasi dikirim untuk optimasi rute<br>
      RECON → PULSE: rute evakuasi & lokasi posko dikirim untuk notifikasi publik
    </div>
    <div style="margin-top:10px;padding:10px;background:rgba(181,101,29,.08);border-radius:8px">
      <div style="font-size:11px;font-weight:800;color:var(--copper)">🤝 KONSENSUS: Risk ${lastResult.risk.score}/100 — ${lastResult.risk.level}</div>
    </div>`;
}

/* ============================================================ DECISION TREE PANEL (Layer 4) */
function renderDecisionTree(result) {
  document.getElementById('decision-tree-panel').style.display = '';
  const badge = document.getElementById('decision-fired-badge');
  const content = document.getElementById('decision-tree-content');
  const top = result.decision?.topRule;

  if (badge && top) {
    const col = LEVEL_COLOR[top.level] || 'var(--text-muted)';
    badge.style.display = '';
    badge.innerHTML = `<span style="background:${col};color:#fff;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700">Rule ${top.id} FIRED → ${top.level}</span>`;
  }

  const rules = result.decision?.allRules || [];
  content.innerHTML = rules.map(r => {
    const fired = result.decision.firedRules.some(f => f.id === r.id);
    const col = LEVEL_COLOR[r.level] || '#6C757D';
    return `<div style="display:flex;justify-content:space-between;padding:8px 12px;border-radius:8px;margin-bottom:4px;background:${fired?col+'15':'var(--bg)'};border:1px solid ${fired?col:'var(--border)'}">
      <span style="font-size:12px;${fired?'font-weight:700;color:'+col:'color:var(--text-muted)'}">${fired?'▶ ':''}${r.id}: ${r.action}</span>
      <span style="font-size:10px;font-weight:700;color:${col}">${r.level}</span>
    </div>`;
  }).join('');
}

/* ============================================================ HISTORY */
async function loadHistory() {
  try {
    const data = await ApiClient.get('/ai/history?limit=20');
    aiHistory = data.history;
    renderHistoryList();
  } catch (e) {}
}

function renderHistoryList() {
  const list = document.getElementById('history-list');
  const count = document.getElementById('history-count');
  if (count) count.textContent = aiHistory.length;
  if (!list) return;

  list.innerHTML = aiHistory.length ? aiHistory.map(h => {
    const col = LEVEL_COLOR[h.risk_level] || '#6C757D';
    return `<div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px;font-size:11px">
      <div style="display:flex;justify-content:space-between"><b>${h.input_data?.location||'—'}</b><span style="color:${col};font-weight:800">${h.risk_score}</span></div>
      <div style="color:var(--text-muted)">${h.input_data?.type||''} · ${new Date(h.created_at).toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
    </div>`;
  }).join('') : '<div style="color:var(--text-muted);font-size:12px;grid-column:1/-1;text-align:center;padding:20px">Belum ada riwayat analisis.</div>';
}

function clearHistory() { Toast.info('Info', 'Riwayat analisis tersimpan permanen di database untuk audit trail (Layer 4 traceability).'); }

Object.assign(window, {
  initAiCommand, updateMagnitudeLabel, runAIAnalysis,
  showAgentReasoning, showCoordPanel, clearHistory,
});
