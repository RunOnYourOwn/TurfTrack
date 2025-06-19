import { SidebarProvider } from "@/components/ui/sidebar";
import * as React from "react";
import { AppSidebar } from "@/components/ui/AppSidebar";

function SidebarWithContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-background">
      <div className="flex min-h-screen">
        <AppSidebar />
        <main
          className="min-w-0 bg-background"
          style={{
            width: "calc(100vw - var(--sidebar-width))",
            maxWidth: "none",
          }}
        >
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
