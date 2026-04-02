"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth/useAuth";

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

  return <AppLayout>{children}</AppLayout>;
}
