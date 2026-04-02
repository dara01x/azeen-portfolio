"use client";

import { AppLayout } from "@/components/AppLayout";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
