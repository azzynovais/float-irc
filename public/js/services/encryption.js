// js/services/encryption.js
// Criptografia client-side usando Web Crypto API.
// Usado pra E2EE entre usuarios (gerar chaves, criptografar antes de enviar).

const Crypto = {
  // Gera uma chave AES-256-GCM
  async generateKey() {
    return await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
  },

  // Exporta chave pra base64 (pra salvar ou trocar)
  async exportKey(key) {
    const raw = await window.crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  },

  // Importa chave de base64
  async importKey(base64) {
    const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return await window.crypto.subtle.importKey(
      'raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
  },

  // Criptografa texto com AES-256-GCM
  async encrypt(text, key) {
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const data = encoder.encode(text);
    const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
    return {
      iv: btoa(String.fromCharCode(...iv)),
      data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    };
  },

  // Descriptografa
  async decrypt(encryptedObj, key) {
    const iv = Uint8Array.from(atob(encryptedObj.iv), (c) => c.charCodeAt(0));
    const data = Uint8Array.from(atob(encryptedObj.data), (c) => c.charCodeAt(0));
    const decrypted = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  },

  // Gera par de chaves ECDH (troca de chaves)
  async generateKeyPair() {
    return await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
    );
  },

  // Deriva segredo compartilhado (Diffie-Hellman)
  async deriveSharedSecret(privateKey, publicKey) {
    return await window.crypto.subtle.deriveBits(
      { name: 'ECDH', public: publicKey }, privateKey, 256
    );
  },

  // SHA-256
  async sha256(data) {
    const encoder = new TextEncoder();
    const hash = await window.crypto.subtle.digest('SHA-256', encoder.encode(data));
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  },

  // Fingerprint da chave (pra verificacao visual)
  async fingerprint(publicKey) {
    const exported = await window.crypto.subtle.exportKey('spki', publicKey);
    const hash = await window.crypto.subtle.digest('SHA-256', exported);
    const bytes = new Uint8Array(hash);
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex.match(/.{1,4}/g).join(' ').toUpperCase().substring(0, 47);
  },

  // String aleatoria criptograficamente segura
  randomString(length = 32) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  },
};
