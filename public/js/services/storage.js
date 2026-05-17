// js/services/storage.js
// Wrapper do localStorage com prefixo pra nao conflitar com outros apps.
// Tudo salva como JSON automaticamente.

const Storage = {
  _prefix: 'float_',

  _key(key) { return this._prefix + key; },

  set(key, value) {
    try {
      localStorage.setItem(this._key(key), JSON.stringify(value));
      return true;
    } catch (err) {
      console.error('Storage set error:', err);
      return false;
    }
  },

  get(key, defaultValue = null) {
    try {
      const data = localStorage.getItem(this._key(key));
      if (data === null) return defaultValue;
      return JSON.parse(data);
    } catch (err) {
      return defaultValue;
    }
  },

  remove(key) {
    try { localStorage.removeItem(this._key(key)); return true; }
    catch { return false; }
  },

  // Limpa so as chaves do Float (nao mexe em outros apps)
  clear() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(this._prefix))
        .forEach((k) => localStorage.removeItem(k));
      return true;
    } catch { return false; }
  },

  // Atalhos pros dados mais usados
  setToken(token) { return this.set('auth_token', token); },
  getToken() { return this.get('auth_token', null); },
  removeToken() { return this.remove('auth_token'); },
  setUserData(data) { return this.set('user_data', data); },
  getUserData() { return this.get('user_data', null); },
  setSettings(settings) { return this.set('settings', settings); },
  getSettings() {
    return this.get('settings', {
      theme: 'dark',
      messageDisplay: 'cozy',
      notificationSound: true,
      desktopNotifications: true,
    });
  },
  setLastChannel(channelId) { return this.set('last_channel', channelId); },
  getLastChannel() { return this.get('last_channel', null); },
};
