import {
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useMemo,
} from "react";
import {
  Globe2,
  ImagePlus,
  Lock,
  Send,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import {
  KnowledgeImageLayout,
  KnowledgeVisibility,
  UserProfile,
} from "../../types";
import { KnowledgeImageCarousel } from "../KnowledgeImageCarousel";
import { ReadativeLoader } from "../ReadativeLoader";
import {
  CONTENT_KIND_OPTIONS,
  KNOWLEDGE_CATEGORY_SUGGESTIONS,
  type KnowledgeContentKind,
  formatReadingMinutes,
  getContentQualityFeedback,
  suggestKnowledgeCategory,
  suggestKnowledgeTags,
} from "../../utils/contentIntelligence";
import {
  estimateReadMinutes,
  mergeHashtags,
  parseManualHashtags,
} from "../../utils/knowledgeEntryHelpers";
import { getKnowledgeImageLayoutSettings } from "../../utils/knowledgeImages";
import { type KnowledgeIdentity } from "../../utils/knowledgeIdentity";
import { type SelectedImage, type MentionState, type FeedMessage } from "./feedTypes";

export function ComposerModal({
  identity,
  onOpenProfile,
  onClose,
  draftTitle,
  setDraftTitle,
  draftContent,
  setDraftContent,
  draftContentKind,
  setDraftContentKind,
  draftCategory,
  setDraftCategory,
  draftVisibility,
  setDraftVisibility,
  hashtagInput,
  setHashtagInput,
  selectedImages,
  selectedImageLayout,
  onRemoveSelectedImage,
  isPosting,
  isModerating,
  isPreparingImage,
  feedMessage,
  handlePublish,
  handleImageSelected,
  contentRef,
  activeMention,
  filteredMentionProfiles,
  handleMentionInsert,
  handleContentKeyUp,
  updateMentionState,
}: {
  identity: KnowledgeIdentity | null;
  onOpenProfile: (authorId: string, username?: string) => void;
  onClose: () => void;
  draftTitle: string;
  setDraftTitle: (value: string) => void;
  draftContent: string;
  setDraftContent: (value: string) => void;
  draftContentKind: KnowledgeContentKind;
  setDraftContentKind: (value: KnowledgeContentKind) => void;
  draftCategory: string;
  setDraftCategory: (value: string) => void;
  draftVisibility: KnowledgeVisibility;
  setDraftVisibility: (value: KnowledgeVisibility) => void;
  hashtagInput: string;
  setHashtagInput: (value: string) => void;
  selectedImages: SelectedImage[];
  selectedImageLayout: KnowledgeImageLayout;
  onRemoveSelectedImage: (index: number) => void;
  isPosting: boolean;
  isModerating: boolean;
  isPreparingImage: boolean;
  feedMessage: FeedMessage | null;
  handlePublish: () => void;
  handleImageSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  contentRef: RefObject<HTMLTextAreaElement | null>;
  activeMention: MentionState | null;
  filteredMentionProfiles: UserProfile[];
  handleMentionInsert: (profile: UserProfile) => void;
  handleContentKeyUp: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  updateMentionState: (value: string, cursorPosition: number) => void;
}) {
  const selectedImageLayoutSettings =
    getKnowledgeImageLayoutSettings(selectedImageLayout);
  const selectedKind =
    CONTENT_KIND_OPTIONS.find((option) => option.id === draftContentKind) ||
    CONTENT_KIND_OPTIONS[0];
  const suggestedCategory = useMemo(
    () => suggestKnowledgeCategory(draftTitle, draftContent),
    [draftContent, draftTitle],
  );
  const suggestedTags = useMemo(
    () => suggestKnowledgeTags(draftTitle, draftContent),
    [draftContent, draftTitle],
  );
  const acceptedTags = useMemo(
    () => parseManualHashtags(hashtagInput),
    [hashtagInput],
  );
  const qualityFeedback = useMemo(
    () => getContentQualityFeedback(draftTitle, draftContent),
    [draftContent, draftTitle],
  );
  const readingMinutes = formatReadingMinutes(estimateReadMinutes(draftContent));
  const addSuggestedTag = (tag: string) => {
    const nextTags = mergeHashtags(acceptedTags, [tag]);
    setHashtagInput(nextTags.map((value) => `#${value}`).join(" "));
  };
  const isBusy = isPosting || isModerating || isPreparingImage;

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, onClose]);

  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center overflow-y-auto bg-slate-950/35 p-3 pt-16 backdrop-blur-sm sm:p-4 sm:pt-20">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="knowledge-composer-title"
        className="readative-dialog-surface relative flex w-full max-w-2xl flex-col overflow-hidden md:max-h-[calc(100vh-6rem)]"
      >
        <div className="shrink-0 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close composer"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
            New Post
          </p>
          <h2 id="knowledge-composer-title" className="mt-1 pr-10 text-2xl font-black tracking-tight text-slate-950">
            Create knowledge
          </h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 p-5 sm:p-6">
            {identity ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    Posting as @{identity.displayName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenProfile(identity.authorId, identity.displayName)}
                  className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700"
                >
                  Profile
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Sign in to publish.
              </div>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                What would you like to share?
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CONTENT_KIND_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDraftContentKind(option.id)}
                    aria-pressed={draftContentKind === option.id}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      draftContentKind === option.id
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/70"
                    }`}
                  >
                    <p className="text-sm font-black">{option.label}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] font-semibold opacity-75">
                      {option.helper}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
              {(
                [
                  ["public", "Public", Globe2],
                  ["private", "Private", Lock],
                ] as const
              ).map(([visibility, label, Icon]) => (
                <button
                  key={visibility}
                  type="button"
                  onClick={() => setDraftVisibility(visibility)}
                  aria-pressed={draftVisibility === visibility}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                    draftVisibility === visibility
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-4">
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                placeholder={`${selectedKind.label} title`}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />

              <div className="relative">
                <textarea
                  ref={contentRef}
                  value={draftContent}
                  onChange={(event) => {
                    setDraftContent(event.target.value);
                    updateMentionState(
                      event.target.value,
                      event.target.selectionStart,
                    );
                  }}
                  onKeyUp={handleContentKeyUp}
                  onClick={(event) =>
                    updateMentionState(
                      event.currentTarget.value,
                      event.currentTarget.selectionStart,
                    )
                  }
                  placeholder={`Write your ${selectedKind.label.toLowerCase()}. Tag people with @username.`}
                  className="min-h-[180px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 text-[15px] leading-7 text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />

                {activeMention && filteredMentionProfiles.length > 0 && (
                  <div className="absolute left-4 right-4 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    {filteredMentionProfiles.map((profile) => (
                      <button
                        type="button"
                        key={profile.id}
                        onClick={() => handleMentionInsert(profile)}
                        className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-emerald-50"
                      >
                        <span className="font-semibold text-slate-800">
                          @{profile.username}
                        </span>
                        <span className="text-xs text-slate-400">User</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-[1.2fr,1fr]">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    <Tag className="h-4 w-4" />
                    Category &amp; Tags
                  </div>
                  <div className="mb-3 space-y-2">
                    <select
                      value={draftCategory}
                      onChange={(event) => setDraftCategory(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none transition-colors focus:border-emerald-300 focus:bg-white"
                      aria-label="Post category"
                    >
                      <option value="">No category</option>
                      {KNOWLEDGE_CATEGORY_SUGGESTIONS.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    {suggestedCategory && draftCategory !== suggestedCategory.id && (
                      <button
                        type="button"
                        onClick={() => setDraftCategory(suggestedCategory.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 transition-colors hover:bg-emerald-100"
                      >
                        Use suggested {suggestedCategory.label}
                      </button>
                    )}
                  </div>
                  <input
                    value={hashtagInput}
                    onChange={(event) => setHashtagInput(event.target.value)}
                    placeholder="#ai #programming #productivity"
                    className="w-full bg-transparent text-sm text-slate-700 outline-none"
                  />
                  {suggestedTags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {suggestedTags.map((tag) => {
                        const isAccepted = acceptedTags.includes(tag);

                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => addSuggestedTag(tag)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-black transition-colors ${
                              isAccepted
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                            }`}
                          >
                            #{tag}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        Images (optional)
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {selectedImages.length}/{selectedImageLayoutSettings.maxImages} selected
                      </p>
                      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                        Add images if they help explain your insight.
                      </p>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700 transition-colors hover:bg-emerald-100">
                      <ImagePlus className="h-4 w-4" />
                      Add
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelected}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {selectedImages.length > 0 && (
                <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
                  <KnowledgeImageCarousel
                    images={selectedImages}
                    layout={selectedImageLayout}
                    altBase="Selected post image"
                    mode="composer"
                    renderOverlayAction={(_, index) => (
                      <button
                        type="button"
                        onClick={() => onRemoveSelectedImage(index)}
                        className="rounded-full bg-slate-950/55 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md transition-colors hover:bg-rose-500"
                      >
                        Remove
                      </button>
                    )}
                  />
                  <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {selectedImages.length} ready
                    </span>
                  </div>
                </div>
              )}

              {feedMessage && (
                <div
                  className={`rounded-3xl border px-4 py-4 text-sm ${
                    feedMessage.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }`}
                >
                  <p className="font-bold">{feedMessage.title}</p>
                  <p className="mt-1 leading-6">{feedMessage.body}</p>
                </div>
              )}

              {(draftTitle.trim() || draftContent.trim()) && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    qualityFeedback.tone === "strong"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : qualityFeedback.tone === "positive"
                        ? "border-sky-200 bg-sky-50 text-sky-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black">{qualityFeedback.label}</p>
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black">
                      {readingMinutes}
                    </span>
                  </div>
                  <p className="mt-1 leading-6">{qualityFeedback.hint}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePublish}
              disabled={
                isPosting ||
                isModerating ||
                isPreparingImage ||
                !draftTitle.trim() ||
                !draftContent.trim()
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
            >
              {isPosting || isModerating || isPreparingImage ? (
                <ReadativeLoader size="xs" tone="light" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isModerating ? "Checking..." : "Publish post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
