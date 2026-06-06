import React, { useState, useRef, useEffect } from "react";
import {
  KeyIcon,
  ShieldCheckIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  generateRandomBytes,
  hexFromBytes,
  hexToBytes,
  derivePassphraseKey,
  deriveVerificationKeyStandard,
  deriveVerificationKeyAdvanced,
  encryptVerificationToken,
  sha256,
  calculateChecksum,
} from "../helpers/crypto";
import { combineAnswers } from "../helpers/normalization";
import { RecoveryMetadata } from "../types";

const PREDEFINED_QUESTIONS = [
  "What was the name of your first pet?",
  "In what city were you born?",
  "What was your childhood nickname?",
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What was the make and model of your first car?",
  "Write a custom question...",
];

function CustomQuestionSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${open ? "z-50" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-8 px-2.5 flex items-center justify-between bg-[var(--input-bg)] border border-border rounded-sm text-left hover:border-border-strong focus:outline-none focus:border-accent transition-colors"
      >
        <span className="text-[11.5px] text-fg truncate">{value}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-3.5 h-3.5 text-fg-muted shrink-0 ml-1"
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-[var(--popover-bg)] border border-border rounded-sm shadow-xl max-h-48 overflow-y-auto p-1">
          {options.map((opt) => {
            const active = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm text-left text-[11.5px] transition-colors ${
                  active
                    ? "bg-[var(--command-active-bg)] text-fg"
                    : "text-fg-muted hover:bg-[var(--menu-hover-bg)] hover:text-fg"
                }`}
              >
                <span className="truncate">{opt}</span>
                {active && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-3.5 h-3.5 text-accent shrink-0 ml-1"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ConfigureRecoveryFormProps {
  onCancel: () => void;
  onComplete: () => void;
}

export function ConfigureRecoveryForm({ onCancel, onComplete }: ConfigureRecoveryFormProps) {
  const [mode, setMode] = useState<"standard" | "advanced">("standard");
  const [isSuccess, setIsSuccess] = useState(false);

  // Dynamic question-answer pairs (2 compulsory, up to 5 max)
  const [qas, setQas] = useState<
    { question: string; isCustom: boolean; customText: string; answer: string }[]
  >([
    { question: PREDEFINED_QUESTIONS[0], isCustom: false, customText: "", answer: "" },
    { question: PREDEFINED_QUESTIONS[1], isCustom: false, customText: "", answer: "" },
  ]);

  const [showAnswers, setShowAnswers] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  // Advanced mode state
  const [recoveryId, setRecoveryId] = useState("");
  const [recoverySecretHex, setRecoverySecretHex] = useState("");
  const [downloaded, setDownloaded] = useState(false);

  const ensureAdvancedKeyGenerated = () => {
    if (!recoveryId || !recoverySecretHex) {
      const secret = generateRandomBytes(32);
      const secretHex = hexFromBytes(secret);
      const id =
        "rec_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      setRecoveryId(id);
      setRecoverySecretHex(secretHex);
    }
  };

  const handleAddQuestion = () => {
    if (qas.length >= 5) return;
    setQas([
      ...qas,
      { question: PREDEFINED_QUESTIONS[0], isCustom: false, customText: "", answer: "" },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (index < 2) return;
    setQas(qas.filter((_, idx) => idx !== index));
  };

  const handleUpdateQA = (
    index: number,
    field: "question" | "customText" | "answer" | "isCustom",
    value: any,
  ) => {
    if (validationErrors[index]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
    setQas(
      qas.map((qa, idx) => {
        if (idx !== index) return qa;
        const updated = { ...qa, [field]: value };
        if (field === "question") {
          updated.isCustom = value === "Write a custom question...";
          if (!updated.isCustom) {
            updated.customText = "";
          }
        }
        return updated;
      }),
    );
  };

  const getFinalQuestionsAndAnswers = () => {
    const finalQuestions: string[] = [];
    const finalAnswers: string[] = [];
    for (let i = 0; i < qas.length; i++) {
      const q = qas[i];
      const qText = q.isCustom ? q.customText.trim() : q.question;
      const aText = q.answer.trim();
      finalQuestions.push(qText);
      finalAnswers.push(aText);
    }
    return { finalQuestions, finalAnswers };
  };

  const handleDownloadKey = async () => {
    const errors: Record<number, string> = {};
    for (let i = 0; i < qas.length; i++) {
      const qa = qas[i];
      const qText = qa.isCustom ? qa.customText.trim() : qa.question.trim();
      const aText = qa.answer.trim();
      if (!qText || (qa.isCustom && qText.length < 3)) {
        errors[i] = "Please write a valid custom question.";
      } else if (aText.length < 4) {
        errors[i] = "Answer must be at least 4 characters long.";
      }
    }
    const validatedQuestions = qas.map((qa) => (qa.isCustom ? qa.customText.trim() : qa.question.trim()));
    const uniqueQuestions = new Set(validatedQuestions.map((q) => q.toLowerCase()));
    if (uniqueQuestions.size !== validatedQuestions.length) {
      const seen = new Map<string, number>();
      validatedQuestions.forEach((q, idx) => {
        const lower = q.toLowerCase();
        if (seen.has(lower)) {
          errors[seen.get(lower)!] = "Duplicate question selected.";
          errors[idx] = "Duplicate question selected.";
        } else {
          seen.set(lower, idx);
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    if (!recoveryId || !recoverySecretHex) return;

    setLoading(true);
    try {
      const version = 1;
      const checksum = await calculateChecksum(version, recoveryId, recoverySecretHex);
      const fileData = {
        version,
        app: "Carbon SSH",
        created_at: new Date().toISOString(),
        recovery_id: recoveryId,
        recovery_secret: recoverySecretHex,
        checksum,
      };

      const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "carbon-recovery.key";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloaded(true);
      setError("");
    } catch (err) {
      setError("Failed to generate and download the recovery file.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const errors: Record<number, string> = {};
    for (let i = 0; i < qas.length; i++) {
      const qa = qas[i];
      const qText = qa.isCustom ? qa.customText.trim() : qa.question.trim();
      const aText = qa.answer.trim();
      if (!qText || (qa.isCustom && qText.length < 3)) {
        errors[i] = "Please write a valid custom question.";
      } else if (aText.length < 4) {
        errors[i] = "Answer must be at least 4 characters long.";
      }
    }
    const validatedQuestions = qas.map((qa) => (qa.isCustom ? qa.customText.trim() : qa.question.trim()));
    const uniqueQuestions = new Set(validatedQuestions.map((q) => q.toLowerCase()));
    if (uniqueQuestions.size !== validatedQuestions.length) {
      const seen = new Map<string, number>();
      validatedQuestions.forEach((q, idx) => {
        const lower = q.toLowerCase();
        if (seen.has(lower)) {
          errors[seen.get(lower)!] = "Duplicate question selected.";
          errors[idx] = "Duplicate question selected.";
        } else {
          seen.set(lower, idx);
        }
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    if (mode === "advanced" && !downloaded) {
      setError("Please generate and download your recovery key file first.");
      return;
    }

    const { finalQuestions, finalAnswers } = getFinalQuestionsAndAnswers();

    setError("");
    setLoading(true);
    try {
      const saltAnswers = generateRandomBytes(16);
      const saltVerification = generateRandomBytes(16);
      const iv = generateRandomBytes(12);
      const verificationToken = generateRandomBytes(32);
      const verificationTokenHash = await sha256(verificationToken);

      const combined = combineAnswers(finalAnswers);
      const kQuestions = await derivePassphraseKey(combined, saltAnswers);

      let metadata: RecoveryMetadata;

      if (mode === "advanced") {
        const secretBytes = hexToBytes(recoverySecretHex);
        const kAdvancedVerification = await deriveVerificationKeyAdvanced(
          secretBytes,
          kQuestions,
          saltVerification,
        );

        const { ciphertext, authTag } = await encryptVerificationToken(
          kAdvancedVerification,
          verificationToken,
          iv,
        );

        metadata = {
          version: 1,
          mode: "advanced",
          recoveryId,
          questions: finalQuestions,
          saltAnswersHex: hexFromBytes(saltAnswers),
          saltVerificationHex: hexFromBytes(saltVerification),
          aesIvHex: hexFromBytes(iv),
          aesAuthTagHex: hexFromBytes(authTag),
          encryptedVerificationTokenHex: hexFromBytes(ciphertext),
          verificationTokenHashHex: hexFromBytes(verificationTokenHash),
          createdAt: Date.now(),
        };
      } else {
        const kStandardVerification = await deriveVerificationKeyStandard(
          kQuestions,
          saltVerification,
        );

        const { ciphertext, authTag } = await encryptVerificationToken(
          kStandardVerification,
          verificationToken,
          iv,
        );

        metadata = {
          version: 1,
          mode: "standard",
          questions: finalQuestions,
          saltAnswersHex: hexFromBytes(saltAnswers),
          saltVerificationHex: hexFromBytes(saltVerification),
          aesIvHex: hexFromBytes(iv),
          aesAuthTagHex: hexFromBytes(authTag),
          encryptedVerificationTokenHex: hexFromBytes(ciphertext),
          verificationTokenHashHex: hexFromBytes(verificationTokenHash),
          createdAt: Date.now(),
        };
      }

      if (window.electron?.saveRecoveryMetadata) {
        await window.electron.saveRecoveryMetadata(metadata);
      } else {
        throw new Error("Electron API is not available");
      }

      setIsSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred during cryptographic setup.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
        <div className="w-12 h-12 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
          <CheckIcon className="w-6 h-6 text-success" strokeWidth={2.5} />
        </div>
        <div>
          <h4 className="text-[15px] font-bold text-fg">Recovery System Configured!</h4>
          <p className="text-xs text-fg-muted mt-1.5 leading-relaxed max-w-[280px]">
            {mode === "advanced"
              ? "Advanced Recovery is set up. Keep your recovery key file and answers in a safe location."
              : "Standard Recovery is set up. Keep your security answers safe."}
          </p>
        </div>
        <div className="pt-2">
          <Button
            size="sm"
            onClick={onComplete}
            className="bg-accent text-accent-fg hover:opacity-90 px-8 rounded-sm"
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-sm flex items-start gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Segmented Mode Switcher Tab Control */}
      <div className="p-0.5 flex rounded-sm bg-[var(--command-bg)] border border-border">
        <button
          type="button"
          onClick={() => {
            setMode("standard");
            setError("");
          }}
          className={`flex-1 h-7 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-sm transition-colors text-center cursor-pointer ${
            mode === "standard"
              ? "bg-[var(--command-active-bg)] text-fg"
              : "text-fg-dim hover:text-fg"
          }`}
        >
          <KeyIcon className="w-3.5 h-3.5 shrink-0" />
          Standard Recovery
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("advanced");
            ensureAdvancedKeyGenerated();
            setError("");
          }}
          className={`flex-1 h-7 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-sm transition-colors text-center cursor-pointer ${
            mode === "advanced"
              ? "bg-[var(--command-active-bg)] text-fg"
              : "text-fg-dim hover:text-fg"
          }`}
        >
          <ShieldCheckIcon className="w-3.5 h-3.5 shrink-0" />
          Advanced Recovery
        </button>
      </div>

      {/* Short description based on mode */}
      <div className="p-3 border border-warning/20 bg-warning/8 text-warning rounded-sm flex items-start gap-2 select-none">
        <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
        <p className="text-[11px] leading-relaxed text-warning">
          {mode === "standard"
            ? "Reset your vault password using answers to your personal security questions. (Recommended, you can change this configuration later)"
            : "Requires security answers and your downloaded secret recovery key file to reset your password. (For high-security environments, you can rotate or download this key again later)"}
        </p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between pb-1">
          <span className="text-[12.5px] font-bold text-fg-muted">
            Security Questions
          </span>
          <button
            type="button"
            onClick={() => setShowAnswers(!showAnswers)}
            className="text-[10px] font-medium text-fg-muted hover:text-fg flex items-center gap-1 bg-[var(--command-bg)]/40 hover:bg-[var(--command-bg)] border border-border/20 px-2 py-1 rounded-sm transition-colors cursor-pointer"
          >
            {showAnswers ? (
              <>
                <EyeSlashIcon className="w-3.5 h-3.5" /> Hide Answers
              </>
            ) : (
              <>
                <EyeIcon className="w-3.5 h-3.5" /> Show Answers
              </>
            )}
          </button>
        </div>

        <div className="space-y-1">
          {qas.map((qa, index) => (
            <div
              key={index}
              className="py-1.5 first:pt-0 border-b border-border/10 last:border-b-0 space-y-1.5 relative animate-in fade-in duration-150"
            >
              {validationErrors[index] && (
                <div className="absolute z-50 bg-destructive text-destructive-foreground text-[10.5px] font-bold px-2.5 py-1 rounded-sm shadow-lg -top-6 left-4 animate-in fade-in zoom-in-95 duration-100 select-none border border-destructive/20">
                  {validationErrors[index]}
                  <div className="absolute left-3 bottom-[-3.5px] w-1.5 h-1.5 bg-destructive rotate-45 border-r border-b border-destructive/20" />
                </div>
              )}
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold text-accent">
                Question {index + 1} {index < 2 && <span className="text-danger font-bold">*</span>}
              </span>
              {index >= 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveQuestion(index)}
                  className="text-[10px] text-danger hover:underline font-medium cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="space-y-2">
              <CustomQuestionSelect
                value={qa.isCustom ? "Write a custom question..." : qa.question}
                options={PREDEFINED_QUESTIONS}
                onChange={(val) => handleUpdateQA(index, "question", val)}
              />

              {qa.isCustom && (
                <Input
                  type="text"
                  value={qa.customText}
                  onChange={(e) => handleUpdateQA(index, "customText", e.target.value)}
                  placeholder="Type your own custom security question"
                  className="bg-[var(--input-bg)] border-border h-8 text-[11.5px] md:text-[11.5px] rounded-sm focus:border-accent"
                />
              )}

              <Input
                type={showAnswers ? "text" : "password"}
                value={qa.answer}
                onChange={(e) => handleUpdateQA(index, "answer", e.target.value)}
                placeholder="Enter answer (at least 4 characters)"
                className="bg-[var(--input-bg)] border-border h-8 text-[11.5px] md:text-[11.5px] rounded-sm focus:border-accent"
              />
            </div>
          </div>
        ))}
      </div>
    </div>

      {qas.length < 5 && (
        <button
          type="button"
          onClick={handleAddQuestion}
          className="w-full h-8 border border-dashed border-border/60 hover:border-accent text-fg-muted hover:text-accent rounded-sm text-xs font-semibold bg-transparent hover:bg-accent/5 transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <span>+ Add Optional Question</span>
          <span className="text-[10px] text-fg-dim font-normal">({qas.length}/5)</span>
        </button>
      )}

      {mode === "advanced" && (
        <div className="p-3 border border-border bg-[var(--bg-panel)] rounded-sm space-y-3">
          <h4 className="text-[12px] font-semibold text-fg flex items-center gap-1.5">
            <ArrowDownTrayIcon className="w-4 h-4 text-accent" />
            Download Recovery Key File
          </h4>
          <div className="p-3 border border-warning/20 bg-warning/8 text-warning rounded-sm flex items-start gap-2 select-none">
            <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
            <p className="text-[11px] leading-relaxed text-warning">
              Downloading `carbon-recovery.key` is compulsory. Both answers and this file are required to recover access.
            </p>
          </div>

          <div className="pt-1">
            <Button
              onClick={handleDownloadKey}
              disabled={loading}
              variant="outline"
              className="w-full flex items-center justify-center gap-2 h-8 text-xs rounded-sm cursor-pointer"
            >
              {downloaded ? (
                <>
                  <CheckIcon className="w-4 h-4 text-success" />
                  Key File Downloaded
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  Generate &amp; Download Key File
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center pt-2 border-t border-border/10">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="text-xs hover:bg-[var(--menu-hover-bg)] rounded-sm h-8 px-4"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={loading || (mode === "advanced" && !downloaded)}
          className="bg-accent text-accent-fg hover:opacity-90 text-xs rounded-sm font-semibold h-8 px-4"
        >
          {loading ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}

interface ConfigureRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConfigureRecoveryModal({
  isOpen,
  onClose,
  onSuccess,
}: ConfigureRecoveryModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-[var(--border-strong)] bg-[var(--popover-bg)] text-fg rounded-sm pt-5 [&>button]:top-5">
        <DialogHeader className="space-y-0.5">
          <DialogTitle className="text-fg font-sans text-[16px] font-bold">
            Configure Account Recovery
          </DialogTitle>
          <DialogDescription className="text-xs text-fg-dim leading-relaxed">
            Select a recovery method to reset your password if you forget it.
          </DialogDescription>
        </DialogHeader>
        <ConfigureRecoveryForm onCancel={onClose} onComplete={onSuccess} />
      </DialogContent>
    </Dialog>
  );
}
