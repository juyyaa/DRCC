/**
 * DRCC — API Client
 * Wrapper fetch() dengan JWT attach otomatis, auto-refresh saat expired,
 * dan format error yang konsisten untuk ditampilkan via Toast.
 */
'use strict';

const ApiClient = {
  _refreshing: null,

  baseUrl() { return window.DRCC_CONFIG?.API_BASE_URL || 'http://localhost:4000/api'; },

  getAccessToken()  { return localStorage.getItem('drcc_access_token'); },
  getRefreshToken() { return localStorage.getItem('drcc_refresh_token'); },

  setTokens(accessToken, refreshToken) {
    if (accessToken)  localStorage.setItem('drcc_access_token', accessToken);
    if (refreshToken) localStorage.setItem('drcc_refresh_token', refreshToken);
  },

  clearTokens() {
    localStorage.removeItem('drcc_access_token');
    localStorage.removeItem('drcc_refresh_token');
    localStorage.removeItem('drcc_user');
    localStorage.removeItem('drcc_permissions');
  },

  setUser(user, permissions) {
    localStorage.setItem('drcc_user', JSON.stringify(user));
    localStorage.setItem('drcc_permissions', JSON.stringify(permissions));
  },

  getUser()        { try { return JSON.parse(localStorage.getItem('drcc_user'));        } catch { return null; } },
  getPermissions() { try { return JSON.parse(localStorage.getItem('drcc_permissions')); } catch { return null; } },

  /**
   * Core request method. Automatically attaches Bearer token,
   * retries once with refreshed token on 401 TOKEN_EXPIRED.
   */
  async request(method, path, body = null, opts = {}) {
    const url = this.baseUrl() + path;
    const doFetch = async (token) => fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let token = this.getAccessToken();
    let res = await doFetch(token);

    // Token expired → try refresh once, then retry original request
    if (res.status === 401 && !opts._isRetry) {
      const refreshed = await this._refreshAccessToken();
      if (refreshed) {
        return this.request(method, path, body, { ...opts, _isRetry: true });
      }
      // Refresh failed → force logout
      this.clearTokens();
      if (!opts.silentAuthFail) window.location.href = (window.getRootPath ? window.getRootPath() : '') + 'index.html';
      throw new Error('Sesi berakhir. Silakan login kembali.');
    }

    let data;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok) {
      const err = new Error(data.error || `Request gagal (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  async _refreshAccessToken() {
    if (this._refreshing) return this._refreshing;
    this._refreshing = (async () => {
      try {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) return false;
        const res = await fetch(this.baseUrl() + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        this.setTokens(data.accessToken, null);
        return true;
      } catch { return false; }
      finally { this._refreshing = null; }
    })();
    return this._refreshing;
  },

  get(path)          { return this.request('GET', path); },
  post(path, body)   { return this.request('POST', path, body); },
  put(path, body)    { return this.request('PUT', path, body); },
  delete(path)       { return this.request('DELETE', path); },
};

window.ApiClient = ApiClient;
