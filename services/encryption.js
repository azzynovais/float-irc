// services/encryption.js
// Criptografia server-side avancada: key pairs ECDH, HMAC, PBKDF2.
// Usado pra derivar chaves compartilhadas entre usuarios (E2EE).

const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
  }

  // Gera par de chaves X25519 pra troca de chaves Diffie-Hellman
  generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });

    return {
      publicKey: publicKey.toString('base64'),
      privateKey: privateKey.toString('base64'),
    };
  }

  // Deriva segredo compartilhado com Diffie-Hellman
  deriveSharedSecret(privateKeyDer, publicKeyDer) {
    const privKey = crypto.createPrivateKey({
      key: Buffer.from(privateKeyDer, 'base64'),
      format: 'der',
      type: 'pkcs8',
    });

    const pubKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyDer, 'base64'),
      format: 'der',
      type: 'spki',
    });

    return crypto.diffieHellman({
      privateKey: privKey,
      publicKey: pubKey,
    });
  }

  // Criptografa com AES-256-GCM usando uma chave especifica
  encryptWithKey(data, key) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv, {
      authTagLength: this.tagLength,
    });

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag();
    return {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: encrypted,
    };
  }

  // Descriptografa com AES-256-GCM
  decryptWithKey(encryptedData, key) {
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const tag = Buffer.from(encryptedData.tag, 'base64');

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv, {
      authTagLength: this.tagLength,
    });
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedData.data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Hash de senha com PBKDF2 (100k iteracoes, SHA-512)
  hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  generateSalt() {
    return crypto.randomBytes(32).toString('hex');
  }

  // HMAC SHA-256 pra verificar integridade de mensagens
  createHMAC(data, key) {
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  verifyHMAC(data, key, signature) {
    const computed = this.createHMAC(data, key);
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  }
}

const encryptionService = new EncryptionService();
module.exports = encryptionService;
