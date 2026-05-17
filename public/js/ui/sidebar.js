// js/ui/sidebar.js
// Gerencia a barra de servidores, lista de canais, amigos e painel do usuario.

const Sidebar = {
  _channels: [],
  _friends: [],
  _activeChannel: null,

  init() {
    this._bindEvents();
    this.loadChannels();
    this.loadFriends();
  },

  _bindEvents() {
    // Clique nos icones de servidor
    document.querySelectorAll('.server-icon[data-view]').forEach((el) => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.server-icon').forEach((s) => s.classList.remove('active'));
        el.classList.add('active');
      });
    });

    // Botao de adicionar servidor
    document.querySelector('.add-server')?.addEventListener('click', () => {
      Notification.info('Em breve: servidores personalizados');
    });

    // Busca de canais
    const searchInput = document.getElementById('channel-search');
    if (searchInput) {
      searchInput.addEventListener('input', Helpers.debounce((e) => {
        this._filterChannels(e.target.value);
      }, 200));
    }

    // Botao de configuracoes
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      Modal.open('modal-settings');
    });
  },

  async loadChannels() {
    try {
      const data = await API.channels.list();
      this._channels = data.channels || [];
      this._renderChannels();

      // Seleciona o ultimo canal visitado ou o primeiro disponivel
      const lastChannel = Storage.getLastChannel();
      if (lastChannel && this._channels.find((c) => c.id === lastChannel)) {
        this.selectChannel(lastChannel);
      } else if (this._channels[0]) {
        this.selectChannel(this._channels[0].id);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  },

  _renderChannels() {
    const textContainer = document.getElementById('text-channels');
    const voiceContainer = document.getElementById('voice-channels');
    if (!textContainer || !voiceContainer) return;

    const textChannels = this._channels.filter((c) => c.type === 'text');
    const voiceChannels = this._channels.filter((c) => c.type === 'voice');

    textContainer.innerHTML = textChannels.map((ch) => this._channelHTML(ch)).join('') +
      '<button class="add-channel-btn" onclick="Modal.open(\'modal-createchannel\')"><span>+</span> Criar Canal</button>';

    voiceContainer.innerHTML = voiceChannels.map((ch) => this._channelHTML(ch)).join('');

    // Bind clicks
    document.querySelectorAll('.channel-item').forEach((el) => {
      el.addEventListener('click', () => this.selectChannel(el.dataset.channelId));
    });
  },

  _channelHTML(channel) {
    const isActive = this._activeChannel === channel.id ? 'active' : '';
    const hash = channel.type === 'voice' ? '🔊' : '#';
    return `
      <div class="channel-item ${isActive}" data-channel-id="${channel.id}">
        <span class="channel-hash">${hash}</span>
        <span class="channel-name">${Helpers.escapeHtml(channel.name)}</span>
      </div>
    `;
  },

  _filterChannels(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.channel-item').forEach((item) => {
      const name = item.querySelector('.channel-name')?.textContent.toLowerCase() || '';
      item.style.display = name.includes(q) ? '' : 'none';
    });
  },

  selectChannel(channelId) {
    this._activeChannel = channelId;
    Storage.setLastChannel(channelId);

    // Marca como ativo na lista
    document.querySelectorAll('.channel-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.channelId === channelId);
    });

    // Atualiza header e input
    const channel = this._channels.find((c) => c.id === channelId);
    if (channel) {
      const nameEl = document.getElementById('current-channel-name');
      const topicEl = document.getElementById('current-channel-topic');
      const welcomeCh = document.getElementById('welcome-channel');
      const inputEl = document.getElementById('message-input');

      if (nameEl) nameEl.textContent = channel.name;
      if (topicEl) topicEl.textContent = channel.topic || '';
      if (welcomeCh) welcomeCh.textContent = channel.name;
      if (inputEl) inputEl.placeholder = `Enviar mensagem em #${channel.name}...`;
    }

    Chat.loadMessages(channelId);
    Members.load(channelId);

    // Entra no canal via WebSocket
    if (FloatApp.ws) {
      FloatApp.ws.send(JSON.stringify({ type: 'join_channel', channelId }));
    }
  },

  getActiveChannel() { return this._activeChannel; },

  async loadFriends() {
    try {
      const data = await API.friends.list();
      this._friends = data.friends || [];
      this._renderFriends(this._friends, data.pending || []);
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  },

  _renderFriends(friends, pending) {
    const list = document.getElementById('friend-list');
    const count = document.getElementById('friend-count');
    if (!list) return;
    if (count) count.textContent = friends.length;

    let html = '<button class="add-friend-btn" onclick="Modal.open(\'modal-addfriend\')">+ Adicionar Amigo</button>';

    // Solicitacoes pendentes
    if (pending.length > 0) {
      html += `<div style="padding:4px 8px; font-size:11px; color:var(--text-warning); font-weight:600;">PENDENTES - ${pending.length}</div>`;
      pending.forEach((f) => {
        html += `
          <div class="friend-item">
            <div class="friend-avatar">${Helpers.getInitials(f.displayName || f.username)}<span class="status-dot online"></span></div>
            <div class="friend-info">
              <div class="friend-name">${Helpers.escapeHtml(f.displayName || f.username)}</div>
              <div class="friend-status-msg">Solicitacao pendente</div>
            </div>
            <button class="panel-btn" onclick="Sidebar.acceptFriend('${f.friendshipId}')" title="Aceitar">ok</button>
          </div>
        `;
      });
    }

    // Amigos aceitos
    friends.forEach((f) => {
      const statusDot = f.isOnline ? 'online' : 'offline';
      html += `
        <div class="friend-item">
          <div class="friend-avatar">${Helpers.getInitials(f.displayName || f.username)}<span class="status-dot ${statusDot}"></span></div>
          <div class="friend-info">
            <div class="friend-name">${Helpers.escapeHtml(f.displayName || f.username)}</div>
            <div class="friend-status-msg">${Helpers.escapeHtml(f.statusMessage || (f.isOnline ? 'Online' : 'Offline'))}</div>
          </div>
        </div>
      `;
    });

    list.innerHTML = html;
  },

  async acceptFriend(friendshipId) {
    try {
      await API.friends.accept(friendshipId);
      Notification.success('Solicitacao aceita!');
      this.loadFriends();
    } catch { Notification.error('Erro ao aceitar'); }
  },

  updateUserPanel(user) {
    const avatarEl = document.getElementById('my-avatar');
    const nameEl = document.getElementById('my-username');
    const statusEl = document.getElementById('my-status-tag');

    if (avatarEl) avatarEl.textContent = Helpers.getInitials(user.displayName || user.username);
    if (nameEl) nameEl.textContent = user.displayName || user.username;
    if (statusEl) statusEl.textContent = user.status || 'online';
  },
};
