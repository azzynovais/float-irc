// middleware/auth.js
// Autenticacao JWT + controle de sessao.
// authenticate: obriga login. optionalAuth: tenta autenticar mas nao bloqueia.
// requireRole: checa se o usuario tem o cargo necessario no canal.

const jwt = require('jsonwebtoken');
const { getDB } = require('../database/db');
const config = require('../config/config');

function authenticate(req, res, next) {
  // Pega o token do cookie ou do header Authorization
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticacao necessario' });
  }

  try {
    const decoded = jwt.verify(token, config.security.jwtSecret);
    const db = getDB();

    // Verifica se a sessao ainda e valida
    const session = db.get(
      'SELECT * FROM sessions WHERE user_id = ? AND expires_at > datetime("now")',
      [decoded.userId]
    );
    if (!session) {
      return res.status(401).json({ error: 'Sessao expirada' });
    }

    const user = db.get(
      'SELECT id, username, display_name, avatar_url, status, matrix_user_id FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (!user) {
      return res.status(401).json({ error: 'Usuario nao encontrado' });
    }

    req.user = user;
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(403).json({ error: 'Token invalido' });
  }
}

// Tenta autenticar, mas segue sem login se o token estiver ausente/invalido
function optionalAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    try {
      const decoded = jwt.verify(token, config.security.jwtSecret);
      const db = getDB();
      const user = db.get(
        'SELECT id, username, display_name, avatar_url, status FROM users WHERE id = ?',
        [decoded.userId]
      );
      if (user) {
        req.user = user;
        req.userId = decoded.userId;
      }
    } catch (err) {
      // segue sem auth
    }
  }
  next();
}

// Checa se o usuario tem um dos cargos especificados no canal
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticacao necessaria' });
    }

    const channelId = req.params.channelId || req.body.channelId;
    if (!channelId) {
      return res.status(400).json({ error: 'Channel ID necessario' });
    }

    const db = getDB();
    const member = db.get(
      'SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, req.userId]
    );

    if (!member || !roles.includes(member.role)) {
      return res.status(403).json({ error: 'Permissao insuficiente' });
    }
    next();
  };
}

module.exports = { authenticate, optionalAuth, requireRole };
