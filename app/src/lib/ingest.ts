import { createCard } from './cards';
import { embedCard } from './rag';
import { suggestTags } from './autotag';
import { updateCard } from './cards';
import type { Card } from './types';

const MAX_CHUNK_SIZE = 4000; // characters per chunk
const CHUNK_OVERLAP = 200;

/**
 * Fetch a document from a URL, extract text, chunk if needed, and create cards.
 */
export async function ingestDocument(
  url: string,
  options?: { title?: string },
): Promise<{ cards: Card[]; errors: string[] }> {
  const errors: string[] = [];

  // Fetch the document
  let text: string;
  let contentType: string;
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'text/plain, text/html, text/markdown, application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    contentType = res.headers.get('content-type') ?? '';
    text = await res.text();
  } catch (err) {
    return { cards: [], errors: [`Failed to fetch: ${err instanceof Error ? err.message : 'unknown error'}`] };
  }

  // Extract text based on content type
  if (contentType.includes('text/html')) {
    text = stripHtml(text);
  }

  text = text.trim();
  if (!text) {
    return { cards: [], errors: ['Document was empty after extraction'] };
  }

  const title = options?.title || extractTitle(url, text);

  // Chunk if necessary
  const chunks = chunkText(text, MAX_CHUNK_SIZE, CHUNK_OVERLAP);
  const cards: Card[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkTitle = chunks.length > 1 ? `${title} (${i + 1}/${chunks.length})` : title;

    try {
      const card = createCard({
        source: 'document',
        title: chunkTitle,
        content: chunks[i],
        url,
        metadata: {
          ...(chunks.length > 1 ? { chunk: `${i + 1}/${chunks.length}` } : {}),
          contentType: contentType.split(';')[0].trim(),
        },
      });

      // Embed
      try {
        await embedCard(card.id);
      } catch (err) {
        errors.push(`Embedding failed for chunk ${i + 1}: ${err instanceof Error ? err.message : 'unknown'}`);
      }

      // Auto-tag (fire and forget)
      suggestTags(card).then(suggested => {
        if (suggested.length > 0) {
          updateCard(card.id, { tags: suggested });
        }
      }).catch(() => {});

      cards.push(card);
    } catch (err) {
      errors.push(`Card creation failed for chunk ${i + 1}: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return { cards, errors };
}

/** Strip HTML tags and decode entities */
function stripHtml(html: string): string {
  return html
    // Remove script and style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract a title from URL or first line of text */
function extractTitle(url: string, text: string): string {
  // Try to get filename from URL
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      const last = decodeURIComponent(pathParts[pathParts.length - 1]);
      // Remove file extension
      const name = last.replace(/\.[^.]+$/, '');
      if (name.length > 2) return name;
    }
  } catch {
    // ignore
  }

  // Fall back to first meaningful line
  const firstLine = text.split('\n').find(l => l.trim().length > 5)?.trim();
  if (firstLine) return firstLine.slice(0, 100);
  return 'Imported Document';
}

/** Split text into overlapping chunks */
function chunkText(text: string, maxSize: number, overlap: number): string[] {
  if (text.length <= maxSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxSize;

    // Try to break at paragraph or sentence boundary
    if (end < text.length) {
      const paraBreak = text.lastIndexOf('\n\n', end);
      if (paraBreak > start + maxSize / 2) {
        end = paraBreak;
      } else {
        const sentenceBreak = text.lastIndexOf('. ', end);
        if (sentenceBreak > start + maxSize / 2) {
          end = sentenceBreak + 1;
        }
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}
