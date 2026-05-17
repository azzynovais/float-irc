// services/websocket.js
// WebSocket server pra tempo real: mensagens, typing, presenca.
// Cada usuario autentica via JWT ao conectar, depois pode
// entrar em canais e trocar mensagens em tempo real.

const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { getDB } = require('../database/db');
const config = require('../config/config');

class FloatWS {
  constructor(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.clients = new Map();    // userId -> ws
    this.channels = new Map();   // channelId -> Set<userId>

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

    // Heartbeat: detecta conexoes mortas e limpa
    setInterval(() => this.cleanup(), config.websocket.heartbeat);

    console.log('WebSocket server initialized on /ws');
  }

  handleConnection(ws, req) {
    ws.isAlive = true;
    ws.userId = null;
    ws.channels = new Set();

    // Responde ao pong do cliente
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(ws, msg);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });

    // Quando desconecta, marca offline
    ws.on('close', () => {
      if (ws.userId) {
        this.clients.delete(ws.userId);
        this.broadcastPresence(ws.userId, 'offline');
      }
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Float WS connected' }));
  }

  handleMessage(ws, msg) {
    switch (msg.type) {
      case 'auth':
        this.handleAuth(ws, msg);
        break;
      case 'join_channel':
        this.handleJoinChannel(ws, msg);
        break;
      case 'leave_channel':
        this.handleLeaveChannel(ws, msg);
        break;
      case 'message':
        this.handleSendMessage(ws, msg);
        break;
      case 'typing':
        this.handleTyping(ws, msg);
        break;
      case 'presence':
        this.handlePresence(ws, msg);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', error: `Unknown type: ${msg.type}` }));
    }
  }

  // Autentica o WebSocket com o mesmo JWT do HTTP
  handleAuth(ws, msg) {
    try {
      const decoded = jwt.verify(msg.token, config.security.jwtSecret);
      ws.userId = decoded.userId;

      const db = getDB();
      const user = db.get(
        'SELECT id, username, display_name, avatar_url, status FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (!user) {
        ws.send(JSON.stringify({ type: 'auth_error', error: 'User not found' }));
        return;
      }

      this.clients.set(ws.userId, ws);
      ws.send(JSON.stringify({ type: 'auth_success', user }));

      // Auto-join nos canais que o usuario ja e membro
      const channels = db.all(
        'SELECT channel_id FROM channel_members WHERE user_id = ?',
        [ws.userId]
      );

      for (const ch of channels) {
        ws.channels.add(ch.channel_id);
        if (!this.channels.has(ch.channel_id)) {
          this.channels.set(ch.channel_id, new Set());
        }
        this.channels.get(ch.channel_id).add(ws.userId);
      }

      this.broadcastPresence(ws.userId, user.status || 'online');
    } catch (err) {
      ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
    }
  }

  handleJoinChannel(ws, msg) {
    if (!ws.userId) return ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));

    const { channelId } = msg;
    ws.channels.add(channelId);

    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Set());
    }
    this.channels.get(channelId).add(ws.userId);

    ws.send(JSON.stringify({ type: 'channel_joined', channelId }));
  }

  handleLeaveChannel(ws, msg) {
    if (!ws.userId) return;

    const { channelId } = msg;
    ws.channels.delete(channelId);

    const channelClients = this.channels.get(channelId);
    if (channelClients) channelClients.delete(ws.userId);

    ws.send(JSON.stringify({ type: 'channel_left', channelId }));
  }

  // Broadcast mensagem pra todos do canal
  handleSendMessage(ws, msg) {
    if (!ws.userId) return;

    const { channelId, message, messageId } = msg;
    const channelClients = this.channels.get(channelId);
    if (!channelClients) return;

    const db = getDB();
    const user = db.get(
      'SELECT id, username, display_name, avatar_url FROM users WHERE id = ?',
      [ws.userId]
    );

    const broadcastMsg = JSON.stringify({
      type: 'message',
      channelId,
      message: {
        id: messageId,
        channelId,
        userId: ws.userId,
        content: message,
        username: user?.username,
        displayName: user?.display_name,
        avatarUrl: user?.avatar_url,
        createdAt: new Date().toISOString(),
      },
    });

    for (const clientId of channelClients) {
      const client = this.clients.get(clientId);
      if (client && client.readyState === 1) {
        client.send(broadcastMsg);
      }
    }
  }

  // Avisa quem esta digitando (pra todos menos o proprio)
  handleTyping(ws, msg) {
    if (!ws.userId) return;

    const { channelId } = msg;
    const channelClients = this.channels.get(channelId);
    if (!channelClients) return;

    const db = getDB();
    const user = db.get(
      'SELECT username, display_name FROM users WHERE id = ?',
      [ws.userId]
    );

    const typingMsg = JSON.stringify({
      type: 'typing',
      channelId,
      userId: ws.userId,
      username: user?.username,
      displayName: user?.display_name,
    });

    for (const clientId of channelClients) {
      if (clientId !== ws.userId) {
        const client = this.clients.get(clientId);
        if (client && client.readyState === 1) {
          client.send(typingMsg);
        }
      }
    }
  }

  handlePresence(ws, msg) {
    if (!ws.userId) return;

    const db = getDB();
    db.run(
      'UPDATE users SET status = ?, is_online = 1, last_seen = datetime("now") WHERE id = ?',
      [msg.status || 'online', ws.userId]
    );

    this.broadcastPresence(ws.userId, msg.status || 'online');
  }

  // Avisa todos os clientes conectados sobre mudanca de status
  broadcastPresence(userId, status) {
    const msg = JSON.stringify({ type: 'presence', userId, status });
    for (const [clientId, client] of this.clients) {
      if (clientId !== userId && client.readyState === 1) {
        client.send(msg);
      }
    }
  }

  // Envia dados pra todos de um canal
  broadcastToChannel(channelId, data) {
    const channelClients = this.channels.get(channelId);
    if (!channelClients) return;

    const msg = JSON.stringify(data);
    for (const clientId of channelClients) {
      const client = this.clients.get(clientId);
      if (client && client.readyState === 1) {
        client.send(msg);
      }
    }
  }

  // Remove conexoes mortas (nao responderam ao ping)
  cleanup() {
    for (const [userId, ws] of this.clients) {
      if (!ws.isAlive) {
        this.clients.delete(userId);
        ws.terminate();
        this.broadcastPresence(userId, 'offline');
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }

  getOnlineCount(channelId) {
    const channelClients = this.channels.get(channelId);
    return channelClients ? channelClients.size : 0;
  }
}

module.exports = FloatWS;
