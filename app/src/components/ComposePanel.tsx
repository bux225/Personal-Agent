'use client';

import { useState } from 'react';

type Destination = 'email' | 'teams' | 'clipboard';

export default function ComposePanel({ onDrafted }: { onDrafted: () => void }) {
  const [prompt, setPrompt] = useState('');
  const [destination, setDestination] = useState<Destination>('email');
  const [to, setTo] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState('');

  // Draft preview state
  const [preview, setPreview] = useState<{ subject: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleDraft = async () => {
    if (!prompt.trim()) return;
    setDrafting(true);
    setError('');
    setPreview(null);

    try {
      const res = await fetch('/api/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          destination,
          to: to.trim() ? to.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed (${res.status})`);
      }

      const data = await res.json();
      setPreview({ subject: data.subject, content: data.content });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Draft failed');
    } finally {
      setDrafting(false);
    }
  };

  const handleSaveToDraft = async () => {
    if (!preview) return;
    setSaving(true);
    setError('');

    try {
      const recipients = to.trim() ? to.split(',').map(s => s.trim()).filter(Boolean) : [];
      const res = await fetch('/api/outbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          subject: preview.subject,
          content: preview.content,
          to: recipients,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed (${res.status})`);
      }

      // Reset form
      setPrompt('');
      setTo('');
      setPreview(null);
      onDrafted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Compose</h2>

      {/* Destination selector */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Destination
        </label>
        <div className="flex gap-2">
          {(['email', 'teams', 'clipboard'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDestination(d)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                destination === d
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              {d === 'email' ? 'Email' : d === 'teams' ? 'Teams' : 'Clipboard'}
            </button>
          ))}
        </div>
      </div>

      {/* Recipients (for email) */}
      {destination === 'email' && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            To
          </label>
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="email@example.com, another@example.com"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
          />
        </div>
      )}

      {/* Prompt */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          What do you want to write?
        </label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={
            destination === 'email'
              ? 'e.g., Write a follow-up email to the team about the project status update from last week…'
              : destination === 'teams'
                ? 'e.g., Let the team know the deploy is done…'
                : 'e.g., Summarize the key points from my meeting notes…'
          }
          rows={4}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Draft button */}
      {!preview && (
        <button
          onClick={handleDraft}
          disabled={!prompt.trim() || drafting}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {drafting ? 'Drafting…' : 'Draft with AI'}
        </button>
      )}

      {/* Preview */}
      {preview && (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Draft Preview</h3>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                Draft
              </span>
            </div>
            {preview.subject && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Subject: {preview.subject}
              </p>
            )}
          </div>
          <div className="p-4">
            <pre className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
              {preview.content}
            </pre>
          </div>
          <div className="flex gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <button
              onClick={handleSaveToDraft}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save to Outbox'}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Discard
            </button>
            <button
              onClick={handleDraft}
              disabled={drafting}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {drafting ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
