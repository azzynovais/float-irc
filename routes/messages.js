// routes/messages.js
// Envio, edicao, exclusao e reacoes em mensagens.
// O conteudo e salvo criptografado no campo content_encrypted
// e em plaintext sanitizado no campo content (pra busca).

const express = require('express');
const { getDB } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { encrypt, decrypt, generateId, sanitizeInput } = require('../middleware/encryption');
const { messageLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// GET /api/messages/:channelId - historico de mensagens (paginado)
router.get('/:channelId', authenticate, (req, res) => {
  try {
    const db = getDB();

    // So pode ver mensagens se for membro do canal
    const member = db.get(
      'SELECT id FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [req.params.channelId, req.userId]
    );
    if (!member) {
      return res.status(403).json({ error: 'Voce nao tem acesso a este canal' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const before = req.query.before || null;

    let messages;
    if (before) {
      // Paginacao: carrega mensagens anteriores a uma data
      messages = db.all(`
        SELECT m.id, m.channel_id, m.user_id, m.type, m.is_edited, m.is_deleted, m.created_at, m.edited_at,
          u.username, u.display_name, u.avatar_url
        FROM messages m
        INNER JOIN users u ON m.user_id = u.id
        WHERE m.channel_id = ? AND m.id < ? AND m.is_deleted = 0
        ORDER BY m.created_at DESC
        LIMIT ?
      `, [req.params.channelId, before, limit]);
    } else {
      messages = db.all(`
        SELECT m.id, m.channel_id, m.user_id, m.type, m.is_edited, m.is_deleted, m.created_at, m.edited_at,
          u.username, u.display_name, u.avatar_url
        FROM messages m
        INNER JOIN users u ON m.user_id = u.id
        WHERE m.channel_id = ? AND m.is_deleted = 0
        ORDER BY m.created_at DESC
        LIMIT ?
      `, [req.params.channelId, limit]);
    }

    // Descriptografa o conteudo antes de mandar pro cliente
    const decryptedMessages = messages.map((msg) => {
      let content = msg.content;
      if (msg.content_encrypted) {
        content = decrypt(msg.content_encrypted);
      }
      return { ...msg, content };
    });

    res.json({ messages: decryptedMessages.reverse() });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

// POST /api/messages/:channelId - envia mensagem
router.post('/:channelId', messageLimiter, authenticate, (req, res) => {
  try {
    const { content, type } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Mensagem nao pode estar vazia' });
    }
    if (content.length > 4000) {
      return res.status(400).json({ error: 'Mensagem muito longa (max 4000 chars)' });
    }

    const db = getDB();

    const member = db.get(
      'SELECT id FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [req.params.channelId, req.userId]
    );
    if (!member) {
      return res.status(403).json({ error: 'Voce nao tem acesso a este canal' });
    }

    const messageId = generateId();
    const encryptedContent = encrypt(content);

    // Salva tanto o conteudo sanitizado (pra busca) quanto o criptografado (original)
    db.run(
      `INSERT INTO messages (id, channel_id, user_id, content, content_encrypted, type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [messageId, req.params.channelId, req.userId, sanitizeInput(content), encryptedContent, type || 'message']
    );

    const message = db.get(`
      SELECT m.id, m.channel_id, m.user_id, m.content, m.type, m.created_at,
        u.username, u.display_name, u.avatar_url
      FROM messages m
      INNER JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `, [messageId]);

    res.status(201).json({ message });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// PUT /api/messages/:channelId/:messageId - edita mensagem
router.put('/:channelId/:messageId', authenticate, (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Mensagem nao pode estar vazia' });
    }

    const db = getDB();
    const message = db.get(
      'SELECT * FROM messages WHERE id = ? AND user_id = ? AND is_deleted = 0',
      [req.params.messageId, req.userId]
    );

    if (!message) {
      return res.status(404).json({ error: 'Mensagem nao encontrada' });
    }

    const encryptedContent = encrypt(content);
    db.run(
      'UPDATE messages SET content = ?, content_encrypted = ?, is_edited = 1, edited_at = datetime("now") WHERE id = ?',
      [sanitizeInput(content), encryptedContent, req.params.messageId]
    );

    res.json({ message: 'Mensagem editada' });
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ error: 'Erro ao editar mensagem' });
  }
});

// DELETE /api/messages/:channelId/:messageId - soft delete
router.delete('/:channelId/:messageId', authenticate, (req, res) => {
  try {
    const db = getDB();
    const message = db.get(
      'SELECT * FROM messages WHERE id = ? AND user_id = ?',
      [req.params.messageId, req.userId]
    );

    if (!message) {
      return res.status(404).json({ error: 'Mensagem nao encontrada' });
    }

    // Soft delete: marca como deletada mas mantem no banco
    db.run(
      'UPDATE messages SET is_deleted = 1, content = "[Mensagem deletada]", content_encrypted = "" WHERE id = ?',
      [req.params.messageId]
    );

    res.json({ message: 'Mensagem deletada' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Erro ao deletar mensagem' });
  }
});

// POST /api/messages/:channelId/:messageId/react - toggle reacao
router.post('/:channelId/:messageId/react', authenticate, (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji necessario' });

    const db = getDB();

    // Se ja reagiu com esse emoji, remove; senao, adiciona (toggle)
    const existing = db.get(
      'SELECT id FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?',
      [req.params.messageId, req.userId, emoji]
    );

    if (existing) {
      db.run('DELETE FROM reactions WHERE id = ?', [existing.id]);
      res.json({ action: 'removed' });
    } else {
      db.run(
        'INSERT INTO reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)',
        [generateId(), req.params.messageId, req.userId, emoji]
      );
      res.json({ action: 'added' });
    }
  } catch (err) {
    console.error('React error:', err);
    res.status(500).json({ error: 'Erro ao reagir' });
  }
});

module.exports = router;
