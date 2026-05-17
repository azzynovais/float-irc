// middleware/encryption.js
// Criptografia server-side: AES-256-GCM pra mensagens no banco,
// hash de tokens, geracao de IDs, sanitizacao de input.

const crypto = require('crypto');
const config = require('../config/config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Deriva a chave de criptografia a partir da config (32 bytes = 256 bits)
function getEncryptionKey() {
  const key = config.security.encryptionKey;
  return Buffer.from(key.padEnd(64, '0').slice(0, 64), 'hex');
}

// Criptografa texto com AES-256-GCM. Retorna "iv:tag:ciphertext" em hex
function encrypt(text) {
  if (!text) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

// Descriptografa texto no formato "iv:tag:ciphertext"
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  try {
    const key = getEncryptionKey();
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText; // nao esta criptografado

    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return '[Mensagem criptografada - falha na descriptografia]';
  }
}

// Hash SHA-256 pra tokens de sessao
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Token aleatorio pra sessoes e IDs
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateId() {
  return crypto.randomUUID();
}

// Escapa HTML pra evitar XSS (usado antes de salvar no banco)
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

module.exports = {
  encrypt,
  decrypt,
  hashToken,
  generateToken,
  generateId,
  sanitizeInput,
  ALGORITHM,
};
