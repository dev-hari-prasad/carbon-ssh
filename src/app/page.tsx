"use client";

import { TopBar } from "@/features/layout/TopBar";
import { MainArea } from "@/features/layout/MainArea";
import { BottomPanel } from "@/features/layout/BottomPanel";
import { SettingsSidebar } from "@/features/layout/SettingsSidebar";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";

export default function Page() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg text-fg">
      <TopBar />
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        <MainArea />
        <SettingsSidebar />
      </div>
      <BottomPanel />
      <KeyboardShortcuts />
    </div>
  );
}
