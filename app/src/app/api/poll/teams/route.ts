import { NextResponse } from 'next/server';
import { getEnabledAccounts } from '@/lib/config';
import { listCards } from '@/lib/cards';
import { pollTeams } from '@/lib/adapters/teams';

// POST /api/poll/teams — poll all enabled Microsoft accounts for new Teams messages
export async function POST() {
  const accounts = getEnabledAccounts('microsoft');
  if (accounts.length === 0) {
    return NextResponse.json({ message: 'No enabled Microsoft accounts' }, { status: 200 });
  }

  const existingCards = listCards({ source: 'teams', limit: 10000 });

  const results = [];
  for (const account of accounts) {
    if (!account.scopes.some(s => s.toLowerCase().includes('chat'))) continue;

    try {
      const result = await pollTeams(account, existingCards);
      results.push({ account: account.name, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ account: account.name, imported: 0, errors: [msg] });
    }
  }

  return NextResponse.json({ results });
}
