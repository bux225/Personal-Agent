import { fetchEmails, type GraphEmail } from '../graph';
import { createCard } from '../cards';
import { getWatermark, upsertWatermark } from '../tokens';
import { embedCard } from '../rag';
import type { AccountConfig, Card, CreateCardInput } from '../types';

/**
 * Convert a Graph API email to a Card creation input.
 */
function emailToCard(email: GraphEmail, accountName: string): CreateCardInput {
  // Strip HTML tags for plain-text content
  const plainContent = email.body.contentType === 'html'
    ? email.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : email.body.content;

  // Extract people from sender and recipients
  const people: string[] = [];
  if (email.from?.emailAddress?.name) {
    people.push(email.from.emailAddress.name);
  }
  for (const r of email.toRecipients ?? []) {
    if (r.emailAddress?.name) {
      people.push(r.emailAddress.name);
    }
  }

  return {
    source: 'email',
    title: email.subject || '(No subject)',
    content: plainContent || email.bodyPreview || '',
    url: email.webLink || undefined,
    people: [...new Set(people)], // deduplicate
    tags: ['inbox'],
    metadata: {
      graphId: email.id,
      from: email.from?.emailAddress?.address ?? '',
      receivedAt: email.receivedDateTime,
      account: accountName,
      isRead: String(email.isRead),
    },
  };
}

/**
 * Check if an email has already been imported (by graphId in metadata).
 */
function isAlreadyImported(email: GraphEmail, existingCards: Card[]): boolean {
  return existingCards.some(
    c => c.source === 'email' && c.metadata.graphId === email.id,
  );
}

/**
 * Poll emails for a given account and create cards for new messages.
 * Uses delta queries for incremental polling.
 */
export async function pollEmails(
  account: AccountConfig,
  existingCards: Card[],
): Promise<{ imported: number; errors: string[] }> {
  const watermark = getWatermark(account.id, 'email');
  const { emails, deltaLink } = await fetchEmails(account, watermark?.deltaLink);

  let imported = 0;
  const errors: string[] = [];

  for (const email of emails) {
    if (isAlreadyImported(email, existingCards)) continue;

    try {
      const input = emailToCard(email, account.name);
      const card = createCard(input);
      imported++;

      // Embed in background
      embedCard(card.id).catch(err =>
        console.error(`Embedding failed for email card ${card.id}:`, err),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to import email "${email.subject}": ${msg}`);
    }
  }

  // Save watermark for next poll
  if (deltaLink) {
    upsertWatermark(account.id, 'email', deltaLink);
  }

  return { imported, errors };
}
