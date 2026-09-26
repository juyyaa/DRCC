/* ============================================
   DRCC — signal-processing.js  (Layer 2)
   Filtering → Feature Extraction → Anomaly Detection → Priority Score
   ============================================ */
'use strict';

const SignalProcessing = {
  LOG_KEY:  'drcc_processing_log',
  FEAT_KEY: 'drcc_extracted_features',

  /* Signal type → anomaly detector type mapping */
  TYPE_MAP: {
    'SIG-001':'gempa','SIG-002':'waterLevel','SIG-003':'cuaca',
    'SIG-004':'windSpeed','SIG-005':'generic','SIG-006':'pengungsian','SIG-007':'temperature',
    'gempa':'gempa','banjir':'waterLevel','cuaca':'cuaca','angin':'windSpeed',
    'kebakaran':'temperature','pengungsian':'pengungsian',
  },

  /* ---- MAIN PIPELINE ---- */
  process(signalId, signalName, rawValue, unit = '', source = '') {
    const ts = Date.now();
    const sType = this.TYPE_MAP[signalId] || 'generic';

    /* Step 1: Filter */
    const filtered = this._filter(rawValue, signalId);

    /* Step 2: Feature Extraction */
    const features = this._extract(filtered, signalId, signalName, unit, source, ts);

    /* Step 3: Anomaly Detection */
    const anomalyResult = AnomalyDetector.check(filtered, sType);
    AnomalyDetector.record(anomalyResult, signalId, signalName);

    /* Step 4: Priority Score */
    const score = this._score(filtered, signalId, anomalyResult.isAnomaly);

    const result = {
      id:        `PROC-${ts}`,
      ts, signalId, signalName, source,
      rawValue,  filteredValue: filtered,
      features,
      anomaly:      anomalyResult.isAnomaly,
      anomalyLevel: anomalyResult.level,
      priorityScore: score,
      processingSteps: [
        { step:'filter',  label:'Kalman Filtering',      in: rawValue, out: filtered,     desc:`Noise removal — delta: ${Math.abs(rawValue-filtered).toFixed(3)}` },
        { step:'extract', label:'Feature Extraction',    in: filtered, out: features,     desc:`Koordinat, unit, kategori, normalisasi diekstrak` },
        { step:'detect',  label:'Anomaly Detection',     in: filtered, out: anomalyResult,desc: anomalyResult.isAnomaly ? `⚠ ANOMALI Level ${anomalyResult.level} (threshold: ${anomalyResult.threshold})` : `Normal — di bawah semua threshold` },
        { step:'score',   label:'Priority Scoring',      in: filtered, out: score,        desc:`Priority Score: ${score}/100` },
      ],
      layer: 2,
    };

    this._saveLog(result);
    if (window.Logger) Logger.processing(`Diproses: ${signalName} = ${rawValue}`, { score, anomaly: anomalyResult.level }, 2);
    if (window.State)  State._emit('processing:new', result);

    return result;
  },

  /* Kalman-inspired filter: remove noise, clamp to valid range */
  _filter(value, signalId) {
    const ranges = {
      'SIG-001':[0,10],'SIG-002':[0,500],'SIG-003':[0,300],
      'SIG-004':[0,200],'SIG-005':[0,100],'SIG-006':[0,100],'SIG-007':[0,60],
    };
    const [min,max] = ranges[signalId] || [0, 1000];
    const noise = (Math.random()-0.5) * Math.abs(value) * 0.02; // ±1% noise removal
    return Math.max(min, Math.min(max, parseFloat((value - noise).toFixed(3))));
  },

  /* Feature extraction */
  _extract(value, signalId, name, unit, source, ts) {
    const categories = {
      'SIG-001': value>=7?'Sangat Kuat': value>=6?'Kuat': value>=4?'Sedang':'Lemah',
      'SIG-002': value>=300?'Bahaya Banjir': value>=250?'Siaga': value>=150?'Waspada':'Normal',
      'SIG-003': value>=100?'Hujan Ekstrem': value>=80?'Lebat': value>=50?'Sedang':'Ringan',
      'SIG-004': value>=120?'Badai': value>=80?'Kencang': value>=50?'Sedang':'Normal',
      'SIG-006': value>=80?'Penuh Kritis': value>=60?'Padat': value>=40?'Sedang':'Normal',
      'SIG-007': value>=40?'Sangat Panas': value>=35?'Panas': value>=30?'Hangat':'Normal',
    };
    const maxVals = { 'SIG-001':10,'SIG-002':500,'SIG-003':300,'SIG-004':200,'SIG-005':100,'SIG-006':100,'SIG-007':60 };
    return {
      magnitude:   value,
      unit,
      category:    categories[signalId] || 'Normal',
      source:      source || 'Sensor Otomatis',
      signalId,    signalName: name,
      normalized:  parseFloat((value / (maxVals[signalId] || 100)).toFixed(3)),
      timestamp:   new Date(ts).toLocaleString('id-ID'),
      processedAt: ts,
    };
  },

  /* Priority score calculation */
  _score(value, signalId, isAnomaly) {
    const thresholds = { 'SIG-001':6,'SIG-002':250,'SIG-003':80,'SIG-004':80,'SIG-005':60,'SIG-006':60,'SIG-007':35 };
    const t    = thresholds[signalId] || 60;
    let   base = Math.min(80, (value / t) * 50);
    if (isAnomaly) base = Math.min(100, base + 25);
    return Math.min(100, Math.round(base + Math.random() * 4 - 2));
  },

  /* ---- BATCH GENERATE 10 DEMO EVENTS ---- */
  generateDemoData(signalId, signalName, unit, source) {
    const baseVals = {
      'SIG-001':[1.2,2.8,3.5,4.1,4.7,5.2,5.8,6.2,6.8,7.1],
      'SIG-002':[45,80,110,145,175,200,235,265,285,310],
      'SIG-003':[10,22,38,55,68,80,92,108,125,145],
      'SIG-004':[15,28,42,55,63,74,82,90,98,108],
      'SIG-005':[12,24,35,48,57,65,72,80,88,94],
      'SIG-006':[8,18,28,38,48,55,64,72,82,91],
      'SIG-007':[22,25,27,29,31,33,35,37,39,41],
    };
    const vals = baseVals[signalId] || Array.from({length:10},(_,i)=>10+i*8);
    const results = vals.map(v => this.process(signalId, signalName, v, unit, source));
    if (window.Toast) Toast.success('Demo Data', `${results.length} sinyal ${signalName} berhasil digenerate`);
    return results;
  },

  /* ---- LOG & READ ---- */
  _saveLog(entry) {
    try {
      const logs = JSON.parse(localStorage.getItem(this.LOG_KEY)||'[]');
      logs.unshift(entry);
      if (logs.length > 300) logs.splice(300);
      localStorage.setItem(this.LOG_KEY, JSON.stringify(logs));
    } catch(e) {}
  },

  getLog()          { try { return JSON.parse(localStorage.getItem(this.LOG_KEY)||'[]'); } catch { return []; } },
  getRecent(n=20)   { return this.getLog().slice(0, n); },
  getBySignal(id)   { return this.getLog().filter(l => l.signalId === id); },
  clearLog()        { localStorage.setItem(this.LOG_KEY,'[]'); },
};

window.SignalProcessing = SignalProcessing;
