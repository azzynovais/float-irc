// js/ui/members.js
// Lista de membros do canal (sidebar direita).

const Members = {
  _members: [],
  _visible: true,

  init() {
    document.getElementById('btn-members-toggle')?.addEventListener('click', () => this.toggle());
  },

  toggle() {
    this._visible = !this._visible;
    const sidebar = document.getElementById('members-sidebar');
    const btn = document.getElementById('btn-members-toggle');
    const app = document.getElementById('app');

    if (sidebar) sidebar.style.display = this._visible ? '' : 'none';
    if (btn) btn.classList.toggle('active', this._visible);
    if (app) app.style.gridTemplateColumns = this._visible ? '72px 240px 1fr 240px' : '72px 240px 1fr';
  },

  async load(channelId) {
    try {
      const data = await API.channels.get(channelId);
      this._members = data.members || [];
      this._render();
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  },

  _render() {
    const onlineContainer = document.getElementById('online-members');
    const offlineContainer = document.getElementById('offline-members');
    if (!onlineContainer || !offlineContainer) return;

    const online = this._members.filter((m) => m.isOnline);
    const offline = this._members.filter((m) => !m.isOnline);

    document.getElementById('member-count').textContent = this._members.length;
    document.getElementById('online-count').textContent = online.length;
    document.getElementById('offline-count').textContent = offline.length;

    onlineContainer.innerHTML = `<span class="member-category-label">ONLINE - ${online.length}</span>` +
      online.map((m) => this._memberHTML(m)).join('');

    offlineContainer.innerHTML = `<span class="member-category-label">OFFLINE - ${offline.length}</span>` +
      offline.map((m) => this._memberHTML(m, true)).join('');
  },

  _memberHTML(member, isOffline = false) {
    const statusDot = member.isOnline ? 'online' : 'offline';
    const roleClass = member.role || 'member';
    return `
      <div class="member-item ${isOffline ? 'offline' : ''}" data-user-id="${member.id}">
        <div class="member-avatar">
          ${Helpers.getInitials(member.displayName || member.username)}
          <span class="status-dot ${statusDot}"></span>
        </div>
        <div class="member-info">
          <div class="member-name">${Helpers.escapeHtml(member.displayName || member.username)}</div>
          ${member.role && member.role !== 'member' ? `<span class="member-role ${roleClass}">${member.role}</span>` : ''}
        </div>
      </div>
    `;
  },

  // Atualiza quando recebe mudanca de status via WS
  updatePresence(userId, status) {
    const member = this._members.find((m) => m.id === userId);
    if (member) {
      member.isOnline = status !== 'offline' && status !== 'invisible';
      member.status = status;
      this._render();
    }
  },
};
