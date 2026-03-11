import { NextRequest } from 'next/server';
import { ragChatStream } from '@/lib/rag';
import type { ChatMessage } from '@/lib/llm';

// POST /api/chat — streaming RAG chat
export async function POST(request: NextRequest) {
  const body = await request.json() as {
    message: string;
    history?: ChatMessage[];
  };

  if (!body.message?.trim()) {
    return new Response(
      JSON.stringify({ error: 'message is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const history = (body.history ?? []).filter(
    (m): m is ChatMessage =>
      typeof m.role === 'string' &&
      typeof m.content === 'string' &&
      ['user', 'assistant'].includes(m.role),
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const gen = ragChatStream(body.message.trim(), history);
        for await (const chunk of gen) {
          if (chunk.type === 'context') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'context', cards: chunk.cards.map(c => ({ id: c.id, title: c.title, source: c.source })) })}\n\n`)
            );
          } else if (chunk.type === 'action') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'action', action: chunk.result.toolName, summary: chunk.result.summary, success: chunk.result.success })}\n\n`)
            );
          } else {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'token', content: chunk.content })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
