/* ============================================
   DRCC — signal-flow.js
   Animated signal flow: Layer 1 → 2 → 3 → 4 → 5
   ============================================ */
'use strict';

const SignalFlow = {

  LAYERS: [
    { id:1, name:'Input Signal',        short:'INPUT',   icon:'fa-satellite-dish',          color:'#2980B9' },
    { id:2, name:'Signal Processing',   short:'PROCESS', icon:'fa-microchip',               color:'#E67E22' },
    { id:3, name:'AI Agent',            short:'AI',      icon:'fa-brain',                   color:'#B5651D' },
    { id:4, name:'Prediction/Decision', short:'DECIDE',  icon:'fa-scale-balanced',          color:'#8E44AD' },
    { id:5, name:'User Action',         short:'ACTION',  icon:'fa-user-shield',             color:'#27AE60' },
  ],

  /* Render 5-layer status bar */
  renderStatusBar(containerEl, activeLayer = 0) {
    if (!containerEl) return;
    const status = window.Schema ? Schema.getLayerStatus() : {};
    containerEl.innerHTML = this.LAYERS.map(l => {
      const done = status[l.id] || false;
      const active = l.id === activeLayer;
      return `
        <div class="layer-badge ${done?'layer-done':''} ${active?'layer-active':''}"
             style="--lc:${l.color};flex:1;min-width:0">
          <i class="fas ${l.icon}"></i>
          <div class="layer-badge-text">
            <span class="layer-badge-num">Layer ${l.id}</span>
            <span class="layer-badge-name">${l.short}</span>
          </div>
          <span class="layer-badge-status">${done?'✓':active?'●':'○'}</span>
        </div>`;
    }).join('<i class="fas fa-chevron-right layer-arrow"></i>');
  },

  /* Animate a pulse through layers 1→N */
  animate(containerEl, upToLayer = 5, onComplete = null) {
    if (!containerEl) return;
    const badges = containerEl.querySelectorAll('.layer-badge');
    let i = 0;
    const interval = setInterval(() => {
      if (i < badges.length && i < upToLayer) {
        badges[i].classList.add('layer-active', 'layer-pulse');
        setTimeout(() => badges[i]?.classList.remove('layer-pulse'), 600);
        i++;
      } else {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 400);
  },

  /* Render mini flow SVG for dashboard */
  renderMiniSVG(activeLayer = 5, scores = {}) {
    const w = 560, h = 60;
    const nodeW = 80, nodeH = 36, gap = (w - nodeW * 5) / 6;

    const nodes = this.LAYERS.map((l, i) => {
      const x = gap + i * (nodeW + gap);
      const active = l.id <= activeLayer;
      const status = window.Schema ? Schema.getLayerStatus() : {};
      const done   = status[l.id];
      const score  = scores[l.id] || '';
      return `
        <g transform="translate(${x}, ${(h-nodeH)/2})">
          <rect width="${nodeW}" height="${nodeH}" rx="8"
            fill="${active ? l.color+'22' : 'var(--border,#dee2e6)'}"
            stroke="${active ? l.color : 'var(--border,#dee2e6)'}" stroke-width="1.5"/>
          <text x="${nodeW/2}" y="13" text-anchor="middle" font-size="9"
            fill="${active?l.color:'var(--text-muted,#6c757d)'}" font-family="Inter,sans-serif" font-weight="700">
            L${l.id}: ${l.short}
          </text>
          <text x="${nodeW/2}" y="26" text-anchor="middle" font-size="9"
            fill="${active?l.color:'var(--text-muted,#6c757d)'}" font-family="Inter,sans-serif">
            ${done ? '✓ Aktif' : '○ Kosong'}
          </text>
          ${score ? `<text x="${nodeW/2}" y="38" text-anchor="middle" font-size="8" fill="${l.color}" font-family="monospace">${score}</text>` : ''}
          ${i < 4 ? `<line x1="${nodeW+2}" y1="${nodeH/2}" x2="${nodeW+gap-2}" y2="${nodeH/2}" stroke="${active && (window.Schema?Schema.getLayerStatus()[l.id+1]:false) ? l.color : 'var(--border,#dee2e6)'}" stroke-width="1.5" stroke-dasharray="${active?'none':'4,3'}"/>` : ''}
        </g>`;
    }).join('');

    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">${nodes}</svg>`;
  },

  /* Inject CSS if not already present */
  injectCSS() {
    if (document.getElementById('signal-flow-css')) return;
    const style = document.createElement('style');
    style.id = 'signal-flow-css';
    style.textContent = `
      .layer-badge{display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:10px;background:var(--bg);border:1.5px solid var(--border);cursor:default;transition:all .3s}
      .layer-badge i{color:var(--lc,#B5651D);font-size:14px;flex-shrink:0}
      .layer-badge-text{flex:1;min-width:0}
      .layer-badge-num{display:block;font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px}
      .layer-badge-name{display:block;font-size:11px;font-weight:700;color:var(--text)}
      .layer-badge-status{font-size:14px;font-weight:900;color:var(--border);flex-shrink:0}
      .layer-done .layer-badge-status{color:var(--lc,#27AE60)}
      .layer-done{border-color:var(--lc,#27AE60)!important;background:color-mix(in srgb,var(--lc,#27AE60) 8%,transparent)}
      .layer-active{border-color:var(--lc)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--lc) 20%,transparent)}
      .layer-pulse{animation:layerPulse .6s ease}
      .layer-arrow{color:var(--text-light);font-size:10px;flex-shrink:0}
      @keyframes layerPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
    `;
    document.head.appendChild(style);
  },
};

window.SignalFlow = SignalFlow;
