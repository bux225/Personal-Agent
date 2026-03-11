import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// POST /api/dev/reset — clear all user data (cards, embeddings, outbox)
export async function POST() {
  const db = getDb();

  db.transaction(() => {
    db.exec('DELETE FROM outbox');
    db.exec('DELETE FROM embeddings');
    db.exec('DELETE FROM cards_fts');
    db.exec('DELETE FROM cards');
  })();

  return NextResponse.json({ status: 'ok', message: 'All data cleared' });
}
