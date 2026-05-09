"use client";

import { TelemetryBoot } from "@/components/TelemetryBoot";
import { TopBar, VerticalTabBar } from "@/features/layout/TopBar";
import { MainArea } from "@/features/layout/MainArea";
import { BottomPanel } from "@/features/layout/BottomPanel";
import { SettingsSidebar } from "@/features/layout/SettingsSidebar";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { UnlockVault } from "@/components/UnlockVault";
import { useStore } from "@/lib/store";
import { AnimatePresence, motion } from "framer-motion";

const transition = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const };

export default function Page() {
  const isUnlocked = useStore((s) => s.isUnlocked);
  const tabBarOrientation = useStore((s) => s.tabBarOrientation);

  return (
    <>
      <TelemetryBoot />

      {!isUnlocked ? (
        <UnlockVault />
      ) : (
        <div className="h-screen w-screen bg-[var(--titlebar-bg)]">
        <div className="w-full h-full flex overflow-hidden text-fg">
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
            <AnimatePresence initial={false}>
              {tabBarOrientation === "horizontal" && (
                <motion.div
                  key="horizontal-topbar"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={transition}
                  className="shrink-0 overflow-hidden"
                >
                  <TopBar />
                </motion.div>
              )}
            </AnimatePresence>
            <div className={`flex-1 min-h-0 ${tabBarOrientation === "horizontal" ? "px-2 pb-2" : "p-2"}`}>
              <div className="h-full flex flex-col bg-bg rounded-md overflow-hidden border border-border/30">
                <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
                  <MainArea />
                  <SettingsSidebar />
                </div>
                <BottomPanel />
              </div>
            </div>
          </div>
          <KeyboardShortcuts />
        </div>
        </div>
      )}
    </>
  );
}
