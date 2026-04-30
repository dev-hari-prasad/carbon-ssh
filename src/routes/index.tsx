import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/features/layout/TopBar";
import { MainArea } from "@/features/layout/MainArea";
import { BottomPanel } from "@/features/layout/BottomPanel";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg text-fg">
      <TopBar />
      <MainArea />
      <BottomPanel />
    </div>
  );
}
