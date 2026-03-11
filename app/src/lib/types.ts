// === Card: the universal unit of knowledge ===

export type CardSourceType = 'note' | 'reference' | 'email' | 'teams' | 'document';

export interface Card {
  id: string;
  source: CardSourceType;
  title: string;
  content: string;
  url?: string;
  people: string[];
  tags: string[];
  metadata: Record<string, string>;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

export interface CreateCardInput {
  source: CardSourceType;
  title: string;
  content: string;
  url?: string;
  people?: string[];
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface UpdateCardInput {
  title?: string;
  content?: string;
  url?: string;
  people?: string[];
  tags?: string[];
  metadata?: Record<string, string>;
}

// === Outbox: pending outputs ===

export type DestinationType = 'clipboard' | 'email' | 'teams';
export type OutboxStatus = 'draft' | 'approved' | 'sent';

export interface OutboxItem {
  id: string;
  destination: DestinationType;
  subject: string;
  content: string;
  to: string[];                     // email addresses or Teams chat IDs
  relatedCards: string[];
  status: OutboxStatus;
  metadata: Record<string, string>; // destination-specific fields (chatId, threadId, etc.)
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutboxInput {
  destination: DestinationType;
  subject: string;
  content: string;
  to?: string[];
  relatedCards?: string[];
  metadata?: Record<string, string>;
}

// === Service interfaces (config-driven) ===

export type LLMProvider = 'githubCopilot' | 'azureOpenAI' | 'local';
export type EmbeddingProvider = 'githubModels' | 'azureOpenAI' | 'local';
export type AccountProvider = 'microsoft' | 'github';

export interface LLMConfig {
  provider: LLMProvider;
  endpoint: string;
  model: string;
  accountRef: string;
}

export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  endpoint: string;
  model: string;
  accountRef: string;
}

export interface AccountConfig {
  id: string;
  name: string;
  provider: AccountProvider;
  tenantId?: string;
  clientId: string;
  scopes: string[];
  envKey: string;
  enabled: boolean;
}

export interface AppConfig {
  accounts: AccountConfig[];
  llm: LLMConfig;
  embeddings: EmbeddingConfig;
  polling: {
    emailIntervalSeconds: number;
    teamsIntervalSeconds: number;
  };
}
