import { NextRequest, NextResponse } from 'next/server';
import { handleCallback } from '@/lib/auth';
import { loadConfig } from '@/lib/config';

// GET /api/auth/microsoft/callback?code=xxx&state=xxx
// Handles the OAuth redirect from Microsoft
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');
  const errorDescription = request.nextUrl.searchParams.get('error_description');

  if (error) {
    console.error(`[auth] OAuth callback error: ${error} — ${errorDescription}`);
    // Redirect to settings with error
    return NextResponse.redirect(
      new URL(`/?settings=true&authError=${encodeURIComponent(errorDescription ?? error)}`, request.url),
    );
  }

  if (!code || !state) {
    console.log(`[auth][callback] Missing code or state. code=${!!code}, state=${!!state}`);
    return NextResponse.redirect(
      new URL('/?settings=true&authError=Missing+code+or+state', request.url),
    );
  }

  console.log(`[auth][callback] Received callback. state length=${state.length}, state prefix=${state.slice(0, 30)}...`);
  console.log(`[auth][callback] Full state: ${state}`);
  console.log(`[auth][callback] Full URL: ${request.url}`);

  // Find the account from state — try all Microsoft accounts
  const config = loadConfig();
  const microsoftAccounts = config.accounts.filter(a => a.provider === 'microsoft');

  let handled = false;
  for (const account of microsoftAccounts) {
    try {
      console.log(`[auth] Attempting token exchange for "${account.name}"...`);
      await handleCallback(code, state, account);
      console.log(`[auth] Token exchange successful for "${account.name}"`);
      handled = true;
      break;
    } catch (err) {
      console.log(`[auth] Token exchange failed for "${account.name}": ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!handled) {
    return NextResponse.redirect(
      new URL('/?settings=true&authError=OAuth+state+mismatch', request.url),
    );
  }

  // Success — redirect back to app
  return NextResponse.redirect(new URL('/?settings=true&authSuccess=true', request.url));
}
