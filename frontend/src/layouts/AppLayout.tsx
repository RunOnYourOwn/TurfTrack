import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import * as React from "react";
import { AppSidebar } from "@/components/ui/AppSidebar";
import { PanelLeftIcon } from "lucide-react";

function MobileHeader() {
  const { setOpenMobile } = useSidebar();
  return (
    <header className="md:hidden flex items-center h-12 px-2 bg-background border-b border-border">
      <button
        className="p-2 rounded hover:bg-muted focus:outline-none"
        aria-label="Open sidebar"
        onClick={() => setOpenMobile(true)}
      >
        <PanelLeftIcon className="h-6 w-6" />
      </button>
      <span className="ml-2 font-bold text-lg">TurfTrack</span>
    </header>
  );
}

function SidebarWithContent({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();

  return (
    <div className={`min-h-screen bg-background sidebar-${state}`}>
      <MobileHeader />
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="min-w-0 bg-background flex-1 w-screen md:w-[calc(100vw-var(--sidebar-width))] max-w-none">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <SidebarWithContent>{children}</SidebarWithContent>
    </SidebarProvider>
  );
}
