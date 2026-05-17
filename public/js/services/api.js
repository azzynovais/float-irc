// js/services/api.js
// Cliente HTTP pra todas as chamadas ao backend.
// Adiciona o JWT automaticamente e trata erros 401 (sessao expirada).

const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const token = Storage.getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };

    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { ...options, headers };
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || 'Erro desconhecido');
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    } catch (err) {
      // Sessao expirada: manda pro login
      if (err.status === 401) {
        Storage.removeToken();
        Storage.remove('user_data');
        window.location.reload();
      }
      throw err;
    }
  },

  // Atalhos organizados por recurso
  auth: {
    login: (username, password) =>
      API.request('/auth/login', { method: 'POST', body: { username, password } }),
    register: (data) =>
      API.request('/auth/register', { method: 'POST', body: data }),
    logout: () =>
      API.request('/auth/logout', { method: 'POST' }),
    me: () =>
      API.request('/auth/me'),
  },

  channels: {
    list: () => API.request('/channels'),
    get: (id) => API.request(`/channels/${id}`),
    create: (data) => API.request('/channels', { method: 'POST', body: data }),
    join: (id) => API.request(`/channels/${id}/join`, { method: 'POST' }),
    leave: (id) => API.request(`/channels/${id}/leave`, { method: 'DELETE' }),
  },

  messages: {
    list: (channelId, before = null, limit = 50) => {
      let url = `/messages/${channelId}?limit=${limit}`;
      if (before) url += `&before=${before}`;
      return API.request(url);
    },
    send: (channelId, content, type = 'message') =>
      API.request(`/messages/${channelId}`, { method: 'POST', body: { content, type } }),
    edit: (channelId, messageId, content) =>
      API.request(`/messages/${channelId}/${messageId}`, { method: 'PUT', body: { content } }),
    delete: (channelId, messageId) =>
      API.request(`/messages/${channelId}/${messageId}`, { method: 'DELETE' }),
    react: (channelId, messageId, emoji) =>
      API.request(`/messages/${channelId}/${messageId}/react`, { method: 'POST', body: { emoji } }),
  },

  users: {
    list: (search = '', limit = 20) =>
      API.request(`/users?search=${encodeURIComponent(search)}&limit=${limit}`),
    get: (id) => API.request(`/users/${id}`),
    updateProfile: (data) => API.request('/users/profile', { method: 'PUT', body: data }),
    updateStatus: (status) => API.request('/users/status', { method: 'PUT', body: { status } }),
    updateSettings: (data) => API.request('/users/settings', { method: 'PUT', body: data }),
  },

  friends: {
    list: () => API.request('/friends'),
    add: (username) => API.request('/friends/request', { method: 'POST', body: { username } }),
    accept: (id) => API.request(`/friends/${id}/accept`, { method: 'PUT' }),
    remove: (id) => API.request(`/friends/${id}`, { method: 'DELETE' }),
    block: (id) => API.request(`/friends/${id}/block`, { method: 'POST' }),
  },
};
