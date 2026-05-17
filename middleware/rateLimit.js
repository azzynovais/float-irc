// middleware/rateLimit.js
// Limita quantas requisicoes um IP pode fazer num intervalo de tempo.
// Protege contra brute force e spam.

const rateLimit = require('express-rate-limit');
const config = require('../config/config');

// Rate limit geral pra todas as rotas /api/
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { error: 'Muitas requisicoes. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit mais restrito pra login/registro (previne brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit pra envio de mensagens (previne spam)
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas mensagens. Aguarde um momento.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, authLimiter, messageLimiter };
