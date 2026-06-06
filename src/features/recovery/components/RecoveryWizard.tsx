import React, { useState, useEffect } from "react";
import {
  KeyIcon,
  ShieldCheckIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  DocumentArrowUpIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  hexToBytes,
  hexFromBytes,
  generateRandomBytes,
  derivePassphraseKey,
  deriveVerificationKeyStandard,
  deriveVerificationKeyAdvanced,
  decryptVerificationToken,
  encryptVerificationToken,
  sha256,
  calculateChecksum,
} from "../helpers/crypto";
import { combinePassphrases, combineAnswers } from "../helpers/normalization";
import { RecoveryMetadata } from "../types";
import { actions } from "@/lib/store";

interface RecoveryWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecoveryWizard({ isOpen, onClose }: RecoveryWizardProps) {
  const [metadata, setMetadata] = useState<RecoveryMetadata | null>(null);
  const [step, setStep] = useState<
    "loading-meta" | "upload" | "passphrases" | "reset-password" | "download-new-key" | "success"
  >("loading-meta");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Advanced Mode File Upload State
  const [uploadedSecretHex, setUploadedSecretHex] = useState("");
  const [uploadedId, setUploadedId] = useState("");
  const [fileName, setFileName] = useState("");

  // Passphrases State
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [pass3, setPass3] = useState("");
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [showPass, setShowPass] = useState(false);

  // Password Reset State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Key Rotation Download State (Advanced only)
  const [newRecoveryId, setNewRecoveryId] = useState("");
  const [newRecoverySecretHex, setNewRecoverySecretHex] = useState("");
  const [newKeyDownloaded, setNewKeyDownloaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setStep("loading-meta");
      setPass1("");
      setPass2("");
      setPass3("");
      setUserAnswers([]);
      if (window.electron?.loadRecoveryMetadata) {
        window.electron
          .loadRecoveryMetadata()
          .then((meta) => {
            setMetadata(meta);
            if (!meta) {
              setError("Account recovery is not configured on this device.");
            } else {
              if (meta.questions && meta.questions.length > 0) {
                setUserAnswers(new Array(meta.questions.length).fill(""));
              } else {
                setUserAnswers(["", "", ""]);
              }

              if (meta.mode === "advanced") {
                setStep("upload");
              } else {
                setStep("passphrases");
              }
            }
          })
          .catch(() => {
            setError("Failed to load account recovery configuration.");
          });
      } else {
        setError("Electron API is not available.");
      }
    }
  }, [isOpen]);

  // Handle Drag/Drop & File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setError("");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);

        if (
          parsed.version === undefined ||
          parsed.app !== "Carbon SSH" ||
          !parsed.recovery_id ||
          !parsed.recovery_secret ||
          !parsed.checksum
        ) {
          setError("This recovery key file is invalid or not for Carbon SSH.");
          return;
        }

        // Verify Checksum
        const calculated = await calculateChecksum(
          parsed.version,
          parsed.recovery_id,
          parsed.recovery_secret,
        );
        if (calculated !== parsed.checksum) {
          setError("This recovery key file has been altered or corrupted.");
          return;
        }

        // Verify Recovery ID matches configured database recovery ID
        if (metadata && parsed.recovery_id !== metadata.recoveryId) {
          setError("This recovery key file does not match the active configuration.");
          return;
        }

        setUploadedSecretHex(parsed.recovery_secret);
        setUploadedId(parsed.recovery_id);
        setStep("passphrases");
      } catch (err) {
        setError("Failed to read or parse recovery key file.");
      }
    };
    reader.readAsText(file);
  };

  // Run cryptographic KDF + Decryption + Verification
  const handleVerify = async () => {
    if (!metadata) return;
    setLoading(true);
    setError("");
    try {
      const combined =
        metadata.questions && metadata.questions.length > 0
          ? combineAnswers(userAnswers)
          : combinePassphrases(pass1, pass2, pass3);
      const saltAnswersBytes = hexToBytes(metadata.saltAnswersHex);
      const saltVerificationBytes = hexToBytes(metadata.saltVerificationHex);
      const ivBytes = hexToBytes(metadata.aesIvHex);
      const encryptedTokenBytes = hexToBytes(metadata.encryptedVerificationTokenHex);
      const authTagBytes = hexToBytes(metadata.aesAuthTagHex);
      const expectedTokenHash = metadata.verificationTokenHashHex;

      // 1. Derive passphrase key (Argon2id)
      const kQuestions = await derivePassphraseKey(combined, saltAnswersBytes);

      // 2. Derive verification key
      let verificationKey: Uint8Array;
      if (metadata.mode === "advanced") {
        if (!uploadedSecretHex) {
          setError("Recovery secret is missing. Please re-upload your recovery key file.");
          return;
        }
        const secretBytes = hexToBytes(uploadedSecretHex);
        verificationKey = await deriveVerificationKeyAdvanced(
          secretBytes,
          kQuestions,
          saltVerificationBytes,
        );
      } else {
        verificationKey = await deriveVerificationKeyStandard(kQuestions, saltVerificationBytes);
      }

      // 3. Decrypt the Verification Token
      let decryptedToken: Uint8Array;
      try {
        decryptedToken = await decryptVerificationToken(
          verificationKey,
          encryptedTokenBytes,
          authTagBytes,
          ivBytes,
        );
      } catch (e) {
        throw new Error("Incorrect passphrases or recovery key file.");
      }

      // 4. Validate Token Hash
      const tokenHash = await sha256(decryptedToken);
      const tokenHashHex = hexFromBytes(tokenHash);

      if (tokenHashHex !== expectedTokenHash) {
        throw new Error("Incorrect passphrases or recovery key file.");
      }

      // Success - Go to reset password step
      setStep("reset-password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 4) {
      setError("New password must be at least 4 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // 1. Update the App Lock password in secure storage
      if (window.electron?.setAppLockPassword) {
        await window.electron.setAppLockPassword(newPassword);
      } else {
        throw new Error("Electron API is not available.");
      }

      // 2. Rotate recovery keys & metadata
      if (metadata) {
        const saltAnswers = generateRandomBytes(16);
        const saltVerification = generateRandomBytes(16);
        const iv = generateRandomBytes(12);
        const verificationToken = generateRandomBytes(32);
        const verificationTokenHash = await sha256(verificationToken);

        const combined =
          metadata.questions && metadata.questions.length > 0
            ? combineAnswers(userAnswers)
            : combinePassphrases(pass1, pass2, pass3);
        const kQuestions = await derivePassphraseKey(combined, saltAnswers);

        if (metadata.mode === "advanced") {
          // Generate new secret & ID
          const newSecret = generateRandomBytes(32);
          const newSecretHex = hexFromBytes(newSecret);
          const newId =
            "rec_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

          setNewRecoveryId(newId);
          setNewRecoverySecretHex(newSecretHex);

          const newKAdvancedVerification = await deriveVerificationKeyAdvanced(
            newSecret,
            kQuestions,
            saltVerification,
          );

          const { ciphertext, authTag } = await encryptVerificationToken(
            newKAdvancedVerification,
            verificationToken,
            iv,
          );

          const newMetadata: RecoveryMetadata = {
            version: 1,
            mode: "advanced",
            recoveryId: newId,
            questions: metadata.questions,
            saltAnswersHex: hexFromBytes(saltAnswers),
            saltVerificationHex: hexFromBytes(saltVerification),
            aesIvHex: hexFromBytes(iv),
            aesAuthTagHex: hexFromBytes(authTag),
            encryptedVerificationTokenHex: hexFromBytes(ciphertext),
            verificationTokenHashHex: hexFromBytes(verificationTokenHash),
            createdAt: Date.now(),
          };

          if (window.electron?.saveRecoveryMetadata) {
            await window.electron.saveRecoveryMetadata(newMetadata);
          } else {
            throw new Error("Electron API is not available.");
          }
          setStep("download-new-key");
        } else {
          // Standard Mode: rotate/re-encrypt with the same answers, save, and succeed
          const newKStandardVerification = await deriveVerificationKeyStandard(
            kQuestions,
            saltVerification,
          );

          const { ciphertext, authTag } = await encryptVerificationToken(
            newKStandardVerification,
            verificationToken,
            iv,
          );

          const newMetadata: RecoveryMetadata = {
            version: 1,
            mode: "standard",
            questions: metadata.questions,
            saltAnswersHex: hexFromBytes(saltAnswers),
            saltVerificationHex: hexFromBytes(saltVerification),
            aesIvHex: hexFromBytes(iv),
            aesAuthTagHex: hexFromBytes(authTag),
            encryptedVerificationTokenHex: hexFromBytes(ciphertext),
            verificationTokenHashHex: hexFromBytes(verificationTokenHash),
            createdAt: Date.now(),
          };

          if (window.electron?.saveRecoveryMetadata) {
            await window.electron.saveRecoveryMetadata(newMetadata);
          } else {
            throw new Error("Electron API is not available.");
          }
          setStep("success");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadNewKey = async () => {
    if (!newRecoveryId || !newRecoverySecretHex) return;

    setLoading(true);
    try {
      const version = 1;
      const checksum = await calculateChecksum(version, newRecoveryId, newRecoverySecretHex);
      const fileData = {
        version,
        app: "Carbon SSH",
        created_at: new Date().toISOString(),
        recovery_id: newRecoveryId,
        recovery_secret: newRecoverySecretHex,
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

      setNewKeyDownloaded(true);
      setError("");
    } catch (err) {
      setError("Failed to download new recovery file.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    // Unlock the vault using actions.unlockAfterVerifiedAuth()!
    await actions.unlockAfterVerifiedAuth();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-[var(--border-strong)] bg-[var(--popover-bg)] text-fg rounded-sm">
        <DialogHeader>
          <DialogTitle className="text-fg font-sans text-[16px] font-bold">
            Account Recovery Wizard
          </DialogTitle>
        </DialogHeader>

        <div className="w-full space-y-4 pt-2">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-md flex items-start gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="break-words leading-relaxed">{error}</span>
            </div>
          )}

          {step === "loading-meta" && (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <svg className="animate-spin h-5 w-5 text-accent" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-xs text-fg-muted">Checking recovery configuration...</span>
            </div>
          )}

          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-xs text-fg-muted leading-relaxed">
                Advanced Recovery is configured. Please upload your `carbon-recovery.key` file.
              </p>

              <div className="relative border border-dashed border-border hover:border-accent/50 bg-[var(--bg-panel)] rounded-sm p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group">
                <input
                  type="file"
                  accept=".key,application/json"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <DocumentArrowUpIcon className="w-8 h-8 text-fg-dim mb-2 group-hover:text-accent transition-colors" />
                <span className="text-xs font-semibold text-fg">
                  {fileName ? fileName : "Choose recovery key file"}
                </span>
                <span className="text-[10px] text-fg-muted mt-1">or drag and drop it here</span>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {step === "passphrases" && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-fg">
                    {metadata?.questions && metadata.questions.length > 0
                      ? "Answer Recovery Questions"
                      : "Enter Your 3 Passphrases"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="text-[10px] font-medium text-fg-muted hover:text-fg flex items-center gap-1 bg-[var(--command-bg)]/40 hover:bg-[var(--command-bg)] border border-border/20 px-2 py-1 rounded-sm transition-colors cursor-pointer"
                  >
                    {showPass ? (
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
              </div>

              <div className="space-y-3.5 max-h-[300px] overflow-y-auto text-left pr-1">
                {metadata?.questions && metadata.questions.length > 0 ? (
                  metadata.questions.map((qText, index) => (
                    <div key={index} className="space-y-1">
                      <label className="text-[11px] font-medium text-fg-muted">
                        Question {index + 1}: {qText}
                      </label>
                      <Input
                        type={showPass ? "text" : "password"}
                        value={userAnswers[index] || ""}
                        onChange={(e) => {
                          const updated = [...userAnswers];
                          updated[index] = e.target.value;
                          setUserAnswers(updated);
                        }}
                        placeholder="Your answer"
                        className="bg-[var(--input-bg)] border-border h-8 text-[11.5px] rounded-sm focus:border-accent"
                      />
                    </div>
                  ))
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Input
                        type={showPass ? "text" : "password"}
                        value={pass1}
                        onChange={(e) => setPass1(e.target.value)}
                        placeholder="First passphrase"
                        className="bg-[var(--input-bg)] border-border h-8 text-[11.5px] rounded-sm focus:border-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <Input
                        type={showPass ? "text" : "password"}
                        value={pass2}
                        onChange={(e) => setPass2(e.target.value)}
                        placeholder="Second passphrase"
                        className="bg-[var(--input-bg)] border-border h-8 text-[11.5px] rounded-sm focus:border-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <Input
                        type={showPass ? "text" : "password"}
                        value={pass3}
                        onChange={(e) => setPass3(e.target.value)}
                        placeholder="Third passphrase"
                        className="bg-[var(--input-bg)] border-border h-8 text-[11.5px] rounded-sm focus:border-accent"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (metadata?.mode === "advanced") setStep("upload");
                    else onClose();
                  }}
                  className="text-xs rounded-sm"
                >
                  {metadata?.mode === "advanced" ? "Back" : "Cancel"}
                </Button>
                <Button
                  size="sm"
                  onClick={handleVerify}
                  disabled={
                    loading ||
                    (metadata?.questions && metadata.questions.length > 0
                      ? userAnswers.some((ans) => !ans.trim())
                      : !pass1 || !pass2 || !pass3)
                  }
                  className="bg-accent text-accent-fg hover:opacity-90 min-w-[80px] text-xs h-8 rounded-sm"
                >
                  {loading ? "Verifying..." : "Verify"}
                </Button>
              </div>
            </div>
          )}

          {step === "reset-password" && (
            <div className="space-y-4">
              <div className="p-3 bg-success/5 border border-success/20 rounded-md text-xs text-success font-medium">
                ✓ Verification succeeded. Please set a new lock password.
              </div>

              <div className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-[11px] text-fg-muted font-medium">New Password</label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new lock password"
                      className="bg-[var(--input-bg)] border-border pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
                    >
                      {showNewPassword ? (
                        <EyeSlashIcon className="w-4 h-4" />
                      ) : (
                        <EyeIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-fg-muted font-medium">Confirm Password</label>
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new lock password"
                    className="bg-[var(--input-bg)] border-border"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={loading || !newPassword || !confirmPassword}
                  className="bg-accent text-accent-fg hover:opacity-90"
                >
                  {loading ? "Saving..." : "Save Password"}
                </Button>
              </div>
            </div>
          )}

          {step === "download-new-key" && (
            <div className="space-y-4">
              <div className="p-4 border border-border bg-[var(--bg-panel)] rounded-lg space-y-3">
                <h4 className="text-[13.5px] font-semibold text-fg flex items-center gap-2">
                  <ArrowDownTrayIcon className="w-4.5 h-4.5 text-accent" />
                  Download Your New Recovery Key
                </h4>
                <p className="text-xs text-fg-muted leading-relaxed">
                  Your account has been recovered. Since you were in Advanced Mode, a new recovery
                  key has been generated. You must download it to replace your old file, which is
                  now invalidated.
                </p>

                <div className="pt-2">
                  <Button
                    onClick={handleDownloadNewKey}
                    disabled={loading}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 h-9 text-xs"
                  >
                    {newKeyDownloaded ? (
                      <>
                        <CheckIcon className="w-4 h-4 text-success" />
                        New Key Downloaded
                      </>
                    ) : (
                      <>
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Download New Key File
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  onClick={handleFinish}
                  disabled={!newKeyDownloaded}
                  className="bg-accent text-accent-fg hover:opacity-90"
                >
                  Continue & Unlock
                </Button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
                <CheckIcon className="w-6 h-6 text-success" strokeWidth={2.5} />
              </div>
              <div>
                <h4 className="text-[15px] font-bold text-fg">Password Reset Successfully!</h4>
                <p className="text-xs text-fg-muted mt-1.5 leading-relaxed max-w-[280px]">
                  Your lock password has been updated. The recovery system has been rotated to
                  secure your new password.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={handleFinish}
                  className="bg-accent text-accent-fg hover:opacity-90 px-8"
                >
                  Unlock Vault
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
