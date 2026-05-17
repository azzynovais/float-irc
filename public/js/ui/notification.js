// js/ui/notification.js
// Sistema de notificacoes: toasts no canto da tela + desktop + som.

const Notification = {
  _container: null,
  _desktopEnabled: false,

  init() {
    this._container = document.getElementById('toast-container');
    if ('Notification' in window && Notification.permission === 'granted') {
      this._desktopEnabled = true;
    }
  },

  async requestDesktopPermission() {
    if (!('Notification' in window)) return false;
    const result = await window.Notification.requestPermission();
    this._desktopEnabled = result === 'granted';
    return this._desktopEnabled;
  },

  // Toast: aquela caixinha que aparece no canto inferior direito
  toast(message, type = 'info', duration = 4000) {
    if (!this._container) this.init();

    const icons = { info: 'i', success: '+', error: '!', warning: '!', message: '#' };
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'i'}</span>
      <span class="toast-message">${Helpers.escapeHtml(message)}</span>
      <button class="toast-close">&times;</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => this._removeToast(toast));
    this._container.appendChild(toast);

    if (duration > 0) setTimeout(() => this._removeToast(toast), duration);
    return toast;
  },

  _removeToast(toast) {
    toast.classList.add('toast-out');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  },

  // Notificacao do sistema operacional
  desktop(title, body) {
    const settings = Storage.getSettings();
    if (!settings.desktopNotifications || !this._desktopEnabled) return;

    try {
      const notif = new window.Notification(title, { body, tag: 'float' });
      notif.onclick = () => { window.focus(); notif.close(); };
      setTimeout(() => notif.close(), 5000);
    } catch { /* navegador nao suporta */ }
  },

  // Beep simples usando Web Audio API
  playSound() {
    const settings = Storage.getSettings();
    if (!settings.notificationSound) return;

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.value = 0.1;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* audio nao disponivel */ }
  },

  // Atalhos
  info(msg, d) { return this.toast(msg, 'info', d); },
  success(msg, d) { return this.toast(msg, 'success', d); },
  error(msg, d) { return this.toast(msg, 'error', d); },
  warning(msg, d) { return this.toast(msg, 'warning', d); },
  message(msg, d) { return this.toast(msg, 'message', d); },
};
