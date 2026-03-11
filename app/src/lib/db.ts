import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'personal-agent.db');

// Use globalThis to persist db connection across Next.js hot-reloads
const globalForDb = globalThis as unknown as { __db?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__db) return globalForDb.__db;

  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  migrate(db);

  globalForDb.__db = db;
  return db;
}

function migrate(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT name FROM migrations').all() as { name: string }[])
      .map((row) => row.name)
  );

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      db.transaction(() => {
        db.exec(migration.sql);
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
      })();
      console.log(`Applied migration: ${migration.name}`);
    }
  }
}

// === Migrations ===

const migrations = [
  {
    name: '001_create_cards',
    sql: `
      CREATE TABLE cards (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL CHECK(source IN ('note', 'reference', 'email', 'teams', 'document')),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        url TEXT,
        people TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Full-text search index
      CREATE VIRTUAL TABLE cards_fts USING fts5(
        title,
        content,
        content='cards',
        content_rowid='rowid'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER cards_ai AFTER INSERT ON cards BEGIN
        INSERT INTO cards_fts(rowid, title, content)
        VALUES (new.rowid, new.title, new.content);
      END;

      CREATE TRIGGER cards_ad AFTER DELETE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts, rowid, title, content)
        VALUES ('delete', old.rowid, old.title, old.content);
      END;

      CREATE TRIGGER cards_au AFTER UPDATE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts, rowid, title, content)
        VALUES ('delete', old.rowid, old.title, old.content);
        INSERT INTO cards_fts(rowid, title, content)
        VALUES (new.rowid, new.title, new.content);
      END;

      -- Indexes for common queries
      CREATE INDEX idx_cards_source ON cards(source);
      CREATE INDEX idx_cards_created_at ON cards(created_at DESC);
    `,
  },
  {
    name: '002_create_embeddings',
    sql: `
      CREATE TABLE card_embeddings (
        card_id TEXT PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    name: '003_create_account_tokens',
    sql: `
      -- Store OAuth tokens per account (encrypted at rest via env secret)
      CREATE TABLE account_tokens (
        account_id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TEXT NOT NULL,
        scopes TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Track polling watermarks so we only fetch new items
      CREATE TABLE poll_watermarks (
        account_id TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK(source_type IN ('email', 'teams')),
        last_polled_at TEXT NOT NULL DEFAULT (datetime('now')),
        delta_link TEXT,
        PRIMARY KEY (account_id, source_type)
      );
    `,
  },
  {
    name: '004_create_outbox',
    sql: `
      CREATE TABLE outbox (
        id TEXT PRIMARY KEY,
        destination TEXT NOT NULL CHECK(destination IN ('clipboard', 'email', 'teams')),
        subject TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL,
        recipients TEXT NOT NULL DEFAULT '[]',
        related_cards TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'approved', 'sent')),
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_outbox_status ON outbox(status);
      CREATE INDEX idx_outbox_created_at ON outbox(created_at DESC);
    `,
  },
  {
    name: '005_create_pending_auth',
    sql: `
      CREATE TABLE pending_auth (
        state TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        verifier TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
];
