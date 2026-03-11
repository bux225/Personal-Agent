import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/auth';
import { getAccountById } from '@/lib/config';

// GET /api/auth/microsoft/login?accountId=xxx
// Redirects to Microsoft OAuth login
export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('accountId');
  if (!accountId) {
    return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  }

  const account = getAccountById(accountId);
  if (!account || account.provider !== 'microsoft') {
    return NextResponse.json({ error: 'Microsoft account not found' }, { status: 404 });
  }

  try {
    const { url, state } = await getAuthUrl(account);
    console.log(`[auth][login] Redirecting to Microsoft. state length=${state.length}, state prefix=${state.slice(0, 30)}...`);
    console.log(`[auth][login] Redirect URL: ${url.slice(0, 200)}...`);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error('OAuth login error:', err);
    return NextResponse.json({ error: 'Failed to initiate OAuth flow' }, { status: 500 });
  }
}
