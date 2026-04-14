import Link from "next/link";
import Image from "next/image";
import {
  Building2, FolderKanban, Users, UserCog, Database,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth/useAuth";

const mainNav = [
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
  const isViewer = user?.role === "viewer";
  const visibleMainNav = isViewer
    ? mainNav.filter((item) => item.url === "/properties" || item.url === "/projects")
    : user?.role === "company"
      ? mainNav.filter((item) => item.url !== "/users")
      : mainNav;
  const visibleSystemNav = isViewer ? [] : systemNav;
  const navLinkSpacingClass = isMobile ? "mx-2 px-3.5 py-2.5" : "mx-2 px-3 py-2";
  const navIconClass = isMobile ? "h-[18px] w-[18px] shrink-0" : "h-4 w-4 shrink-0";
  const navTextClass = isMobile ? "text-[15px]" : "text-sm";
  const handleNavItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-4 py-5">
        <Link href="/properties" className="flex items-center gap-2.5">
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
          <SidebarGroupLabel className={`${isMobile ? "text-xs" : "text-[11px]"} uppercase tracking-wider font-semibold text-muted-foreground/70 px-4`}>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size={isMobile ? "lg" : "default"} onClick={handleNavItemClick}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={`rounded-lg ${navLinkSpacingClass} text-muted-foreground hover:text-foreground hover:bg-accent transition-colors`}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className={navIconClass} />
                      {!collapsed && <span className={navTextClass}>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {visibleSystemNav.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel className={`${isMobile ? "text-xs" : "text-[11px]"} uppercase tracking-wider font-semibold text-muted-foreground/70 px-4`}>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSystemNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild size={isMobile ? "lg" : "default"} onClick={handleNavItemClick}>
                      <NavLink
                        to={item.url}
                        className={`rounded-lg ${navLinkSpacingClass} text-muted-foreground hover:text-foreground hover:bg-accent transition-colors`}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className={navIconClass} />
                        {!collapsed && <span className={navTextClass}>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
    </Sidebar>
  );
}
