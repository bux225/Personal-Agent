import { NextResponse } from 'next/server';
import { getEnabledAccounts } from '@/lib/config';
import { listCards } from '@/lib/cards';
import { pollEmails } from '@/lib/adapters/email';

// POST /api/poll/email — poll all enabled Microsoft accounts for new emails
export async function POST() {
  const accounts = getEnabledAccounts('microsoft');
  if (accounts.length === 0) {
    return NextResponse.json({ message: 'No enabled Microsoft accounts' }, { status: 200 });
  }

  // Get existing email cards to deduplicate
  const existingCards = listCards({ source: 'email', limit: 10000 });

  const results = [];
  for (const account of accounts) {
    // Only poll accounts with email scopes
    if (!account.scopes.some(s => s.toLowerCase().includes('mail'))) continue;

    try {
      const result = await pollEmails(account, existingCards);
      results.push({ account: account.name, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ account: account.name, imported: 0, errors: [msg] });
    }
  }

  return NextResponse.json({ results });
}
