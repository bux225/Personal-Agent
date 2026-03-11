import { fetchChats, fetchChatMessages, type GraphChat, type GraphChatMessage } from '../graph';
import { createCard } from '../cards';
import { getWatermark, upsertWatermark } from '../tokens';
import { embedCard } from '../rag';
import type { AccountConfig, Card, CreateCardInput } from '../types';

/**
 * Convert a batch of Teams chat messages into a single Card.
 * Groups messages by chat so each chat becomes one card update.
 */
function chatMessagesToCard(
  chat: GraphChat,
  messages: GraphChatMessage[],
  accountName: string,
): CreateCardInput {
  // Build readable conversation content
  const lines = messages
    .filter(m => m.messageType === 'message') // skip system messages
    .sort((a, b) => new Date(a.createdDateTime).getTime() - new Date(b.createdDateTime).getTime())
    .map(m => {
      const sender = m.from?.user?.displayName ?? 'Unknown';
      const text = m.body.contentType === 'html'
        ? m.body.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : m.body.content;
      return `${sender}: ${text}`;
    });

  const content = lines.join('\n');

  // Extract people from messages + chat members
  const people = new Set<string>();
  for (const m of messages) {
    if (m.from?.user?.displayName) people.add(m.from.user.displayName);
  }
  if (chat.members) {
    for (const member of chat.members) {
      if (member.displayName) people.add(member.displayName);
    }
  }

  const title = chat.topic || `Teams chat with ${[...people].slice(0, 3).join(', ')}`;

  return {
    source: 'teams',
    title,
    content: content || '(empty chat)',
    url: undefined,
    people: [...people],
    tags: ['teams-chat'],
    metadata: {
      chatId: chat.id,
      chatType: chat.chatType,
      account: accountName,
      messageCount: String(messages.length),
      lastMessageAt: messages.length > 0
        ? messages[messages.length - 1].createdDateTime
        : '',
    },
  };
}

/**
 * Poll Teams chats for a given account and create/update cards.
 */
export async function pollTeams(
  account: AccountConfig,
  existingCards: Card[],
): Promise<{ imported: number; errors: string[] }> {
  const watermark = getWatermark(account.id, 'teams');
  const since = watermark?.lastPolledAt ?? undefined;

  const chats = await fetchChats(account);

  let imported = 0;
  const errors: string[] = [];

  for (const chat of chats) {
    try {
      const messages = await fetchChatMessages(account, chat.id, since);
      if (messages.length === 0) continue;

      // Check if we already have a card for this chat
      const existingCard = existingCards.find(
        c => c.source === 'teams' && c.metadata.chatId === chat.id,
      );

      if (existingCard) {
        // Skip if already imported — could update in future
        continue;
      }

      const input = chatMessagesToCard(chat, messages, account.name);
      const card = createCard(input);
      imported++;

      embedCard(card.id).catch(err =>
        console.error(`Embedding failed for teams card ${card.id}:`, err),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to poll chat "${chat.topic ?? chat.id}": ${msg}`);
    }
  }

  // Update watermark
  upsertWatermark(account.id, 'teams', null);

  return { imported, errors };
}
