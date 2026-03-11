import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db';
import type { Card, CreateCardInput, UpdateCardInput } from './types';

// === Row shape from SQLite ===
interface CardRow {
  id: string;
  source: string;
  title: string;
  content: string;
  url: string | null;
  people: string;
  tags: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

function safeParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    console.error('Failed to parse JSON from DB:', str);
    return fallback;
  }
}

function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    source: row.source as Card['source'],
    title: row.title,
    content: row.content,
    url: row.url ?? undefined,
    people: safeParse<string[]>(row.people, []),
    tags: safeParse<string[]>(row.tags, []),
    metadata: safeParse<Record<string, string>>(row.metadata, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// === CRUD Operations ===

export function createCard(input: CreateCardInput): Card {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO cards (id, source, title, content, url, people, tags, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.source,
    input.title,
    input.content,
    input.url ?? null,
    JSON.stringify(input.people ?? []),
    JSON.stringify(input.tags ?? []),
    JSON.stringify(input.metadata ?? {}),
    now,
    now,
  );

  return getCardById(id)!;
}

export function getCardById(id: string): Card | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined;
  return row ? rowToCard(row) : null;
}

export function listCards(options?: {
  source?: string;
  limit?: number;
  offset?: number;
}): Card[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.source) {
    conditions.push('source = ?');
    params.push(options.source);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const rows = db.prepare(`
    SELECT * FROM cards ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as CardRow[];

  return rows.map(rowToCard);
}

export function updateCard(id: string, input: UpdateCardInput): Card | null {
  const db = getDb();
  const existing = getCardById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) { fields.push('title = ?'); params.push(input.title); }
  if (input.content !== undefined) { fields.push('content = ?'); params.push(input.content); }
  if (input.url !== undefined) { fields.push('url = ?'); params.push(input.url); }
  if (input.people !== undefined) { fields.push('people = ?'); params.push(JSON.stringify(input.people)); }
  if (input.tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(input.tags)); }
  if (input.metadata !== undefined) { fields.push('metadata = ?'); params.push(JSON.stringify(input.metadata)); }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  return getCardById(id);
}

export function deleteCard(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM cards WHERE id = ?').run(id);
  return result.changes > 0;
}

export function searchCards(query: string, limit = 20): Card[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT cards.* FROM cards
    JOIN cards_fts ON cards.rowid = cards_fts.rowid
    WHERE cards_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as CardRow[];

  return rows.map(rowToCard);
}

export function countCards(source?: string): number {
  const db = getDb();
  if (source) {
    const row = db.prepare('SELECT COUNT(*) as count FROM cards WHERE source = ?').get(source) as { count: number };
    return row.count;
  }
  const row = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number };
  return row.count;
}
