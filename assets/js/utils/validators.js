/* ============================================
   DRCC — validators.js
   Form & data validation utilities
   ============================================ */
'use strict';

const Validators = {

  /* ---- PRIMITIVE VALIDATORS ---- */
  required(value) {
    return value !== null && value !== undefined && String(value).trim() !== '';
  },

  minLength(value, min) { return String(value).trim().length >= min; },
  maxLength(value, max) { return String(value).trim().length <= max; },

  email(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
  },

  phone(value) {
    return /^(\+62|62|0)\d{8,12}$/.test(String(value).trim().replace(/[\s\-().]/g, ''));
  },

  number(value, min = -Infinity, max = Infinity) {
    const n = parseFloat(value);
    return !isNaN(n) && n >= min && n <= max;
  },

  integer(value, min = -Infinity, max = Infinity) {
    const n = parseInt(value, 10);
    return !isNaN(n) && n === parseFloat(value) && n >= min && n <= max;
  },

  coords(lat, lng) {
    return this.number(lat, -90, 90) && this.number(lng, -180, 180);
  },

  date(value) {
    if (!value) return false;
    const d = new Date(value);
    return !isNaN(d.getTime());
  },

  url(value) {
    try { new URL(value); return true; }
    catch { return false; }
  },

  /* ---- DRCC-SPECIFIC VALIDATORS ---- */
  incidentTitle(value) {
    return this.required(value) && this.minLength(value, 5) && this.maxLength(value, 120);
  },

  severity(value) {
    return ['NORMAL','WASPADA','SIAGA','BAHAYA'].includes(value);
  },

  incidentStatus(value) {
    return ['aktif','ditangani','selesai'].includes(value);
  },

  resourceStatus(value) {
    return ['tersedia','deployed','maintenance'].includes(value);
  },

  /* ---- SINGLE FIELD VALIDATION (with DOM feedback) ---- */
  field(inputEl, rules = {}) {
    if (!inputEl) return true;
    const val = inputEl.value.trim();
    let ok = true, msg = '';

    if (rules.required && !this.required(val))          { ok=false; msg='Field ini wajib diisi.'; }
    else if (rules.minLength && !this.minLength(val, rules.minLength)) { ok=false; msg=`Minimal ${rules.minLength} karakter.`; }
    else if (rules.maxLength && !this.maxLength(val, rules.maxLength)) { ok=false; msg=`Maksimal ${rules.maxLength} karakter.`; }
    else if (rules.email && val && !this.email(val))    { ok=false; msg='Format email tidak valid (contoh@mail.com).'; }
    else if (rules.phone && val && !this.phone(val))    { ok=false; msg='Format HP tidak valid (08xx...).'; }
    else if (rules.min !== undefined && !this.number(val, rules.min, rules.max ?? Infinity)) {
      ok=false; msg=`Nilai harus antara ${rules.min} – ${rules.max ?? '∞'}.`;
    }

    inputEl.classList.toggle('invalid', !ok);
    const errEl = inputEl.parentElement?.querySelector('.form-error');
    if (errEl) { errEl.textContent = msg; errEl.style.display = ok ? 'none' : 'block'; }

    return ok;
  },

  /* ---- FORM-LEVEL VALIDATION ---- */
  form(formEl) {
    if (!formEl) return true;
    const inputs = formEl.querySelectorAll('[data-validate]');
    let allOk = true;
    inputs.forEach(input => {
      const rules = (() => { try { return JSON.parse(input.dataset.validate); } catch { return {}; } })();
      if (!this.field(input, rules)) allOk = false;
    });
    return allOk;
  },

  /* ---- CLEAR VALIDATION STATE ---- */
  clearField(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove('invalid');
    const errEl = inputEl.parentElement?.querySelector('.form-error');
    if (errEl) errEl.style.display = 'none';
  },

  clearForm(formEl) {
    formEl?.querySelectorAll('.form-input, .form-select, .form-textarea')
      .forEach(el => this.clearField(el));
  },
};

window.Validators = Validators;
