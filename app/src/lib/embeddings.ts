import { getDb } from './db';

// === EmbeddingService interface ===

export interface EmbeddingService {
  embed(texts: string[]): Promise<number[][]>;
  dimensions: number;
  model: string;
}

// === GitHub Models implementation ===

export class GitHubModelsEmbedding implements EmbeddingService {
  readonly model: string;
  readonly dimensions: number;
  private endpoint: string;
  private token: string;

  constructor(options?: { model?: string; dimensions?: number; endpoint?: string }) {
    this.model = options?.model ?? 'text-embedding-3-small';
    this.dimensions = options?.dimensions ?? 1536;
    this.endpoint = options?.endpoint ?? 'https://models.inference.ai.azure.com';
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error('GITHUB_TOKEN environment variable is required for embeddings');
    this.token = token;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.endpoint}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
        dimensions: this.dimensions,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Embedding API error (${res.status}): ${errorText}`);
    }

    const data = await res.json() as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    // Sort by index to match input order
    return data.data
      .sort((a, b) => a.index - b.index)
      .map(d => d.embedding);
  }
}

// === Vector storage (SQLite BLOB) ===

function float32ToBlob(vec: number[]): Buffer {
  const buf = Buffer.alloc(vec.length * 4);
  for (let i = 0; i < vec.length; i++) {
    buf.writeFloatLE(vec[i], i * 4);
  }
  return buf;
}

function blobToFloat32(buf: Buffer): number[] {
  if (buf.length % 4 !== 0) {
    throw new Error(`Invalid embedding buffer size: ${buf.length}, must be divisible by 4`);
  }
  const vec: number[] = [];
  for (let i = 0; i < buf.length; i += 4) {
    vec.push(buf.readFloatLE(i));
  }
  return vec;
}

export function storeEmbedding(cardId: string, embedding: number[], model: string): void {
  const db = getDb();
  const blob = float32ToBlob(embedding);
  db.prepare(`
    INSERT OR REPLACE INTO card_embeddings (card_id, embedding, model, dimensions, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(cardId, blob, model, embedding.length);
}

export function getEmbedding(cardId: string): number[] | null {
  const db = getDb();
  const row = db.prepare('SELECT embedding FROM card_embeddings WHERE card_id = ?').get(cardId) as { embedding: Buffer } | undefined;
  if (!row) return null;
  try {
    return blobToFloat32(row.embedding);
  } catch (err) {
    console.error(`Failed to decode embedding for card ${cardId}:`, err);
    return null;
  }
}

// === Cosine similarity search ===

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

interface SimilarityResult {
  cardId: string;
  score: number;
}

export function findSimilarCards(queryEmbedding: number[], topK = 5): SimilarityResult[] {
  const db = getDb();
  const rows = db.prepare('SELECT card_id, embedding FROM card_embeddings').all() as Array<{
    card_id: string;
    embedding: Buffer;
  }>;

  const results: SimilarityResult[] = rows.map(row => ({
    cardId: row.card_id,
    score: cosineSimilarity(queryEmbedding, blobToFloat32(row.embedding)),
  }));

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

// === Singleton factory ===

let embeddingService: EmbeddingService | null = null;

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new GitHubModelsEmbedding();
  }
  return embeddingService;
}
