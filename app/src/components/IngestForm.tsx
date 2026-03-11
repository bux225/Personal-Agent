'use client';

import { useState } from 'react';

interface IngestFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

export default function IngestForm({ onSaved, onCancel }: IngestFormProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    try {
      new URL(url.trim());
    } catch {
      setError('Invalid URL');
      return;
    }

    setIngesting(true);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed (${res.status})`);
      }

      setResult({ imported: data.imported, errors: data.errors });

      if (data.imported > 0) {
        // Auto-navigate back after brief delay
        setTimeout(onSaved, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingestion failed');
    } finally {
      setIngesting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl p-8">
      <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        Ingest Document
      </h2>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        Fetch a web page or document by URL. The content will be extracted, chunked if large, and added to your knowledge base with auto-tagging and embeddings.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className={`mb-4 rounded-lg px-4 py-2 text-sm ${
          result.imported > 0
            ? 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
        }`}>
          <p>Imported {result.imported} card{result.imported !== 1 ? 's' : ''}</p>
          {result.errors.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="ingest-url" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            URL
          </label>
          <input
            id="ingest-url"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/document"
            autoFocus
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="ingest-title" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Title <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <input
            id="ingest-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Auto-detected from URL or content"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={ingesting}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ingesting ? 'Ingesting…' : 'Ingest'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={ingesting}
          className="rounded-lg border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
