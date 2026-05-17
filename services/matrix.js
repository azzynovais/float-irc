// services/matrix.js
// Wrapper do protocolo Matrix. Em producao, integraria com matrix-js-sdk.
// Por enquanto, funciona como bridge IRC e mantem a estrutura pra conectar
// num homeserver real depois.

const config = require('../config/config');
const { getDB } = require('../database/db');
const { generateId, encrypt, decrypt } = require('../middleware/encryption');

class MatrixService {
  constructor() {
    this.clients = new Map();
    this.homeserver = config.matrix.homeserver;
    this.serverName = config.matrix.serverName;
  }

  // Registra um usuario Float no Matrix
  async registerMatrixUser(userId, username, accessToken) {
    try {
      const matrixUserId = `@${username}:${this.serverName}`;
      const db = getDB();
      db.run(
        'UPDATE users SET matrix_user_id = ?, matrix_access_token = ? WHERE id = ?',
        [matrixUserId, encrypt(accessToken), userId]
      );
      return { matrixUserId, success: true };
    } catch (err) {
      console.error('Matrix register error:', err);
      return { success: false, error: err.message };
    }
  }

  // Cria uma sala Matrix pra um canal
  async createRoom(channelId, channelName, creatorUserId) {
    try {
      const roomId = `!${generateId().replace(/-/g, '')}:${this.serverName}`;
      const db = getDB();
      db.run('UPDATE channels SET matrix_room_id = ? WHERE id = ?', [roomId, channelId]);
      return { roomId, success: true };
    } catch (err) {
      console.error('Matrix create room error:', err);
      return { success: false, error: err.message };
    }
  }

  // Envia mensagem pra sala Matrix
  async sendMessage(matrixRoomId, content, matrixUserId) {
    try {
      const eventId = `$${generateId().replace(/-/g, '')}`;
      return { eventId, success: true };
    } catch (err) {
      console.error('Matrix send message error:', err);
      return { success: false, error: err.message };
    }
  }

  // Inicializa o client Matrix com credenciais salvas
  async initClient(userId) {
    try {
      const db = getDB();
      const user = db.get(
        'SELECT matrix_user_id, matrix_access_token, matrix_device_id FROM users WHERE id = ?',
        [userId]
      );
      if (!user || !user.matrix_access_token) {
        return { success: false, error: 'No Matrix credentials found' };
      }
      const accessToken = decrypt(user.matrix_access_token);
      return { success: true, matrixUserId: user.matrix_user_id };
    } catch (err) {
      console.error('Matrix init client error:', err);
      return { success: false, error: err.message };
    }
  }

  // Sync: puxa eventos novos do Matrix (em prod, usaria /sync do SDK)
  async syncState(userId) {
    try {
      return { success: true, events: [] };
    } catch (err) {
      console.error('Matrix sync error:', err);
      return { success: false, error: err.message };
    }
  }

  // Convida usuario pra sala (DM)
  async inviteToRoom(roomId, matrixUserId) {
    try {
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Lista contatos IRC (amigos) no formato IRC
  async getIRCContacts(userId) {
    try {
      const db = getDB();
      const friends = db.all(`
        SELECT u.id, u.username, u.display_name, u.status, u.is_online, u.matrix_user_id
        FROM friends f
        INNER JOIN users u ON f.friend_id = u.id
        WHERE f.user_id = ? AND f.status = 'accepted'
        ORDER BY u.is_online DESC, u.display_name
      `, [userId]);

      return {
        success: true,
        contacts: friends.map((f) => ({
          id: f.id,
          nick: f.username,
          displayName: f.display_name,
          status: f.status,
          online: !!f.is_online,
          matrixId: f.matrix_user_id,
        })),
      };
    } catch (err) {
      console.error('Get IRC contacts error:', err);
      return { success: false, error: err.message };
    }
  }
}

const matrixService = new MatrixService();
module.exports = matrixService;
