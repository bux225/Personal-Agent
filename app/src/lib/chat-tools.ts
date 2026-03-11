import type { ToolDefinition, ToolCall } from './llm';
import { createCard } from './cards';
import { createOutboxItem } from './outbox';
import { embedCard } from './rag';
import { suggestTags } from './autotag';
import { updateCard } from './cards';

// === Tool definitions sent to the LLM ===

export const CHAT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_note',
      description: 'Save a note to the knowledge base. Use when the user wants to remember something, jot down a thought, or save information.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short descriptive title for the note' },
          content: { type: 'string', description: 'The full note content' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
        },
        required: ['title', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_reference',
      description: 'Save a URL/link as a reference in the knowledge base. Use when the user shares a link or asks to bookmark/save a URL.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Descriptive title for the reference' },
          url: { type: 'string', description: 'The URL to save' },
          notes: { type: 'string', description: 'Optional notes about this reference' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
        },
        required: ['title', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_email',
      description: 'Draft an email and save it to the outbox for review. Use when the user asks to write, draft, or compose an email.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses (if known)' },
          subject: { type: 'string', description: 'Email subject line' },
          body: { type: 'string', description: 'Email body content' },
        },
        required: ['subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_teams_message',
      description: 'Draft a Teams message and save it to the outbox for review. Use when the user asks to write or send a Teams message.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'The message content' },
        },
        required: ['content'],
      },
    },
  },
];

// === Action result returned to the chat stream ===

export interface ActionResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  summary: string;       // human-readable summary
  toolOutput: string;    // returned to LLM as tool result
}

// === Execute a tool call ===

export async function executeToolCall(call: ToolCall): Promise<ActionResult> {
  const args = JSON.parse(call.function.arguments);

  switch (call.function.name) {
    case 'create_note': {
      const card = createCard({
        source: 'note',
        title: args.title,
        content: args.content,
        tags: args.tags ?? [],
      });
      // Embed + auto-tag in background
      embedCard(card.id).then(() =>
        suggestTags(card).then(tags => {
          if (tags.length > 0) {
            updateCard(card.id, { tags: [...new Set([...card.tags, ...tags])] });
          }
        }).catch(() => {})
      ).catch(() => {});

      return {
        toolCallId: call.id,
        toolName: 'create_note',
        success: true,
        summary: `Note saved: "${args.title}"`,
        toolOutput: JSON.stringify({ status: 'saved', id: card.id, title: card.title }),
      };
    }

    case 'save_reference': {
      const card = createCard({
        source: 'reference',
        title: args.title,
        content: args.notes || args.url,
        url: args.url,
        tags: args.tags ?? [],
      });
      embedCard(card.id).then(() =>
        suggestTags(card).then(tags => {
          if (tags.length > 0) {
            updateCard(card.id, { tags: [...new Set([...card.tags, ...tags])] });
          }
        }).catch(() => {})
      ).catch(() => {});

      return {
        toolCallId: call.id,
        toolName: 'save_reference',
        success: true,
        summary: `Reference saved: "${args.title}"`,
        toolOutput: JSON.stringify({ status: 'saved', id: card.id, title: card.title, url: args.url }),
      };
    }

    case 'draft_email': {
      const item = createOutboxItem({
        destination: 'email',
        subject: args.subject,
        content: args.body,
        to: args.to ?? [],
      });

      return {
        toolCallId: call.id,
        toolName: 'draft_email',
        success: true,
        summary: `Email draft saved to Outbox: "${args.subject}"`,
        toolOutput: JSON.stringify({ status: 'drafted', id: item.id, subject: args.subject, destination: 'email' }),
      };
    }

    case 'draft_teams_message': {
      const item = createOutboxItem({
        destination: 'teams',
        subject: '',
        content: args.content,
      });

      return {
        toolCallId: call.id,
        toolName: 'draft_teams_message',
        success: true,
        summary: `Teams message draft saved to Outbox`,
        toolOutput: JSON.stringify({ status: 'drafted', id: item.id, destination: 'teams' }),
      };
    }

    default:
      return {
        toolCallId: call.id,
        toolName: call.function.name,
        success: false,
        summary: `Unknown tool: ${call.function.name}`,
        toolOutput: JSON.stringify({ error: `Unknown tool: ${call.function.name}` }),
      };
  }
}
