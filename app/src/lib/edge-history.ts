import Database from 'better-sqlite3';
import { existsSync, copyFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createCard, listCards } from './cards';
import { embedCard } from './rag';
import type { Card } from './types';

const EDGE_HISTORY_PATHS: Record<string, string> = {
  darwin: join(
    process.env.HOME ?? '',
    'Library/Application Support/Microsoft Edge/Default/History',
  ),
  win32: join(
    process.env.LOCALAPPDATA ?? '',
    'Microsoft/Edge/User Data/Default/History',
  ),
  linux: join(process.env.HOME ?? '', '.config/microsoft-edge/Default/History'),
};

interface HistoryRow {
  url: string;
  title: string;
  visit_count: number;
  last_visit_time: number;
}

/**
 * Import recent browser history from Microsoft Edge as reference cards.
 * Edge locks its DB, so we copy it to a temp file first.
 */
export async function importEdgeHistory(options?: {
  daysBack?: number;
  minVisits?: number;
  urlFilter?: string;
}): Promise<{ imported: Card[]; skipped: number; errors: string[] }> {
  const daysBack = options?.daysBack ?? 7;
  const minVisits = options?.minVisits ?? 1;
  const urlFilter = options?.urlFilter;

  const historyPath = EDGE_HISTORY_PATHS[process.platform];
  if (!historyPath || !existsSync(historyPath)) {
    return { imported: [], skipped: 0, errors: ['Edge history database not found at expected location'] };
  }

  // Copy the locked DB to a temp file
  const tempPath = join(tmpdir(), `edge-history-${Date.now()}.db`);
  try {
    copyFileSync(historyPath, tempPath);
  } catch (err) {
    return { imported: [], skipped: 0, errors: [`Failed to copy history DB: ${err instanceof Error ? err.message : 'unknown'}`] };
  }

  const errors: string[] = [];
  const imported: Card[] = [];
  let skipped = 0;

  try {
    const histDb = new Database(tempPath, { readonly: true });

    // Chrome/Edge timestamps are microseconds since 1601-01-01
    // Convert to JS Date: (chromeTime / 1000000) - 11644473600 = unix seconds
    const cutoffChromeTime = ((Date.now() / 1000) + 11644473600 - (daysBack * 86400)) * 1000000;

    let query = `
      SELECT url, title, visit_count, last_visit_time
      FROM urls
      WHERE last_visit_time > ?
        AND visit_count >= ?
        AND title != ''
    `;
    const params: unknown[] = [cutoffChromeTime, minVisits];

    if (urlFilter) {
      query += ' AND url LIKE ?';
      params.push(`%${urlFilter}%`);
    }

    query += ' ORDER BY last_visit_time DESC LIMIT 200';

    const rows = histDb.prepare(query).all(...params) as HistoryRow[];
    histDb.close();

    // Get existing reference cards to deduplicate
    const existingCards = listCards({ source: 'reference', limit: 10000 });
    const existingUrls = new Set(existingCards.map(c => c.url).filter(Boolean));

    for (const row of rows) {
      if (existingUrls.has(row.url)) {
        skipped++;
        continue;
      }

      // Skip internal browser pages
      if (row.url.startsWith('edge://') || row.url.startsWith('chrome://') || row.url.startsWith('about:')) {
        skipped++;
        continue;
      }

      try {
        const visitDate = new Date(row.last_visit_time / 1000 - 11644473600000);

        const card = createCard({
          source: 'reference',
          title: row.title || row.url,
          content: `Visited ${row.visit_count} time${row.visit_count !== 1 ? 's' : ''}, last on ${visitDate.toLocaleDateString()}.`,
          url: row.url,
          metadata: {
            importedFrom: 'edge-history',
            visitCount: String(row.visit_count),
            lastVisit: visitDate.toISOString(),
          },
        });

        existingUrls.add(row.url);

        // Embed
        try {
          await embedCard(card.id);
        } catch {
          errors.push(`Embedding failed for ${row.url}`);
        }

        imported.push(card);
      } catch (err) {
        errors.push(`Failed to import ${row.url}: ${err instanceof Error ? err.message : 'unknown'}`);
      }
    }
  } finally {
    // Clean up temp file
    try { unlinkSync(tempPath); } catch { /* ignore */ }
  }

  return { imported, skipped, errors };
}
