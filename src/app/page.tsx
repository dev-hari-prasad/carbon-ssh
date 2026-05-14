"use client";

import { TelemetryBoot } from "@/components/TelemetryBoot";
import { TopBar, VerticalTabBar } from "@/features/layout/TopBar";
import { MainArea } from "@/features/layout/MainArea";
import { BottomPanel } from "@/features/layout/BottomPanel";
import { SettingsSidebar } from "@/features/layout/SettingsSidebar";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { UnlockVault } from "@/components/UnlockVault";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useStore } from "@/lib/store";
import { getThemeById } from "@/config/themes";
import { AnimatePresence, motion } from "framer-motion";

const transition = { duration: 0.22, ease: [0.32, 0.72, 0, 1] as const };

export default function Page() {
  const isUnlocked = useStore((s) => s.isUnlocked);
  const onboardingCompleted = useStore((s) => s.onboardingCompleted);
  const tabBarOrientation = useStore((s) => s.tabBarOrientation);
  const themeId = useStore((s) => s.themeId);
  const currentTheme = getThemeById(themeId);
  const logoSrc = currentTheme.type === "light" ? "/logo/Carbon logo dark.svg" : "/logo/Carbon logo light.svg";

  const showUnlock = !isUnlocked && onboardingCompleted;

  return (
    <>
      <TelemetryBoot />

    <div className="h-screen w-screen bg-[var(--titlebar-bg)] flex flex-col overflow-hidden">
      <TelemetryBoot />

        {onboardingCompleted && (
          <div 
            className="w-full shrink-0 flex items-center z-50 select-none h-[40px]" 
            style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
          >
            {(tabBarOrientation === "horizontal" && isUnlocked) ? (
              <div className="w-full h-full" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
                <TopBar isTitleBar />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 opacity-90 pointer-events-none px-3">
                <img src={logoSrc} alt="" className="h-[18px] w-[18px] object-contain" />
                <div className="text-[13px] font-semibold tracking-tight text-fg-muted">Carbon</div>
              </div>
            )}
            <div className="w-[135px] shrink-0" />
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
                    <SettingsSidebar />
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
  );
}
