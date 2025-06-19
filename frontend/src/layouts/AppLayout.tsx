import { SidebarProvider } from "@/components/ui/sidebar";
import * as React from "react";
import { AppSidebar } from "@/components/ui/AppSidebar";

function SidebarWithContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/50 dark:bg-gray-900">
      <AppSidebar />
      <main
        className="min-w-0"
        style={{
          width: "calc(100vw - var(--sidebar-width))",
          maxWidth: "none",
        }}
      >
        {children}
      </main>
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
