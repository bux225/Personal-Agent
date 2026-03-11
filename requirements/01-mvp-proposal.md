# MVP Proposal — Personal Knowledge Base Agent

## Problem Statement

You lose time and context switching between email, Teams, OneDrive, and notes apps. When you need to find something, you don't remember *where* it lives. When you need to compose something, you need context scattered across multiple tools. The tax is cognitive, not technical.

## Core Value Proposition

**One place to capture, find, and act on everything from your work day.**

## What Does NOT Belong in MVP

- Teams integration (requires separate Graph permissions, more complex message threading)
- OneDrive document ingestion (complex parsing: Word, Excel, PowerPoint)
- Edge history mining (nice-to-have, not core)
- Auto-tagging, daily digests, smart summaries
- Outbox review queue (can start with just drafts in a text field you copy/paste)

## MVP Scope

| Feature | Why it's in MVP |
|---|---|
| **Quick note capture** | Immediate daily value from day one. Zero dependencies. |
| **URL reference bookmarks** | Drag/drop a link + description. Replaces sticky notes and "where was that file" moments. |
| **Full-text search across all cards** | The first "aha" — finding things in one place instead of four. |
| **AI chat over your knowledge base** | The differentiator. "What did I note about the Q3 budget?" and it *finds it*. |

## User Journey (MVP)

1. Open app. It's always running in the menu bar or as a window.
2. Jot a note: *"Sarah said budget approval is delayed until March 20"* → saved, indexed.
3. Drop a URL: *sharepoint.com/sites/project/budget_v3.xlsx* with note *"latest budget spreadsheet"* → saved, indexed.
4. Later: ask the AI *"What do I know about the budget?"* → it surfaces the note + the reference link.
5. Say *"Draft an email to Jim asking about budget timeline based on what Sarah told me"* → it generates a draft you can copy into Outlook.

## MVP Success Criteria

- You use it for one full work week and capture >80% of your notes/references there
- You successfully retrieve something via AI that you would've had to hunt for manually
- You feel less anxiety about "losing track" of things

## Input Sources

| Source | How | Notes |
|---|---|---|
| **Manual notes** | Type directly in app | First-class citizen, immediate indexing |
| **URL references** | Drag/drop or paste a URL + description | Lightweight — stores URL + metadata, not file contents |
| **On-demand doc fetch** | Explicitly request "ingest this" for a finished document | Pulls content via Graph API, chunks, embeds |

## Output Channels (MVP)

| Channel | MVP Behavior |
|---|---|
| **Clipboard** | AI generates draft → you copy/paste into email/Teams |

## Output Channels (Post-MVP)

| Channel | Behavior |
|---|---|
| **Email** | Composed in-app → Outbox → review → send via Graph API |
| **Teams** | Composed in-app → Outbox → review → send via Graph API |
| **File save** | Export notes/summaries to disk or OneDrive |

## Key Design Decisions

### OneDrive = Reference Tracker, Not File Sync

Instead of pulling file contents, build a **bookmark/reference index**:
- Drag/drop a URL → app stores the URL + title/description
- Optional: Edge history mining for SharePoint/OneDrive URLs
- On-demand fetch: when a doc is final, explicitly ingest content into KB

### Notes = First-Class, Replaces Obsidian

- Quick capture: text box, always available, minimal friction
- Auto-timestamped, auto-tagged (LLM can suggest tags)
- Immediately indexed and searchable
- Meeting notes flow: jot raw bullets → later ask agent to produce structured minutes

### Safety Layer for Outputs

| Channel | Draft Behavior |
|---|---|
| **Email** | Composed in-app → Outbox → review → hit Send → Graph API fires |
| **Teams** | Same pattern: Outbox → review → hit Send → Graph API posts |

Everything lives in a single **Outbox queue** with a source tag. Optional daily outbox review.
