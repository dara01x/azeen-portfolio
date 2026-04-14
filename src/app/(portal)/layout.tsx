"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth/useAuth";

function isViewerAllowedPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  if (pathname === "/" || pathname === "/properties" || pathname === "/projects") {
    return true;
  }

  const propertyDetailMatch = pathname.match(/^\/properties\/([^/]+)$/);
  if (propertyDetailMatch) {
    return propertyDetailMatch[1] !== "new";
  }

  const projectDetailMatch = pathname.match(/^\/projects\/([^/]+)$/);
  if (projectDetailMatch) {
    return projectDetailMatch[1] !== "new";
  }

  return false;
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      const nextPath = pathname || "/";
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    if (user.role === "company" && pathname?.startsWith("/users")) {
      router.replace("/");
      return;
    }

    if (user.role === "viewer" && !isViewerAllowedPath(pathname)) {
      router.replace("/properties");
    }
  }, [loading, pathname, router, user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </div>
    );
  }

  if (user.role === "company" && pathname?.startsWith("/users")) {
    return null;
  }

  if (user.role === "viewer" && !isViewerAllowedPath(pathname)) {
    return null;
  }

  return <AppLayout>{children}</AppLayout>;
}
