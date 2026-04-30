import { createFileRoute } from "@tanstack/react-router";
import { Sidebar } from "@/features/layout/Sidebar";
import { Tabs } from "@/features/layout/Tabs";
import { MainArea } from "@/features/layout/MainArea";
import { BottomPanel } from "@/features/layout/BottomPanel";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg text-fg">
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Tabs />
          <MainArea />
          <BottomPanel />
        </div>
      </div>
    </div>
  );
}
