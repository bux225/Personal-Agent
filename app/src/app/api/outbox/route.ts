import { NextRequest, NextResponse } from 'next/server';
import {
  createOutboxItem,
  listOutboxItems,
  countOutboxItems,
} from '@/lib/outbox';
import type { CreateOutboxInput, OutboxStatus } from '@/lib/types';

// GET /api/outbox — list outbox items, optionally filtered by status
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') as OutboxStatus | null;
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  const items = listOutboxItems({ status: status ?? undefined, limit, offset });
  const total = countOutboxItems(status ?? undefined);

  return NextResponse.json({ items, total, limit, offset });
}

// POST /api/outbox — create a new outbox item (draft)
export async function POST(request: NextRequest) {
  const body = await request.json() as CreateOutboxInput;

  if (!body.destination || !body.content) {
    return NextResponse.json(
      { error: 'destination and content are required' },
      { status: 400 },
    );
  }

  const validDestinations = ['clipboard', 'email', 'teams'];
  if (!validDestinations.includes(body.destination)) {
    return NextResponse.json(
      { error: `destination must be one of: ${validDestinations.join(', ')}` },
      { status: 400 },
    );
  }

  const item = createOutboxItem(body);
  return NextResponse.json(item, { status: 201 });
}
