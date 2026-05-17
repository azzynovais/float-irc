// database/migrations/migrations.js
// Definicoes das migrations e funcoes pra rodar e popular o banco.
// Cada migration tem version, name, up (criar) e down (reverter).

const { getDB } = require('../db');

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- Tabela principal de usuarios
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT DEFAULT '',
        status TEXT DEFAULT 'offline',
        status_message TEXT DEFAULT '',
        matrix_user_id TEXT DEFAULT '',
        matrix_access_token TEXT DEFAULT '',
        matrix_device_id TEXT DEFAULT '',
        encryption_key_salt TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        last_seen TEXT DEFAULT (datetime('now')),
        is_online INTEGER DEFAULT 0
      );

      -- Canais (texto, voz, DM)
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        topic TEXT DEFAULT '',
        type TEXT DEFAULT 'text' CHECK(type IN ('text', 'voice', 'dm')),
        matrix_room_id TEXT DEFAULT '',
        server_id TEXT DEFAULT 'default',
        is_encrypted INTEGER DEFAULT 1,
        created_by TEXT DEFAULT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      -- Mensagens com campo criptografado separado
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        content_encrypted TEXT DEFAULT '',
        type TEXT DEFAULT 'message' CHECK(type IN ('message', 'system', 'action', 'notice')),
        matrix_event_id TEXT DEFAULT '',
        is_edited INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        edited_at TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- Sistema de amizade
      CREATE TABLE IF NOT EXISTS friends (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        friend_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'blocked')),
        matrix_room_id TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, friend_id)
      );

      -- Membros de cada canal
      CREATE TABLE IF NOT EXISTS channel_members (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'moderator', 'member')),
        joined_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(channel_id, user_id)
      );

      -- Servidores (tipo "guilds" do Discord)
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon_url TEXT DEFAULT '',
        owner_id TEXT NOT NULL,
        matrix_space_id TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (owner_id) REFERENCES users(id)
      );

      -- Membros de servidores
      CREATE TABLE IF NOT EXISTS server_members (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'moderator', 'member')),
        nickname TEXT DEFAULT '',
        joined_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(server_id, user_id)
      );

      -- Sessoes ativas (pra poder revogar)
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        device_info TEXT DEFAULT '',
        ip_address TEXT DEFAULT '',
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Reacoes nas mensagens
      CREATE TABLE IF NOT EXISTS reactions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(message_id, user_id, emoji)
      );

      -- Anexos (arquivos, imagens, etc)
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        mimetype TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        encryption_iv TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      );

      -- Indicadores de digitando (expiram automaticamente)
      CREATE TABLE IF NOT EXISTS typing_indicators (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(channel_id, user_id)
      );

      -- Indexes pra queries frequentes
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_channel_members_channel ON channel_members(channel_id);
      CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
      CREATE INDEX IF NOT EXISTS idx_server_members_server ON server_members(server_id);
      CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
      CREATE INDEX IF NOT EXISTS idx_typing_channel ON typing_indicators(channel_id);
    `,
    down: `
      DROP TABLE IF EXISTS typing_indicators;
      DROP TABLE IF EXISTS reactions;
      DROP TABLE IF EXISTS attachments;
      DROP TABLE IF EXISTS sessions;
      DROP TABLE IF EXISTS server_members;
      DROP TABLE IF EXISTS servers;
      DROP TABLE IF EXISTS channel_members;
      DROP TABLE IF EXISTS friends;
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS channels;
      DROP TABLE IF EXISTS users;
    `,
  },
  {
    version: 2,
    name: 'add_user_settings',
    up: `
      -- Preferencias do usuario (tema, idioma, notificacoes)
      CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        theme TEXT DEFAULT 'dark' CHECK(theme IN ('dark', 'light', 'midnight', 'amoled')),
        language TEXT DEFAULT 'pt-BR',
        notification_sound INTEGER DEFAULT 1,
        desktop_notifications INTEGER DEFAULT 1,
        message_display TEXT DEFAULT 'cozy' CHECK(message_display IN ('cozy', 'compact')),
        show_current_game INTEGER DEFAULT 1,
        inline_embed_media INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `,
    down: `DROP TABLE IF EXISTS user_settings;`,
  },
];

// Roda as migrations que ainda nao foram aplicadas
function runMigrations() {
  const db = getDB();

  // Tabela de controle de migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);

  const applied = db.all('SELECT version FROM _migrations');
  const appliedVersions = new Set(applied.map((m) => m.version));

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`Running migration v${migration.version}: ${migration.name}`);
      const transaction = db.transaction(() => {
        db.exec(migration.up);
        db.run('INSERT INTO _migrations (version, name) VALUES (?, ?)', [
          migration.version,
          migration.name,
        ]);
      });
      transaction();
      console.log(`Migration v${migration.version} applied`);
    }
  }

  console.log('All migrations done');
}

// Popula canais padrao na primeira vez
function seedData() {
  const db = getDB();

  const existingChannels = db.get("SELECT COUNT(*) as count FROM channels WHERE server_id = 'default'");
  if (existingChannels.count > 0) return;

  console.log('Seeding default channels...');

  const defaultChannels = [
    { id: 'ch-general', name: 'geral', topic: 'Canal geral para conversas', type: 'text' },
    { id: 'ch-random', name: 'aleatorio', topic: 'Qualquer coisa vai aqui', type: 'text' },
    { id: 'ch-help', name: 'ajuda', topic: 'Precisa de ajuda? Pergunte aqui', type: 'text' },
    { id: 'ch-dev', name: 'dev', topic: 'Desenvolvimento e codigo', type: 'text' },
    { id: 'ch-music', name: 'musica', topic: 'Compartilhe musicas', type: 'text' },
    { id: 'ch-lobby', name: 'lobby', topic: 'Vagas para jogos e salas', type: 'voice' },
  ];

  const insertChannel = db.prepare(`
    INSERT INTO channels (id, name, topic, type, server_id, is_encrypted)
    VALUES (?, ?, ?, ?, 'default', 1)
  `);

  const transaction = db.transaction(() => {
    for (const ch of defaultChannels) {
      insertChannel.run(ch.id, ch.name, ch.topic, ch.type);
    }
  });
  transaction();

  console.log('Default channels seeded');
}

module.exports = { runMigrations, seedData, migrations };
