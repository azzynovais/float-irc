// routes/users.js
// Perfil, status, configuracoes e busca de usuarios.

const express = require('express');
const { getDB } = require('../database/db');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { generateId, sanitizeInput } = require('../middleware/encryption');

const router = express.Router();

// GET /api/users - busca usuarios (pra adicionar amigos, etc)
router.get('/', authenticate, (req, res) => {
  try {
    const db = getDB();
    const search = req.query.search || '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    let users;
    if (search) {
      users = db.all(`
        SELECT id, username, display_name, avatar_url, status, status_message, is_online
        FROM users
        WHERE (username LIKE ? OR display_name LIKE ?) AND id != ?
        ORDER BY is_online DESC, display_name
        LIMIT ?
      `, [`%${search}%`, `%${search}%`, req.userId, limit]);
    } else {
      users = db.all(`
        SELECT id, username, display_name, avatar_url, status, status_message, is_online
        FROM users
        WHERE id != ?
        ORDER BY is_online DESC, display_name
        LIMIT ?
      `, [req.userId, limit]);
    }

    res.json({ users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Erro ao buscar usuarios' });
  }
});

// GET /api/users/:userId - perfil publico
router.get('/:userId', optionalAuth, (req, res) => {
  try {
    const db = getDB();
    const user = db.get(
      'SELECT id, username, display_name, avatar_url, status, status_message, is_online, created_at FROM users WHERE id = ?',
      [req.params.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Erro ao buscar usuario' });
  }
});

// PUT /api/users/profile - atualiza perfil
router.put('/profile', authenticate, (req, res) => {
  try {
    const { displayName, statusMessage, avatarUrl } = req.body;
    const db = getDB();

    const updates = [];
    const values = [];

    if (displayName !== undefined) {
      updates.push('display_name = ?');
      values.push(sanitizeInput(displayName));
    }
    if (statusMessage !== undefined) {
      updates.push('status_message = ?');
      values.push(sanitizeInput(statusMessage));
    }
    if (avatarUrl !== undefined) {
      updates.push('avatar_url = ?');
      values.push(avatarUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updates.push('updated_at = datetime("now")');
    values.push(req.userId);

    db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const updatedUser = db.get(
      'SELECT id, username, display_name, avatar_url, status, status_message FROM users WHERE id = ?',
      [req.userId]
    );

    res.json({ user: updatedUser, message: 'Perfil atualizado' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// PUT /api/users/status - muda status (online, idle, dnd, invisible)
router.put('/status', authenticate, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['online', 'idle', 'dnd', 'invisible', 'offline'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status invalido' });
    }

    const db = getDB();
    const isOnline = status === 'offline' || status === 'invisible' ? 0 : 1;

    db.run(
      'UPDATE users SET status = ?, is_online = ?, last_seen = datetime("now") WHERE id = ?',
      [status, isOnline, req.userId]
    );

    res.json({ status, message: 'Status atualizado' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// PUT /api/users/settings - preferencias do usuario
router.put('/settings', authenticate, (req, res) => {
  try {
    const { theme, language, notificationSound, desktopNotifications, messageDisplay } = req.body;
    const db = getDB();

    const updates = [];
    const values = [];

    if (theme !== undefined) { updates.push('theme = ?'); values.push(theme); }
    if (language !== undefined) { updates.push('language = ?'); values.push(language); }
    if (notificationSound !== undefined) { updates.push('notification_sound = ?'); values.push(notificationSound ? 1 : 0); }
    if (desktopNotifications !== undefined) { updates.push('desktop_notifications = ?'); values.push(desktopNotifications ? 1 : 0); }
    if (messageDisplay !== undefined) { updates.push('message_display = ?'); values.push(messageDisplay); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhuma configuracao para atualizar' });
    }

    values.push(req.userId);

    db.run(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`, values);

    const settings = db.get('SELECT * FROM user_settings WHERE user_id = ?', [req.userId]);
    res.json({ settings, message: 'Configuracoes atualizadas' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Erro ao atualizar configuracoes' });
  }
});

module.exports = router;
