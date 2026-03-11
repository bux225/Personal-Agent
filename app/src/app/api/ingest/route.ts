import { NextRequest, NextResponse } from 'next/server';
import { ingestDocument } from '@/lib/ingest';

// POST /api/ingest — ingest a document from a URL
export async function POST(request: NextRequest) {
  const body = await request.json() as { url?: string; title?: string };

  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  // Basic URL validation
  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are supported' }, { status: 400 });
  }

  const result = await ingestDocument(body.url, { title: body.title });

  return NextResponse.json({
    imported: result.cards.length,
    cards: result.cards,
    errors: result.errors,
  }, { status: result.cards.length > 0 ? 201 : 422 });
}
