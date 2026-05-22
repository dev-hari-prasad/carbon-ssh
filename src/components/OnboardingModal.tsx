import React, { useEffect, useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, actions } from "@/lib/store";
import { THEMES, getThemeById, RECOMMENDED_THEME_IDS, cssVariablesForTheme, type AppTheme } from "@/config/themes";
import { TITLE_BAR_HEIGHT } from "@/config/titlebar";
import {
  Docker,
  Linux,
  Slack,
  Spotify,
  VisualStudioCode,
} from "@ridemountainpig/svgl-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LockClosedIcon, FingerPrintIcon, KeyIcon, EyeIcon, EyeSlashIcon, CheckIcon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { savePasskeyAccess, savePasswordAccess } from "@/lib/storage";
import {
  canUseElectronTouchId,
  createWebAuthnPasskey,
  promptElectronTouchId,
} from "@/lib/passkeys";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Kbd } from "@/components/Kbd";
import { KeyReturn, HardDrive, Fingerprint, ShieldCheck, ShieldWarning, ChartBar, PushPinSimple } from "@phosphor-icons/react";

const STEPS = 4;
const SKIP_LOCK_WARNING =
  "This leaves Carbon accessible to anyone with access to this computer. This is not recommended.\n\nSkip app lock anyway?";

export function OnboardingModal() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const access = useStore((s) => s.access);
  const [activeTab, setActiveTab] = useState(access.appLockEnabled ? access.method : "passkey");
  const [setupStatus, setSetupStatus] = useState<'idle' | 'success' | 'error' | 'skipped'>(access.appLockEnabled ? 'success' : 'idle');
  const [showSkipWarning, setShowSkipWarning] = useState(false);

  const onboardingCompleted = useStore((s) => s.onboardingCompleted);
  const tabBarOrientation = useStore((s) => s.tabBarOrientation);
  const terminalFont = useStore((s) => s.terminalFont);
  const themeId = useStore((s) => s.theme);
  const currentTheme = getThemeById(themeId);
  const telemetryEnabled = useStore((s) => s.telemetryEnabled);
  
  const [pinToTaskbar, setPinToTaskbar] = useState(true);
  const [isTelemetryEnabled, setIsTelemetryEnabled] = useState(telemetryEnabled);
  
  const handleNext = useCallback(() => {
    if (step < STEPS) setStep((s) => s + 1);
  }, [step]);

  const attemptBiometricUnlock = useCallback(async () => {
    setLoading(true);
    setError(false);
    setErrorMessage("");
    try {
      if (canUseElectronTouchId()) {
        await promptElectronTouchId("Set up Carbon biometric unlock");
        await savePasskeyAccess("electron");
      } else {
        await createWebAuthnPasskey();
      }
      actions.setAccessSettings({ appLockEnabled: true, method: "passkey" });
      await actions.unlockAfterVerifiedAuth();
      setSetupStatus('success');
      handleNext();
    } catch (err: any) {
      setError(true);
      setErrorMessage(err.message || "An error occurred during passkey setup.");
    } finally {
      setLoading(false);
    }
  }, [handleNext]);

  const attemptPasswordSetup = useCallback(async () => {
    if (!password || password.length < 4) {
      setPasswordError("Password must be at least 4 characters.");
      return;
    }
    setPasswordError("");
    await savePasswordAccess(password);
    actions.setAccessSettings({ appLockEnabled: true, method: "password" });
    await actions.unlockApp();
    setSetupStatus('success');
    handleNext();
  }, [password, handleNext]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (onboardingCompleted) return;
      
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "Enter") {
        if (step < STEPS) {
          if (step === 3) {
            if (setupStatus === 'idle') {
              if (activeTab === "password") attemptPasswordSetup();
            } else {
              handleNext();
            }
          } else {
            handleNext();
          }
        }
      } else if (e.key === "Backspace" && step > 1 && !isInput) {
        setStep(s => s - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, onboardingCompleted, activeTab, attemptPasswordSetup, setupStatus, handleNext]);

  useEffect(() => {
    document.documentElement.setAttribute("data-onboarding", "true");
    const v = cssVariablesForTheme(currentTheme);
    if (typeof window !== "undefined" && (window as any).electron?.setTitleBarOverlay) {
      (window as any).electron.setTitleBarOverlay({
        color: "#00000000",
        symbolColor: v["--titlebar-fg"],
        height: TITLE_BAR_HEIGHT,
      });
    }
    return () => {
      document.documentElement.removeAttribute("data-onboarding");
    };
  }, [themeId, currentTheme]);

  const [isCompleting, setIsCompleting] = useState(false);

  const handleFinish = async () => {
    setIsCompleting(true);
    
    if (pinToTaskbar && (window as any).electron?.pinToTaskbar) {
      (window as any).electron.pinToTaskbar();
    }
    
    if ((window as any).electron?.maximizeWindow) {
      console.log("[renderer] Calling maximizeWindow");
      (window as any).electron.maximizeWindow();
    }

    // Wait for expansion animation to settle
    setTimeout(() => {
      actions.completeOnboarding();
    }, 1000);
  };

  const handleSkipLock = () => {
    setShowSkipWarning(true);
  };

  const confirmSkipLock = () => {
    void actions.skipAppLock();
    setShowSkipWarning(false);
    setSetupStatus('skipped');
    handleNext();
  };



  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)]"
      style={{ 
        "--fg-muted": "color-mix(in oklab, var(--fg-muted) 65%, var(--fg))",
        "--input": "color-mix(in oklab, var(--border) 60%, var(--border-strong))",
      } as React.CSSProperties}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05, filter: "blur(20px)" }}
        transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
        className="w-full h-full bg-[var(--bg)] overflow-hidden flex relative"
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-white/5 z-50 pointer-events-none" />
        <motion.div
          key="left-panel"
          initial={false}
          animate={{ 
            width: isCompleting ? "0%" : "51%",
            opacity: isCompleting ? 0 : 1,
            pointerEvents: isCompleting ? "none" : "auto"
          }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="h-full bg-[var(--bg)] pt-8 px-10 pb-10 flex flex-col relative shrink-0 border-r border-border overflow-hidden"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              {step === 1 && (
                <div className="flex flex-col h-full justify-start pt-[22vh] pl-10 pr-6">
                  <motion.div 
                    className="flex flex-col items-center w-full mb-8"
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: { opacity: 0 },
                      visible: {
                        opacity: 1,
                        transition: {
                          staggerChildren: 0.1,
                          delayChildren: 0.2
                        }
                      }
                    }}
                  >
                    <div className="w-full max-w-[400px]">
                      <div className="mb-8">
                        <motion.img 
                          variants={{
                            hidden: { opacity: 0, y: 10 },
                            visible: { opacity: 1, y: 0 }
                          }}
                          src={currentTheme.type === "light" ? "/logo/Carbon logo dark.svg" : "/logo/Carbon logo light.svg"} 
                          alt="Carbon" 
                          className="h-14 mb-3" 
                        />
                        <motion.h1 
                          variants={{
                            hidden: { opacity: 0, y: 10 },
                            visible: { opacity: 1, y: 0 }
                          }}
                          className="text-xl font-bold text-fg mb-0"
                        >
                          Welcome to Carbon SSH
                        </motion.h1>
                        <motion.p 
                          variants={{
                            hidden: { opacity: 0, y: 10 },
                            visible: { opacity: 1, y: 0 }
                          }}
                          className="text-fg-muted text-[13px]"
                        >
                          A new, faster and easier way to manage your SSH hosts.
                        </motion.p>
                      </div>
                      
                      <div className="mt-2 space-y-2">
                        {[
                          { icon: HardDrive, text: "Store and access your hosts securely" },
                          { icon: Fingerprint, text: "Lock your data and Carbon with Passkeys" },
                          { icon: ShieldCheck, text: "Open source, fully local and private" }
                        ].map((item, i) => (
                          <motion.div 
                            key={i}
                            variants={{
                              hidden: { opacity: 0, y: 10 },
                              visible: { opacity: 1, y: 0 }
                            }}
                            className="flex items-center gap-3"
                          >
                            <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                              <item.icon className="w-4 h-4 text-green-500" weight="duotone" />
                            </div>
                            <span className="text-[14px] text-fg-muted">{item.text}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col h-full px-0">
                  <div className="mb-8 mt-0 shrink-0">
                    <h1 className="text-xl font-bold text-fg mb-0">Customize Carbon</h1>
                    <p className="text-fg-muted text-[13px]">Tailor the UI to your liking.</p>
                  </div>

                  <div className="flex-1 flex flex-col justify-center items-center max-w-[80%] mx-auto w-full pb-12 mb-12">
                    <div className="flex flex-col gap-4 w-full max-w-[400px]">
                      {/* Tab Styling */}
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[14px] font-sans font-medium text-fg">Tab styling</span>
                        </div>
                        <div className="p-1 flex items-stretch h-9 gap-1 rounded-md bg-[var(--command-bg)] border border-border w-full">
                          <SubTabBtn
                            active={tabBarOrientation === "horizontal"}
                            onClick={() => actions.setTabBarOrientation("horizontal")}
                            className="flex-1 gap-1"
                            layoutId="step2-tab-bg"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                                <rect x="0.5" y="0.5" width="11" height="3" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
                                <rect x="0.5" y="5" width="11" height="6.5" rx="0.75" stroke="currentColor" strokeWidth="1.1" opacity="0.35" />
                              </svg>
                              <span>Horizontal</span>
                            </span>
                          </SubTabBtn>
                          <SubTabBtn
                            active={tabBarOrientation === "vertical"}
                            onClick={() => actions.setTabBarOrientation("vertical")}
                            className="flex-1 gap-1"
                            layoutId="step2-tab-bg"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
                                <rect x="0.5" y="0.5" width="3.5" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.1" />
                                <rect x="5.5" y="0.5" width="6" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.1" opacity="0.35" />
                              </svg>
                              <span>Vertical</span>
                            </span>
                          </SubTabBtn>
                        </div>
                      </div>

                      <hr className="border-border w-full opacity-80" />

                      {/* Theme */}
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col min-w-0">
                          <span className="text-[14px] font-sans font-medium text-fg">Theme</span>
                        </div>
                        <div className="w-full">
                           <OnboardingThemeSelector activeThemeId={themeId} onSelect={(id) => actions.setTheme(id)} compact />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col h-full px-0">
                  <div className="mb-6 mt-0 shrink-0">
                    <h1 className="text-xl font-bold text-fg mb-0">Secure your data</h1>
                    <p className="text-fg-muted text-[13px]">Choose how you want to unlock your data.</p>
                  </div>

                  <div className="flex-1 flex flex-col justify-center items-center pb-12 pr-2 w-[70%] mx-auto">
                    {setupStatus === 'success' ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-8"
                      >
                         <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                           <ShieldCheck className="w-10 h-10 text-emerald-500" weight="fill" />
                         </div>
                         <h3 className="text-lg font-bold text-fg mb-1">Securely locked</h3>
                         <p className="text-fg-muted mb-6 text-center text-[13px] leading-relaxed">
                           Your data is now protected by {access.method === 'passkey' ? 'biometric authentication' : 'a master password'}.
                         </p>
                         <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={() => setSetupStatus('idle')} 
                           className="h-8 px-6 text-[11px] font-medium bg-transparent border-border hover:bg-[var(--command-active-bg)]"
                         >
                           Change method
                         </Button>
                      </motion.div>
                    ) : setupStatus === 'skipped' ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-8"
                      >
                         <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                           <ShieldWarning className="w-10 h-10 text-amber-500" weight="fill" />
                         </div>
                         <h3 className="text-lg font-bold text-fg mb-1">App lock skipped</h3>
                         <p className="text-fg-muted mb-6 text-center text-[13px] leading-relaxed">
                           Your data is currently unprotected. We highly recommend enabling a lock for security.
                         </p>
                         <div className="flex justify-center w-full">
                           <Button 
                             onClick={() => setSetupStatus('idle')} 
                             className="h-9 px-8 text-[12px] font-medium bg-accent text-accent-fg hover:opacity-90 shadow-sm"
                           >
                             Setup App Lock
                           </Button>
                         </div>
                      </motion.div>
                    ) : (
                      <Tabs
                        value={activeTab}
                        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                        className="w-full"
                      >
                        <TabsList className="grid w-full grid-cols-2 mb-4 bg-[var(--bg-panel)] border border-border h-9 p-1 relative overflow-hidden">
                          <TabsTrigger value="passkey" className="z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-fg">
                            <FingerPrintIcon className="w-4 h-4 mr-2" /> Passkeys
                          </TabsTrigger>
                          <TabsTrigger value="password" className="z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-fg">
                            <KeyIcon className="w-4 h-4 mr-2" /> Password
                          </TabsTrigger>
                          <motion.div
                            className="absolute h-[calc(100%-8px)] top-1 bg-[var(--command-active-bg)] shadow-sm rounded-md"
                            initial={false}
                            animate={{
                              left: activeTab === "passkey" ? "4px" : "50%",
                              width: "calc(50% - 4px)"
                            }}
                            transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                          />
                        </TabsList>

                        <div className="relative h-[180px]">
                          <AnimatePresence mode="wait">
                            {activeTab === "passkey" ? (
                              <motion.div
                                key="passkey"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col gap-4"
                              >
                                <p className="text-[13px] text-fg-muted text-center mx-auto mt-4">
                                  Uses Touch ID or Windows Hello. <br /> You can change this later in settings.
                                </p>
                                {error && (
                                  <div className="bg-red-500/10 text-red-500 text-sm px-4 py-3 rounded-lg w-full text-center border border-red-500/20">
                                    {errorMessage}
                                  </div>
                                )}
                                  <div className="flex flex-col gap-1.5">
                                    <Button
                                      onClick={attemptBiometricUnlock}
                                      disabled={loading}
                                      className="w-full bg-accent text-accent-fg hover:opacity-90 h-10 mt-4 max-w-[95%] mx-auto"
                                    >
                                      {loading ? "Waiting..." : "Set up Passkey"}
                                    </Button>
                                    <Button 
                                      onClick={handleSkipLock} 
                                      variant="outline"
                                      className="w-fit px-6 bg-transparent hover:bg-[var(--command-active-bg)] text-fg h-8 mt-2 mx-auto border-dashed border-border-strong text-[11px] font-medium"
                                    >
                                      Skip app lock
                                    </Button>
                                  </div>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="password"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="flex flex-col gap-4"
                              >
                                <div className="space-y-2">
                                  <label className="text-xs font-medium text-fg-muted">Password</label>
                                  <div className="relative">
                                    <Input
                                      type={showPassword ? "text" : "password"}
                                      value={password}
                                      onChange={(e) => setPassword(e.target.value)}
                                      placeholder="Enter a secure password..."
                                      className="pr-8 bg-[var(--input-bg)] border-border text-fg focus:border-border-strong"
                                      onKeyDown={(e) => e.key === "Enter" && attemptPasswordSetup()}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg transition-colors"
                                    >
                                      {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                                    </button>
                                  </div>
                                  {passwordError && <p className="text-xs text-danger">{passwordError}</p>}
                                </div>

                                  <div className="flex flex-col gap-1.5">
                                    <Button onClick={attemptPasswordSetup} className="w-full bg-accent text-accent-fg hover:opacity-90 h-10 mt-3">
                                      Set Password
                                    </Button>
                                    <Button 
                                      onClick={handleSkipLock} 
                                      variant="outline"
                                      className="w-fit px-6 bg-transparent hover:bg-[var(--command-active-bg)] text-fg h-8 mt-2 mx-auto border-dashed border-border-strong text-[11px] font-medium"
                                    >
                                      Skip app lock
                                    </Button>
                                  </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </Tabs>
                    )}
                    
                    <AlertDialog open={showSkipWarning} onOpenChange={setShowSkipWarning}>
                      <AlertDialogContent 
                        className="z-[200] border-[var(--border-strong)] bg-[var(--popover-bg)] text-fg"
                        overlayClassName="z-[190] backdrop-blur-[3px] bg-black/10"
                      >
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-fg font-sans text-[15px]">Skip app lock?</AlertDialogTitle>
                          <AlertDialogDescription className="text-fg-muted whitespace-pre-wrap text-[12px] leading-snug font-sans">
                            {SKIP_LOCK_WARNING}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-3">
                          <AlertDialogAction onClick={confirmSkipLock} className="bg-danger text-white hover:bg-danger/90">
                            Skip anyway
                          </AlertDialogAction>
                          <AlertDialogCancel className="border-border bg-transparent text-fg hover:bg-[var(--menu-hover-bg)]">Cancel</AlertDialogCancel>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              )}
              {step === 4 && (
                <div className="flex flex-col h-full px-0">
                  <div className="mb-6 mt-0 shrink-0">
                    <h1 className="text-xl font-bold text-fg mb-0">One last thing</h1>
                    <p className="text-fg-muted text-[13px]">Set your final preferences to get started.</p>
                  </div>

                  <div className="flex-1 flex flex-col justify-center items-center pb-12 mb-10 max-w-[400px] mx-auto w-full">
                    <div className="space-y-3 w-full">
                      <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-[var(--bg-panel)]">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-fg/5 border border-border/50 flex items-center justify-center shrink-0 mt-0.5">
                            <PushPinSimple className="w-4 h-4 text-fg" weight="duotone" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-[14px] font-medium text-fg">Pin to Dock</h4>
                            <p className="text-[12px] text-fg-muted leading-tight">
                              Pin Carbon to your dock/taskbar for quick access.
                            </p>
                          </div>
                        </div>
                        <Switch 
                          checked={pinToTaskbar} 
                          onCheckedChange={setPinToTaskbar} 
                        />
                      </div>

                      <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-[var(--bg-panel)]">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-fg/5 border border-border/50 flex items-center justify-center shrink-0 mt-0.5">
                            <ChartBar className="w-4 h-4 text-fg" weight="duotone" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-[14px] font-medium text-fg">Anonymous Telemetry</h4>
                            <p className="text-[12px] text-fg-muted leading-tight">
                              Share anonymous usage data to improve Carbon.
                            </p>
                          </div>
                        </div>
                        <Switch 
                          checked={isTelemetryEnabled} 
                          onCheckedChange={(checked) => {
                            setIsTelemetryEnabled(checked);
                            actions.setTelemetryEnabled(checked);
                          }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer Controls */}
          <div className="absolute bottom-10 left-10 right-10 flex items-center justify-between mt-auto">
            {step > 1 ? (
              <Button onClick={() => setStep(s => s - 1)} variant="outline" className="text-sm text-fg-muted hover:text-fg font-medium">
                Back
              </Button>
            ) : <div />}
            
            <div className="flex gap-1.5 absolute left-1/2 -translate-x-1/2">
              {[1, 2, 3, 4].map(i => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? "bg-accent" : "bg-border-strong"}`}
                />
              ))}
            </div>

            {step < STEPS && step !== 3 ? (
              <Button onClick={handleNext} className="bg-accent text-accent-fg hover:opacity-90 flex items-center gap-2 pl-4 pr-2 h-8 text-xs font-semibold rounded-md">
                Next
                <Kbd variant="onAccent" className="border-none bg-transparent shadow-none opacity-85"><KeyReturn weight="bold" size={12} /></Kbd>
              </Button>
            ) : step === 3 ? (
              setupStatus === 'idle' ? (
                <TooltipProvider>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <div className="inline-block">
                        <Button disabled className="bg-accent/50 text-accent-fg/50 cursor-not-allowed flex items-center gap-2 pl-4 pr-2 h-8 text-xs font-semibold rounded-md">
                          Next
                          <Kbd variant="onAccent" className="border-none bg-transparent shadow-none opacity-65"><KeyReturn weight="bold" size={12} /></Kbd>
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-popover text-popover-fg border-border">
                      <p className="text-xs font-medium">Setup or skip security first</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button onClick={handleNext} className="bg-accent text-accent-fg hover:opacity-90 flex items-center gap-2 pl-4 pr-2 h-8 text-xs font-semibold rounded-md">
                  Next
                  <Kbd variant="onAccent" className="border-none bg-transparent shadow-none opacity-85"><KeyReturn weight="bold" size={12} /></Kbd>
                </Button>
              )
            ) : (
              <Button onClick={handleFinish} className="bg-accent text-accent-fg hover:opacity-90 flex items-center gap-2 pl-4 pr-2 h-8 text-xs font-semibold rounded-md">
                Start SSHing
                <Kbd variant="onAccent" className="border-none bg-transparent shadow-none opacity-85"><KeyReturn weight="bold" size={12} /></Kbd>
              </Button>
            )}
          </div>
        </motion.div>

        {/* Right Panel - Terminal Preview */}
        <div 
          className="flex-1 flex items-center justify-center relative overflow-hidden"
          style={{
            background: currentTheme.type === "light"
              ? "linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)"
              : "linear-gradient(135deg, #525252 0%, #171717 100%)"
          }}
        >
          {/* Subtle glow effect */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-white/5 blur-[100px] rounded-full pointer-events-none" />
          
          <AnimatePresence mode="wait">
            {step === 4 ? (
              <motion.div
                key="waterfall"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0"
              >
                <MatrixGridPreview theme={currentTheme} enabled={isTelemetryEnabled} />
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full h-full flex items-center justify-center"
              >
                <MiniAppPreview 
                  step={step === 3 ? 4 : step} 
                  theme={currentTheme} 
                  tabBarOrientation={tabBarOrientation as "vertical" | "horizontal"} 
                  isCompleting={isCompleting}
                  reducedBlur={step === 3}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {step === 4 && (
              <motion.div
                initial={{ y: 50, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 50, opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
              >
                <FakeDock platform={(window as any).electron?.platform || 'win32'} theme={currentTheme} pinned={pinToTaskbar} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function SubTabBtn({
  active,
  onClick,
  className = "",
  children,
  layoutId = "active-tab-background",
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
  layoutId?: string;
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`flex relative ${className}`}
    >
      <button
        onClick={onClick}
        className={`h-full w-full px-4 rounded-[6px] text-[12.5px] font-sans transition-colors flex items-center justify-center z-10 ${active ? "text-fg" : "text-fg-muted hover:text-fg"
          }`}
      >
        {children}
      </button>
      {active && (
        <motion.div
          layoutId={layoutId}
          className="absolute inset-0 bg-[var(--command-active-bg)] shadow-sm rounded-[6px]"
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
        />
      )}
    </motion.div>
  );
}


function OnboardingThemeSelector({ activeThemeId, onSelect, compact = false }: { activeThemeId: string, onSelect: (id: string) => void, compact?: boolean }) {
  const [tab, setTab] = useState<"dark" | "light">("dark");

  const allowedDark = ["dark_modern", "onedark-pro-darker", "onedark-pro-night-flat"];
  const allowedLight = ["2026-light", "light_modern", "solarized-light"];

  const ordered = tab === "dark" 
    ? allowedDark.map(id => THEMES.find(t => t.id === id)).filter((t): t is AppTheme => Boolean(t))
    : allowedLight.map(id => THEMES.find(t => t.id === id)).filter((t): t is AppTheme => Boolean(t));

  return (
    <div className={`flex flex-col gap-2.5 flex-1 justify-center items-center w-full ${compact ? "" : "max-w-[80%] mx-auto mb-8"}`}>
      <div className={`p-1 flex items-stretch h-9 gap-1 rounded-md bg-[var(--command-bg)] border border-border w-full ${compact ? "" : "max-w-[400px]"}`}>
        <SubTabBtn active={tab === "dark"} onClick={() => setTab("dark")} className="flex-1" layoutId="step3-theme-bg">
          <span className="inline-flex items-center gap-2">
            <MoonIcon className="w-4 h-4" />
            <span>Dark</span>
          </span>
        </SubTabBtn>
        <SubTabBtn active={tab === "light"} onClick={() => setTab("light")} className="flex-1" layoutId="step3-theme-bg">
          <span className="inline-flex items-center gap-2">
            <SunIcon className="w-4 h-4" />
            <span>Light</span>
          </span>
        </SubTabBtn>
      </div>
      <div className={`flex flex-col gap-0.5 w-full ${compact ? "" : "max-w-[400px]"}`}>
        {ordered.map((theme) => (
          <ThemeRow
            key={theme.id}
            theme={theme}
            active={theme.id === activeThemeId}
            onSelect={() => onSelect(theme.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeRow({
  theme,
  active,
  onSelect,
}: {
  theme: AppTheme;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors ${active
          ? "bg-[var(--command-active-bg)] ring-1 ring-accent/40"
          : "hover:bg-[var(--menu-hover-bg)]"
        }`}
    >
      <ThemePreview theme={theme} />
      <span
        className={`min-w-0 flex-1 text-[13px] font-sans truncate ${active ? "text-fg font-semibold" : "text-fg-muted"
          }`}
      >
        {theme.name}
      </span>
      {active ? (
        <span className="w-5 h-5 grid place-items-center rounded-full bg-accent text-accent-fg shrink-0">
          <CheckIcon className="w-[11px] h-[11px]" strokeWidth={2.5} />
        </span>
      ) : null}
    </button>
  );
}

function ThemePreview({ theme }: { theme: AppTheme }) {
  const v = cssVariablesForTheme(theme);
  const c = theme.colors;
  const bg = v["--bg"];
  const titleBg = v["--titlebar-bg"];
  const border = v["--border-strong"];
  const accent = v["--accent"];
  const fg = v["--fg"];
  const blue = c["terminal.ansiBlue"] ?? accent;
  const green = c["terminal.ansiGreen"] ?? "#89d185";
  const yellow = c["terminal.ansiYellow"] ?? "#cca700";

  return (
    <div
      className="w-[52px] h-[34px] rounded-sm overflow-hidden shrink-0 border"
      style={{ borderColor: border, background: bg }}
    >
      <div className="h-2 w-full" style={{ background: titleBg }} />
      <div className="px-1.5 pt-1 flex flex-col gap-[2px]">
        <div className="flex items-center gap-1">
          <div className="h-[2px] w-2.5 rounded-sm" style={{ background: blue }} />
          <div className="h-[3px] w-6 rounded-sm" style={{ background: fg, opacity: 0.85 }} />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-[2px] w-3 rounded-sm" style={{ background: green }} />
          <div className="h-[2px] w-4 rounded-sm" style={{ background: yellow }} />
        </div>
        <div className="flex items-center gap-1">
          <div className="h-[2px] w-1.5 rounded-sm" style={{ background: accent }} />
        </div>
      </div>
    </div>
  );
}

function FakeDock({ platform, theme, pinned = true }: { platform: string; theme: AppTheme; pinned?: boolean }) {
  const isMac = platform === "darwin";
  const isWin = platform === "win32";
  const isDark = theme.type === "dark";
  const v = cssVariablesForTheme(theme);

  const icons = useMemo(() => [
    { id: "vscode", Icon: VisualStudioCode },
    { id: "docker", Icon: Docker },
    { id: "carbon", isCarbon: true },
    { id: "spotify", Icon: Spotify },
    { id: "slack", Icon: Slack },
  ], []);

  const dockBg = isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";
  const dockBorder = v["--border"];

  // MacOS Dock Style
  if (isMac) {
    return (
      <div 
        className="flex items-end p-2 px-3 gap-2.5 backdrop-blur-2xl border shadow-2xl relative overflow-visible"
        style={{ 
          backgroundColor: dockBg, 
          borderColor: dockBorder,
          borderRadius: "22px"
        }}
      >
        {icons.map((item) => {
          const isGrayscale = !pinned;
          const delay = pinned 
            ? (item.isCarbon ? '0ms' : '250ms') 
            : (item.isCarbon ? '250ms' : '0ms');

          return (
            <div key={item.id} className="relative flex flex-col items-center group">
              <div 
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${item.isCarbon ? 'scale-[1.15] translate-y-0.5 mx-1.5' : 'hover:scale-110'}`}
                style={{ 
                  filter: isGrayscale ? "grayscale(1) contrast(0.8)" : "none",
                  opacity: isGrayscale ? 0.5 : 1,
                  transitionDelay: delay
                }}
              >
                {item.isCarbon ? (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ring-1 ${isDark ? 'bg-black ring-white/10' : 'bg-white ring-black/5'}`}>
                    <img src={isDark ? "/logo/Carbon logo light.svg" : "/logo/Carbon logo dark.svg"} alt="" className="w-6 h-6" />
                  </div>
                ) : (
                  "Icon" in item &&
                  item.Icon &&
                  React.createElement(item.Icon, { className: "w-7 h-7" })
                )}
              </div>
              {item.isCarbon && pinned && (
                <div 
                  className="absolute -bottom-1 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_white]" 
                  style={{ transition: 'opacity 0.3s ease', transitionDelay: delay }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Windows Taskbar Style
  if (isWin) {
    return (
      <div 
        className="flex items-center p-1.5 px-2 gap-1 backdrop-blur-xl border shadow-2xl overflow-visible"
        style={{ 
          backgroundColor: isDark ? "rgba(26,26,26,0.85)" : "rgba(240,240,240,0.85)", 
          borderColor: dockBorder,
          borderRadius: "12px"
        }}
      >
        <div 
          className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-white/5 mr-1 transition-all duration-300"
          style={{ 
            filter: !pinned ? "grayscale(1) contrast(0.8)" : "none",
            opacity: !pinned ? 0.5 : 1,
            transitionDelay: pinned ? '100ms' : '0ms'
          }}
        >
          <svg viewBox="0 0 24 24" className={`w-5 h-5 ${isDark ? 'text-[#00a4ef]' : 'text-[#0078d7]'}`} fill="currentColor">
            <path d="M0 0h11.5v11.5H0V0zm12.5 0H24v11.5H12.5V0zM0 12.5h11.5V24H0V12.5zm12.5 0H24V24H12.5V12.5z" />
          </svg>
        </div>
        {icons.map((item) => {
          const isGrayscale = !pinned;
          const delay = pinned 
            ? (item.isCarbon ? '0ms' : '100ms') 
            : (item.isCarbon ? '100ms' : '0ms');

          return (
            <div key={item.id} className="relative group flex flex-col items-center">
              <div 
                className={`w-9 h-9 rounded-md flex items-center justify-center transition-all duration-300 ${item.isCarbon ? 'mx-1 scale-110 translate-y-0' : 'hover:bg-white/5'}`}
                style={{ 
                  filter: isGrayscale ? "grayscale(1) contrast(0.8)" : "none",
                  opacity: isGrayscale ? 0.5 : 1,
                  transitionDelay: delay
                }}
              >
                {item.isCarbon ? (
                  <div className={`w-9 h-9 rounded-md flex items-center justify-center shadow-sm ring-1 ${isDark ? 'bg-white/10 ring-white/10' : 'bg-black/5 ring-black/5'}`}>
                    <img src={isDark ? "/logo/Carbon logo light.svg" : "/logo/Carbon logo dark.svg"} alt="" className="w-5 h-5" />
                  </div>
                ) : (
                  "Icon" in item &&
                  item.Icon &&
                  React.createElement(item.Icon, { className: "w-5 h-5" })
                )}
              </div>
              {item.isCarbon && pinned && (
                <div 
                  className="absolute -bottom-1 left-1.5 right-1.5 h-0.5 bg-[#00a4ef] rounded-full shadow-[0_0_8px_#00a4ef]" 
                  style={{ transition: 'opacity 0.3s ease', transitionDelay: delay }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Linux (Default)
  return (
    <div 
      className="flex items-center p-1.5 px-3 gap-3 backdrop-blur-2xl border rounded-full shadow-2xl"
      style={{ 
        backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.6)", 
        borderColor: dockBorder 
      }}
    >
      <div 
        className="w-8 h-8 flex items-center justify-center bg-orange-600 rounded-full shadow-md mr-1 transition-all duration-300"
        style={{ 
          filter: !pinned ? "grayscale(1) contrast(0.8)" : "none",
          opacity: !pinned ? 0.8 : 1,
          transitionDelay: pinned ? '100ms' : '0ms'
        }}
      >
        <Linux className="w-5 h-5 text-white" />
      </div>
      {icons.map((item) => {
        const isGrayscale = !pinned;
        const delay = pinned 
          ? (item.isCarbon ? '0ms' : '100ms') 
          : (item.isCarbon ? '100ms' : '0ms');

        return (
          <div key={item.id} className="relative flex flex-col items-center">
            <div 
              className={`transition-all duration-300 ${item.isCarbon ? 'scale-110 mx-1' : 'opacity-70'}`}
              style={{ 
                filter: isGrayscale ? "grayscale(1) contrast(0.8)" : "none",
                opacity: isGrayscale ? (item.isCarbon ? 0.6 : 0.4) : (item.isCarbon ? 1 : 0.7),
                transitionDelay: delay
              }}
            >
              {item.isCarbon ? (
                <img 
                  src={isDark ? "/logo/Carbon logo light.svg" : "/logo/Carbon logo dark.svg"} 
                  alt="" 
                  className="w-6 h-6" 
                  style={{ 
                    filter: pinned ? (isDark ? 'drop-shadow(0 0 10px rgba(255,255,255,0.4))' : 'drop-shadow(0 0 10px rgba(0,0,0,0.1))') : 'none',
                    transition: 'filter 0.3s ease',
                    transitionDelay: delay
                  }}
                />
              ) : (
                "Icon" in item &&
                item.Icon &&
                React.createElement(item.Icon, { className: "w-5 h-5" })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MatrixGridPreview({ theme, enabled = true }: { theme: AppTheme, enabled?: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const enabledRef = React.useRef(enabled);
  const powerRef = React.useRef(enabled ? 1 : 0);
  const shimmerPosRef = React.useRef(-200);
  
  React.useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-res canvas dimensions
    canvas.width = 450;
    canvas.height = 450;

    const chars = "0123456789ABCDEFx$#%&*<>{}[]~";
    const fontSize = 11;
    const cols = Math.floor(canvas.width / fontSize);
    const rows = Math.floor(canvas.height / fontSize);
    
    // Initialize fixed grid and shimmer states
    const grid = Array.from({ length: cols }, () => 
      Array.from({ length: rows }, () => chars[Math.floor(Math.random() * chars.length)])
    );
    const charBrightness = Array.from({ length: cols }, () => 
      Array.from({ length: rows }, () => 0)
    );

    const isLight = theme.type === 'light';
    const baseAlpha = isLight ? 0.08 : 0.12;
    const highlightMax = 0.5;

    ctx.textBaseline = 'top';

    let animationId: number;
    let lastTime = 0;

    const draw = (time: number) => {
      // Update power level gradually (smoothing)
      const targetPower = enabledRef.current ? 1 : 0;
      const easing = enabledRef.current ? 0.08 : 0.06; // Faster transitions as requested
      powerRef.current += (targetPower - powerRef.current) * easing;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update diagonal shimmer
      shimmerPosRef.current += (enabledRef.current ? 3.5 : 1) * powerRef.current;
      if (shimmerPosRef.current > canvas.width + canvas.height + 100) {
        shimmerPosRef.current = -150;
      }

      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * fontSize;
          const y = j * fontSize;

          // Fade per-character brightness
          if (charBrightness[i][j] > 0) {
            charBrightness[i][j] -= 0.06;
            if (charBrightness[i][j] < 0) charBrightness[i][j] = 0;
          }

          // Randomly flip character (scaled by power)
          if (Math.random() < 0.03 * powerRef.current) {
            grid[i][j] = chars[Math.floor(Math.random() * chars.length)];
            charBrightness[i][j] = 1.0; 
          }
          
          // Calculate diagonal shimmer intensity
          const dist = Math.abs(x + y - shimmerPosRef.current);
          const shimmerIntensity = Math.max(0, 1 - dist / 120);

          const intensity = charBrightness[i][j];
          // Keep baseAlpha visible even when power is 0, but scale the active effects (shimmer/flips)
          const alpha = baseAlpha + ((intensity * 0.2) + (shimmerIntensity * highlightMax)) * powerRef.current;
          
          ctx.fillStyle = isLight 
            ? `rgba(0, 0, 0, ${alpha})` 
            : `rgba(255, 255, 255, ${alpha})`;
          
          ctx.fillText(grid[i][j], x, y);
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationId);
  }, [theme.type]);

  return (
    <div className="w-full h-full relative flex items-center justify-center overflow-hidden px-8">
      {/* Centered Container with Radial Fade Mask */}
      <div 
        className="w-[450px] h-[450px] relative overflow-hidden flex justify-center items-center pointer-events-none"
        style={{
          WebkitMaskImage: "radial-gradient(circle at center, black 15%, transparent 65%)",
          maskImage: "radial-gradient(circle at center, black 15%, transparent 65%)"
        }}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </div>
  );
}

function MiniAppPreview({
  step,
  theme,
  tabBarOrientation,
  isCompleting = false,
  reducedBlur = false,
}: {
  step: number;
  theme: AppTheme;
  tabBarOrientation: "vertical" | "horizontal";
  isCompleting?: boolean;
  reducedBlur?: boolean;
}) {
  let scale = 1;
  let originX = "0%";
  let originY = "50%";
  let showBlur = false;

  let top: number | string = 122.5;
  let bottom: number | string = 122.5;
  let left: number | string = 60;
  let right: number | string = -10;
  let rightBorder = 0;
  let rightRadius = 0;

  switch (step) {
    case 1:
      scale = 1.2;
      top = 100;
      bottom = 100;
      left = 100;
      break;
    case 2:
      // Top Left Zoom
      scale = 1.35;
      originX = "0%";
      originY = "0%";
      break;
    case 3:
      // Left Zoom (same shape as step 1)
      scale = 1;
      originX = "0%";
      originY = "50%";
      break;
    case 4:
      // Center with blur
      scale = 1;
      originX = "20%"; // Shift origin to align the blurred modal into the visible area
      originY = "50%";
      showBlur = true;
      break;
  }

  if (isCompleting) {
    scale = 1;
    top = 0;
    bottom = 0;
    left = 0;
    right = 0;
    rightBorder = 1;
    rightRadius = 0;
    originX = "50%";
    originY = "50%";
    showBlur = false;
  }

  const v = cssVariablesForTheme(theme);

  return (
    <motion.div
      className="absolute border-y border-l flex flex-col overflow-hidden"
      style={{
        borderColor: v["--border"] || "rgba(255,255,255,0.1)",
        backgroundColor: v["--titlebar-bg"],
        borderTopLeftRadius: 14,
        borderBottomLeftRadius: 14,
      }}
      initial={false}
      animate={{ 
        scale, 
        transformOrigin: `${originX} ${originY}`,
        top,
        bottom,
        left,
        right,
        borderRightWidth: rightBorder,
        borderTopRightRadius: rightRadius,
        borderBottomRightRadius: rightRadius
      }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
    >
      {/* Title Bar */}
      <div className="w-full shrink-0 flex items-center px-4 select-none" style={{ height: TITLE_BAR_HEIGHT }}>
        <div className="flex items-center gap-2">
          <img src={theme.type === "light" ? "/logo/Carbon logo dark.svg" : "/logo/Carbon logo light.svg"} alt="" className="h-3.5" />
          <div
            className="text-[12px] font-medium opacity-50 font-sans tracking-wide"
            style={{ color: v["--titlebar-fg"] || "#fff" }}
          >
            Carbon
          </div>
        </div>
        
        <div className="ml-auto flex items-center gap-5 opacity-40">
          <div className="w-3 h-[1px] bg-current" style={{ backgroundColor: v["--titlebar-fg"] || "#fff" }} />
          <div className="w-3 h-3 border border-current opacity-80" style={{ borderColor: v["--titlebar-fg"] || "#fff" }} />
          <div className="relative w-3.5 h-3.5">
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-current rotate-45" style={{ backgroundColor: v["--titlebar-fg"] || "#fff" }} />
            <div className="absolute top-1/2 left-0 w-full h-[1px] bg-current -rotate-45" style={{ backgroundColor: v["--titlebar-fg"] || "#fff" }} />
          </div>
        </div>
      </div>

      <div className="flex-1 w-full flex overflow-hidden">
        {/* Vertical Tab Bar */}
        <AnimatePresence mode="popLayout">
          {tabBarOrientation === "vertical" && (
            <motion.div
              initial={{ x: -56, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -56, opacity: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="w-14 shrink-0 h-full flex flex-col items-center py-3 gap-2 border-r"
              style={{ backgroundColor: v["--sidebar-bg"], borderColor: v["--border"] }}
            >
              <div
                className="w-10 h-10 rounded-[8px] flex items-center justify-center border shadow-sm"
                style={{ backgroundColor: v["--tab-active-bg"], borderColor: v["--border"] }}
              >
                <div className="w-5 h-5 rounded-sm opacity-60" style={{ backgroundColor: v["--fg"] }} />
              </div>
              <div
                className="w-10 h-10 rounded-[8px] flex items-center justify-center"
                style={{ backgroundColor: "transparent" }}
              >
                <div className="w-5 h-5 rounded-sm opacity-20" style={{ backgroundColor: v["--fg"] }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Horizontal Tab Bar */}
          <AnimatePresence mode="popLayout">
            {tabBarOrientation === "horizontal" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: TITLE_BAR_HEIGHT, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                className="shrink-0 flex items-end px-3 gap-1.5 overflow-hidden"
                style={{ backgroundColor: v["--titlebar-bg"], height: TITLE_BAR_HEIGHT }}
              >
                <div
                  className="h-9 w-48 rounded-t-[8px] border-t border-x flex items-center px-3 gap-2 shadow-sm"
                  style={{ backgroundColor: v["--tab-active-bg"], borderColor: v["--border"] }}
                >
                  <div className="w-3.5 h-3.5 rounded-sm opacity-60" style={{ backgroundColor: v["--fg"] }} />
                  <div className="h-2.5 w-20 rounded-sm opacity-60" style={{ backgroundColor: v["--fg"] }} />
                </div>
                <div
                  className="h-9 w-48 rounded-t-[8px] flex items-center px-3 gap-2"
                  style={{ backgroundColor: "transparent" }}
                >
                  <div className="w-3.5 h-3.5 rounded-sm opacity-30" style={{ backgroundColor: v["--fg"] }} />
                  <div className="h-2.5 w-20 rounded-sm opacity-30" style={{ backgroundColor: v["--fg"] }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`flex-1 min-h-0 ${tabBarOrientation === "horizontal" ? "px-2 pb-2" : "p-2 pl-0.5"}`}>
            <div
              className="h-full flex flex-col rounded-md overflow-hidden border shadow-inner"
              style={{ backgroundColor: v["--bg"], borderColor: v["--border"] }}
            >
              <div className="flex-1 min-h-0 flex relative overflow-hidden">
                {/* Main Area Sidebar (Hosts) */}
                <AnimatePresence mode="popLayout">
                  {tabBarOrientation === "vertical" && (
                    <motion.div
                      initial={{ x: -224, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -224, opacity: 0 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                      className="w-56 shrink-0 border-r flex flex-col overflow-hidden"
                      style={{ borderColor: v["--border"], backgroundColor: v["--sidebar-bg"] }}
                    >
                      <div className="h-10 px-4 flex items-center border-b" style={{ borderColor: v["--border"] }}>
                        <div className="h-3 w-20 rounded-sm" style={{ backgroundColor: v["--fg-muted"] }} />
                      </div>
                      <div className="p-3 flex flex-col gap-1.5">
                        <div className="h-8 w-full rounded-md border flex items-center px-3 gap-3" style={{ backgroundColor: v["--command-active-bg"], borderColor: v["--border-strong"] }}>
                           <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: v["--success"] }} />
                           <div className="h-2 w-24 rounded-sm" style={{ backgroundColor: v["--fg"] }} />
                        </div>
                        <div className="h-8 w-full rounded-md flex items-center px-3 gap-3">
                           <div className="w-2.5 h-2.5 rounded-full opacity-30" style={{ backgroundColor: v["--fg"] }} />
                           <div className="h-2 w-20 rounded-sm opacity-40" style={{ backgroundColor: v["--fg"] }} />
                        </div>
                        <div className="h-8 w-full rounded-md flex items-center px-3 gap-3">
                           <div className="w-2.5 h-2.5 rounded-full opacity-30" style={{ backgroundColor: v["--fg"] }} />
                           <div className="h-2 w-32 rounded-sm opacity-40" style={{ backgroundColor: v["--fg"] }} />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Terminal View */}
                <div className="flex-1 p-8 font-mono text-[13px] leading-[2.2] overflow-hidden whitespace-nowrap" style={{ color: v["--fg"] }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span style={{ color: v["--syntax-keyword"] }}>➜</span>
                    <span style={{ color: v["--syntax-string"] }}>~</span>
                    <span style={{ color: v["--syntax-function"] }}>ssh</span>
                    <span>root@api.carbon.sh</span>
                  </div>
                  <div style={{ color: v["--syntax-comment"] }} className="text-[12px] opacity-80 leading-relaxed">
                    Last login: Wed May 13 02:24:36 2026 from 1.2.3.4<br />
                    Connected to api.carbon.sh (Ubuntu 22.04.3 LTS)
                  </div>
                  <br />
                  <div className="flex items-center gap-2">
                    <span style={{ color: v["--success"] }}>root@api-prod</span>
                    <span style={{ color: v["--syntax-keyword"] }}>:</span>
                    <span style={{ color: v["--syntax-string"] }}>~</span>
                    <span style={{ color: v["--syntax-keyword"] }}>#</span>
                    <span style={{ color: v["--syntax-function"] }}>docker</span>
                    <span>ps</span>
                  </div>
                  <div className="mt-1 opacity-50 text-[11px] leading-tight font-mono">
                    CONTAINER ID   IMAGE          COMMAND       STATUS          PORTS<br />
                    7a83d1e2b4c1   redis:alpine   "docker-e…"   Up 12 hours     6379/tcp<br />
                    b2c3d4e5f6g7   nginx:latest   "/docker-…"   Up 3 days       80/tcp
                  </div>

                  <div className="mt-8 flex items-center gap-2">
                    <span style={{ color: v["--success"] }}>root@api-prod</span>
                    <span style={{ color: v["--syntax-keyword"] }}>:</span>
                    <span style={{ color: v["--syntax-string"] }}>~</span>
                    <span style={{ color: v["--syntax-keyword"] }}>#</span>
                    <span className="w-2 h-5 inline-block animate-pulse" style={{ backgroundColor: v["--fg"] }} />
                  </div>
                </div>
              </div>

              {/* Bottom Panel */}
              <div
                className="h-8 shrink-0 border-t flex items-center px-3 gap-4 text-xs font-mono"
                style={{ borderColor: v["--border"], backgroundColor: v["--sidebar-bg"], color: v["--fg-muted"] }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: v["--success"] }} />
                  <span>Connected</span>
                </div>
                <div className="flex items-center gap-2">
                   <span style={{ color: v["--warning"] }}>⚠ 0</span>
                   <span style={{ color: v["--danger"] }}>✖ 0</span>
                </div>
                <div className="ml-auto">
                   <div className="h-3 w-16 rounded-sm opacity-50" style={{ backgroundColor: v["--fg-muted"] }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showBlur && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-50 flex items-center justify-center ${reducedBlur ? 'bg-black/10 backdrop-blur-[4px]' : 'bg-black/30 backdrop-blur-md'}`}
          >
            <div
              className={`w-[320px] p-8 rounded-2xl border flex flex-col items-center justify-center gap-5 shadow-2xl ${reducedBlur ? 'backdrop-blur-xl' : 'backdrop-blur-2xl'}`}
              style={{ 
                borderColor: "rgba(255,255,255,0.2)", 
                backgroundColor: reducedBlur ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.14)" 
              }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                style={{ backgroundColor: v["--accent"] }}
              >
                <LockClosedIcon className="w-8 h-8" style={{ color: v["--accent-fg"] }} />
              </div>
              <div className="h-5 w-40 rounded-sm" style={{ backgroundColor: v["--fg"], opacity: 0.5 }} />
              <div className="h-12 w-full rounded-lg mt-2 border" style={{ backgroundColor: "rgba(0,0,0,0.2)", borderColor: "rgba(255,255,255,0.1)" }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
