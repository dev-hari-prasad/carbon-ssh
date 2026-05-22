"use client";

import { useEffect, useState } from "react";
import { TelemetryBoot } from "@/components/TelemetryBoot";
import { TopBar, VerticalTabBar } from "@/features/layout/TopBar";
import { MainArea } from "@/features/layout/MainArea";
import { BottomPanel } from "@/features/layout/BottomPanel";
import { LargeSettingsModal } from "@/features/layout/LargeSettingsModal";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { UnlockVault } from "@/components/UnlockVault";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useStore } from "@/lib/store";
import { getThemeById } from "@/config/themes";
import { AnimatePresence, motion } from "framer-motion";
import { migrateAppLockPasswordIfNeeded } from "@/lib/storage";
import { TITLE_BAR_HEIGHT, TITLE_BAR_OS_CONTROLS_WIDTH } from "@/config/titlebar";

const transition = { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const };

function AppLockMigrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void migrateAppLockPasswordIfNeeded().then(() => setReady(true));
  }, []);
  if (!ready) return null;
  return <>{children}</>;
}

export default function Page() {
  const isUnlocked = useStore((s) => s.isUnlocked);
  const onboardingCompleted = useStore((s) => s.onboardingCompleted);
  const tabBarOrientation = useStore((s) => s.tabBarOrientation);
  const theme = useStore((s) => s.theme);
  const currentTheme = getThemeById(theme);
  const logoSrc =
    currentTheme.type === "light" ? "/logo/Carbon logo dark.svg" : "/logo/Carbon logo light.svg";

  const showUnlock = !isUnlocked && onboardingCompleted;

  return (
    <AppLockMigrationGate>
      <>
        <TelemetryBoot />

        <div className="h-screen w-screen bg-[var(--titlebar-bg)] flex flex-col overflow-hidden">
          {onboardingCompleted && (
          <div 
            className="w-full shrink-0 flex items-center z-50 select-none" 
            style={{ height: TITLE_BAR_HEIGHT, WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            {(tabBarOrientation === "horizontal" && isUnlocked) ? (
              <div className="flex-1 min-w-0 h-full overflow-hidden" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
                <TopBar isTitleBar />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 opacity-90 pointer-events-none px-2.5">
                <img src={logoSrc} alt="" className="h-4 w-4 object-contain" />
                <div className="text-[12px] font-semibold tracking-tight text-fg-muted">Carbon</div>
              </div>
            )}
            <div className="shrink-0" style={{ width: TITLE_BAR_OS_CONTROLS_WIDTH }} />
          </div>
        )}

      <div className="flex-1 w-full flex overflow-hidden text-fg">
        {showUnlock ? (
          <UnlockVault />
        ) : (
          <>
            <AnimatePresence initial={false}>
              {tabBarOrientation === "vertical" && (
                <motion.div
                  key="vertical-sidebar"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={transition}
                  className="shrink-0 overflow-hidden h-full"
                >
                  <VerticalTabBar />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className={`flex-1 min-h-0 ${tabBarOrientation === "horizontal" ? "px-2 pb-2" : "px-2 pb-2 pl-0.5"}`}>
                <div className="h-full flex flex-col bg-bg rounded-md overflow-hidden border border-border/30">
                  <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
                    <MainArea />
                    <LargeSettingsModal />
                  </div>
                  <BottomPanel />
                </div>
              </div>
            </div>
          </>
        )}
        <KeyboardShortcuts />
        <AnimatePresence>
          {!onboardingCompleted && <OnboardingModal />}
        </AnimatePresence>
      </div>
        </div>
      </>
    </AppLockMigrationGate>
  );
}
