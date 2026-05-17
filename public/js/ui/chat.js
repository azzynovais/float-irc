// js/ui/chat.js
// Tudo que acontece na area de chat: mensagens, input, typing, contexto.

const Chat = {
  _messages: [],
  _channelId: null,
  _loading: false,
  _editingMessageId: null,
  _contextMessageId: null,
  _typingUsers: new Map(),

  init() {
    this._bindEvents();
    this._bindContextMenu();
  },

  _bindEvents() {
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('btn-send');

    if (input) {
      // Auto-resize do textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 200) + 'px';
      });

      // Enter envia, Shift+Enter quebra linha
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Typing indicator (throttled)
      input.addEventListener('input', Helpers.throttle(() => this._sendTyping(), 2000));
    }

    if (sendBtn) sendBtn.addEventListener('click', () => this.sendMessage());

    // Scroll pro topo carrega mensagens antigas
    const messagesArea = document.getElementById('messages-area');
    if (messagesArea) {
      messagesArea.addEventListener('scroll', Helpers.debounce(() => {
        if (messagesArea.scrollTop < 50) this._loadOlderMessages();
      }, 300));
    }
  },

  _bindContextMenu() {
    const messagesArea = document.getElementById('messages-area');
    const contextMenu = document.getElementById('context-menu');
    if (!messagesArea || !contextMenu) return;

    messagesArea.addEventListener('contextmenu', (e) => {
      const msgEl = e.target.closest('.message-item');
      if (!msgEl) return;
      e.preventDefault();
      this._contextMessageId = msgEl.dataset.messageId;
      contextMenu.style.display = 'block';
      contextMenu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
      contextMenu.style.top = Math.min(e.clientY, window.innerHeight - 250) + 'px';
    });

    document.addEventListener('click', () => { contextMenu.style.display = 'none'; });

    contextMenu.querySelectorAll('.context-item').forEach((item) => {
      item.addEventListener('click', () => {
        this._handleContextAction(item.dataset.action);
        contextMenu.style.display = 'none';
      });
    });
  },

  async _handleContextAction(action) {
    if (!this._contextMessageId) return;

    switch (action) {
      case 'reply':
        Notification.info('Threads em breve');
        break;
      case 'react':
        try {
          await API.messages.react(this._channelId, this._contextMessageId, '👍');
          Notification.success('Reacao adicionada');
        } catch { Notification.error('Erro ao reagir'); }
        break;
      case 'edit':
        this._startEdit(this._contextMessageId);
        break;
      case 'copy': {
        const msg = this._messages.find((m) => m.id === this._contextMessageId);
        if (msg) {
          try { await navigator.clipboard.writeText(msg.content); Notification.success('Copiado'); }
          catch { Notification.error('Falha ao copiar'); }
        }
        break;
      }
      case 'pin':
        Notification.info('Pinned messages em breve');
        break;
      case 'delete':
        Modal.confirm('Deletar Mensagem', 'Tem certeza?', async () => {
          try {
            await API.messages.delete(this._channelId, this._contextMessageId);
            this._removeMessage(this._contextMessageId);
            Notification.success('Deletada');
          } catch { Notification.error('Erro ao deletar'); }
        });
        break;
    }
  },

  async loadMessages(channelId) {
    this._channelId = channelId;
    this._messages = [];

    const listEl = document.getElementById('messages-list');
    if (listEl) listEl.innerHTML = '';

    document.getElementById('welcome-msg').style.display = 'block';
    this._showLoading(true);

    try {
      const data = await API.messages.list(channelId, null, MESSAGE_LOAD_LIMIT);
      this._messages = data.messages || [];
      this._renderMessages();
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      this._showLoading(false);
    }
  },

  _renderMessages() {
    const listEl = document.getElementById('messages-list');
    if (!listEl) return;

    let html = '';
    let lastAuthor = null;
    let lastDate = null;

    for (const msg of this._messages) {
      const msgDate = new Date(msg.createdAt);
      const msgDateStr = msgDate.toLocaleDateString('pt-BR');

      // Separador de data
      if (lastDate !== msgDateStr) {
        html += `<div class="date-separator"><span>${msgDateStr}</span></div>`;
        lastAuthor = null;
        lastDate = msgDateStr;
      }

      // Mensagens seguidas do mesmo autor ficam compactas
      const prevMsg = this._messages[this._messages.indexOf(msg) - 1];
      const isCompact = lastAuthor === msg.userId && prevMsg &&
        Math.abs(new Date(msg.createdAt) - new Date(prevMsg.createdAt)) < 300000;
      const isOwn = FloatApp.user && msg.userId === FloatApp.user.id;

      html += `
        <div class="message-group">
          <div class="message-item ${isCompact ? 'compact' : ''}" data-message-id="${msg.id}">
            <div class="message-avatar ${isCompact ? 'hidden' : ''}" title="${Helpers.escapeHtml(msg.displayName || msg.username)}">
              ${isCompact ? '' : Helpers.getInitials(msg.displayName || msg.username)}
            </div>
            <div class="message-content-wrapper">
              ${!isCompact ? `
                <div class="message-header">
                  <span class="message-author" style="color:${this._nameColor(msg.userId)}">${Helpers.escapeHtml(msg.displayName || msg.username)}</span>
                  <span class="message-timestamp">${Helpers.formatTime(msg.createdAt)}</span>
                  ${msg.isEdited ? '<span class="message-edited">(editado)</span>' : ''}
                  <span class="encryption-badge">&#128274;</span>
                </div>
              ` : ''}
              <div class="message-text">${Helpers.parseMessage(msg.content)}</div>
            </div>
          </div>
          <div class="message-actions">
            <button class="message-action-btn" title="Reagir">&#128512;</button>
            ${isOwn ? '<button class="message-action-btn" title="Editar">&#9998;</button>' : ''}
          </div>
        </div>
      `;

      lastAuthor = msg.userId;
    }

    listEl.innerHTML = html;
    const area = document.getElementById('messages-area');
    if (area) Helpers.scrollToBottom(area, false);
  },

  // Cor consistente pro nome de cada usuario (baseada no hash do ID)
  _nameColor(userId) {
    const colors = ['#5865F2','#57F287','#FEE75C','#EB459E','#ED4245','#F47B67','#E8A23E','#00D4AA','#00A8FC','#B5BBCA'];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  },

  async sendMessage() {
    const input = document.getElementById('message-input');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    // Comandos IRC
    if (content.startsWith('/')) {
      const cmd = MatrixClient.parseIRCCommand(content);
      if (cmd) {
        if (cmd.type === 'unknown') { Notification.warning(cmd.error); }
        else { this._handleIRCCommand(cmd); }
        input.value = '';
        input.style.height = 'auto';
        return;
      }
    }

    // Modo edicao
    if (this._editingMessageId) {
      try {
        await API.messages.edit(this._channelId, this._editingMessageId, content);
        this._editingMessageId = null;
        input.value = '';
        input.style.height = 'auto';
        this.loadMessages(this._channelId);
      } catch { Notification.error('Erro ao editar'); }
      return;
    }

    // Envio normal
    try {
      input.value = '';
      input.style.height = 'auto';
      await API.messages.send(this._channelId, content);
      // A mensagem chega via WebSocket
    } catch {
      Notification.error('Erro ao enviar');
      input.value = content;
    }
  },

  _startEdit(messageId) {
    const msg = this._messages.find((m) => m.id === messageId);
    if (!msg) return;

    const input = document.getElementById('message-input');
    if (!input) return;

    this._editingMessageId = messageId;
    input.value = msg.content;
    input.focus();
    input.style.height = 'auto';
    input.style.height = input.scrollHeight + 'px';

    // Esc cancela a edicao
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this._editingMessageId = null;
        input.value = '';
        input.style.height = 'auto';
        input.removeEventListener('keydown', escHandler);
      }
    };
    input.addEventListener('keydown', escHandler);
  },

  // Mensagem recebida via WebSocket
  addMessage(msg) {
    this._messages.push(msg);
    document.getElementById('welcome-msg').style.display = 'none';

    const listEl = document.getElementById('messages-list');
    const area = document.getElementById('messages-area');
    const wasAtBottom = area ? Helpers.isAtBottom(area) : true;

    const lastMsg = this._messages[this._messages.length - 2];
    const isCompact = lastMsg && lastMsg.userId === msg.userId &&
      Math.abs(new Date(msg.createdAt) - new Date(lastMsg.createdAt)) < 300000;

    listEl.insertAdjacentHTML('beforeend', `
      <div class="message-group">
        <div class="message-item ${isCompact ? 'compact' : ''}" data-message-id="${msg.id}">
          <div class="message-avatar ${isCompact ? 'hidden' : ''}">${isCompact ? '' : Helpers.getInitials(msg.displayName || msg.username)}</div>
          <div class="message-content-wrapper">
            ${!isCompact ? `
              <div class="message-header">
                <span class="message-author" style="color:${this._nameColor(msg.userId)}">${Helpers.escapeHtml(msg.displayName || msg.username)}</span>
                <span class="message-timestamp">${Helpers.formatTime(msg.createdAt)}</span>
                <span class="encryption-badge">&#128274;</span>
              </div>
            ` : ''}
            <div class="message-text">${Helpers.parseMessage(msg.content)}</div>
          </div>
        </div>
      </div>
    `);

    if (wasAtBottom && area) Helpers.scrollToBottom(area);

    // Som se nao for mensagem propria
    if (FloatApp.user && msg.userId !== FloatApp.user.id) Notification.playSound();
  },

  _removeMessage(messageId) {
    const el = document.querySelector(`.message-item[data-message-id="${messageId}"]`);
    if (el) {
      const group = el.closest('.message-group');
      if (group) { group.style.transition = 'opacity 0.3s'; group.style.opacity = '0'; setTimeout(() => group.remove(), 300); }
    }
    this._messages = this._messages.filter((m) => m.id !== messageId);
  },

  _sendTyping() {
    if (FloatApp.ws && this._channelId) {
      FloatApp.ws.send(JSON.stringify({ type: 'typing', channelId: this._channelId }));
    }
  },

  showTyping(username, displayName) {
    const indicator = document.getElementById('typing-indicator');
    const text = document.getElementById('typing-text');
    if (!indicator || !text) return;

    this._typingUsers.set(username, Date.now());
    const names = Array.from(this._typingUsers.keys());
    text.textContent = names.length === 1
      ? `${displayName} esta digitando...`
      : `${names.length} pessoas estao digitando...`;
    indicator.style.display = 'flex';

    // Auto-hide depois de 5s sem atualizar
    setTimeout(() => {
      const now = Date.now();
      for (const [user, time] of this._typingUsers) {
        if (now - time > 5000) this._typingUsers.delete(user);
      }
      if (this._typingUsers.size === 0) indicator.style.display = 'none';
    }, 5000);
  },

  // Executa comandos IRC vindos do input
  _handleIRCCommand(cmd) {
    switch (cmd.type) {
      case 'action':
        if (cmd.args.length > 0) API.messages.send(this._channelId, cmd.args.join(' '), 'action');
        break;
      case 'away':
        API.users.updateStatus('idle');
        Notification.info('Status: ausente');
        break;
      case 'help':
        MatrixClient.getMOTD().forEach((line) => this._addSystemMessage(line));
        break;
      case 'join':
        if (cmd.args[0]) {
          const ch = Sidebar._channels.find((c) => c.name === cmd.args[0].replace('#', ''));
          if (ch) Sidebar.selectChannel(ch.id);
          else Notification.warning(`Canal nao encontrado`);
        }
        break;
      case 'list': {
        let listText = 'Canais disponiveis:\n';
        Sidebar._channels.forEach((c) => { listText += `  #${c.name} - ${c.topic || 'Sem topico'}\n`; });
        this._addSystemMessage(listText);
        break;
      }
      case 'nick':
        if (cmd.args[0]) { API.users.updateProfile({ displayName: cmd.args.join(' ') }); Notification.success('Nome atualizado'); }
        break;
      case 'topic': {
        const ch = Sidebar._channels.find((c) => c.id === this._channelId);
        if (ch) this._addSystemMessage(`Topico de #${ch.name}: ${ch.topic || 'Nenhum'}`);
        break;
      }
      case 'whois':
        if (cmd.args[0]) {
          API.users.list(cmd.args[0], 1).then((data) => {
            const u = data.users[0];
            if (u) this._addSystemMessage(`[WHOIS] ${u.username} (${u.displayName}) - Status: ${u.status}`);
            else this._addSystemMessage(`[WHOIS] ${cmd.args[0]} nao encontrado`);
          });
        }
        break;
      case 'quit':
        FloatApp.logout();
        break;
    }
  },

  _addSystemMessage(text) {
    const listEl = document.getElementById('messages-list');
    if (!listEl) return;
    listEl.insertAdjacentHTML('beforeend', `
      <div class="message-system"><span class="system-icon">&#8226;</span><span>${Helpers.escapeHtml(text)}</span></div>
    `);
    const area = document.getElementById('messages-area');
    if (area) Helpers.scrollToBottom(area);
  },

  async _loadOlderMessages() {
    if (this._loading || !this._messages.length) return;
    this._loading = true;

    try {
      const data = await API.messages.list(this._channelId, this._messages[0].id, 30);
      const older = data.messages || [];
      if (older.length > 0) {
        this._messages = [...older, ...this._messages];
        this._renderMessages();
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      this._loading = false;
    }
  },

  _showLoading(show) {
    const listEl = document.getElementById('messages-list');
    if (!listEl) return;
    const existing = listEl.querySelector('.loading-messages');
    if (show && !existing) {
      listEl.insertAdjacentHTML('afterbegin', '<div class="loading-messages"><div class="spinner"></div><span>Carregando...</span></div>');
    } else if (!show && existing) {
      existing.remove();
    }
  },
};
