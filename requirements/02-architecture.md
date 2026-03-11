# Architecture — Personal Knowledge Base Agent

## Guiding Principles

> **Nothing above the adapter layer should ever know the word "email", "Teams", or "OneDrive". Everything is a Card going in and an OutboxItem going out.**

If you follow that, adding a new source is a weekend project, not a rewrite.

> **Every external dependency is configured, not hardcoded. Swapping a provider or adding an account is a config change, not a code change.**

This means: protocols for capabilities, configuration records for credentials/endpoints, factories to wire them together.

## High-Level Architecture

```
┌────────────────────────────────────────────────┐
│  UI Layer (SwiftUI)                            │
│  Inbox │ Compose │ Chat │ Outbox │ Settings    │
├────────────────────────────────────────────────┤
│  Application Services                          │
│  CardService │ SearchService │ OutboxService   │
├────────────────────────────────────────────────┤
│  AI Layer                                      │
│  EmbeddingService │ LLMService │ RAGService    │
├────────────────────────────────────────────────┤
│  Persistence                                   │
│  SQLite (cards + FTS5) │ Vector Index          │
├────────────────────────────────────────────────┤
│  Source/Destination Adapters  ← plug in later  │
│  NoteSource │ URLSource │ EmailSource │ ...    │
└────────────────────────────────────────────────┘
```

## Core Domain Model

```
Protocol: CardSource        Protocol: CardDestination
  - poll() -> [Card]          - send(Card) -> Result
  - name: String              - name: String

Implementations:             Implementations:
  ManualNoteSource             ClipboardDestination  (MVP)
  URLReferenceSource           EmailDestination      (Phase N)
  EmailSource      (later)     TeamsDestination      (Phase N)
  TeamsSource      (later)     FileDestination       (Phase N)
  DocumentSource   (later)
```

### Card (Universal Unit)

```typescript
type CardSourceType = 'note' | 'reference' | 'email' | 'teams' | 'document';

interface Card {
  id: string;                          // UUID
  source: CardSourceType;
  content: string;                     // raw text content
  url?: string;                        // external reference if applicable
  people: string[];                    // extracted or tagged people
  tags: string[];                      // auto or manual tags
  metadata: Record<string, string>;    // extensible — source-specific fields
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
}
```

### OutboxItem (Pending Output)

```typescript
type DestinationType = 'clipboard' | 'email' | 'teams';
type OutboxStatus = 'draft' | 'approved' | 'sent';

interface OutboxItem {
  id: string;                          // UUID
  destination: DestinationType;
  content: string;
  relatedCards: string[];              // UUIDs of context cards
  status: OutboxStatus;
}
```

## Extensibility

| When you add... | What changes | What doesn't change |
|---|---|---|
| Email polling | Add `EmailSource` conforming to `CardSource` | Card model, search, AI layer, UI |
| Teams polling | Add `TeamsSource` conforming to `CardSource` | Card model, search, AI layer, UI |
| Send email | Add `EmailDestination` conforming to `CardDestination` | Outbox model, UI, review flow |
| Doc ingestion | Add `DocumentSource` + chunking logic | Card model, search, AI layer |
| Better embeddings | Swap embedding provider | Everything else |
| Different LLM | Swap LLM service | Everything else |

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **UI** | Next.js (React) + Tailwind CSS | Full-stack in one framework, hot reload, excellent Copilot support |
| **Language** | TypeScript | One language front + back, strong typing, huge ecosystem |
| **Persistence** | SQLite via better-sqlite3 | FTS5 for text search, synchronous, single file DB, no server |
| **Vector store** | SQLite + custom table (MVP), swap to Qdrant later | At <100K cards, brute-force cosine similarity is fine |
| **LLM** | GitHub Copilot Chat Completions API | Already have access, OpenAI-compatible |
| **Embeddings** | GitHub Models API (MVP), local model later | Avoids shipping a model binary in v1 |
| **Auth** | MSAL.js / passport.js (when adding Graph) | Microsoft's official lib for web |
| **Secrets** | Environment variables + .env.local | Standard Next.js pattern, gitignored |
| **Config** | JSON config in project root | All external service wiring is configuration, not code |

### Why Web Over Native macOS

- **Path to sharing**: deploy to a server later, no rewrite
- **AI/RAG ecosystem**: LangChain, LlamaIndex, etc. are first-class in TypeScript/Python
- **Speed of iteration**: save → refresh vs. compile → run
- **Copilot effectiveness**: larger TypeScript training corpus = better completions
- **Multi-device future**: already a server, just deploy it
- **Containers**: skip for now, trivial Dockerfile when needed

## Configuration-Driven Design

### Problem

The app will need to work against multiple accounts (personal vs. work Microsoft 365, personal vs. work GitHub) and multiple LLM backends (GitHub Copilot, Azure OpenAI, Microsoft Copilot, local models). Hardcoding any of this creates refactoring debt.

### Three Dimensions of Configurability

1. **Accounts** — same service, different credentials (personal vs. work Microsoft 365)
2. **Service Providers** — same capability, different backend (GitHub Copilot → Azure OpenAI)
3. **Environment** — dev vs. production, local-only vs. cloud-connected

### Protocol + Config + Factory Pattern

Every external dependency gets:
1. A **protocol** (what it does — never changes)
2. A **configuration record** (how to connect — changes per environment/account)
3. A **factory** (builds the right implementation from config)

```typescript
// Interface — stable contract
interface LLMService {
  chat(messages: ChatMessage[], stream: boolean): AsyncGenerator<string>;
}

// Config — all the variability lives here
interface LLMConfig {
  provider: 'githubCopilot' | 'azureOpenAI' | 'local';
  endpoint: string;
  model: string;
  accountRef: string;  // key into env vars / .env.local for credentials
}

// Factory — wires config to implementation
function createLLMService(config: LLMConfig): LLMService {
  switch (config.provider) {
    case 'githubCopilot': return new GitHubCopilotLLM(config);
    case 'azureOpenAI':   return new AzureOpenAILLM(config);
    case 'local':         return new LocalLLM(config);
  }
}
```

Same pattern for every external service:

| Capability | Protocol | Swappable Implementations |
|---|---|---|
| **LLM Chat** | `LLMService` | `GitHubCopilotLLM`, `AzureOpenAILLM`, `LocalLLM` |
| **Embeddings** | `EmbeddingService` | `GitHubModelsEmbedding`, `AzureEmbedding`, `LocalEmbedding` |
| **Email** | `CardSource` + `CardDestination` | `MSGraphEmailAdapter(account: personal)`, `MSGraphEmailAdapter(account: work)` |
| **Teams** | `CardSource` + `CardDestination` | `MSGraphTeamsAdapter(account: personal)`, `MSGraphTeamsAdapter(account: work)` |

### Account Management

```typescript
interface AccountConfig {
  id: string;                      // UUID
  name: string;                    // "Personal Microsoft 365", "Work Microsoft 365"
  provider: 'microsoft' | 'github';
  tenantId?: string;               // Azure AD tenant ("consumers" for personal, org domain for work)
  clientId: string;                // OAuth app registration
  scopes: string[];                // what permissions this account grants
  envKey: string;                  // environment variable name holding the token
  enabled: boolean;                // toggle accounts on/off without deleting
}
```

Multiple accounts of the same type coexist. Each adapter instance binds to a specific account. The inbox shows cards from all enabled accounts, tagged by source account.

### App Configuration File

All wiring lives in a single config file (stored in project root as `config.json`, editable via Settings UI):

```json
{
  "accounts": [
    {
      "id": "...",
      "name": "Personal Microsoft 365",
      "provider": "microsoft",
      "clientId": "abc123",
      "tenantId": "consumers",
      "scopes": ["Mail.ReadWrite", "Chat.ReadWrite"],
      "enabled": true
    },
    {
      "id": "...",
      "name": "Work Microsoft 365",
      "provider": "microsoft",
      "clientId": "def456",
      "tenantId": "myorg.onmicrosoft.com",
      "scopes": ["Mail.ReadWrite", "Chat.ReadWrite", "Files.Read"],
      "enabled": false
    },
    {
      "id": "...",
      "name": "Personal GitHub",
      "provider": "github",
      "clientId": "...",
      "scopes": ["copilot"],
      "enabled": true
    }
  ],
  "llm": {
    "provider": "githubCopilot",
    "endpoint": "https://api.githubcopilot.com/chat/completions",
    "model": "gpt-4o",
    "accountRef": "Personal GitHub"
  },
  "embeddings": {
    "provider": "githubModels",
    "endpoint": "https://models.github.ai/inference",
    "model": "text-embedding-3-small",
    "accountRef": "Personal GitHub"
  },
  "polling": {
    "emailIntervalSeconds": 60,
    "teamsIntervalSeconds": 30
  }
}
```

### Switching Providers

To switch from GitHub Copilot to Azure OpenAI — change the `llm` block:
```json
{
  "llm": {
    "provider": "azureOpenAI",
    "endpoint": "https://myinstance.openai.azure.com/openai/deployments/gpt-4o/chat/completions",
    "model": "gpt-4o",
    "accountRef": "Work Azure"
  }
}
```
No code changes. The factory reads the new provider, builds `AzureOpenAILLM` instead of `GitHubCopilotLLM`.

### Secrets Management

- **All tokens and API keys** stored in `.env.local` (gitignored), referenced by `envKey` in config
- **Config file** stores only the env variable name, never the actual secret
- **OAuth tokens** managed by MSAL.js, persisted in encrypted session store
- **Settings UI** lets you add/remove accounts and trigger OAuth flows
- **In production** these would move to proper secrets management (Azure Key Vault, etc.)

## Build Phases

### Phase 1 — Local Knowledge Base (MVP)
- App config model + JSON persistence + Settings UI stub
- TypeScript interfaces for `LLMService`, `EmbeddingService`, `CardSource`, `CardDestination`
- `.env.local` secrets pattern
- SQLite store with Card model
- Note capture + URL reference capture
- FTS5 full-text search
- Basic SwiftUI list/detail UI

### Phase 2 — AI Layer
- Embedding service (GitHub Models API)
- Vector storage in SQLite
- RAG retrieval: embed query → find top-K → build prompt
- LLM chat (Copilot API) with streaming responses
- Chat UI panel

### Phase 3 — Microsoft Graph Inputs
- OAuth flow with MSAL.swift
- `EmailSource` adapter → polls, creates cards
- `TeamsSource` adapter → polls, creates cards
- Unified inbox view with source filters

### Phase 4 — Outputs & Outbox
- Outbox model + review UI
- `EmailDestination` → send via Graph
- `TeamsDestination` → send via Graph
- Compose flow: AI drafts → outbox → review → send

### Phase 5 — Polish
- Edge history import
- On-demand document ingestion
- Auto-tagging
- Daily digest / smart summaries

## Data Flow

### Input Flow
```
External Source → Adapter.poll() → Card → SQLite + FTS5 Index + Vector Embedding
```

### Query Flow
```
User Query → Embed Query → Vector Similarity Search → Top-K Cards → LLM Prompt → Response
```

### Output Flow
```
AI Draft (or manual compose) → OutboxItem (.draft) → User Review → OutboxItem (.approved) → Adapter.send() → OutboxItem (.sent)
```

## API Integration Points

### GitHub Copilot Chat Completions API
```
POST https://api.githubcopilot.com/chat/completions
Authorization: Bearer <github_token>
Content-Type: application/json

{
    "model": "gpt-4o",
    "messages": [...],
    "stream": true
}
```

### Microsoft Graph API (Phase 3+)
```
# Email
GET  /me/messages                    — poll inbox
POST /me/sendMail                    — send email
POST /me/messages/{id}/reply         — reply to email

# Teams
GET  /me/chats/{id}/messages         — poll chat messages
POST /me/chats/{id}/messages         — send message

# OneDrive
GET  /me/drive/items/{id}/content    — fetch file content
```
