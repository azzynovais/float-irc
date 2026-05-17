// config/config.js
// Centraliza todas as configs do app. Tudo vem do .env com fallbacks sensatos.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
  },

  security: {
    // JWT: em prod, troque o secret por algo bem longo e aleatorio
    jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_in_production',
    jwtExpiry: process.env.JWT_EXPIRY || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
    // Chave AES-256: precisa ser hex de 32 bytes (64 chars hex)
    encryptionKey: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef',
  },

  matrix: {
    // Homeserver Matrix pra federacao IRC
    homeserver: process.env.MATRIX_HOMESERVER || 'https://matrix.org',
    serverName: process.env.MATRIX_SERVER_NAME || 'matrix.org',
  },

  database: {
    path: process.env.DB_PATH || path.join(__dirname, '..', 'database', 'float.db'),
  },

  rateLimit: {
    // Janela de tempo (em minutos) e max de requests por janela
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) * 60 * 1000 || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  websocket: {
    // Intervalo do heartbeat pra detectar conexoes mortas (ms)
    heartbeat: parseInt(process.env.WS_HEARTBEAT, 10) || 30000,
  },
};
