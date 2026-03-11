import { NextRequest, NextResponse } from 'next/server';
import { embedCard } from '@/lib/rag';
import { countCards } from '@/lib/cards';
import { getDb } from '@/lib/db';

// POST /api/embed — embed one card or backfill all
export async function POST(request: NextRequest) {
  const body = await request.json() as { cardId?: string };

  try {
    if (body.cardId) {
      await embedCard(body.cardId);
      return NextResponse.json({ embedded: 1 });
    }

    // Backfill: embed all cards that don't have embeddings yet
    const db = getDb();
    const unembedded = db.prepare(`
      SELECT c.id FROM cards c
      LEFT JOIN card_embeddings ce ON c.id = ce.card_id
      WHERE ce.card_id IS NULL
    `).all() as Array<{ id: string }>;

    let count = 0;
    const failed: Array<{ cardId: string; error: string }> = [];
    for (const row of unembedded) {
      try {
        await embedCard(row.id);
        count++;
      } catch (err) {
        console.error(`Failed to embed ${row.id}:`, err);
        failed.push({ cardId: row.id, error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    return NextResponse.json({
      embedded: count,
      total: countCards(),
      failed: failed.length > 0 ? failed : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Embedding failed', details: message },
      { status: 500 },
    );
  }
}
