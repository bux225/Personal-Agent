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
    console.error('OAuth error:', error, errorDescription);
    // Redirect to settings with error
    return NextResponse.redirect(
      new URL(`/?settings=true&authError=${encodeURIComponent(errorDescription ?? error)}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/?settings=true&authError=Missing+code+or+state', request.url),
    );
  }

  // Find the account from state — try all Microsoft accounts
  const config = loadConfig();
  const microsoftAccounts = config.accounts.filter(a => a.provider === 'microsoft');

  let handled = false;
  for (const account of microsoftAccounts) {
    try {
      await handleCallback(code, state, account);
      handled = true;
      break;
    } catch {
      // State didn't match this account, try next
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
