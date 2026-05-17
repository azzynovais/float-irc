// js/app.js
// Arquivo principal: inicializa tudo, conecta WS, coordena os componentes.

const FloatApp = {
  user: null,
  ws: null,
  _initialized: false,

  async init() {
    if (this._initialized) return;

    // Tenta restaurar sessao existente
    const token = Storage.getToken();
    if (token) {
      try {
        const data = await API.auth.me();
        if (data.user) {
          this.user = data.user;
          this._showApp();
          return;
        }
      } catch {
        Storage.removeToken();
        Storage.remove('user_data');
      }
    }

    this._showLogin();
  },

  _showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    this._bindLoginEvents();
  },

  _showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'grid';

    // Inicializa todos os componentes
    this._applyTheme(Storage.getSettings().theme);
    Sidebar.init();
    Sidebar.updateUserPanel(this.user);
    Chat.init();
    Members.init();
    Modal.init();
    Notification.init();
    MatrixClient.init(this.user);

    this._connectWS();
    this._loadSettings();
    this._initialized = true;
  },

  _bindLoginEvents() {
    // Tabs login/registro
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => { b.classList.remove('active'); });
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
        document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
      });
    });

    // Login
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      if (!username || !password) { this._showLoginError('Preencha todos os campos'); return; }

      document.getElementById('login-status').textContent = 'Conectando...';
      try {
        const data = await API.auth.login(username, password);
        this.user = data.user;
        Storage.setToken(data.token);
        Storage.setUserData(data.user);
        this._showApp();
        Notification.success(`Bem-vindo, ${data.user.displayName || data.user.username}!`);
      } catch (err) {
        this._showLoginError(err.message || 'Erro ao fazer login');
        document.getElementById('login-status').textContent = 'Erro';
      }
    });

    // Registro
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('reg-username').value.trim();
      const displayName = document.getElementById('reg-displayname').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const password2 = document.getElementById('reg-password2').value;

      if (!username || !email || !password) { this._showLoginError('Preencha todos os campos'); return; }
      if (password !== password2) { this._showLoginError('As senhas nao coincidem'); return; }

      document.getElementById('login-status').textContent = 'Registrando...';
      try {
        const data = await API.auth.register({ username, displayName, email, password });
        this.user = data.user;
        Storage.setToken(data.token);
        Storage.setUserData(data.user);
        this._showApp();
        Notification.success('Conta criada! Bem-vindo ao Float!');
      } catch (err) {
        this._showLoginError(err.message || 'Erro ao registrar');
        document.getElementById('login-status').textContent = 'Erro';
      }
    });
  },

  _showLoginError(msg) {
    const el = document.getElementById('login-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 5000); }
  },

  // WebSocket: mensagens em tempo real, typing, presenca
  _connectWS() {
    const token = Storage.getToken();
    if (!token) return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ type: 'auth', token }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleWSMessage(data);
        } catch (err) { console.error('[WS] Parse error:', err); }
      };

      this.ws.onclose = () => {
        setTimeout(() => this._connectWS(), 3000);
      };

      this.ws.onerror = (err) => { console.error('[WS] Error:', err); };
    } catch (err) { console.error('[WS] Failed:', err); }
  },

  _handleWSMessage(data) {
    switch (data.type) {
      case 'message':
        if (data.channelId === Sidebar.getActiveChannel()) {
          Chat.addMessage(data.message);
        } else {
          Notification.desktop(`#${data.message.username}`, data.message.content);
        }
        break;
      case 'typing':
        if (data.channelId === Sidebar.getActiveChannel()) Chat.showTyping(data.username, data.displayName);
        break;
      case 'presence':
        Members.updatePresence(data.userId, data.status);
        Sidebar.loadFriends();
        break;
    }
  },

  // Carrega configs do usuario e popula o formulario de settings
  async _loadSettings() {
    try {
      const data = await API.auth.me();
      if (data.settings) {
        Storage.setSettings({
          theme: data.settings.theme || 'dark',
          messageDisplay: data.settings.messageDisplay || 'cozy',
          notificationSound: !!data.settings.notificationSound,
          desktopNotifications: !!data.settings.desktopNotifications,
        });
        this._applyTheme(data.settings.theme || 'dark');

        const dn = document.getElementById('setting-displayname');
        const sm = document.getElementById('setting-statusmsg');
        const hs = document.getElementById('setting-homeserver');
        const mi = document.getElementById('setting-matrixid');
        if (dn) dn.value = this.user.displayName || '';
        if (sm) sm.value = this.user.statusMessage || '';
        if (hs) hs.value = 'https://matrix.org';
        if (mi) mi.value = this.user.matrixUserId || '';
      }
    } catch {}

    this._bindSettingsEvents();
  },

  _bindSettingsEvents() {
    // Navegacao nas settings
    document.querySelectorAll('.settings-nav-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.settings-nav-item').forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.settings-section').forEach((s) => s.style.display = 'none');
        const target = document.getElementById(`section-${item.dataset.section}`);
        if (target) target.style.display = 'block';
      });
    });

    // Salvar perfil
    document.getElementById('save-profile')?.addEventListener('click', async () => {
      try {
        await API.users.updateProfile({
          displayName: document.getElementById('setting-displayname')?.value,
          statusMessage: document.getElementById('setting-statusmsg')?.value,
        });
        await API.users.updateStatus(document.getElementById('setting-status')?.value);
        if (this.user) {
          this.user.displayName = document.getElementById('setting-displayname')?.value;
        }
        Sidebar.updateUserPanel(this.user);
        Notification.success('Perfil atualizado');
      } catch { Notification.error('Erro ao salvar'); }
    });

    // Salvar aparencia
    document.getElementById('save-appearance')?.addEventListener('click', async () => {
      try {
        const theme = document.getElementById('setting-theme')?.value;
        await API.users.updateSettings({ theme, messageDisplay: document.getElementById('setting-msgdisplay')?.value });
        this._applyTheme(theme);
        Notification.success('Aparencia atualizada');
      } catch { Notification.error('Erro ao salvar'); }
    });

    // Salvar notificacoes
    document.getElementById('save-notifications')?.addEventListener('click', async () => {
      try {
        const sound = document.getElementById('setting-notifsound')?.checked;
        const desktop = document.getElementById('setting-desktopnotif')?.checked;
        await API.users.updateSettings({ notificationSound: sound, desktopNotifications: desktop });
        if (desktop) await Notification.requestDesktopPermission();
        Notification.success('Notificacoes atualizadas');
      } catch { Notification.error('Erro ao salvar'); }
    });

    // Logout de todos os dispositivos
    document.getElementById('logout-all')?.addEventListener('click', () => {
      Modal.confirm('Sair de Todos os Dispositivos', 'Todas as sessoes serao encerradas.', () => this.logout());
    });

    // Criar canal
    document.getElementById('create-channel-btn')?.addEventListener('click', async () => {
      const name = document.getElementById('newchannel-name')?.value.trim();
      const topic = document.getElementById('newchannel-topic')?.value.trim();
      const type = document.getElementById('newchannel-type')?.value;
      if (!name) { Notification.warning('Nome obrigatorio'); return; }

      try {
        await API.channels.create({ name, topic, type });
        Modal.close('modal-createchannel');
        Notification.success(`Canal #${name} criado!`);
        Sidebar.loadChannels();
        document.getElementById('newchannel-name').value = '';
        document.getElementById('newchannel-topic').value = '';
      } catch (err) { Notification.error(err.message || 'Erro ao criar canal'); }
    });

    // Adicionar amigo
    document.getElementById('send-friend-request')?.addEventListener('click', async () => {
      const username = document.getElementById('addfriend-username')?.value.trim();
      if (!username) return;

      try {
        await API.friends.add(username);
        const result = document.getElementById('friend-request-result');
        if (result) { result.style.display = 'block'; result.className = 'result-msg success'; result.textContent = `Solicitacao enviada para ${username}!`; }
        document.getElementById('addfriend-username').value = '';
        Sidebar.loadFriends();
        setTimeout(() => { if (result) result.style.display = 'none'; }, 3000);
      } catch (err) {
        const result = document.getElementById('friend-request-result');
        if (result) { result.style.display = 'block'; result.className = 'result-msg error'; result.textContent = err.message || 'Erro'; }
      }
    });

    // Botoes mudo/surdo
    document.getElementById('btn-mute')?.addEventListener('click', function () {
      this.classList.toggle('active');
      Notification.info(this.classList.contains('active') ? 'Microfone mutado' : 'Microfone ativado');
    });

    document.getElementById('btn-deafen')?.addEventListener('click', function () {
      this.classList.toggle('active');
      Notification.info(this.classList.contains('active') ? 'Audio desativado' : 'Audio ativado');
    });
  },

  _applyTheme(theme) {
    if (!THEMES.includes(theme)) theme = 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    const settings = Storage.getSettings();
    settings.theme = theme;
    Storage.setSettings(settings);
  },

  async logout() {
    try { await API.auth.logout(); } catch {}
    Storage.removeToken();
    Storage.remove('user_data');
    this.user = null;
    this._initialized = false;
    if (this.ws) { this.ws.close(); this.ws = null; }
    MatrixClient.disconnect();
    window.location.reload();
  },
};

// Bora
document.addEventListener('DOMContentLoaded', () => FloatApp.init());
