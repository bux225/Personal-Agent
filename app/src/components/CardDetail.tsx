'use client';

import { useState } from 'react';
import type { Card } from '@/lib/types';

const SOURCE_COLORS: Record<string, string> = {
  note: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  reference: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  email: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  teams: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  document: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
};

interface CardDetailProps {
  card: Card;
  onDelete: (id: string) => void;
}

export default function CardDetail({ card, onDelete }: CardDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  };

  const isSafeUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`inline-block rounded px-2 py-0.5 text-xs font-medium uppercase ${
                SOURCE_COLORS[card.source] ?? 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {card.source}
            </span>
            <span className="text-sm text-zinc-400">
              {formatDate(card.createdAt)}
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {card.title}
          </h2>
        </div>

        {/* Delete */}
        <div className="flex gap-2">
          {confirmDelete ? (
            <>
              <button
                onClick={() => onDelete(card.id)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              aria-label="Delete this card"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-500 hover:border-red-300 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* URL */}
      {card.url && isSafeUrl(card.url) && (
        <div className="mb-4">
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            {card.url}
          </a>
        </div>
      )}

      {/* Content */}
      <div className="prose prose-zinc max-w-none dark:prose-invert">
        <div className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
          {card.content}
        </div>
      </div>

      {/* Tags */}
      {card.tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {card.tags.map(tag => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* People */}
      {card.people.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {card.people.map(person => (
            <span
              key={person}
              className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              {person}
            </span>
          ))}
        </div>
      )}

      {/* Metadata footer */}
      {card.updatedAt !== card.createdAt && (
        <p className="mt-6 text-xs text-zinc-400">
          Updated {formatDate(card.updatedAt)}
        </p>
      )}
    </div>
  );
}
