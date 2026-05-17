// routes/auth.js
// Rotas de autenticacao: registro, login, logout, dados do usuario logado.
// Senhas com bcrypt, sessoes com JWT no cookie httpOnly.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const { getDB } = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { encrypt, hashToken, generateId, sanitizeInput } = require('../middleware/encryption');
const config = require('../config/config');

const router = express.Router();

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, displayName, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos os campos sao obrigatorios' });
    }

    const sanitizedUsername = sanitizeInput(username).toLowerCase();
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedDisplayName = sanitizeInput(displayName || username);

    // Validacoes
    if (!validator.isAlphanumeric(sanitizedUsername) || sanitizedUsername.length < 3 || sanitizedUsername.length > 20) {
      return res.status(400).json({ error: 'Username deve ter 3-20 caracteres alfanumericos' });
    }
    if (!validator.isEmail(sanitizedEmail)) {
      return res.status(400).json({ error: 'Email invalido' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Senha deve ter no minimo 8 caracteres' });
    }

    const db = getDB();

    // Checa se ja existe
    const existingUser = db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [sanitizedUsername, sanitizedEmail]
    );
    if (existingUser) {
      return res.status(409).json({ error: 'Username ou email ja cadastrado' });
    }

    const userId = generateId();
    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
    const matrixUserId = `@${sanitizedUsername}:${config.matrix.serverName}`;

    // Cria usuario, settings, e entra nos canais padrao
    const transaction = db.transaction(() => {
      db.run(
        `INSERT INTO users (id, username, display_name, email, password_hash, matrix_user_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, sanitizedUsername, sanitizedDisplayName, sanitizedEmail, passwordHash, matrixUserId]
      );

      db.run(
        `INSERT INTO user_settings (id, user_id) VALUES (?, ?)`,
        [generateId(), userId]
      );

      // Entra em todos os canais do servidor padrao
      const defaultChannels = db.all("SELECT id FROM channels WHERE server_id = 'default'");
      for (const ch of defaultChannels) {
        db.run(
          'INSERT INTO channel_members (id, channel_id, user_id, role) VALUES (?, ?, ?, ?)',
          [generateId(), ch.id, userId, 'member']
        );
      }
    });
    transaction();

    // Cria token e sessao
    const token = jwt.sign({ userId }, config.security.jwtSecret, { expiresIn: config.security.jwtExpiry });
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.run(
      'INSERT INTO sessions (id, user_id, token_hash, device_info, expires_at) VALUES (?, ?, ?, ?, ?)',
      [generateId(), userId, tokenHash, req.headers['user-agent'] || 'unknown', expiresAt]
    );

    // Cookie httpOnly: JS do cliente nao consegue ler (protege contra XSS)
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.server.env === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: 'Registro realizado',
      user: {
        id: userId,
        username: sanitizedUsername,
        displayName: sanitizedDisplayName,
        email: sanitizedEmail,
        matrixUserId,
      },
      token,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e senha sao obrigatorios' });
    }

    const db = getDB();
    const user = db.get(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (!user) {
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais invalidas' });
    }

    // Cria sessao nova
    const token = jwt.sign({ userId: user.id }, config.security.jwtSecret, { expiresIn: config.security.jwtExpiry });
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.run(
      'INSERT INTO sessions (id, user_id, token_hash, device_info, ip_address, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [generateId(), user.id, tokenHash, req.headers['user-agent'] || 'unknown', req.ip, expiresAt]
    );

    // Marca como online
    db.run('UPDATE users SET is_online = 1, last_seen = datetime("now") WHERE id = ?', [user.id]);

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.server.env === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login realizado',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        avatarUrl: user.avatar_url,
        status: user.status,
        matrixUserId: user.matrix_user_id,
      },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  try {
    const db = getDB();
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    const tokenHash = hashToken(token);

    // Remove a sessao e marca offline
    db.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    db.run('UPDATE users SET is_online = 0, status = "offline", last_seen = datetime("now") WHERE id = ?', [req.userId]);

    res.clearCookie('token');
    res.json({ message: 'Logout realizado' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/me - retorna dados do usuario logado + settings
router.get('/me', authenticate, (req, res) => {
  try {
    const db = getDB();
    const user = db.get(
      'SELECT id, username, display_name, email, avatar_url, status, status_message, matrix_user_id, created_at FROM users WHERE id = ?',
      [req.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    const settings = db.get('SELECT * FROM user_settings WHERE user_id = ?', [req.userId]);

    res.json({ user, settings });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
