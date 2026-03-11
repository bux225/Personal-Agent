import { NextRequest, NextResponse } from 'next/server';
import { getOutboxItemById, updateOutboxStatus } from '@/lib/outbox';
import { getEnabledAccounts } from '@/lib/config';
import { sendEmail, sendTeamsMessage } from '@/lib/adapters/send';

// POST /api/outbox/[id]/send — send an approved outbox item
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = getOutboxItemById(id);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (item.status !== 'approved') {
    return NextResponse.json(
      { error: `Item must be approved before sending (current: ${item.status})` },
      { status: 400 },
    );
  }

  // Handle clipboard destination locally
  if (item.destination === 'clipboard') {
    updateOutboxStatus(id, 'sent');
    return NextResponse.json({
      sent: true,
      message: 'Content ready to copy — use the clipboard button in the UI',
      content: item.content,
    });
  }

  // For email/teams, find an enabled Microsoft account
  const accounts = getEnabledAccounts('microsoft');
  if (accounts.length === 0) {
    return NextResponse.json(
      { error: 'No enabled Microsoft accounts — connect one in Settings' },
      { status: 400 },
    );
  }

  // Use the first enabled account (or a specific one from metadata)
  const accountId = item.metadata.accountId;
  const account = accountId
    ? accounts.find(a => a.id === accountId)
    : accounts[0];

  if (!account) {
    return NextResponse.json({ error: 'Specified account not found or disabled' }, { status: 400 });
  }

  try {
    if (item.destination === 'email') {
      await sendEmail(account, item);
    } else if (item.destination === 'teams') {
      await sendTeamsMessage(account, item);
    }

    const updated = updateOutboxStatus(id, 'sent');
    return NextResponse.json({ sent: true, item: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to send outbox item ${id}:`, err);
    return NextResponse.json({ error: `Send failed: ${msg}` }, { status: 500 });
  }
}
