// === LLMService interface ===

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Extended message type supporting tool calls */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type StreamChunk =
  | { type: 'token'; content: string }
  | { type: 'tool_calls'; calls: ToolCall[] };

export interface LLMService {
  chat(messages: ChatMessage[]): Promise<string>;
  chatStream(messages: ChatMessage[]): AsyncGenerator<string>;
  chatStreamWithTools(messages: LLMMessage[], tools?: ToolDefinition[]): AsyncGenerator<StreamChunk>;
  model: string;
}

// === GitHub Copilot / Models implementation ===

export class GitHubCopilotLLM implements LLMService {
  readonly model: string;
  private endpoint: string;
  private token: string;

  constructor(options?: { model?: string; endpoint?: string }) {
    this.model = options?.model ?? 'gpt-4o';
    this.endpoint = options?.endpoint ?? 'https://models.inference.ai.azure.com';
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN environment variable is required for LLM');
    this.token = token;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const res = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`LLM API error (${res.status}): ${errorText}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content ?? '';
  }

  async *chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
    const res = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`LLM API error (${res.status}): ${errorText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data) as {
              choices: Array<{ delta: { content?: string } }>;
            };
            const content = parsed.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async *chatStreamWithTools(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
  ): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: true,
    };
    if (tools?.length) body.tools = tools;

    const res = await fetch(`${this.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`LLM API error (${res.status}): ${errorText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    const accumulatedToolCalls = new Map<number, { id: string; name: string; arguments: string }>();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            if (accumulatedToolCalls.size > 0) {
              const calls: ToolCall[] = [];
              for (const [, tc] of accumulatedToolCalls) {
                calls.push({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } });
              }
              yield { type: 'tool_calls', calls };
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.content) {
              yield { type: 'token', content: delta.content };
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!accumulatedToolCalls.has(idx)) {
                  accumulatedToolCalls.set(idx, { id: tc.id || '', name: tc.function?.name || '', arguments: '' });
                }
                const existing = accumulatedToolCalls.get(idx)!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name = tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              }
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      // Final flush for tool calls
      if (accumulatedToolCalls.size > 0) {
        const calls: ToolCall[] = [];
        for (const [, tc] of accumulatedToolCalls) {
          calls.push({ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } });
        }
        yield { type: 'tool_calls', calls };
      }
    } finally {
      reader.releaseLock();
    }
  }
}

// === Singleton factory ===

let llmService: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!llmService) {
    llmService = new GitHubCopilotLLM();
  }
  return llmService;
}
