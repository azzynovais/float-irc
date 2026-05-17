// js/utils/constants.js
// Constantes usadas no cliente. Centralizar aqui facilita manutencao.

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
const API_BASE = '/api';

// Cores de status (online, ausente, nao perturbe, offline)
const STATUS_COLORS = {
  online: '#23A559',
  idle: '#F0B232',
  dnd: '#F23F43',
  offline: '#80848E',
  invisible: '#80848E',
};

const STATUS_LABELS = {
  online: 'Online',
  idle: 'Ausente',
  dnd: 'Nao Perturbe',
  offline: 'Offline',
  invisible: 'Invisivel',
};

const MESSAGE_TYPES = {
  MESSAGE: 'message',
  SYSTEM: 'system',
  ACTION: 'action',
  NOTICE: 'notice',
};

const THEMES = ['dark', 'light', 'midnight', 'amoled'];

const MAX_MESSAGE_LENGTH = 4000;
const TYPING_TIMEOUT = 5000;       // ms pra parar de mostrar "digitando"
const MESSAGE_LOAD_LIMIT = 50;     // mensagens por pagina
