// js/ui/modal.js
// Sistema de modais: abrir, fechar, confirmar.
// Usa o estilo window do 7.css.

const Modal = {
  _overlayClass: 'modal-overlay',

  init() {
    // Fecha no botao X
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-close')) {
        this.close(e.target.closest(`.${this._overlayClass}`));
      }
    });

    // Fecha clicando no fundo escuro
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains(this._overlayClass)) this.close(e.target);
    });

    // Fecha com Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll(`.${this._overlayClass}`).forEach((m) => {
          if (m.style.display !== 'none') this.close(m);
        });
      }
    });
  },

  open(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Foca no primeiro input
    const firstInput = modal.querySelector('input:not([readonly]), textarea, select');
    if (firstInput) setTimeout(() => firstInput.focus(), 100);
  },

  close(modalOrId) {
    const modal = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  },

  closeAll() {
    document.querySelectorAll(`.${this._overlayClass}`).forEach((m) => { m.style.display = 'none'; });
    document.body.style.overflow = '';
  },

  // Dialogo de confirmacao (cria o modal na hora)
  confirm(title, message, onConfirm, onCancel) {
    const overlay = document.createElement('div');
    overlay.className = this._overlayClass;
    overlay.innerHTML = `
      <div class="modal-window window" style="width:400px;">
        <div class="title-bar">
          <div class="title-bar-text">${Helpers.escapeHtml(title)}</div>
          <div class="title-bar-controls"><button aria-label="Close" class="modal-close"></button></div>
        </div>
        <div class="window-body">
          <p>${Helpers.escapeHtml(message)}</p>
          <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
            <button class="btn-cancel" style="padding:8px 16px; background:var(--bg-modifier-hover); border:1px solid var(--border-severity); border-radius:4px; color:var(--text-normal); cursor:pointer;">Cancelar</button>
            <button class="btn-confirm btn-primary">Confirmar</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.btn-confirm').addEventListener('click', () => {
      this._removeCustom(overlay);
      if (onConfirm) onConfirm();
    });

    overlay.querySelector('.btn-cancel').addEventListener('click', () => {
      this._removeCustom(overlay);
      if (onCancel) onCancel();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this._removeCustom(overlay);
        if (onCancel) onCancel();
      }
    });
  },

  _removeCustom(overlay) {
    overlay.style.display = 'none';
    setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
  },
};
