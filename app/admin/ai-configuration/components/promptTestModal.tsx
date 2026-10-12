"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toApiErrorMessage } from "@/lib/api/apiErrorMessage";
import type { PromptTestResult } from "@/lib/types/aiConfiguration";

interface PromptTestModalProps {
  versionLabel: string;
  body: string;
  onTest: (body: string, question: string) => Promise<PromptTestResult>;
  onClose: () => void;
}

const TEST_FAILED_MESSAGE = "Couldn't run the test. Please try again.";

// Asks the live model one sample question under this prompt. Nothing is saved.
export const PromptTestModal = ({ versionLabel, body, onTest, onClose }: PromptTestModalProps) => {
  const [question, setQuestion] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PromptTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsRunning(true);
    setTestError(null);
    try {
      setResult(await onTest(body, question.trim()));
    } catch (error) {
      setTestError(toApiErrorMessage(error, TEST_FAILED_MESSAGE));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal title={`Test prompt — ${versionLabel}`} onClose={onClose} widthClassName="w-[640px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        <div className="flex gap-2.5">
          <Input
            className="flex-1"
            placeholder="Can I run the pump dry for 30 seconds?"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={4000}
            required
            autoFocus
          />
          <Button type="submit" variant="primary" disabled={!question.trim() || isRunning}>
            {isRunning ? "Running…" : "Ask"}
          </Button>
        </div>
        {testError && <span className="text-xs text-danger">{testError}</span>}
        {result && (
          <div className="flex flex-col gap-2">
            <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-fillGray p-3 text-sm text-ink">
              {result.answer || "(empty answer)"}
            </div>
            <span className="text-xs text-mutedGray">
              {result.modelId} · {result.inputTokens.toLocaleString()} in / {result.outputTokens.toLocaleString()} out ·{" "}
              {(result.latencyMs / 1000).toFixed(1)}s{result.stopReason === "refusal" ? " · refused" : ""}
            </span>
          </div>
        )}
      </form>
    </Modal>
  );
};
