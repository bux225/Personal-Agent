import { NextRequest, NextResponse } from 'next/server';
import { generateDigest } from '@/lib/digest';

// GET /api/digest — generate a smart summary of recent activity
export async function GET(request: NextRequest) {
  const daysBack = parseInt(request.nextUrl.searchParams.get('days') ?? '1', 10);
  const safeDays = Math.max(1, Math.min(30, daysBack));

  const digest = await generateDigest(safeDays);

  return NextResponse.json(digest);
}
