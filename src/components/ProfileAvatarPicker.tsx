import { useEffect, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import {
  PROFESSIONAL_PROFILE_VISUALS,
  STICKER_PROFILE_VISUALS,
  resolveProfileVisualPreset,
} from "../utils/profileVisuals";
import { ProfileAvatar } from "./ProfileAvatar";

function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}

interface ProfileAvatarPickerProps {
  authorId: string;
  avatarId?: string | null;
  username: string;
  isSaving?: boolean;
  errorMessage?: string | null;
  onSave: (avatarId: string) => void | Promise<void>;
  onClose: () => void;
}

export function ProfileAvatarPicker({
  authorId,
  avatarId,
  username,
  isSaving = false,
  errorMessage,
  onSave,
  onClose,
}: ProfileAvatarPickerProps) {
  const currentPresetId = resolveProfileVisualPreset(authorId, avatarId).id;
  const [selectedAvatarId, setSelectedAvatarId] = useState(currentPresetId);

  useEffect(() => {
    setSelectedAvatarId(currentPresetId);
  }, [currentPresetId]);

  const hasChanged = selectedAvatarId !== currentPresetId;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 pt-16 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/65 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="relative bg-gradient-to-r from-slate-950 via-emerald-900 to-teal-700 px-6 py-6 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/85 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close avatar picker"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-100">
            Profile Picture
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Choose your tech identity
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">
            Pick a polished working avatar or a bold tech sticker. Older
            profiles keep a sticker fallback until you choose something new.
          </p>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[320px,1fr]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              Live Preview
            </p>
            <div className="mt-4 flex flex-col items-center rounded-[28px] bg-white px-5 py-6 text-center shadow-sm">
              <ProfileAvatar
                authorId={authorId}
                avatarId={selectedAvatarId}
                username={username}
                size="xl"
                className="border-slate-200"
              />
              <p className="mt-4 text-lg font-black text-slate-900">
                @{username}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {resolveProfileVisualPreset(authorId, selectedAvatarId).description}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                {resolveProfileVisualPreset(authorId, selectedAvatarId).category ===
                "professional"
                  ? "Professional avatar"
                  : "Tech sticker"}
              </div>
            </div>

            {errorMessage && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {errorMessage}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => void onSave(selectedAvatarId)}
                disabled={!hasChanged || isSaving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Check className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save photo"}
              </button>
              <button
                onClick={onClose}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <ProfileVisualSection
              title="Professional Avatars"
              description="People-first portraits with laptops, desks, and different tech work styles."
              presets={PROFESSIONAL_PROFILE_VISUALS}
              selectedAvatarId={selectedAvatarId}
              authorId={authorId}
              username={username}
              onSelect={setSelectedAvatarId}
            />

            <ProfileVisualSection
              title="Sticker Avatars"
              description="Tech-flavored sticker picks for playful identities, legacy accounts, and retro vibes."
              presets={STICKER_PROFILE_VISUALS}
              selectedAvatarId={selectedAvatarId}
              authorId={authorId}
              username={username}
              onSelect={setSelectedAvatarId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileVisualSection({
  title,
  description,
  presets,
  selectedAvatarId,
  authorId,
  username,
  onSelect,
}: {
  title: string;
  description: string;
  presets: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  selectedAvatarId: string;
  authorId: string;
  username: string;
  onSelect: (avatarId: string) => void;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-black text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {presets.map((preset) => {
          const isSelected = preset.id === selectedAvatarId;

          return (
            <button
              key={preset.id}
              onClick={() => onSelect(preset.id)}
              className={cn(
                "rounded-[24px] border p-4 text-left transition-all",
                isSelected
                  ? "border-emerald-400 bg-emerald-50 shadow-[0_12px_30px_rgba(16,185,129,0.15)]"
                  : "border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-white",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <ProfileAvatar
                  authorId={authorId}
                  avatarId={preset.id}
                  username={username}
                  size="lg"
                  className={isSelected ? "border-emerald-200" : "border-slate-200"}
                />
                {isSelected && (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm font-bold text-slate-900">
                {preset.label}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
