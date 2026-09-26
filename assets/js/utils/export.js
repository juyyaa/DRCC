/* ============================================
   DRCC — export.js
   CSV & JSON export utilities
   ============================================ */
'use strict';

const Exporter = {

  /* ---- CORE HELPERS ---- */
  _row(values) {
    return values.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  },

  _download(content, filename, mime = 'text/csv;charset=utf-8;') {
    const bom  = mime.includes('csv') ? '\uFEFF' : ''; // BOM for Excel UTF-8
    const blob = new Blob([bom + content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  /* Convert array of objects to CSV string */
  toCSV(data, columns) {
    const headers = columns.map(c => c.header || c.key);
    const rows    = [this._row(headers)];
    data.forEach(item => {
      rows.push(this._row(columns.map(c =>
        c.format ? c.format(item[c.key], item) : (item[c.key] ?? '')
      )));
    });
    return rows.join('\r\n');
  },

  /* ---- INCIDENTS ---- */
  exportIncidents() {
    const data = AppStorage.get('drcc_incidents', []);
    if (!data.length) { Toast.warning('Tidak Ada Data', 'Belum ada insiden tersimpan'); return; }

    const columns = [
      { key:'id',        header:'ID' },
      { key:'title',     header:'Judul' },
      { key:'type',      header:'Jenis' },
      { key:'location',  header:'Lokasi' },
      { key:'province',  header:'Provinsi' },
      { key:'lat',       header:'Latitude' },
      { key:'lng',       header:'Longitude' },
      { key:'severity',  header:'Keparahan' },
      { key:'status',    header:'Status' },
      { key:'affected',  header:'Terdampak' },
      { key:'reporter',  header:'Pelapor' },
      { key:'phone',     header:'HP Pelapor' },
      { key:'desc',      header:'Deskripsi' },
      { key:'createdAt', header:'Dibuat', format: v => v ? new Date(v).toLocaleString('id-ID') : '' },
    ];

    const csv = this.toCSV(data, columns);
    this._download(csv, `drcc_insiden_${Date.now()}.csv`);
    Toast.success('Export Berhasil', `${data.length} insiden diekspor ke CSV`);
  },

  /* ---- RESOURCES ---- */
  exportResources() {
    const data = AppStorage.get('drcc_resources', []);
    if (!data.length) { Toast.warning('Tidak Ada Data', 'Belum ada sumber daya tersimpan'); return; }

    const columns = [
      { key:'id',         header:'ID' },
      { key:'name',       header:'Nama' },
      { key:'type',       header:'Jenis' },
      { key:'quantity',   header:'Jumlah' },
      { key:'status',     header:'Status' },
      { key:'location',   header:'Lokasi' },
      { key:'assignedTo', header:'Ditugaskan ke' },
      { key:'notes',      header:'Catatan' },
      { key:'updatedAt',  header:'Diperbarui', format: v => v ? new Date(v).toLocaleString('id-ID') : '' },
    ];

    const csv = this.toCSV(data, columns);
    this._download(csv, `drcc_sumberdaya_${Date.now()}.csv`);
    Toast.success('Export Berhasil', `${data.length} sumber daya diekspor`);
  },

  /* ---- HISTORY ---- */
  exportHistory(historyData) {
    if (!historyData?.length) { Toast.warning('Tidak Ada Data', 'Tidak ada riwayat untuk diekspor'); return; }

    const columns = [
      { key:'ts',     header:'Waktu', format: v => new Date(v).toLocaleString('id-ID') },
      { key:'type',   header:'Tipe' },
      { key:'level',  header:'Level' },
      { key:'title',  header:'Judul' },
      { key:'source', header:'Sumber' },
      { key:'detail', header:'Detail' },
      { key:'id',     header:'Ref ID' },
    ];

    const csv = this.toCSV(historyData, columns);
    this._download(csv, `drcc_riwayat_${Date.now()}.csv`);
    Toast.success('Export Berhasil', `${historyData.length} baris riwayat diekspor`);
  },

  /* ---- FULL BACKUP (JSON) ---- */
  exportAllJSON() {
    const backup = {
      meta: {
        exportedAt: new Date().toISOString(),
        version:    '1.0',
        app:        'DRCC AI Disaster Response Command Center',
      },
      incidents:  AppStorage.get('drcc_incidents',        []),
      resources:  AppStorage.get('drcc_resources',        []),
      aiHistory:  AppStorage.get('drcc_ai_history',       []),
      signals:    AppStorage.get('drcc_signals_history',  []),
      mapMarkers: AppStorage.get('drcc_map_markers',      []),
      settings:   AppStorage.get('drcc_settings',         {}),
    };

    const json = JSON.stringify(backup, null, 2);
    this._download(json, `drcc_backup_${Date.now()}.json`, 'application/json;charset=utf-8;');
    const count = backup.incidents.length + backup.resources.length + backup.aiHistory.length;
    Toast.success('Backup Berhasil', `${count} item data diekspor ke JSON`);
  },

  /* ---- IMPORT BACKUP (JSON) ---- */
  importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.meta?.version) throw new Error('Format tidak dikenali');

      let imported = 0;
      if (data.incidents?.length)  { AppStorage.set('drcc_incidents',        data.incidents);  imported += data.incidents.length; }
      if (data.resources?.length)  { AppStorage.set('drcc_resources',        data.resources);  imported += data.resources.length; }
      if (data.aiHistory?.length)  { AppStorage.set('drcc_ai_history',       data.aiHistory);  imported += data.aiHistory.length; }
      if (data.mapMarkers?.length) { AppStorage.set('drcc_map_markers',      data.mapMarkers); imported += data.mapMarkers.length; }
      if (data.settings)           { AppStorage.set('drcc_settings',         data.settings); }

      Toast.success('Import Berhasil', `${imported} item dari backup ${data.meta.exportedAt?.split('T')[0] || '—'} dimuat`);
      return true;
    } catch(e) {
      Toast.error('Import Gagal', `Format file tidak valid: ${e.message}`);
      return false;
    }
  },
};

window.Exporter = Exporter;
