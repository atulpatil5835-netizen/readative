import { type ChangeEvent, useEffect, useState } from "react";
import { Check, ImagePlus, X } from "lucide-react";
import { type KnowledgeImageAsset } from "../types";
import { ProfileAvatar } from "./ProfileAvatar";
import { ReadativeLoader } from "./ReadativeLoader";

interface ProfileAvatarPickerProps {
  currentImage?: KnowledgeImageAsset | null;
  username: string;
  isSaving?: boolean;
  errorMessage?: string | null;
  onSave: (image: KnowledgeImageAsset) => void | Promise<void>;
  onClose: () => void;
}

export function ProfileAvatarPicker({
  currentImage = null,
  username,
  isSaving = false,
  errorMessage,
  onSave,
  onClose,
}: ProfileAvatarPickerProps) {
  const [selectedImage, setSelectedImage] = useState<KnowledgeImageAsset | null>(
    null,
  );
  const [previewImage, setPreviewImage] = useState<KnowledgeImageAsset | null>(
    currentImage,
  );
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedImage(null);
    setPreviewImage(currentImage);
    setLocalError(null);
  }, [currentImage]);

  const combinedError = localError || errorMessage;
  const handleClose = () => {
    if (isSaving || isOptimizing) {
      return;
    }

    onClose();
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsOptimizing(true);
    setLocalError(null);

    try {
      const { optimizeProfileImageFile } = await import(
        "../utils/profileImageOptimizer"
      );
      const optimizedImage = await optimizeProfileImageFile(file);
      setSelectedImage(optimizedImage);
      setPreviewImage(optimizedImage);
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Could not prepare this image right now.",
      );
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-4 pt-16 backdrop-blur-sm">
      <div className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-white/65 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="relative bg-gradient-to-r from-slate-950 via-emerald-900 to-teal-700 px-6 py-6 text-white">
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/85 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close photo uploader"
          >
            <X className="h-4 w-4" />
          </button>

          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-100">
            Profile Picture
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight">
            Upload a square profile photo
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50">
            Choose one image and we will center-crop it to a square, compress it,
            and keep it lightweight for faster loading across the app.
          </p>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[260px,1fr]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
              Live Preview
            </p>
            <div className="mt-4 flex flex-col items-center rounded-[28px] bg-white px-5 py-6 text-center shadow-sm">
              <ProfileAvatar
                image={previewImage}
                username={username}
                size="2xl"
                className="border-slate-200"
              />
              <p className="mt-4 text-lg font-black text-slate-900">@{username}</p>
              <p className="mt-1 text-sm text-slate-500">
                {previewImage
                  ? `${previewImage.width} x ${previewImage.height} optimized`
                  : "No uploaded photo yet. Your initials will be shown until you add one."}
              </p>
            </div>

            {combinedError && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {combinedError}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => selectedImage && void onSave(selectedImage)}
                disabled={!selectedImage || isSaving || isOptimizing}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Check className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save photo"}
              </button>
              <button
                onClick={handleClose}
                disabled={isSaving || isOptimizing}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Choose an image
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  JPG, PNG, and WebP are supported. We automatically optimize the
                  final image before it is saved.
                </p>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700">
                {isOptimizing ? (
                  <ReadativeLoader size="xs" tone="light" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {previewImage ? "Replace photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelected}
                  disabled={isOptimizing || isSaving}
                  className="hidden"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <InfoCard
                title="Square crop"
                body="The image is center-cropped to 1:1 so every avatar stays neat in cards, comments, and profile pages."
              />
              <InfoCard
                title="Fast loading"
                body="Profile photos are compressed down to a lightweight size that suits small avatar slots across the app."
              />
              <InfoCard
                title="Sharp preview"
                body="The optimized version is what gets saved, so the preview closely matches how it will look to everyone else."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </div>
  );
}
