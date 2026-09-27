"use client";

import { useState } from "react";
import { toApiErrorMessage } from "../api/apiErrorMessage";

const UPLOAD_FAILED_MESSAGE = "Upload failed. Please try again.";

type UploadRunner<TResult> = (file: File, onProgress: (fraction: number) => void) => Promise<TResult>;

// Progress/error state around one upload at a time. `upload` resolves to
// the endpoint's response, or null when it failed (see errorMessage).
export const useFileUpload = <TResult>(runUpload: UploadRunner<TResult>) => {
  const [progress, setProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const upload = async (file: File): Promise<TResult | null> => {
    setErrorMessage(null);
    setProgress(0);
    try {
      return await runUpload(file, setProgress);
    } catch (error) {
      setErrorMessage(toApiErrorMessage(error, UPLOAD_FAILED_MESSAGE));
      return null;
    } finally {
      setProgress(null);
    }
  };

  return { upload, progress, isUploading: progress !== null, errorMessage };
};
