import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  HomeIcon,
  LeafIcon,
  PackageIcon,
  ClipboardListIcon,
  BarChartIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: HomeIcon,
    description: "Dashboard overview",
  },
  {
    title: "Lawns",
    url: "/lawns",
    icon: LeafIcon,
    description: "Manage your lawns",
  },
  {
    title: "GDD",
    url: "/gdd",
    icon: LeafIcon,
    description: "Manage your lawns",
  },
  {
    title: "Products",
    url: "/products",
    icon: PackageIcon,
    description: "Product database",
  },
  {
    title: "Applications",
    url: "/applications",
    icon: ClipboardListIcon,
    description: "Track applications",
  },
  {
    title: "Reports",
    url: "/reports",
    icon: BarChartIcon,
    description: "Analytics and reports",
  },
  {
    title: "Task Monitor",
    url: "/tasks",
    icon: ClipboardListIcon,
    description: "Monitor background tasks",
  },
];

function CollapseButton() {
  const { state, toggleSidebar } = useSidebar();
  return (
    <button
      onClick={toggleSidebar}
      className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-gray-100 transition"
      aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
    >
      {state === "collapsed" ? (
        <ChevronRightIcon size={20} />
      ) : (
        <ChevronLeftIcon size={20} />
      )}
    </button>
  );
}

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar className="overflow-x-hidden h-full" collapsible="icon">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-center px-2 py-4 font-bold text-lg tracking-tight text-primary h-16">
          {state === "collapsed" ? (
            <>
              <span className="text-2xl flex-1 text-center">T</span>
              <CollapseButton />
            </>
          ) : (
            <>
              <span className="flex-1">TurfTrack</span>
              <CollapseButton />
            </>
          )}
        </div>
        <SidebarSeparator />
        {/* Navigation */}
        <SidebarContent className="flex-1 h-full overflow-y-auto">
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.description}
                    >
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-5 w-5" />
                        {state === "collapsed" ? null : (
                          <span>{item.title}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t p-4">
          {state === "collapsed" ? null : (
            <span className="text-xs text-muted-foreground">
              © 2024 TurfTrack
            </span>
          )}
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
