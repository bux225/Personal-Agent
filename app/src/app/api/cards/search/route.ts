import { NextRequest, NextResponse } from 'next/server';
import { searchCards } from '@/lib/cards';

// GET /api/cards/search?q=query
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: 'q parameter is required' },
      { status: 400 },
    );
  }

  const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '20', 10);
  const cards = searchCards(query, limit);

  return NextResponse.json({ cards, query });
}
