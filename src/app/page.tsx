"use client";

import { TelemetryBoot } from "@/components/TelemetryBoot";
import { TopBar } from "@/features/layout/TopBar";
import { MainArea } from "@/features/layout/MainArea";
import { BottomPanel } from "@/features/layout/BottomPanel";
import { SettingsSidebar } from "@/features/layout/SettingsSidebar";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { UnlockVault } from "@/components/UnlockVault";
import { useStore } from "@/lib/store";

export default function Page() {
  const isUnlocked = useStore((s) => s.isUnlocked);

  return (
    <>
      {/* Mount once per window load so vault → main transition does not duplicate app_open */}
      <TelemetryBoot />

      {!isUnlocked ? (
        <UnlockVault />
      ) : (
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg text-fg">
          <TopBar />
          <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
            <MainArea />
            <SettingsSidebar />
          </div>
          <BottomPanel />
          <KeyboardShortcuts />
        </div>
      )}
    </>
  );
}
