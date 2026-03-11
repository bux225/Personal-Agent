import { NextRequest, NextResponse } from 'next/server';
import {
  getOutboxItemById,
  updateOutboxItem,
  updateOutboxStatus,
  deleteOutboxItem,
} from '@/lib/outbox';
import type { OutboxStatus } from '@/lib/types';

// GET /api/outbox/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = getOutboxItemById(id);
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(item);
}

// PATCH /api/outbox/[id] — update content or status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json() as {
    subject?: string;
    content?: string;
    to?: string[];
    metadata?: Record<string, string>;
    status?: OutboxStatus;
  };

  const existing = getOutboxItemById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // If status change requested, validate the transition
  if (body.status) {
    const validTransitions: Record<OutboxStatus, OutboxStatus[]> = {
      draft: ['approved'],
      approved: ['draft', 'sent'],
      sent: [],
    };
    if (!validTransitions[existing.status].includes(body.status)) {
      return NextResponse.json(
        { error: `Cannot transition from "${existing.status}" to "${body.status}"` },
        { status: 400 },
      );
    }
    const updated = updateOutboxStatus(id, body.status);
    return NextResponse.json(updated);
  }

  // Only allow editing drafts
  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: 'Can only edit items in draft status' },
      { status: 400 },
    );
  }

  const updated = updateOutboxItem(id, {
    subject: body.subject,
    content: body.content,
    to: body.to,
    metadata: body.metadata,
  });

  return NextResponse.json(updated);
}

// DELETE /api/outbox/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deleted = deleteOutboxItem(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
