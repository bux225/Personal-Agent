# Personal Knowledge Base — User Manual

Welcome! This app is your personal second brain — one place to capture notes, save links, pull in your emails and Teams messages, ask questions about everything you've saved, and even draft and send messages. Everything you add is searchable and available to the AI assistant.

---

## The Layout

The app has two main areas:

- **Left sidebar** — Your card list, search bar, filters, and navigation buttons
- **Right panel** — Whatever you're currently looking at (a card, the chat, compose, etc.)

---

## Cards: The Building Blocks

Everything in the app is a **card**. A card is just a piece of information — it could be a note you typed, a link you saved, an email that was pulled in, or a Teams message. Each card has:

- A **colored label** showing where it came from (blue = Note, purple = Reference, amber = Email, indigo = Teams, green = Document)
- A **title** and **content**
- **Tags** (the AI automatically suggests tags when you create a card)
- A **date** showing when it was created

### Viewing a Card

Click any card in the left sidebar to see its full details in the right panel. You'll see all the content, tags, people mentioned, and a link if one was saved.

### Deleting a Card

When viewing a card, there's a delete option. It'll ask you to confirm before removing it.

---

## Creating New Cards

Click the **+** button in the top-right corner of the sidebar. A dropdown appears with three options:

### Note
For jotting down anything — meeting notes, reminders, ideas, quick thoughts.

1. Click **+** → **Note**
2. Type a **title** (what's this about?)
3. Type the **content** (the actual note)
4. Optionally add **tags** separated by commas (e.g., `budget, project, q3`)
5. Click **Save**

The AI will automatically suggest additional tags after saving.

### URL Reference
For bookmarking a link with a description — a SharePoint file, a web article, anything with a URL.

1. Click **+** → **URL Reference**
2. Paste the **URL**
3. Add a **title** and **description** so you'll remember what it is
4. Optionally add **tags**
5. Click **Save**

*Tip: You can also drag and drop a URL into the form.*

### Ingest Document
For pulling in the full text content of a web page so the AI can reference it later.

1. Click **+** → **Ingest Document**
2. Paste the **URL** of the page you want to import
3. Optionally give it a **title** (otherwise it'll pick one automatically)
4. Click **Ingest**

The app will fetch the page, extract the text, break it into chunks if it's long, and save each chunk as a card. Each card gets automatically tagged and embedded so the AI can find it later.

---

## Searching & Filtering

### Search
Type anything into the **search bar** at the top of the sidebar. Results update as you type. It searches across titles, content, and tags.

### Source Filters
Below the search bar you'll see filter pills: **All**, **Note**, **Reference**, **Email**, **Teams**. Click one to show only cards from that source. Click **All** to show everything again.

---

## The Bottom Bar

At the bottom of the sidebar you'll see a card count and five buttons:

| Button | What it does |
|--------|-------------|
| **Digest** | Get an AI-generated summary of your recent activity |
| **Compose** | Write a message with AI help and save it to your outbox |
| **Outbox** | Review, approve, and send your drafted messages |
| **Chat** | Ask the AI questions about anything in your knowledge base |

---

## Chat — Ask the AI Anything

This is the star of the show. Click **Chat** in the bottom bar.

Type a question in plain English and the AI will search through all your cards to find relevant information and give you an answer. Examples:

- *"What did Sarah say about the budget?"*
- *"Summarize my meeting notes from this week"*
- *"What emails have I gotten about the project deadline?"*
- *"When is the Q3 review?"*

The AI will show you which cards it used to build its answer (listed as sources below the response), so you can click through and verify.

**Tips:**
- You can have a back-and-forth conversation — it remembers the context
- The more cards you have, the better the answers get
- If it says it can't find something, try rephrasing or check that the information was actually saved as a card

---

## Compose — Write Messages with AI Help

Click **Compose** in the bottom bar when you want to draft an email or Teams message.

1. **Pick a destination**: Email, Teams, or Clipboard
2. If email, enter the **To** address(es) — separate multiple with commas
3. Describe **what you want to write** in plain English, e.g.:
   - *"Write a follow-up email to Jim about the budget timeline based on my notes from last week"*
   - *"Draft a Teams message to the team saying the deploy is done"*
4. Click **Draft with AI**

The AI will search your knowledge base for relevant context and write a draft for you. You'll see a preview with:

- **Save to Outbox** — saves it as a draft you can review and send later
- **Discard** — throw it away and start over
- **Regenerate** — ask the AI to try again

---

## Outbox — Review & Send

Click **Outbox** in the bottom bar to see everything you've drafted.

### Status Filters
At the top you can filter by: **All**, **Draft**, **Approved**, **Sent**

### The Workflow

Every message goes through three stages:

1. **Draft** — Just saved, not ready to send yet. You can review and edit.
2. **Approved** — You've reviewed it and it's ready to go.
3. **Sent** — It's been delivered.

### Actions

Click on any item to expand it and see the full content. Depending on the status, you'll see different buttons:

| Status | Available Actions |
|--------|------------------|
| **Draft** | **Approve** (move to approved), **Delete** |
| **Approved** | **Send** (actually delivers it), **Revert to Draft** (go back and edit), **Delete** |
| **Sent** | View only — it's been delivered |

**Important:** The app will always ask you to approve before sending. Nothing goes out without your explicit approval.

---

## Digest — Your Daily Summary

Click **Digest** in the bottom bar for an AI-generated summary of what's happened recently.

1. Choose a time period: **Today**, **3 days**, or **7 days**
2. Click **Generate**

You'll get:
- **Stats** — how many new cards, broken down by source, pending drafts
- **Summary** — an AI-written overview of key themes, people, and action items
- **Highlights** — a quick list of recent cards

Great for a morning catch-up or end-of-day review.

---

## Settings

Click the **gear icon** (⚙) in the top-right of the sidebar.

### Microsoft Accounts
Your Microsoft account should already be connected. You can see its status here. If it shows as connected and enabled, emails and Teams messages will be pulled in when you click the poll buttons.

### Polling for New Messages
In settings, you'll see buttons to pull in new emails and Teams messages:

- **Poll Email** — checks your inbox for new messages and creates cards
- **Poll Teams** — checks your Teams chats for new messages and creates cards

These only pull in *new* messages since the last time you polled. Duplicates are automatically skipped.

### Browser History Import
You can import your recent Microsoft Edge browsing history as reference cards:

1. Set how many **days back** to look (default: 7)
2. Click **Import from Edge**

Pages you've visited will be saved as reference cards with the URL and page title. Duplicates are skipped.

---

## Quick Tips

- **Save everything** — The more you put in, the smarter the AI gets. Quick notes, links, emails — all of it builds your knowledge base.
- **Use Chat often** — Instead of scrolling through cards, just ask the AI. It's faster.
- **Check your Digest** — Start or end your day with a digest to stay on top of things.
- **Compose saves time** — Instead of writing emails from scratch, tell the AI what you want and let it draft for you using context from your cards.
- **Tags happen automatically** — You don't need to worry about organizing. The AI tags everything for you.
- **Search is powerful** — It searches across everything: titles, content, tags, people. Just type what you're looking for.

---

## Keyboard Shortcuts

The app is primarily mouse/touch driven. Use **Tab** to move between fields in forms and **Enter** to submit.

---

*That's it! The app is designed to be simple — save things, search things, ask the AI, and send messages. If something doesn't work right, let Matt know.*
