"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import type { AuthUser } from "@/lib/auth";

/**
 * Client-side hook for current user and auth actions.
 * Uses NextAuth session; fetches /api/me for app user (roles, employee_id).
 */
export function useAuth() {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    if (status === "unauthenticated" || !session) {
      setUser(null);
      setLoading(false);
      return;
    }
    if (status !== "authenticated") {
      setLoading(true);
      return;
    }
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const u = await res.json();
        setUser(u);
      } else {
        setUser({
          id: session.user?.email ?? "session",
          email: session.user?.email ?? null,
          name: session.user?.name ?? session.user?.email ?? null,
          roles: ["employee"],
        });
      }
    } catch {
      setUser({
        id: session.user?.email ?? "session",
        email: session.user?.email ?? null,
        name: session.user?.name ?? session.user?.email ?? null,
        roles: ["employee"],
      });
    } finally {
      setLoading(false);
    }
  }, [session, status]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const signOut = useCallback(async () => {
    await nextAuthSignOut({ callbackUrl: "/login" });
    setUser(null);
  }, []);

  return {
    user,
    loading: status === "loading" || loading,
    isAuthenticated: !!session && !!user,
    signOut,
    refresh: loadUser,
  };
}
