import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import * as React from "react";
import { AppSidebar } from "@/components/ui/AppSidebar";

function SidebarWithContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 min-w-0">{children}</main>
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
