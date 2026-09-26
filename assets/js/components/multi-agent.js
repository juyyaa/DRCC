/* ============================================
   DRCC — multi-agent.js  (Layer 3)
   Koordinasi 4 AI Agent: communication flow + consensus
   ============================================ */
'use strict';

const MultiAgent = {
  KEY: 'drcc_agent_coordination',

  FLOW: [
    { from:'ARIA', to:'LOGI',  msg:'Situasi assessment + estimasi populasi terdampak → untuk kalkulasi kebutuhan logistik',     delay:0   },
    { from:'ARIA', to:'RECON', msg:'Area terdampak dan severity level → untuk perencanaan rute evakuasi',                      delay:200 },
    { from:'ARIA', to:'PULSE', msg:'Risk level final → untuk penentuan level siaga publik',                                    delay:300 },
    { from:'LOGI', to:'RECON', msg:'Ketersediaan transportasi dan kapasitas → untuk optimasi rute distribusi',                 delay:450 },
    { from:'RECON',to:'PULSE', msg:'Rute evakuasi dan lokasi posko → untuk panduan publik dan notifikasi',                    delay:600 },
    { from:'LOGI', to:'PULSE', msg:'Kapasitas posko dan kebutuhan logistik → untuk informasi pengungsian publik',              delay:700 },
    { from:'RECON',to:'ARIA',  msg:'Konfirmasi kapasitas respons lapangan → update situasi assessment',                       delay:850 },
    { from:'PULSE',to:'ARIA',  msg:'Status siaran notifikasi publik → untuk laporan final koordinasi',                        delay:950 },
  ],

  coordinate(input) {
    const session = {
      id:       `COORD-${Date.now()}`,
      ts:       Date.now(),
      input,
      messages: this.FLOW.map((f,i) => ({ ...f, seq:i+1, status:'sent', ts: Date.now()+f.delay })),
      agentStatus: { ARIA:'done', LOGI:'done', RECON:'done', PULSE:'done' },
      consensus:   this._buildConsensus(input),
    };
    this._save(session);
    if (window.Logger) Logger.ai(`Multi-agent koordinasi: ${session.messages.length} pesan`, {}, 3);
    if (window.State)  State._emit('coordination:new', session);
    return session;
  },

  _buildConsensus(input) {
    const { risk={score:0,level:'NORMAL'}, population=0, location='—' } = input;
    const level = risk.level || 'NORMAL';
    const actionMap = {
      BAHAYA:  ['🚨 DARURAT PENUH: Evakuasi massal segera', '🏥 Aktifkan semua unit medis darurat', '📦 Deploy logistik prioritas tertinggi', '📢 Siaran darurat nasional'],
      SIAGA:   ['⚡ Evakuasi mandatori zona terdampak', '🏕️ Buka posko pengungsian', '🚛 Siagakan konvoi logistik', '📻 Siaran peringatan regional'],
      WASPADA: ['👁️ Pantau situasi berkelanjutan', '🏠 Siapkan jalur evakuasi', '📋 Standby tim respons', '📱 Kirim peringatan dini'],
      NORMAL:  ['📊 Monitoring rutin', '📝 Update laporan situasi'],
    };
    return {
      riskLevel:   level,
      riskScore:   risk.score,
      location,
      actions:     actionMap[level] || actionMap.NORMAL,
      agreeCount:  4,
      statement:   `Seluruh 4 agen sepakat: ${level==='BAHAYA'?'Eskalasi darurat penuh diperlukan segera':level==='SIAGA'?'Respons terkoordinasi cepat diperlukan':'Pemantauan dan kesiapsiagaan ditingkatkan'}`,
    };
  },

  /* ---- RENDER COORDINATION PANEL (HTML) ---- */
  renderPanel(session) {
    if (!session) return '<div style="padding:20px;color:var(--text-muted)">Belum ada koordinasi</div>';
    const agentColors = { ARIA:'#B5651D', LOGI:'#2980B9', RECON:'#27AE60', PULSE:'#8E44AD' };
    const msgs = session.messages.map(m => `
      <div style="display:flex;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:11px;align-items:flex-start">
        <span style="background:${agentColors[m.from]};color:#fff;padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px;flex-shrink:0;min-width:40px;text-align:center">${m.from}</span>
        <i class="fas fa-arrow-right" style="color:var(--text-light);margin-top:2px;font-size:9px;flex-shrink:0"></i>
        <span style="background:${agentColors[m.to]}22;color:${agentColors[m.to]};padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px;flex-shrink:0;min-width:40px;text-align:center">${m.to}</span>
        <span style="color:var(--text-muted);flex:1;line-height:1.4">${m.msg}</span>
      </div>`).join('');
    return `
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">
        ${session.messages.length} Pesan Koordinasi — ID ${session.id.slice(-8)}
      </div>
      ${msgs}
      <div style="margin-top:10px;padding:10px;background:rgba(181,101,29,.08);border-radius:8px;border:1px solid rgba(181,101,29,.2)">
        <div style="font-size:11px;font-weight:800;color:var(--copper);margin-bottom:4px">🤝 KONSENSUS AGEN</div>
        <div style="font-size:12px;color:var(--text)">${session.consensus.statement}</div>
        <div style="margin-top:8px">${session.consensus.actions.map(a=>`<div style="font-size:11px;color:var(--text-muted);margin-top:3px">${a}</div>`).join('')}</div>
      </div>`;
  },

  _save(s) {
    try {
      const all = JSON.parse(localStorage.getItem(this.KEY)||'[]');
      all.unshift(s);
      if (all.length > 50) all.splice(50);
      localStorage.setItem(this.KEY, JSON.stringify(all));
    } catch {}
  },
  getAll()    { try { return JSON.parse(localStorage.getItem(this.KEY)||'[]'); } catch { return []; } },
  getLatest() { return this.getAll()[0] || null; },
  clear()     { localStorage.setItem(this.KEY,'[]'); },
};

window.MultiAgent = MultiAgent;
