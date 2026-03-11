import { NextRequest, NextResponse } from 'next/server';
import { getCardById, updateCard } from '@/lib/cards';
import { suggestTags } from '@/lib/autotag';

// POST /api/cards/[id]/autotag — suggest and apply tags to a card
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const card = getCardById(id);
  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  const suggested = await suggestTags(card);
  if (suggested.length === 0) {
    return NextResponse.json({ tags: card.tags, suggested: [] });
  }

  // Merge with existing tags, deduplicating
  const existingSet = new Set(card.tags.map(t => t.toLowerCase()));
  const newTags = suggested.filter(t => !existingSet.has(t));
  const merged = [...card.tags, ...newTags];

  const updated = updateCard(id, { tags: merged });
  return NextResponse.json({ tags: updated?.tags ?? merged, suggested });
}
