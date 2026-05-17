// js/matrix.js
// Client Matrix/IRC. Traduz entre o protocolo Matrix e comandos IRC.
// Em producao, integraria com matrix-js-sdk completo.

const MatrixClient = {
  _connected: false,
  _userId: null,
  _deviceId: null,
  _accessToken: null,

  init(userData) {
    this._userId = userData.matrixUserId || `@${userData.username}:matrix.org`;
    this._deviceId = userData.id || 'float-device';
    this._connected = true;
    console.log(`[Matrix] Initialized for ${this._userId}`);
    return true;
  },

  getUserId() { return this._userId; },
  isConnected() { return this._connected; },

  // Formata lista de membros no estilo IRC (nick, host, modes)
  formatIRCUsers(members) {
    return members.map((m) => ({
      nick: m.username,
      host: m.username + '@float.irc',
      realname: m.displayName || m.username,
      modes: m.role === 'owner' ? '~' : m.role === 'admin' ? '&' : m.role === 'moderator' ? '@' : '',
      online: m.isOnline || false,
    }));
  },

  // Formata mensagem como linha IRC
  formatIRCMessage(message) {
    const prefix = `:${message.username}!${message.username}@float.irc`;
    const target = `#${message.channelId || 'geral'}`;

    switch (message.type) {
      case 'action': return `${prefix} PRIVMSG ${target} :\x01ACTION ${message.content}\x01`;
      case 'notice': return `${prefix} NOTICE ${target} :${message.content}`;
      case 'system': return `:${message.content}`;
      default: return `${prefix} PRIVMSG ${target} :${message.content}`;
    }
  },

  // Interpreta comandos IRC digitados pelo usuario (/me, /join, etc)
  parseIRCCommand(input) {
    if (!input.startsWith('/')) return null;

    const parts = input.substring(1).split(' ');
    const command = parts[0].toUpperCase();
    const args = parts.slice(1);

    const commands = {
      ME:     { type: 'action', usage: '/me <acao>' },
      MSG:    { type: 'message', usage: '/msg <usuario> <mensagem>' },
      NOTICE: { type: 'notice', usage: '/notice <mensagem>' },
      JOIN:   { type: 'join', usage: '/join <canal>' },
      PART:   { type: 'part', usage: '/part [canal]' },
      QUIT:   { type: 'quit', usage: '/quit [mensagem]' },
      NICK:   { type: 'nick', usage: '/nick <novo_nick>' },
      WHOIS:  { type: 'whois', usage: '/whois <usuario>' },
      LIST:   { type: 'list', usage: '/list' },
      TOPIC:  { type: 'topic', usage: '/topic [novo_topico]' },
      NAMES:  { type: 'names', usage: '/names' },
      AWAY:   { type: 'away', usage: '/away [mensagem]' },
      HELP:   { type: 'help', usage: '/help' },
      KICK:   { type: 'kick', usage: '/kick <usuario>' },
      BAN:    { type: 'ban', usage: '/ban <usuario>' },
      OP:     { type: 'op', usage: '/op <usuario>' },
      INVITE: { type: 'invite', usage: '/invite <usuario>' },
    };

    const cmd = commands[command];
    if (!cmd) return { type: 'unknown', command, error: `Comando desconhecido: /${command}` };
    return { type: cmd.type, command, args, usage: cmd.usage };
  },

  // MOTD do servidor (mensagem do dia, estilo IRC)
  getMOTD() {
    return [
      '- Float IRC Gateway -',
      `- Bem-vindo ao Float, ${this._userId}`,
      '- Protocolo Matrix com criptografia E2EE ativa.',
      '-',
      '- Comandos IRC suportados:',
      '-  /me <acao>          - Enviar acao',
      '-  /msg <user> <msg>   - Mensagem privada',
      '-  /notice <msg>       - Enviar aviso',
      '-  /join <canal>       - Entrar em canal',
      '-  /part               - Sair do canal',
      '-  /nick <nome>        - Alterar apelido',
      '-  /whois <user>       - Info do usuario',
      '-  /list               - Listar canais',
      '-  /topic [topico]     - Ver/alterar topico',
      '-  /away [msg]         - Marcar ausente',
      '-  /help               - Ajuda',
      '-',
      '- Float v1.0 | Matrix | E2EE',
    ];
  },

  disconnect() {
    this._connected = false;
    this._userId = null;
    this._accessToken = null;
  },
};
