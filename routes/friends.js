// routes/friends.js
// Sistema de amizade: solicitar, aceitar, remover e bloquear.
// Amizade e bidirecional: quando aceita, cria registros nos dois sentidos.

const express = require('express');
const { getDB } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { generateId } = require('../middleware/encryption');

const router = express.Router();

// GET /api/friends - lista amigos, pendentes e bloqueados
router.get('/', authenticate, (req, res) => {
  try {
    const db = getDB();

    // Amigos aceitos
    const friends = db.all(`
      SELECT f.id as friendship_id, f.status, f.created_at,
        u.id, u.username, u.display_name, u.avatar_url, u.status as user_status, u.is_online, u.status_message
      FROM friends f
      INNER JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ? AND f.status != 'blocked'
      ORDER BY u.is_online DESC, u.display_name
    `, [req.userId]);

    // Solicitacoes pendentes recebidas
    const pending = db.all(`
      SELECT f.id as friendship_id, f.created_at,
        u.id, u.username, u.display_name, u.avatar_url, u.status as user_status
      FROM friends f
      INNER JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [req.userId]);

    // Usuarios bloqueados
    const blocked = db.all(`
      SELECT f.id as friendship_id,
        u.id, u.username, u.display_name, u.avatar_url
      FROM friends f
      INNER JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ? AND f.status = 'blocked'
    `, [req.userId]);

    res.json({ friends, pending, blocked });
  } catch (err) {
    console.error('Get friends error:', err);
    res.status(500).json({ error: 'Erro ao buscar amigos' });
  }
});

// POST /api/friends/request - envia solicitacao de amizade
router.post('/request', authenticate, (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username necessario' });

    const db = getDB();
    const targetUser = db.get(
      'SELECT id, username, display_name FROM users WHERE username = ?',
      [username]
    );

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    if (targetUser.id === req.userId) {
      return res.status(400).json({ error: 'Voce nao pode adicionar a si mesmo' });
    }

    // Checa se ja existe alguma relacao
    const existing = db.get(
      'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [req.userId, targetUser.id, targetUser.id, req.userId]
    );

    if (existing) {
      if (existing.status === 'accepted') return res.status(409).json({ error: 'Voces ja sao amigos' });
      if (existing.status === 'pending') return res.status(409).json({ error: 'Solicitacao ja enviada' });
      if (existing.status === 'blocked') return res.status(403).json({ error: 'Nao e possivel enviar solicitacao' });
    }

    db.run(
      'INSERT INTO friends (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)',
      [generateId(), req.userId, targetUser.id, 'pending']
    );

    res.status(201).json({
      message: `Solicitacao enviada para ${targetUser.display_name}`,
      target: { id: targetUser.id, username: targetUser.username, displayName: targetUser.display_name },
    });
  } catch (err) {
    console.error('Friend request error:', err);
    res.status(500).json({ error: 'Erro ao enviar solicitacao' });
  }
});

// PUT /api/friends/:friendshipId/accept - aceita solicitacao
router.put('/:friendshipId/accept', authenticate, (req, res) => {
  try {
    const db = getDB();
    const friendship = db.get(
      'SELECT * FROM friends WHERE id = ? AND friend_id = ? AND status = ?',
      [req.params.friendshipId, req.userId, 'pending']
    );

    if (!friendship) {
      return res.status(404).json({ error: 'Solicitacao nao encontrada' });
    }

    // Aceita e cria a relacao reversa
    const transaction = db.transaction(() => {
      db.run('UPDATE friends SET status = ?, updated_at = datetime("now") WHERE id = ?', [
        'accepted',
        req.params.friendshipId,
      ]);

      const existing = db.get(
        'SELECT id FROM friends WHERE user_id = ? AND friend_id = ?',
        [req.userId, friendship.user_id]
      );
      if (!existing) {
        db.run('INSERT INTO friends (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)', [
          generateId(),
          req.userId,
          friendship.user_id,
          'accepted',
        ]);
      }
    });
    transaction();

    res.json({ message: 'Solicitacao aceita' });
  } catch (err) {
    console.error('Accept friend error:', err);
    res.status(500).json({ error: 'Erro ao aceitar solicitacao' });
  }
});

// DELETE /api/friends/:friendshipId - remove amigo
router.delete('/:friendshipId', authenticate, (req, res) => {
  try {
    const db = getDB();
    const friendship = db.get(
      'SELECT * FROM friends WHERE id = ? AND (user_id = ? OR friend_id = ?)',
      [req.params.friendshipId, req.userId, req.userId]
    );

    if (!friendship) {
      return res.status(404).json({ error: 'Amizade nao encontrada' });
    }

    // Remove ambos os lados
    const transaction = db.transaction(() => {
      db.run('DELETE FROM friends WHERE id = ?', [req.params.friendshipId]);
      db.run('DELETE FROM friends WHERE user_id = ? AND friend_id = ?', [
        friendship.friend_id,
        friendship.user_id,
      ]);
    });
    transaction();

    res.json({ message: 'Amigo removido' });
  } catch (err) {
    console.error('Remove friend error:', err);
    res.status(500).json({ error: 'Erro ao remover amigo' });
  }
});

// POST /api/friends/:userId/block - bloqueia usuario
router.post('/:userId/block', authenticate, (req, res) => {
  try {
    const db = getDB();

    if (req.params.userId === req.userId) {
      return res.status(400).json({ error: 'Voce nao pode bloquear a si mesmo' });
    }

    const existing = db.get(
      'SELECT * FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [req.userId, req.params.userId, req.params.userId, req.userId]
    );

    if (existing) {
      db.run('UPDATE friends SET status = ?, updated_at = datetime("now") WHERE id = ?', [
        'blocked',
        existing.id,
      ]);
    } else {
      db.run('INSERT INTO friends (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)', [
        generateId(),
        req.userId,
        req.params.userId,
        'blocked',
      ]);
    }

    res.json({ message: 'Usuario bloqueado' });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Erro ao bloquear usuario' });
  }
});

module.exports = router;
