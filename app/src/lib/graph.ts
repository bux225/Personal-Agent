import { getAccessToken } from './auth';
import type { AccountConfig } from './types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

/**
 * Authenticated fetch against Microsoft Graph API.
 * Handles token injection and error responses.
 */
export async function graphFetch(
  account: AccountConfig,
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const token = await getAccessToken(account);

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Graph API ${res.status}: ${res.statusText} — ${body}`);
  }

  return res;
}

// === Email types (subset of Graph API response) ===

export interface GraphEmail {
  id: string;
  subject: string;
  bodyPreview: string;
  body: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } };
  toRecipients: { emailAddress: { name: string; address: string } }[];
  receivedDateTime: string;
  webLink: string;
  isRead: boolean;
}

interface GraphEmailResponse {
  value: GraphEmail[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

/**
 * Fetch emails from the user's inbox.
 * Supports delta queries for incremental polling.
 */
export async function fetchEmails(
  account: AccountConfig,
  deltaLink?: string | null,
): Promise<{ emails: GraphEmail[]; deltaLink: string | null }> {
  let response: GraphEmailResponse;

  if (deltaLink) {
    // Delta links are full URLs — fetch directly with auth
    const token = await getAccessToken(account);
    const res = await fetch(deltaLink, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`Graph delta ${res.status}`);
    response = await res.json() as GraphEmailResponse;
  } else {
    const path = '/me/mailFolders/inbox/messages/delta?$select=subject,bodyPreview,body,from,toRecipients,receivedDateTime,webLink,isRead&$top=25&$orderby=receivedDateTime desc';
    const res = await graphFetch(account, path);
    response = await res.json() as GraphEmailResponse;
  }

  // Follow pagination
  const allEmails = [...response.value];
  let nextLink = response['@odata.nextLink'];
  while (nextLink) {
    const token = await getAccessToken(account);
    const pageRes = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!pageRes.ok) break;
    const page = await pageRes.json() as GraphEmailResponse;
    allEmails.push(...page.value);
    nextLink = page['@odata.nextLink'];
  }

  return {
    emails: allEmails,
    deltaLink: response['@odata.deltaLink'] ?? null,
  };
}

// === Teams types ===

export interface GraphChatMessage {
  id: string;
  messageType: string;
  body: { contentType: string; content: string };
  from: { user?: { displayName: string; id: string } } | null;
  createdDateTime: string;
  chatId: string;
  webUrl?: string;
}

export interface GraphChat {
  id: string;
  topic: string | null;
  chatType: string;
  lastUpdatedDateTime: string;
  members?: { displayName: string; userId: string }[];
}

interface GraphChatsResponse {
  value: GraphChat[];
  '@odata.nextLink'?: string;
}

interface GraphMessagesResponse {
  value: GraphChatMessage[];
  '@odata.nextLink'?: string;
}

/**
 * Fetch recent Teams chats the user is part of.
 */
export async function fetchChats(account: AccountConfig): Promise<GraphChat[]> {
  const res = await graphFetch(
    account,
    '/me/chats?$top=25',
  );
  const data = await res.json() as GraphChatsResponse;
  return data.value;
}

/**
 * Fetch messages from a specific Teams chat since a given timestamp.
 */
export async function fetchChatMessages(
  account: AccountConfig,
  chatId: string,
  since?: string,
): Promise<GraphChatMessage[]> {
  let path = `/me/chats/${encodeURIComponent(chatId)}/messages?$top=50&$orderby=createdDateTime desc`;
  if (since) {
    path += `&$filter=createdDateTime gt ${since}`;
  }

  const res = await graphFetch(account, path);
  const data = await res.json() as GraphMessagesResponse;

  // Tag each message with its chatId for context
  return data.value.map(msg => ({ ...msg, chatId }));
}
