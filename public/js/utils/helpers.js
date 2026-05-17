// js/utils/helpers.js
// Funcoes utilitarias reutilizadas em varios lugares do cliente.

const Helpers = {
  // UUID v4 (fallback caso o navegador nao suporte crypto.randomUUID)
  uuid() {
    return crypto.randomUUID ? crypto.randomUUID() :
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
  },

  // Formata data/hora pra exibicao (relativo pra recentes, absoluto pra antigas)
  formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m atras`;
    if (diff < 86400000) return `Hoje as ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    if (diff < 172800000) return `Ontem as ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
      ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },

  // So a hora (HH:MM)
  formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },

  // Iniciais do nome (pra avatares sem foto)
  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  },

  // Escapa HTML (previne XSS)
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Parser de markdown basico dentro das mensagens
  parseMessage(text) {
    let html = Helpers.escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');     // bold
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');                  // italic
    html = html.replace(/`(.+?)`/g, '<code>$1</code>');                // inline code
    html = html.replace(/```([\s\S]+?)```/g, '<pre><code>$1</code></pre>'); // code block
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');                // strikethrough
    html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'); // links
    html = html.replace(/@(\w+)/g, '<span class="mention">@$1</span>'); // mentions
    return html;
  },

  // Debounce: so executa depois de parar de chamar por X ms
  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  // Throttle: executa no maximo uma vez a cada X ms
  throttle(fn, limit) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // Checa se duas datas sao o mesmo dia
  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  },

  // Scroll pro fim do elemento
  scrollToBottom(el, smooth = true) {
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  },

  // Checa se o scroll esta perto do fim (pra auto-scroll em mensagens novas)
  isAtBottom(el, threshold = 50) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  },
};
