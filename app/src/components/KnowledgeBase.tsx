'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card } from '@/lib/types';
import CardDetail from './CardDetail';
import ChatPanel from './ChatPanel';
import SettingsPanel from './SettingsPanel';
import OutboxPanel from './OutboxPanel';
import IngestForm from './IngestForm';
import DigestPanel from './DigestPanel';

type ViewMode = 'list' | 'settings' | 'outbox' | 'ingest' | 'digest';

const SOURCE_COLORS: Record<string, string> = {
  note: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  reference: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  email: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  teams: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  document: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
};

export default function KnowledgeBase() {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Handle OAuth callback query params (?authError=... or ?authSuccess=true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('authError');
    const authSuccess = params.get('authSuccess');
    if (authError) {
      setAuthMessage({ type: 'error', text: decodeURIComponent(authError) });
      setViewMode('settings');
    } else if (authSuccess) {
      setAuthMessage({ type: 'success', text: 'Account connected successfully!' });
      setViewMode('settings');
    }
    // Clean up URL
    if (authError || authSuccess) {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const fetchCards = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setFetchError('');
    try {
      let url: string;
      if (searchQuery.trim()) {
        url = `/api/cards/search?q=${encodeURIComponent(searchQuery.trim())}`;
      } else {
        const params = new URLSearchParams({ limit: '100' });
        if (sourceFilter) params.set('source', sourceFilter);
        url = `/api/cards?${params.toString()}`;
      }
      const res = await fetch(url, { signal: abortRef.current.signal });
      if (!res.ok) throw new Error(`Failed to load cards (${res.status})`);
      const data = await res.json();
      setCards(data.cards ?? []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Failed to load cards:', err);
      setFetchError(err instanceof Error ? err.message : 'Failed to load cards');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sourceFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchCards, searchQuery ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchCards, searchQuery]);

  useEffect(() => {
    if (selectedCard) {
      const stillExists = cards.find(c => c.id === selectedCard.id);
      if (!stillExists) setSelectedCard(null);
    }
  }, [cards, selectedCard]);

  const handleDelete = async (id: string) => {
    await fetch(`/api/cards/${id}`, { method: 'DELETE' });
    setSelectedCard(null);
    fetchCards();
  };

  const handleFormSaved = () => {
    setViewMode('list');
    fetchCards();
  };

  const handleFormCancel = () => {
    setViewMode('list');
  };

  // Called when chat creates a note, reference, or email draft
  const handleChatAction = () => {
    fetchCards();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside className="flex w-80 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header + Search */}
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Knowledge Base
            </h1>
            <button
              onClick={() => { setViewMode('settings'); setSelectedCard(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label="Settings"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search cards…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 pl-9 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {/* Source filter pills */}
          <div className="mt-2 flex flex-wrap gap-1">
            {['all', 'note', 'reference', 'email', 'teams'].map(s => (
              <button
                key={s}
                onClick={() => setSourceFilter(s === 'all' ? null : s)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  (s === 'all' && !sourceFilter) || sourceFilter === s
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Card list */}
        <div className="flex-1 overflow-y-auto">
          {fetchError ? (
            <div className="m-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {fetchError}
            </div>
          ) : loading ? (
            <div className="p-4 text-center text-sm text-zinc-400">Loading…</div>
          ) : cards.length === 0 ? (
            <div className="p-4 text-center text-sm text-zinc-400">
              {searchQuery ? 'No results found.' : 'No cards yet. Use the chat to save notes and references.'}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cards.map(card => (
                <li key={card.id}>
                  <button
                    onClick={() => { setSelectedCard(card); setViewMode('list'); }}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                      selectedCard?.id === card.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${SOURCE_COLORS[card.source] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {card.source}
                      </span>
                      <span className="text-xs text-zinc-400">{formatDate(card.createdAt)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{card.title}</p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{card.content}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer: card count + action buttons */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <span className="text-xs text-zinc-400">
            {cards.length} card{cards.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setViewMode(viewMode === 'digest' ? 'list' : 'digest'); setSelectedCard(null); }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'digest'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Digest
            </button>
            <button
              onClick={() => { setViewMode(viewMode === 'outbox' ? 'list' : 'outbox'); setSelectedCard(null); }}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === 'outbox'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              Outbox
            </button>
          </div>
        </div>
      </aside>

      {/* Main content: top 2/3 content + bottom 1/3 chat */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top panel: card detail, settings, outbox, etc. */}
        <div className="flex-[2] overflow-y-auto border-b border-zinc-200 dark:border-zinc-800">
          {viewMode === 'settings' ? (
            <SettingsPanel onClose={() => { setViewMode('list'); setAuthMessage(null); }} onDataCleared={() => { fetchCards(); setSelectedCard(null); }} onDataChanged={fetchCards} authMessage={authMessage} onDismissAuthMessage={() => setAuthMessage(null)} />
          ) : viewMode === 'digest' ? (
            <DigestPanel />
          ) : viewMode === 'outbox' ? (
            <OutboxPanel />
          ) : viewMode === 'ingest' ? (
            <IngestForm onSaved={handleFormSaved} onCancel={handleFormCancel} />
          ) : selectedCard ? (
            <CardDetail card={selectedCard} onDelete={handleDelete} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center text-zinc-400">
                <svg className="mx-auto mb-3 h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-sm">Select a card to view details</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom panel: always-on chat */}
        <div className="flex-[1] min-h-0 bg-white dark:bg-zinc-900">
          <ChatPanel onAction={handleChatAction} />
        </div>
      </main>
    </div>
  );
}
