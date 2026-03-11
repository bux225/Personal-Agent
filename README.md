# Personal Knowledge Base Agent

A chat-first personal knowledge base that captures, searches, and synthesizes information from notes, URL references, emails, and Teams chats — all as unified "Cards" with AI-powered retrieval (RAG + LLM).

The LLM chat is always visible and serves as the primary interface. You can ask questions, draft emails, save notes, and bookmark references — all through natural language.

## Tech Stack

- **Framework**: Next.js 16 + TypeScript + Tailwind CSS 4
- **Database**: SQLite (better-sqlite3) with FTS5 full-text search
- **AI**: GitHub Models API (text-embedding-3-small for embeddings, gpt-4o for chat with tool calling)
- **Auth**: MSAL.js for Microsoft Graph OAuth
- **Design**: Config-driven — protocol + config + factory pattern for all external services

## Getting Started

```bash
cd app

# Install dependencies
npm install

# Create env file with your tokens
cat > .env.local << 'EOF'
GITHUB_TOKEN=your_github_pat_here
MS_CLIENT_SECRET=your_azure_secret_here
EOF

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes (for AI) | GitHub PAT with `models:read` scope |
| `MS_CLIENT_SECRET` | For Graph | Azure AD app client secret |

> **Want to connect Microsoft email and Teams?** See the [Microsoft Graph Setup Guide](./docs/microsoft-graph-setup.md) for step-by-step instructions.

## Project Structure

```
app/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/
│   │   │   ├── cards/          # Card CRUD + search
│   │   │   ├── chat/           # Streaming AI chat (SSE) with tool calling
│   │   │   ├── compose/        # AI-assisted message drafting
│   │   │   ├── embed/          # Embedding management
│   │   │   ├── outbox/         # Outbox CRUD + send
│   │   │   ├── digest/         # Daily digest generation
│   │   │   ├── ingest/         # Document ingestion
│   │   │   ├── accounts/       # Account CRUD
│   │   │   ├── auth/microsoft/ # OAuth login + callback
│   │   │   ├── poll/           # Email + Teams polling
│   │   │   ├── import/         # Edge history import
│   │   │   └── dev/reset/      # Database clear (dev only)
│   │   └── page.tsx            # Main entry point
│   ├── components/             # React UI components
│   │   ├── KnowledgeBase.tsx   # Main layout (sidebar + detail + chat)
│   │   ├── ChatPanel.tsx       # Always-on AI chat with tool actions
│   │   ├── CardDetail.tsx      # Card viewer
│   │   ├── OutboxPanel.tsx     # Draft review + send
│   │   ├── DigestPanel.tsx     # Daily digest
│   │   └── SettingsPanel.tsx   # Account management + polling + data tools
│   └── lib/                    # Core logic
│       ├── types.ts            # All TypeScript interfaces
│       ├── db.ts               # SQLite + migrations
│       ├── cards.ts            # Card CRUD + FTS5
│       ├── llm.ts              # LLM service (streaming + tool calling)
│       ├── rag.ts              # RAG orchestration with tool support
│       ├── chat-tools.ts       # Tool definitions + execution
│       ├── embeddings.ts       # Vector embeddings
│       ├── auth.ts             # MSAL.js OAuth
│       ├── tokens.ts           # Token + watermark storage
│       ├── graph.ts            # Microsoft Graph API client
│       ├── outbox.ts           # Outbox CRUD
│       ├── autotag.ts          # LLM-based auto-tagging
│       ├── digest.ts           # Daily digest generation
│       ├── ingest.ts           # URL document ingestion
│       └── adapters/           # Source adapters
│           ├── email.ts        # Graph emails → Cards
│           └── teams.ts        # Teams chats → Cards
requirements/                   # Design docs
```

## Features

- **Chat-first UI** — always-on chat panel at the bottom; ask questions, draft emails, save notes, bookmark URLs
- **LLM tool calling** — the AI creates notes, saves references, and drafts emails/Teams messages automatically
- **RAG search** — semantic + full-text search across all cards
- **Microsoft Graph** — poll Outlook email and Teams chats into cards
- **Outbox** — review AI-drafted messages before sending
- **Daily digest** — LLM-generated summary of recent activity
- **Auto-tagging** — LLM suggests tags for new cards
- **Document ingestion** — fetch and chunk web pages into cards
- **Edge history import** — import browser history as reference cards
