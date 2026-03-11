# Microsoft Graph Setup Guide

Connect your Microsoft 365 email and Teams to the Knowledge Base. This guide walks you through registering an Azure AD app, configuring OAuth, and connecting your account.

## Prerequisites

- A Microsoft 365 account (personal or work/school)
- Access to the [Azure Portal](https://portal.azure.com)
- The Knowledge Base app running locally (`npm run dev`)

---

## Step 1: Register an Azure AD Application

1. Go to [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Click **+ New registration**
3. Fill in:
   - **Name**: `Personal Knowledge Base` (or whatever you like)
   - **Supported account types**: Choose based on your needs:
     - *Personal Microsoft accounts only* → for personal Outlook/Hotmail
     - *Accounts in any organizational directory and personal* → for both work and personal
   - **Redirect URI**:
     - Platform: **Web**
     - URI: `http://localhost:3000/api/auth/microsoft/callback`
4. Click **Register**

After registration, you'll land on the app's overview page. Note the **Application (client) ID** — you'll need it later.

## Step 2: Create a Client Secret

1. In your app registration, go to **Certificates & secrets** in the left sidebar
2. Under **Client secrets**, click **+ New client secret**
3. Add a description (e.g., `Knowledge Base dev`) and choose an expiry
4. Click **Add**
5. You'll see two fields: **Value** and **Secret ID**
   - **Copy the Value** — this is your client secret (it won't be shown again)
   - Ignore the Secret ID — that's just Azure's internal identifier for the secret

## Step 3: Configure API Permissions

1. In your app registration, go to **API permissions** in the left sidebar
2. Click **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add the following permissions:

| Permission | Purpose |
|---|---|
| `User.Read` | Read your profile (required for sign-in) |
| `Mail.ReadWrite` | Read and manage email |
| `Chat.ReadWrite` | Read and manage Teams chats |

4. Click **Add permissions**

> **Note**: For a work/school account, an admin may need to click **Grant admin consent** for these permissions. For personal accounts, the user consents during the OAuth flow.

## Step 4: Add the Client Secret to Your Environment

Open (or create) `.env.local` in the app root and add:

```bash
# Microsoft Graph OAuth
MS_CLIENT_SECRET=paste_your_secret_value_here
```

> **Important**: Never commit `.env.local` to git. It's already in `.gitignore`.

## Step 5: Add the Account in the App

1. Start the dev server if it's not running: `npm run dev`
2. Open [http://localhost:3000](http://localhost:3000)
3. Click the **gear icon** (⚙) in the sidebar header to open Settings
4. Click **+ Add Account**
5. Fill in:
   - **Account Name**: Something descriptive (e.g., "Personal Microsoft 365")
   - **Client ID**: The Application (client) ID from Step 1
   - **Tenant ID**: 
     - For personal accounts: `consumers`
     - For work/school accounts: your organization's tenant ID or domain (e.g., `myorg.onmicrosoft.com`)
     - For both: `common`
6. Click **Add Account**

## Step 6: Connect the Account

1. In Settings, find your newly added account
2. Click **Connect**
3. You'll be redirected to Microsoft's sign-in page
4. Sign in with your Microsoft account
5. Review and accept the requested permissions
6. You'll be redirected back to the app with a green **Connected** badge

## Step 7: Poll for Data

Once connected, you can import data:

1. In Settings, click **Poll Email** to import recent inbox messages as cards
2. Click **Poll Teams** to import recent Teams chat messages as cards
3. Use the **source filter pills** in the sidebar (Email, Teams) to view imported cards

Each poll uses delta queries, so subsequent polls only fetch new items since the last poll.

---

## Troubleshooting

### "Token expired — re-authentication required"

Your OAuth token has expired. Go to Settings and click **Connect** again to re-authenticate.

### "No token for account — OAuth required"

The account hasn't been connected yet, or the stored tokens were cleared. Click **Connect** in Settings.

### "OAuth state mismatch"

The OAuth callback didn't match any pending login flow. This can happen if you refresh the page mid-login. Try clicking **Connect** again.

### Permissions errors from Graph API

Make sure:
- The correct API permissions are configured (Step 3)
- For work accounts, admin consent has been granted
- The scopes in the account configuration match the permissions

### "No enabled Microsoft accounts"

The poll endpoints require at least one connected and enabled Microsoft account. Check Settings to ensure your account shows as both **Connected** and enabled.

---

## Multi-Account Setup

You can add multiple Microsoft accounts (e.g., personal + work):

1. Register a separate Azure AD app for each account (or use the same app if the supported account types cover both)
2. Add each account in Settings with its own Client ID and Tenant ID
3. Connect each account individually
4. Cards from all accounts appear in the unified card list, tagged by source account in their metadata

## Security Notes

- **Client secrets** are stored only in `.env.local`, never in config or the database
- **OAuth tokens** are stored in the local SQLite database (`data/personal-agent.db`)
- **PKCE** (Proof Key for Code Exchange) is used for the OAuth flow for additional security
- This setup is for **local development only**. For production, use a proper secrets manager and HTTPS
