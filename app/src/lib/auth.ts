import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node';
import { getToken, upsertToken, isTokenExpired } from './tokens';
import type { AccountConfig } from './types';

const cryptoProvider = new CryptoProvider();

// Cache MSAL app instances per account
const msalApps = new Map<string, ConfidentialClientApplication>();

function getMsalApp(account: AccountConfig): ConfidentialClientApplication {
  const existing = msalApps.get(account.id);
  if (existing) return existing;

  const clientId = account.clientId;
  const clientSecret = process.env.MS_CLIENT_SECRET ?? '';
  const authority = `https://login.microsoftonline.com/${account.tenantId ?? 'common'}`;

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

/**
 * Generate the authorization URL to redirect the user to Microsoft login.
 * Returns { url, state } — state is used to verify the callback.
 */
export async function getAuthUrl(account: AccountConfig): Promise<{ url: string; state: string }> {
  const app = getMsalApp(account);
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
  const state = cryptoProvider.createNewGuid();

  // Store PKCE verifier in a module-level map keyed by state
  // (short-lived, cleared on callback)
  pendingAuth.set(state, { accountId: account.id, verifier });

  const url = await app.getAuthCodeUrl({
    redirectUri: REDIRECT_URI,
    scopes: account.scopes,
    state,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
  });

  return { url, state };
}

// Short-lived map for pending OAuth flows
const pendingAuth = new Map<string, { accountId: string; verifier: string }>();

/**
 * Exchange the authorization code for tokens and store them.
 */
export async function handleCallback(
  code: string,
  state: string,
  account: AccountConfig,
): Promise<void> {
  const pending = pendingAuth.get(state);
  if (!pending || pending.accountId !== account.id) {
    throw new Error('Invalid OAuth state — possible CSRF');
  }
  pendingAuth.delete(state);

  const app = getMsalApp(account);
  const result = await app.acquireTokenByCode({
    code,
    redirectUri: REDIRECT_URI,
    scopes: account.scopes,
    codeVerifier: pending.verifier,
  });

  if (!result) throw new Error('Token acquisition failed');

  upsertToken(
    account.id,
    result.accessToken,
    // MSAL node doesn't expose refresh tokens directly in the result,
    // but the token cache handles refresh internally
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
