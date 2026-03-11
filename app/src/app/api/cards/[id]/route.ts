import { NextRequest, NextResponse } from 'next/server';
import { getCardById, updateCard, deleteCard } from '@/lib/cards';
import type { UpdateCardInput } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/cards/:id
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const card = getCardById(id);

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  return NextResponse.json(card);
}

// PATCH /api/cards/:id
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json() as UpdateCardInput;

  const card = updateCard(id, body);

  if (!card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  return NextResponse.json(card);
}

// DELETE /api/cards/:id
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const deleted = deleteCard(id);

  if (!deleted) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
