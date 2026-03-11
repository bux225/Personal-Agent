import { NextRequest, NextResponse } from 'next/server';
import { getLLMService } from '@/lib/llm';
import { retrieveContext } from '@/lib/rag';
import { getCardById } from '@/lib/cards';

// POST /api/compose — AI-assisted message drafting
// Body: { prompt, destination, relatedCardIds?, to? }
export async function POST(request: NextRequest) {
  const body = await request.json() as {
    prompt: string;
    destination: 'email' | 'teams' | 'clipboard';
    relatedCardIds?: string[];
    to?: string[];
  };

  if (!body.prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // Gather context from related cards and/or RAG
  const contextParts: string[] = [];

  // If specific cards referenced, include them
  if (body.relatedCardIds?.length) {
    for (const cardId of body.relatedCardIds) {
      const card = getCardById(cardId);
      if (card) {
        contextParts.push(`[CARD: ${card.title}]\n${card.content}`);
      }
    }
  }

  // Also do RAG retrieval for additional context
  try {
    const ragCards = await retrieveContext(body.prompt, 3);
    for (const card of ragCards) {
      // Avoid duplicates
      if (body.relatedCardIds?.includes(card.id)) continue;
      contextParts.push(`[CARD: ${card.title}]\n${card.content}`);
    }
  } catch {
    // RAG context is optional — continue without it
  }

  const contextBlock = contextParts.length > 0
    ? `\n\nRelevant context from the knowledge base:\n${contextParts.join('\n\n')}`
    : '';

  const destinationInstructions: Record<string, string> = {
    email: 'Write a professional email. Include an appropriate subject line on the first line prefixed with "Subject: ". The rest is the email body.',
    teams: 'Write a concise Teams chat message. Keep it conversational and to the point.',
    clipboard: 'Write clear, well-structured content suitable for copying and pasting.',
  };

  const systemPrompt = `You are a helpful writing assistant for a personal knowledge base. 
${destinationInstructions[body.destination] || destinationInstructions.clipboard}

Use the following context to inform your response. Only reference information from the context if it's relevant.
${contextBlock}

Guidelines:
- Be concise and clear
- Match the tone appropriate for the destination
- Do not invent facts not present in the context
- If writing an email, include "Subject: <subject>" on the first line`;

  const llm = getLLMService();

  try {
    const response = await llm.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: body.prompt },
    ]);

    // Parse subject from email drafts
    let subject = '';
    let content = response;

    if (body.destination === 'email') {
      const lines = response.split('\n');
      const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'));
      if (subjectLine) {
        subject = subjectLine.replace(/^subject:\s*/i, '').trim();
        content = lines.filter(l => l !== subjectLine).join('\n').trim();
      }
    }

    return NextResponse.json({
      subject,
      content,
      destination: body.destination,
      relatedCardIds: body.relatedCardIds ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Compose error:', err);
    return NextResponse.json({ error: `AI draft failed: ${msg}` }, { status: 500 });
  }
}
