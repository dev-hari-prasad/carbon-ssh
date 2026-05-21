import { useEffect, useState } from "react";
import { actions } from "@/lib/store";
import { trackOnboardingComplete } from "@/lib/telemetry";
import { savePasskeyAccess, savePasswordAccess, verifyAppLockPassword } from "@/lib/storage";
import {
  canUseElectronTouchId,
  createWebAuthnPasskey,
  getSavedPasskeyId,
  getSavedPasskeyProvider,
  promptElectronTouchId,
  verifyWebAuthnPasskey,
} from "@/lib/passkeys";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  FingerPrintIcon,
  KeyIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function UnlockVault() {
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [destroyMode, setDestroyMode] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [activeTab, setActiveTab] = useState("biometric");
  const [passwordWarningTime, setPasswordWarningTime] = useState(0);
  const canUseNativeTouchId = canUseElectronTouchId();

  // Check if first-time setup (used for initial render path)
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === "password" && passwordWarningTime > 0) {
      interval = setInterval(() => {
        setPasswordWarningTime((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTab, passwordWarningTime]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsFirstTime(!window.localStorage.getItem("ssh.vault-setup"));
    }
  }, []);

  const attemptElectronBiometricUnlock = async () => {
    await promptElectronTouchId(isFirstTime ? "Set up Carbon biometric unlock" : "Unlock Carbon");

    if (isFirstTime) {
      await savePasskeyAccess("electron");
      actions.setAccessSettings({ appLockEnabled: true, method: "passkey" });
    }

    await actions.unlockAfterVerifiedAuth();
    if (isFirstTime) {
      trackOnboardingComplete({ path: "passkey_or_biometric" });
    }
  };

  const attemptWebAuthnUnlock = async (setupIfMissing = false) => {
    if (isFirstTime || (setupIfMissing && !getSavedPasskeyId())) {
      await createWebAuthnPasskey();
      actions.setAccessSettings({ appLockEnabled: true, method: "passkey" });
      await actions.unlockAfterVerifiedAuth();
      if (isFirstTime) {
        trackOnboardingComplete({ path: "passkey_or_biometric" });
      }
      return;
    }

    await verifyWebAuthnPasskey();
    await actions.unlockAfterVerifiedAuth();
  };

  const attemptBiometricUnlock = async () => {
    setLoading(true);
    setError(false);
    setErrorMessage("");
    try {
      const provider = getSavedPasskeyProvider();

      if (isFirstTime) {
        if (canUseNativeTouchId) {
          await attemptElectronBiometricUnlock();
          return;
        }
        await attemptWebAuthnUnlock();
        return;
      }

      if (provider === "electron" && canUseNativeTouchId) {
        await attemptElectronBiometricUnlock();
      } else if (provider === "webauthn" || !provider) {
        await attemptWebAuthnUnlock(!getSavedPasskeyId());
      } else if (provider === "electron") {
        await attemptWebAuthnUnlock(true);
      } else {
        throw new Error(`Unsupported biometric provider: ${provider}`);
      }
    } catch (e) {
      setErrorMessage(
        (e instanceof Error && e.name === "NotAllowedError") ||
          (e instanceof Error && e.message.includes("cancelled"))
          ? "Biometrics failed or cancelled"
          : "Biometrics failed or cancelled",
      );
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const attemptPasswordSetup = async () => {
    if (!password) {
      setPasswordError("Password cannot be empty");
      return;
    }
    setPasswordError("");
    await savePasswordAccess(password);
    actions.setAccessSettings({ appLockEnabled: true, method: "password" });
    await actions.unlockAfterVerifiedAuth();
    trackOnboardingComplete({ path: "password_setup" });
  };

  const attemptPasswordUnlock = async () => {
    if (!password) {
      setPasswordError("Password cannot be empty");
      return;
    }
    setLoading(true);
    setError(false);
    setPasswordError("");
    try {
      const ok = await verifyAppLockPassword(password);
      if (ok) {
        await actions.unlockAfterVerifiedAuth();
      } else {
        setPasswordError("Incorrect password");
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDestroy = () => {
    if (confirmText === "DESTROY") {
      void actions.fullFactoryResetAndReload();
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setError(false);
    setErrorMessage("");
    if (value === "password") {
      setPasswordWarningTime(5); // 5 seconds warning
    } else {
      setPasswordWarningTime(0);
    }
  };

  const handleSkipLock = async () => {
    await actions.skipAppLock();
    trackOnboardingComplete({ path: "skip_lock" });
  };

  if (isFirstTime === null) {
    return null; // or a tiny loader while we check local storage
  }

  if (isFirstTime) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg text-fg">
        <div className="max-w-2xl w-full p-8 px-10 border border-border bg-panel flex rounded-xl space-x-8">
          {/* Left Side */}
          <div className="flex-1 flex flex-col justify-center space-y-6 shrink-0">
            <div className="space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center">
                <LockClosedIcon className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2 text-left">
                <h1 className="text-3xl font-bold tracking-tight">Lock Carbon</h1>
                <p className="text-muted-foreground text-sm  leading-tight">
                  <b>Carbon locks your data.</b>
                  <br /> Choose how you want to unlock it.
                </p>
              </div>
            </div>
          </div>
          <div className="block w-px bg-border shrink-0 my-[-2rem]" />{" "}
          {/* Divider matching padding height optionally, or just inside */}
          {/* Right Side */}
          <div className="flex-1 shrink-0 flex flex-col justify-center ml-4">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="biometric">
                  <FingerPrintIcon className="w-4 h-4 mr-2" /> Passkeys
                </TabsTrigger>
                <TabsTrigger value="password">
                  <KeyIcon className="w-4 h-4 mr-2" /> Password
                </TabsTrigger>
              </TabsList>

              <TabsContent value="biometric" className="space-y-4">
                <p className="text-xs text-muted-foreground text-center">
                  Uses Touch ID or Windows Hello <br /> (Recommended).
                </p>
                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg w-full text-center">
                    {errorMessage || "Biometric setup was canceled or failed. Please try again."}
                  </div>
                )}
                <Button
                  onClick={attemptBiometricUnlock}
                  disabled={loading}
                  size="lg"
                  className="w-full"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Setting up...</span>
                    </div>
                  ) : (
                    "Use Biometrics"
                  )}
                </Button>
              </TabsContent>

              <TabsContent value="password" className="space-y-4 text-left">
                {passwordWarningTime > 0 && activeTab === "password" ? (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs px-3 py-2 rounded-lg w-full mb-2">
                    <p className="font-semibold flex items-center gap-1">
                      <ExclamationTriangleIcon className="h-3 w-3" /> Unsafe Method
                    </p>
                    <p className="mt-1">
                      Passwords are stored locally and don't provide strong security.
                    </p>
                    <p className="mt-2 text-[10px] opacity-80 text-right">
                      Dismissing in {passwordWarningTime}s...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground"> Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter a secure password..."
                          className="pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? (
                          <EyeSlashIcon className="h-[15px] w-[15px]" />
                        ) : (
                          <EyeIcon className="h-[15px] w-[15px]" />
                        )}
                        </button>
                      </div>
                      {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                    </div>

                    <Button onClick={attemptPasswordSetup} disabled={loading} size="lg" className="w-full">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Setting up...</span>
                        </div>
                      ) : (
                        "Set Password"
                      )}
                    </Button>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-destructive/25 border-dashed hover:border-destructive/40"
            >
              Skip app lock
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-[var(--border-strong)]">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {" "}
                <span className="text-danger">WARNING:</span> Skip app lock?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-fg-muted">
                Anyone with access to your computer can access Carbon. This may allow unauthorized
                access to your SSH hosts.{" "}
                <span className="text-danger">
                  <b>This is strongly not recommended.</b>
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-3">
              <AlertDialogAction onClick={handleSkipLock} variant="destructive">
                Skip app lock anyway
              </AlertDialogAction>
              <AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  const isPasswordMode =
    typeof window !== "undefined" && window.localStorage.getItem("ssh.vault-setup") === "password";

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-bg text-fg">
      <div className="max-w-2xl w-full p-8 px-10 border border-border bg-panel flex rounded-xl space-x-8">
        {/* Left Side */}
        <div className="flex-1 flex flex-col justify-center space-y-6 shrink-0 relative">
          <div className="space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center">
              {isPasswordMode ? (
                <KeyIcon className="h-10 w-10 text-primary" />
              ) : (
                <FingerPrintIcon className="h-10 w-10 text-primary" />
              )}
            </div>

            <div className="space-y-2 text-left">
              <h1 className="text-3xl font-bold tracking-tight">
                Let's decrypt <br /> Carbon!
              </h1>
            </div>
          </div>
        </div>

        <div className="block w-px bg-border shrink-0 my-[-2rem]" />

        {/* Right Side */}
        <div className="flex-1 shrink-0 flex flex-col justify-center ml-4">
          {error && !destroyMode && !isPasswordMode && (
            <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg w-full text-center mb-4">
              {errorMessage || "Biometric verification failed or was canceled."}
            </div>
          )}

          {!destroyMode ? (
            <div className="space-y-4 w-full">
              {isPasswordMode ? (
                <div className="space-y-4 text-left">
                  <div className="space-y-2 text-center mb-4">
                    <p className="text-xs font-medium text-fg text-center border-1 border-dashed rounded-md p-2">
                      Use password to unlock Carbon
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder=" Password"
                        onKeyDown={(e) => e.key === "Enter" && attemptPasswordUnlock()}
                        className="pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-[15px] w-[15px]" />
                        ) : (
                          <EyeIcon className="h-[15px] w-[15px]" />
                        )}
                      </button>
                    </div>
                    {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                  </div>
                  <Button
                    onClick={attemptPasswordUnlock}
                    disabled={loading}
                    size="lg"
                    className="w-full"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Decrypting...</span>
                      </div>
                    ) : (
                      <>
                        <LockOpenIcon className="h-4 w-4" />
                        Unlock Vault
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <p className="text-xs font-medium text-fg text-center border-1 border-dashed rounded-md p-2">
                    Use your passkey to unlock Carbon
                  </p>
                  <Button
                    onClick={attemptBiometricUnlock}
                    disabled={loading}
                    size="lg"
                    className="w-full"
                  >
                    {loading ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Decrypting...</span>
                      </div>
                    ) : (
                      <>
                        <LockOpenIcon className="h-4 w-4" />
                        Unlock
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full space-y-4 text-left animate-in fade-in zoom-in-[0.98] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
                <h3 className="text-destructive font-semibold flex items-center gap-2">
                  <TrashIcon className="h-4 w-4" /> Danger Zone
                </h3>
                <p className="text-xs text-muted-foreground">
                  This will delete all your Carbon data. This action cannot be undone.
                </p>
              </div>

              <div className="space-y-2 flex flex-col mt-4">
                <label className="text-xs font-medium text-muted-foreground">
                  Type "DESTROY" to confirm
                </label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DESTROY"
                  className="font-mono"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={confirmText !== "DESTROY"}
                  onClick={handleDestroy}
                >
                  Reset App
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDestroyMode(false);
                    setConfirmText("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && !destroyMode && (
        <div className="mt-4 max-w-2xl w-full flex justify-center gap-4 animate-in fade-in duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
          <Button
            onClick={() => setDestroyMode(true)}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-destructive/20 border-dashed hover:border-destructive/20"
          >
            Having trouble? Reset App
          </Button>
        </div>
      )}
    </div>
  );
}
