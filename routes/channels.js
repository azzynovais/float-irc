// routes/channels.js
// CRUD de canais + entrar/sair. Canais podem ser texto, voz ou DM.

const express = require('express');
const { getDB } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { generateId, sanitizeInput } = require('../middleware/encryption');

const router = express.Router();

// GET /api/channels - lista canais do servidor e do usuario
router.get('/', authenticate, (req, res) => {
  try {
    const db = getDB();

    // Todos os canais publicos do servidor padrao
    const channels = db.all(`
      SELECT c.*,
        (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count,
        (SELECT COUNT(*) FROM messages WHERE channel_id = c.id AND is_deleted = 0) as message_count
      FROM channels c
      WHERE c.server_id = 'default'
      ORDER BY c.name
    `);

    // Canais que o usuario esta
    const userChannels = db.all(`
      SELECT c.* FROM channels c
      INNER JOIN channel_members cm ON c.id = cm.channel_id
      WHERE cm.user_id = ?
      ORDER BY c.name
    `, [req.userId]);

    res.json({ channels, userChannels });
  } catch (err) {
    console.error('Get channels error:', err);
    res.status(500).json({ error: 'Erro ao buscar canais' });
  }
});

// GET /api/channels/:channelId - detalhe do canal + membros
router.get('/:channelId', authenticate, (req, res) => {
  try {
    const db = getDB();
    const channel = db.get('SELECT * FROM channels WHERE id = ?', [req.params.channelId]);

    if (!channel) {
      return res.status(404).json({ error: 'Canal nao encontrado' });
    }

    const members = db.all(`
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, cm.role, cm.joined_at
      FROM channel_members cm
      INNER JOIN users u ON cm.user_id = u.id
      WHERE cm.channel_id = ?
      ORDER BY cm.role, u.display_name
    `, [req.params.channelId]);

    res.json({ channel, members });
  } catch (err) {
    console.error('Get channel error:', err);
    res.status(500).json({ error: 'Erro ao buscar canal' });
  }
});

// POST /api/channels - cria um canal novo
router.post('/', authenticate, (req, res) => {
  try {
    const { name, topic, type, serverId } = req.body;

    if (!name || name.length < 2 || name.length > 30) {
      return res.status(400).json({ error: 'Nome do canal deve ter entre 2 e 30 caracteres' });
    }

    const sanitizedName = sanitizeInput(name).toLowerCase().replace(/\s+/g, '-');
    const sanitizedTopic = sanitizeInput(topic || '');

    const db = getDB();
    const existing = db.get('SELECT id FROM channels WHERE name = ?', [sanitizedName]);
    if (existing) {
      return res.status(409).json({ error: 'Canal com este nome ja existe' });
    }

    const channelId = generateId();
    db.run(
      'INSERT INTO channels (id, name, topic, type, server_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [channelId, sanitizedName, sanitizedTopic, type || 'text', serverId || 'default', req.userId]
    );

    // Quem cria vira owner
    db.run(
      'INSERT INTO channel_members (id, channel_id, user_id, role) VALUES (?, ?, ?, ?)',
      [generateId(), channelId, req.userId, 'owner']
    );

    const channel = db.get('SELECT * FROM channels WHERE id = ?', [channelId]);
    res.status(201).json({ channel });
  } catch (err) {
    console.error('Create channel error:', err);
    res.status(500).json({ error: 'Erro ao criar canal' });
  }
});

// POST /api/channels/:channelId/join
router.post('/:channelId/join', authenticate, (req, res) => {
  try {
    const db = getDB();
    const channel = db.get('SELECT * FROM channels WHERE id = ?', [req.params.channelId]);

    if (!channel) {
      return res.status(404).json({ error: 'Canal nao encontrado' });
    }

    const existing = db.get(
      'SELECT id FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [req.params.channelId, req.userId]
    );
    if (existing) {
      return res.status(409).json({ error: 'Voce ja esta neste canal' });
    }

    db.run(
      'INSERT INTO channel_members (id, channel_id, user_id, role) VALUES (?, ?, ?, ?)',
      [generateId(), req.params.channelId, req.userId, 'member']
    );

    res.json({ message: 'Entrou no canal' });
  } catch (err) {
    console.error('Join channel error:', err);
    res.status(500).json({ error: 'Erro ao entrar no canal' });
  }
});

// DELETE /api/channels/:channelId/leave
router.delete('/:channelId/leave', authenticate, (req, res) => {
  try {
    const db = getDB();
    db.run(
      'DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [req.params.channelId, req.userId]
    );
    res.json({ message: 'Saiu do canal' });
  } catch (err) {
    console.error('Leave channel error:', err);
    res.status(500).json({ error: 'Erro ao sair do canal' });
  }
});

module.exports = router;
