import { useState } from "react";
import { Globe2, Lock, Save, X } from "lucide-react";
import { KnowledgeVisibility } from "../../types";
import { normalizeKnowledgeVisibility } from "../../utils/knowledgePrivacy";
import { EditPostModalProps } from "./cardTypes";

export function EditPostModal({
  entry,
  onClose,
  onSave,
}: EditPostModalProps) {
  const [title, setTitle] = useState(entry.title);
  const [content, setContent] = useState(entry.content);
  const [hashtagInput, setHashtagInput] = useState(
    entry.hashtags.map((tag) => `#${tag}`).join(" "),
  );
  const [visibility, setVisibility] = useState<KnowledgeVisibility>(
    normalizeKnowledgeVisibility(entry.visibility),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (!nextTitle || !nextContent || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await onSave({
        title: nextTitle,
        content: nextContent,
        hashtagInput,
        visibility,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update this post right now.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-3 pt-16 backdrop-blur-sm sm:p-4 sm:pt-20">
      <div className="readative-dialog-surface relative w-full max-w-2xl overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close edit post"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            Edit Post
          </p>
          <h2 className="mt-1 pr-10 text-2xl font-black tracking-tight text-slate-950">
            Update knowledge
          </h2>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {(
              [
                ["public", "Public", Globe2],
                ["private", "Private", Lock],
              ] as const
            ).map(([nextVisibility, label, Icon]) => (
              <button
                key={nextVisibility}
                type="button"
                onClick={() => setVisibility(nextVisibility)}
                aria-pressed={visibility === nextVisibility}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                  visibility === nextVisibility
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Post title"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />

          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Write your post. Tag people with @username."
            className="min-h-[190px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[15px] leading-7 text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Hashtags
            </p>
            <input
              value={hashtagInput}
              onChange={(event) => setHashtagInput(event.target.value)}
              placeholder="#science #history #productivity"
              className="w-full bg-transparent text-sm text-slate-700 outline-none"
            />
          </div>

          {errorMessage && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !title.trim() || !content.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
