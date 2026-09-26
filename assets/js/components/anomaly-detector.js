/* ============================================
   DRCC — anomaly-detector.js  (Layer 2)
   Deteksi anomali sinyal otomatis vs threshold
   ============================================ */
'use strict';

const AnomalyDetector = {
  KEY: 'drcc_anomalies',

  /* Threshold config per signal type */
  THRESHOLDS: {
    gempa:       [{ v:7.0,label:'BAHAYA' },{ v:6.0,label:'SIAGA' },{ v:4.0,label:'WASPADA' }],
    cuaca:       [{ v:100,label:'BAHAYA' },{ v:80, label:'SIAGA' },{ v:50, label:'WASPADA' }],
    waterLevel:  [{ v:300,label:'BAHAYA' },{ v:250,label:'SIAGA' },{ v:150,label:'WASPADA' }],
    windSpeed:   [{ v:120,label:'BAHAYA' },{ v:80, label:'SIAGA' },{ v:50, label:'WASPADA' }],
    temperature: [{ v:40, label:'BAHAYA' },{ v:35, label:'SIAGA' },{ v:30, label:'WASPADA' }],
    pengungsian: [{ v:80, label:'BAHAYA' },{ v:60, label:'SIAGA' },{ v:40, label:'WASPADA' }],
    generic:     [{ v:80, label:'BAHAYA' },{ v:60, label:'SIAGA' },{ v:40, label:'WASPADA' }],
  },

  check(value, signalType = 'generic') {
    const thresholds = this.THRESHOLDS[signalType] || this.THRESHOLDS.generic;
    const sorted = [...thresholds].sort((a,b) => b.v - a.v);
    for (const t of sorted) {
      if (value >= t.v) {
        return { isAnomaly:true, level:t.label, threshold:t.v, value, signalType };
      }
    }
    return { isAnomaly:false, level:'NORMAL', value, signalType };
  },

  record(result, signalId, signalName) {
    if (!result.isAnomaly) return;
    const all = this._getAll();
    const entry = {
      id:         `ANOM-${Date.now()}`,
      ts:         Date.now(),
      signalId, signalName,
      value:      result.value,
      threshold:  result.threshold,
      level:      result.level,
      signalType: result.signalType,
    };
    all.unshift(entry);
    if (all.length > 200) all.splice(200);
    this._save(all);

    /* Real-time notification */
    if (window.State)  State.notifications.push('warning', `⚠ Anomali: ${signalName}`, `Nilai ${result.value} melebihi threshold ${result.threshold} — Level ${result.level}`);
    if (window.Logger) Logger.warn(`Anomali terdeteksi: ${signalName}`, entry, 2);
    if (window.State)  State._emit('anomaly:new', entry);
    return entry;
  },

  getAll()         { return this._getAll(); },
  getRecent(n=10)  { return this._getAll().slice(0, n); },
  getByLevel(l)    { return this._getAll().filter(a => a.level === l); },
  count()          { return this._getAll().length; },
  clear()          { this._save([]); },

  _getAll() { try { return JSON.parse(localStorage.getItem(this.KEY)||'[]'); } catch { return []; } },
  _save(d)  { try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch{} },
};

window.AnomalyDetector = AnomalyDetector;
