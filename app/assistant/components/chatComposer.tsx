"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons/icon";
import { usePermissions } from "@/lib/auth/usePermissions";
import { PERMISSIONS, describeMissingPermission } from "@/lib/auth/permissionCodes";
import { useFilePicker } from "@/lib/uploads/useFilePicker";
import { downscalePhoto } from "@/lib/uploads/downscalePhoto";
import { useSpeechDictation } from "@/lib/hooks/useSpeechDictation";
import type { AttachedPhoto } from "@/lib/types/aiAssistant";

interface ChatComposerProps {
  // Resolves false when the question wasn't answered, to restore it.
  onAsk: (question: string, photo: AttachedPhoto | null) => Promise<boolean>;
  isAnswering: boolean;
  hasMachineContext: boolean;
}

const iconButtonClasses =
  "flex h-9 w-9 flex-none items-center justify-center rounded-lg text-slate-400 hover:bg-fillGray hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50";

export const ChatComposer = ({ onAsk, isAnswering, hasMachineContext }: ChatComposerProps) => {
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<AttachedPhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const { isLoaded, can } = usePermissions();
  const canAsk = isLoaded && can(PERMISSIONS.useAiAssistant);
  const deniedMessage = isLoaded && !canAsk ? describeMissingPermission(PERMISSIONS.useAiAssistant) : undefined;
  const dictation = useSpeechDictation((text) => setDraft((current) => (current ? `${current} ${text}` : text)));
  const photoPicker = useFilePicker("image/*", (file) => {
    setPhotoError(null);
    downscalePhoto(file)
      .then(setPhoto)
      .catch((error: unknown) => setPhotoError(error instanceof Error ? error.message : "Couldn't use that photo."));
  });
  const canSend = canAsk && !isAnswering && draft.trim().length >= 2;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    const question = draft.trim();
    const sentPhoto = photo;
    dictation.stop();
    setDraft("");
    setPhoto(null);
    if (!(await onAsk(question, sentPhoto))) {
      setDraft(question);
      setPhoto(sentPhoto);
    }
  };

  const placeholder = deniedMessage
    ? "Your role doesn't include the AI assistant"
    : hasMachineContext
      ? "Ask about this machine…"
      : "Ask about a fault, spec or procedure…";

  return (
    <form onSubmit={handleSubmit} className="flex flex-none flex-col gap-2" title={deniedMessage}>
      {photoPicker.input}
      {(photo || photoError) && (
        <div className="flex items-center gap-2">
          {photo && (
            <span className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL preview */}
              <img src={photo.previewUrl} alt="Photo to send" className="h-16 w-16 rounded-lg border border-borderGray object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPhoto(null)}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white"
              >
                <Icon name="x" className="h-3 w-3 stroke-white" />
              </button>
            </span>
          )}
          {photoError && <span className="text-xs text-danger">{photoError}</span>}
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <div className="flex h-11 flex-1 items-center gap-1 rounded-lg border border-borderGrayStrong bg-surface pl-3 pr-1">
          {deniedMessage && <Icon name="lock" className="h-4 w-4 stroke-mutedGray" />}
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={dictation.isListening ? "Listening…" : placeholder}
            maxLength={4000}
            disabled={!canAsk}
            className="w-full flex-1 border-none bg-transparent text-[15px] text-ink outline-none placeholder:text-mutedGray disabled:cursor-not-allowed"
          />
          <button type="button" aria-label="Attach a photo" onClick={photoPicker.open} disabled={!canAsk || isAnswering} className={iconButtonClasses}>
            <Icon name="camera" className="stroke-current" />
          </button>
        </div>
        {dictation.isSupported && (
          <button
            type="button"
            aria-label={dictation.isListening ? "Stop voice input" : "Voice input"}
            aria-pressed={dictation.isListening}
            onClick={dictation.isListening ? dictation.stop : dictation.start}
            disabled={!canAsk}
            className={`${iconButtonClasses} ${dictation.isListening ? "bg-primaryTint text-primary" : ""}`}
          >
            <Icon name="mic" className="stroke-current" />
          </button>
        )}
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-primary text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name="send" />
        </button>
      </div>
    </form>
  );
};
