/* ============================================
   DRCC — decision-tree.js  (Layer 4)
   Decision tree visualizer + auto-trigger + escalation
   ============================================ */
'use strict';

const DecisionTree = {
  KEY: 'drcc_ai_decisions',

  /* Auto-trigger rules (Layer 4) */
  RULES: [
    { id:'R01', condition: d => d.magnitude >= 7.0,  action:'DARURAT NASIONAL — Eskalasi otomatis semua layer',                           level:'BAHAYA', score:95 },
    { id:'R02', condition: d => d.magnitude >= 6.0,  action:'Aktifkan respons darurat daerah — notifikasi otomatis',                      level:'BAHAYA', score:80 },
    { id:'R03', condition: d => d.magnitude >= 5.0,  action:'Siagakan tim SAR regional — pantau perkembangan',                           level:'SIAGA',  score:65 },
    { id:'R04', condition: d => (d.waterLevel||0)>=300, action:'Peringatan banjir kritis — evakuasi wajib zona rendah',                   level:'BAHAYA', score:88 },
    { id:'R05', condition: d => (d.waterLevel||0)>=250, action:'Siaga banjir — buka jalur evakuasi',                                     level:'SIAGA',  score:70 },
    { id:'R06', condition: d => (d.riskScore||0) >= 90, action:'Auto-escalation: Risk > 90 → notifikasi semua pejabat darurat',          level:'BAHAYA', score:90 },
    { id:'R07', condition: d => (d.riskScore||0) >= 80, action:'Auto-escalation: Risk > 80 → aktifkan posko koordinasi',                 level:'SIAGA',  score:80 },
    { id:'R08', condition: d => (d.population||0) > 100000, action:'Populasi besar — prioritas koordinasi multi-instansi',               level:'SIAGA',  score:75 },
    { id:'R09', condition: d => d.anomalyCount > 2,  action:'Multi-anomali terdeteksi — compound hazard assessment',                     level:'SIAGA',  score:70 },
    { id:'R10', condition: d => true,                action:'Monitoring rutin — update laporan situasi',                                  level:'NORMAL', score:20 },
  ],

  evaluate(data) {
    const fired = [];
    for (const rule of this.RULES) {
      try {
        if (rule.condition(data)) {
          fired.push({ ...rule, condition: undefined, firedAt: Date.now(), data });
          if (rule.level === 'BAHAYA' || rule.level === 'SIAGA') break; // stop at first critical
        }
      } catch {}
    }

    const decision = {
      id:         `DEC-${Date.now()}`,
      ts:         Date.now(),
      input:      data,
      firedRules: fired,
      topRule:    fired[0] || null,
      allRules:   this.RULES.map(r => ({ id:r.id, action:r.action, level:r.level, score:r.score, fired: fired.some(f=>f.id===r.id), condition: r.condition.toString().replace(/d\s*=>\s*/,'') })),
      layer: 4,
    };

    this._save(decision);
    if (window.Logger) Logger.decision(`Decision: ${fired[0]?.level||'NORMAL'} — ${fired[0]?.id}`, decision, 4);
    if (window.State && fired[0]?.level==='BAHAYA') {
      State.notifications.push('error', '🚨 Auto-Escalation Aktif', fired[0]?.action);
    }
    return decision;
  },

  /* Render simple SVG decision tree */
  renderSVG(decision) {
    if (!decision) return '';
    const rules = decision.allRules || [];
    const w = 580, rowH = 36, pad = 16;
    const h = rules.length * rowH + pad * 2 + 40;
    const levelColor = { BAHAYA:'#E74C3C', SIAGA:'#E67E22', WASPADA:'#F39C12', NORMAL:'#27AE60' };

    let rows = '';
    rules.forEach((r, i) => {
      const y   = pad + 40 + i * rowH;
      const col = levelColor[r.level] || '#6C757D';
      const isFired = r.fired;
      rows += `
        <g transform="translate(0,${y})">
          <rect x="8" y="-14" width="${w-16}" height="30" rx="6"
            fill="${isFired ? col+'22' : 'transparent'}"
            stroke="${isFired ? col : 'var(--border,#dee2e6)'}"
            stroke-width="${isFired?2:1}"/>
          <text x="18" y="4" font-size="10" font-family="Inter,sans-serif"
            fill="${isFired ? col : 'var(--text-muted,#6c757d)'}"
            font-weight="${isFired?'700':'400'}">
            ${r.id}: ${isFired?'▶ FIRED → ':''} ${r.action.length>62?r.action.slice(0,59)+'…':r.action}
          </text>
          <text x="${w-20}" y="4" font-size="9" text-anchor="end"
            font-family="monospace" fill="${col}" font-weight="700">${r.level}</text>
        </g>`;
    });

    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
      <text x="12" y="22" font-size="12" font-weight="800" fill="var(--text,#212529)" font-family="Inter,sans-serif">Decision Tree — ${rules.length} Rules</text>
      ${rows}
    </svg>`;
  },

  _save(d) {
    try {
      const all = JSON.parse(localStorage.getItem(this.KEY)||'[]');
      all.unshift(d);
      if (all.length > 100) all.splice(100);
      localStorage.setItem(this.KEY, JSON.stringify(all));
    } catch {}
  },
  getAll()    { try { return JSON.parse(localStorage.getItem(this.KEY)||'[]'); } catch { return []; } },
  getLatest() { return this.getAll()[0] || null; },
  clear()     { localStorage.setItem(this.KEY,'[]'); },
};

window.DecisionTree = DecisionTree;
