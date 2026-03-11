import { NextRequest, NextResponse } from 'next/server';
import { importEdgeHistory } from '@/lib/edge-history';

// POST /api/import/edge-history — import browser history from Edge
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    daysBack?: number;
    minVisits?: number;
    urlFilter?: string;
  };

  const daysBack = typeof body.daysBack === 'number' ? Math.max(1, Math.min(365, body.daysBack)) : 7;
  const minVisits = typeof body.minVisits === 'number' ? Math.max(1, body.minVisits) : 1;
  const urlFilter = typeof body.urlFilter === 'string' ? body.urlFilter : undefined;

  const result = await importEdgeHistory({ daysBack, minVisits, urlFilter });

  return NextResponse.json({
    imported: result.imported.length,
    skipped: result.skipped,
    errors: result.errors,
  }, { status: result.imported.length > 0 ? 201 : 200 });
}
