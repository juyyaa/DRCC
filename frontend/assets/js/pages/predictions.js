/* ============================================
   DRCC — predictions.js (Fullstack API version)
   Riwayat prediksi/analisis AI dari backend (Layer 4)
   ============================================ */
'use strict';

async function initPredictions() {
  buildAppShell('predictions', 'Prediksi AI', 'Riwayat analisis dan prediksi dari AI Command Panel');

  let history = [];
  try {
    const data = await ApiClient.get('/ai/history?limit=100');
    history = data.history;
  } catch (e) { Toast.error('Gagal Memuat', e.message); return; }

  const stats = {
    total:  history.length,
    bahaya: history.filter(a => a.risk_level === 'BAHAYA').length,
    siaga:  history.filter(a => a.risk_level === 'SIAGA').length,
    normal: history.filter(a => !a.risk_level || a.risk_level === 'NORMAL' || a.risk_level === 'WASPADA').length,
  };
  setText('ps-total', stats.total); setText('ps-bahaya', stats.bahaya);
  setText('ps-siaga', stats.siaga); setText('ps-normal', stats.normal);

  if (!history.length) {
    document.getElementById('pred-list').style.display  = 'none';
    document.getElementById('pred-empty').style.display = '';
    return;
  }

  const levColor = { BAHAYA:'#E74C3C', SIAGA:'#E67E22', WASPADA:'#F39C12', NORMAL:'#27AE60' };
  const levBg    = { BAHAYA:'rgba(231,76,60,.1)', SIAGA:'rgba(230,126,34,.1)', WASPADA:'rgba(243,156,18,.1)', NORMAL:'rgba(39,174,96,.1)' };

  document.getElementById('pred-list').innerHTML = history.map(a => {
    const lc = levColor[a.risk_level] || '#6C757D';
    const lb = levBg[a.risk_level]    || 'rgba(108,117,125,.1)';
    const input = a.input_data || {};
    const area   = a.area_data || {};
    const cas    = a.casualty_data || {};
    const confs  = a.confidence_data || {};
    const dt     = new Date(a.created_at);
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:12px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:${lb};border-bottom:1px solid ${lc}33;flex-wrap:wrap;gap:8px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:10px;background:${lc}22;color:${lc};display:flex;align-items:center;justify-content:center;font-size:16px"><i class="fas fa-brain"></i></div>
            <div>
              <div style="font-size:14px;font-weight:800;color:var(--text)">${input.location || '—'}, ${input.province || '—'}</div>
              <div style="font-size:11px;color:var(--text-muted)">${input.type || '—'} · ${dt.toLocaleString('id-ID')} · ${a.ai_provider || 'gemini'}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="text-align:center;padding:6px 12px;background:${lc}22;border-radius:8px">
              <div style="font-size:20px;font-weight:900;color:${lc}">${a.risk_score}</div>
              <div style="font-size:9px;color:var(--text-muted)">Risk Score</div>
            </div>
            <span style="background:${lc};color:#fff;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:800">${a.risk_level}</span>
          </div>
        </div>
        <div style="padding:14px 18px;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
          <div style="text-align:center;padding:10px;background:var(--bg);border-radius:8px"><div style="font-size:18px;font-weight:800">${(area.km2||0).toLocaleString('id-ID')}</div><div style="font-size:10px;color:var(--text-muted)">km² area terdampak</div></div>
          <div style="text-align:center;padding:10px;background:var(--bg);border-radius:8px"><div style="font-size:18px;font-weight:800">${(cas.light||0).toLocaleString('id-ID')}</div><div style="font-size:10px;color:var(--text-muted)">korban ringan (est.)</div></div>
          <div style="text-align:center;padding:10px;background:var(--bg);border-radius:8px"><div style="font-size:18px;font-weight:800">${(input.population||0).toLocaleString('id-ID')}</div><div style="font-size:10px;color:var(--text-muted)">populasi terdampak</div></div>
          <div style="text-align:center;padding:10px;background:var(--bg);border-radius:8px"><div style="font-size:18px;font-weight:800;color:var(--copper)">${input.magnitude ?? '—'}</div><div style="font-size:10px;color:var(--text-muted)">magnitude</div></div>
        </div>
        ${Object.keys(confs).length ? `
        <div style="padding:0 18px 14px;display:flex;gap:8px;flex-wrap:wrap">
          ${Object.entries(confs).map(([ag, conf]) => `<div style="display:flex;align-items:center;gap:5px;padding:4px 10px;background:var(--bg);border-radius:20px;font-size:11px"><i class="fas fa-robot" style="color:var(--copper);font-size:10px"></i><span style="font-weight:700">${ag.toUpperCase()}</span><span style="color:var(--text-muted)">${conf}%</span></div>`).join('')}
          ${a.scenario_id ? `<span style="padding:4px 10px;background:rgba(181,101,29,.1);color:var(--copper);border-radius:20px;font-size:10px;font-weight:700">Demo: ${a.scenario_id}</span>` : ''}
        </div>` : ''}
      </div>`;
  }).join('');
}

function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

window.initPredictions = initPredictions;
