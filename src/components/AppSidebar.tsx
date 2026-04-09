import Link from "next/link";
import Image from "next/image";
import {
  Building2, FolderKanban, Users, UserCog, Database, BarChart3,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth/useAuth";

const mainNav = [
  { title: "Dashboard", url: "/", icon: BarChart3 },
  { title: "Properties", url: "/properties", icon: Building2 },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Users", url: "/users", icon: UserCog },
];

const systemNav = [
  { title: "App Variables", url: "/app-variables", icon: Database },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { user } = useAuth();
  const collapsed = state === "collapsed";
  const visibleMainNav = user?.role === "company" ? mainNav.filter((item) => item.url !== "/users") : mainNav;
  const handleNavItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative h-9 w-9 overflow-hidden rounded-lg border bg-background shadow-sm">
            <Image
              src="/azeen-logo.webp"
              alt="Azeen logo"
              fill
              sizes="36px"
              className="object-contain p-0.5"
              priority
            />
          </div>
          {!collapsed && (
            <div>
              <span className="text-base font-bold tracking-tight">Azeen</span>
              <span className="text-[10px] text-muted-foreground block leading-none">Real Estate Portal</span>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <Separator className="mx-4 w-auto" />
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 px-4">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild onClick={handleNavItemClick}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="rounded-lg mx-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 px-4">System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild onClick={handleNavItemClick}>
                    <NavLink
                      to={item.url}
                      className="rounded-lg mx-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
