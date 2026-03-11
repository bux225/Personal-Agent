import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node';
import { getToken, upsertToken, isTokenExpired } from './tokens';
import type { AccountConfig } from './types';
import crypto from 'crypto';

const cryptoProvider = new CryptoProvider();

// Cache MSAL app instances per account
const msalApps = new Map<string, ConfidentialClientApplication>();

function getMsalApp(account: AccountConfig): ConfidentialClientApplication {
  const existing = msalApps.get(account.id);
  if (existing) return existing;

  const clientId = account.clientId;
  const clientSecret = process.env.MS_CLIENT_SECRET ?? '';
  const tenant = account.tenantId ?? 'common';
  const authority = `https://login.microsoftonline.com/${tenant}`;

  console.log(`[auth] Creating MSAL confidential client for "${account.name}" (clientId=${clientId}, tenant=${tenant})`);

  const app = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority,
    },
  });

  msalApps.set(account.id, app);
  return app;
}

const REDIRECT_URI = 'http://localhost:3000/api/auth/microsoft/callback';

// Encode PKCE verifier + account ID into the state param so nothing needs to be stored
function encodeState(accountId: string, verifier: string): string {
  const payload = JSON.stringify({ a: accountId, v: verifier });
  return Buffer.from(payload).toString('base64url');
}

function decodeState(state: string): { accountId: string; verifier: string } | null {
  try {
    const payload = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
    if (payload.a && payload.v) return { accountId: payload.a, verifier: payload.v };
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate the authorization URL to redirect the user to Microsoft login.
 * Returns { url, state } — state carries the PKCE verifier (no server-side storage needed).
 */
export async function getAuthUrl(account: AccountConfig): Promise<{ url: string; state: string }> {
  // Clear cached MSAL instance to pick up config changes (e.g. tenantId)
  msalApps.delete(account.id);
  const app = getMsalApp(account);
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
  const state = encodeState(account.id, verifier);

  console.log(`[auth] Generating auth URL for "${account.name}" with scopes: ${account.scopes.join(', ')}`);

  const url = await app.getAuthCodeUrl({
    redirectUri: REDIRECT_URI,
    scopes: account.scopes,
    state,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
  });

  console.log(`[auth] Auth URL generated, redirecting to Microsoft login`);
  return { url, state };
}

/**
 * Exchange the authorization code for tokens and store them.
 */
export async function handleCallback(
  code: string,
  state: string,
  account: AccountConfig,
): Promise<void> {
  console.log(`[auth][handleCallback] Raw state: ${state}`);
  const decoded = decodeState(state);
  console.log(`[auth][handleCallback] Decoded: ${JSON.stringify(decoded)}`);
  console.log(`[auth][handleCallback] Account ID: ${account.id}`);
  if (!decoded || decoded.accountId !== account.id) {
    throw new Error(`Invalid OAuth state — ${!decoded ? 'failed to decode state' : `account mismatch: state has ${decoded.accountId}, trying ${account.id}`}`);
  }

  const app = getMsalApp(account);
  const result = await app.acquireTokenByCode({
    code,
    redirectUri: REDIRECT_URI,
    scopes: account.scopes,
    codeVerifier: decoded.verifier,
  });

  if (!result) throw new Error('Token acquisition failed');

  upsertToken(
    account.id,
    result.accessToken,
    null,
    result.expiresOn ?? new Date(Date.now() + 3600_000),
    account.scopes,
  );
}

/**
 * Get a valid access token for the account, refreshing if needed.
 */
export async function getAccessToken(account: AccountConfig): Promise<string> {
  const app = getMsalApp(account);

  // Try silent acquisition from MSAL's internal cache first
  try {
    const accounts = await app.getTokenCache().getAllAccounts();
    if (accounts.length > 0) {
      const result = await app.acquireTokenSilent({
        account: accounts[0],
        scopes: account.scopes,
      });
      if (result) {
        // Update our DB store
        upsertToken(
          account.id,
          result.accessToken,
          null,
          result.expiresOn ?? new Date(Date.now() + 3600_000),
          account.scopes,
        );
        return result.accessToken;
      }
    }
  } catch {
    // Silent acquisition failed, fall through to DB token
  }

  // Fall back to stored token
  const stored = getToken(account.id);
  if (!stored) {
    throw new Error(`No token for account "${account.name}" — OAuth required`);
  }
  if (isTokenExpired(stored)) {
    throw new Error(`Token expired for account "${account.name}" — re-authentication required`);
  }
  return stored.accessToken;
}

/**
 * Check if an account has valid (non-expired) tokens.
 */
export function isAccountConnected(accountId: string): boolean {
  const token = getToken(accountId);
  return token !== null && !isTokenExpired(token);
}
