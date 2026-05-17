// js/utils/sanitize.js
// Sanitizacao de input no lado do cliente.
// O server tambem sanitiza, mas fazermos aqui pra UX (feedback imediato).

const Sanitize = {
  // Escapa tudo (pra exibir texto do usuario com seguranca)
  html(input) {
    if (typeof input !== 'string') return '';
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  // Username: so alfanumerico e underscore
  username(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().substring(0, 20);
  },

  // Nome de canal: alfanumerico, traco e underscore
  channelName(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase().substring(0, 30);
  },

  // Email
  email(input) {
    if (typeof input !== 'string') return '';
    return input.trim().toLowerCase().substring(0, 254);
  },

  // URL: so permite http/https
  url(input) {
    if (typeof input !== 'string') return '';
    try {
      const url = new URL(input);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return url.href;
    } catch { return ''; }
  },

  // Texto simples (nomes, etc): remove chars perigosos
  text(input, maxLength = 100) {
    if (typeof input !== 'string') return '';
    return input.replace(/[<>'"&]/g, '').trim().substring(0, maxLength);
  },

  // Mensagem: remove bytes de controle, mantem newlines
  message(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').substring(0, 4000);
  },
};
