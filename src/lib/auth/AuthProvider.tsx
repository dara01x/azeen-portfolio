"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { logout } from "@/lib/auth/logout";
import type { AuthUser } from "@/lib/auth/types";

export interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const profile = await getCurrentUser();

    if (!profile || profile.status !== "active") {
      setUser(null);
      return;
    }

    setUser(profile);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const profile = await getCurrentUser();

        if (!profile || profile.status !== "active") {
          setUser(null);
          await logout();
        } else {
          setUser(profile);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown auth error";
        console.warn("Auth profile loading failed:", message);
        setUser(null);
        await logout();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      refreshUser,
    }),
    [user, loading, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
