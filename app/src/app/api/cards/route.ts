import { NextRequest, NextResponse } from 'next/server';
import { createCard, listCards, countCards, updateCard } from '@/lib/cards';
import { embedCard } from '@/lib/rag';
import { suggestTags } from '@/lib/autotag';
import type { CreateCardInput } from '@/lib/types';

// GET /api/cards — list cards with optional filtering
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const source = searchParams.get('source') ?? undefined;
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const cards = listCards({ source, limit, offset });
  const total = countCards(source);

  return NextResponse.json({ cards, total, limit, offset });
}

// POST /api/cards — create a new card
export async function POST(request: NextRequest) {
  const body = await request.json() as CreateCardInput;

  // Validate required fields
  if (!body.source || !body.title || !body.content) {
    return NextResponse.json(
      { error: 'source, title, and content are required' },
      { status: 400 },
    );
  }

  const validSources = ['note', 'reference', 'email', 'teams', 'document'];
  if (!validSources.includes(body.source)) {
    return NextResponse.json(
      { error: `source must be one of: ${validSources.join(', ')}` },
      { status: 400 },
    );
  }

  const card = createCard(body);

  // Attempt embedding synchronously so we can report status
  let embeddingStatus: 'success' | 'failed' = 'success';
  try {
    await embedCard(card.id);
  } catch (err) {
    console.error('Embedding failed for card', card.id, err);
    embeddingStatus = 'failed';
  }

  // Auto-tag in background (don't block response)
  suggestTags(card).then(suggested => {
    if (suggested.length > 0) {
      const existingSet = new Set(card.tags.map(t => t.toLowerCase()));
      const newTags = suggested.filter(t => !existingSet.has(t));
      if (newTags.length > 0) {
        updateCard(card.id, { tags: [...card.tags, ...newTags] });
      }
    }
  }).catch(err => console.warn('Auto-tagging failed for card', card.id, err));

  return NextResponse.json({ ...card, embeddingStatus }, { status: 201 });
}
