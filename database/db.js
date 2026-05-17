// database/db.js
// Wrapper do better-sqlite3. Usa singleton pra evitar multiplas conexoes.
// Configura WAL mode e foreign keys por padrao.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

class FloatDB {
  constructor() {
    // Cria o diretorio do banco se nao existir
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.database.path);

    // Otimizacoes SQLite
    this.db.pragma('journal_mode = WAL');       // Write-Ahead Logging: mais rapido pra escrita concorrente
    this.db.pragma('foreign_keys = ON');         // FK constraints ativas
    this.db.pragma('synchronous = NORMAL');      // Balance entre seguranca e velocidade
    this.db.pragma('cache_size = -64000');       // 64MB de cache
    this.db.pragma('temp_store = MEMORY');       // Tabelas temporarias em RAM
  }

  prepare(sql) {
    return this.db.prepare(sql);
  }

  transaction(fn) {
    return this.db.transaction(fn);
  }

  // Executa uma unica statement (INSERT, UPDATE, DELETE)
  run(sql, params = []) {
    return this.db.prepare(sql).run(...params);
  }

  // Executa multiplas statements separadas por ; (CREATE TABLE, indexes, etc)
  exec(sql) {
    return this.db.exec(sql);
  }

  // Retorna uma linha
  get(sql, params = []) {
    return this.db.prepare(sql).get(...params);
  }

  // Retorna todas as linhas
  all(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  close() {
    this.db.close();
  }
}

// Singleton: so uma instancia do banco roda por processo
let instance = null;

function getDB() {
  if (!instance) {
    instance = new FloatDB();
  }
  return instance;
}

module.exports = { getDB, FloatDB };
