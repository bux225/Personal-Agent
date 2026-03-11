import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig, saveConfig } from '@/lib/config';
import { isAccountConnected } from '@/lib/auth';
import { deleteToken } from '@/lib/tokens';
import type { AccountConfig } from '@/lib/types';

// GET /api/accounts — list all accounts with connection status
export async function GET() {
  const config = loadConfig();
  const accounts = config.accounts.map(a => ({
    ...a,
    connected: isAccountConnected(a.id),
  }));
  return NextResponse.json({ accounts });
}

// POST /api/accounts — add a new account
export async function POST(request: NextRequest) {
  const body = await request.json() as Partial<AccountConfig>;

  if (!body.name || !body.provider || !body.clientId) {
    return NextResponse.json(
      { error: 'name, provider, and clientId are required' },
      { status: 400 },
    );
  }

  const config = loadConfig();
  const account: AccountConfig = {
    id: uuidv4(),
    name: body.name,
    provider: body.provider,
    tenantId: body.tenantId,
    clientId: body.clientId,
    scopes: body.scopes ?? [],
    envKey: body.envKey ?? '',
    enabled: body.enabled ?? true,
  };

  config.accounts.push(account);
  saveConfig(config);

  return NextResponse.json(account, { status: 201 });
}

// PATCH /api/accounts — update an account (expects { id, ...fields })
export async function PATCH(request: NextRequest) {
  const body = await request.json() as Partial<AccountConfig> & { id: string };
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const config = loadConfig();
  const idx = config.accounts.findIndex(a => a.id === body.id);
  if (idx < 0) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  const account = config.accounts[idx];
  if (body.name !== undefined) account.name = body.name;
  if (body.enabled !== undefined) account.enabled = body.enabled;
  if (body.scopes !== undefined) account.scopes = body.scopes;
  if (body.tenantId !== undefined) account.tenantId = body.tenantId;
  if (body.clientId !== undefined) account.clientId = body.clientId;

  config.accounts[idx] = account;
  saveConfig(config);

  return NextResponse.json(account);
}

// DELETE /api/accounts?id=xxx — remove an account
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const config = loadConfig();
  const idx = config.accounts.findIndex(a => a.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  config.accounts.splice(idx, 1);
  saveConfig(config);

  // Clean up stored tokens
  deleteToken(id);

  return NextResponse.json({ deleted: true });
}
