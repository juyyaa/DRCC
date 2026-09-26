/* ============================================
   DRCC — schema.js
   LocalStorage schema + data model definitions
   ============================================ */
'use strict';

const Schema = {
  VERSION: '2.0',

  KEYS: {
    INCIDENTS:       'drcc_incidents',
    RESOURCES:       'drcc_resources',
    SIGNALS_HIST:    'drcc_signals_history',
    AI_HISTORY:      'drcc_ai_history',
    MAP_MARKERS:     'drcc_map_markers',
    SETTINGS:        'drcc_settings',
    DARK_MODE:       'drcc_dark_mode',
    NOTIFICATIONS:   'drcc_notifications',
    ACTIVITY_LOG:    'drcc_activity_log',
    SIGNAL_EVENTS:   'drcc_signal_events',
    PROCESSING_LOG:  'drcc_processing_log',
    ANOMALIES:       'drcc_anomalies',
    AI_DECISIONS:    'drcc_ai_decisions',
    REASONING_LOG:   'drcc_reasoning_log',
    COORD_LOG:       'drcc_agent_coordination',
    EVIDENCE:        'drcc_evidence',
    SCENARIOS_RUN:   'drcc_scenarios_run',
    CUSTOM_SIGNALS:  'drcc_custom_signals',
    NAV_HISTORY:     'drcc_nav_history',
  },

  models: {
    incident: {
      id:'', title:'', type:'', location:'', province:'',
      lat:0, lng:0, severity:'NORMAL', status:'aktif',
      desc:'', reporter:'', phone:'', affected:0,
      signalOrigin:null, assignedResources:[],
      createdAt:0, updatedAt:0,
    },
    resource: {
      id:'', name:'', type:'', quantity:1, status:'tersedia',
      location:'', assignedTo:null, notes:'', createdAt:0, updatedAt:0,
    },
    signalEvent: {
      id:'', signalId:'', signalName:'', ts:0,
      rawValue:0, filteredValue:0,
      features:{}, anomaly:false, anomalyLevel:'NORMAL',
      processingSteps:[], priorityScore:0, source:'', layer:1,
    },
    aiDecision: {
      id:'', agentId:'', agentName:'', ts:0,
      inputData:{}, reasoningSteps:[], output:{},
      confidence:0, triggerSource:null, layer:3,
    },
    evidence: {
      id:'', type:'', layer:0, ts:0,
      title:'', data:{}, user:'', page:'',
    },
    scenarioRun: {
      id:'', scenarioId:'', ts:0, completedAt:0,
      steps:[], complete:false,
    },
  },

  create(modelName, overrides = {}) {
    const model = this.models[modelName];
    if (!model) return null;
    return {
      ...JSON.parse(JSON.stringify(model)),
      ...overrides,
      id: overrides.id || `${modelName.toUpperCase().slice(0,3)}-${Date.now()}`,
      createdAt: Date.now(), updatedAt: Date.now(),
    };
  },

  validate(modelName, data) {
    const model = this.models[modelName];
    if (!model) return { valid:false, errors:['Unknown model: '+modelName] };
    const errors = [];
    if (!data.id) errors.push('id is required');
    return { valid: errors.length === 0, errors };
  },

  /* Check if all 5 layers have data */
  getLayerStatus() {
    const get = (key) => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch { return []; } };
    return {
      1: get(this.KEYS.PROCESSING_LOG).length   > 0,
      2: get(this.KEYS.ANOMALIES).length        > 0,
      3: get(this.KEYS.REASONING_LOG).length    > 0,
      4: get(this.KEYS.AI_HISTORY).length       > 0,
      5: get(this.KEYS.INCIDENTS).length        > 0,
    };
  },

  getCompletenessScore() {
    const status = this.getLayerStatus();
    const filled = Object.values(status).filter(Boolean).length;
    return { score: Math.round((filled / 5) * 100), layers: status, filled, total: 5 };
  },
};

window.Schema = Schema;
