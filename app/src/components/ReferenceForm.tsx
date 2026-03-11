'use client';

import { useState, useCallback } from 'react';

interface ReferenceFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

export default function ReferenceForm({ onSaved, onCancel }: ReferenceFormProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    // Try to get a URL from the drop
    const droppedUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (droppedUrl && /^https?:\/\/.+/.test(droppedUrl.trim())) {
      setUrl(droppedUrl.trim());
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!url.trim() || !title.trim()) {
      setError('URL and title are required.');
      return;
    }

    if (title.trim().length > 200) {
      setError('Title must be 200 characters or less.');
      return;
    }

    if (description.trim().length > 50000) {
      setError('Description must be 50,000 characters or less.');
      return;
    }

    let isValidUrl = false;
    try {
      const parsed = new URL(url.trim());
      isValidUrl = ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      isValidUrl = false;
    }
    if (!isValidUrl) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'reference',
          title: title.trim(),
          content: description.trim() || `Reference: ${url.trim()}`,
          url: url.trim(),
          tags: tags
            .split(',')
            .map(t => t.trim())
            .filter(Boolean),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to save reference');
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl p-8">
      <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        New Reference
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Drop zone for URL */}
        <div>
          <label htmlFor="ref-url" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            URL
          </label>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`rounded-lg border-2 border-dashed transition-colors ${
              dragOver
                ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/40'
                : 'border-zinc-300 dark:border-zinc-700'
            }`}
          >
            <input
              id="ref-url"
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste or drag & drop a URL here…"
              autoFocus
              className="w-full rounded-lg border-0 bg-transparent px-3 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>
          <p className="mt-1 text-xs text-zinc-400">Drag a link from your browser or paste a URL</p>
        </div>

        <div>
          <label htmlFor="ref-title" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Title
          </label>
          <input
            id="ref-title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What is this reference?"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="ref-desc" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description <span className="text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="ref-desc"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Why is this useful? Any notes about this link…"
            rows={4}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>

        <div>
          <label htmlFor="ref-tags" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Tags <span className="text-zinc-400">(comma-separated, optional)</span>
          </label>
          <input
            id="ref-tags"
            type="text"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="sharepoint, budget, project"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Reference'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
