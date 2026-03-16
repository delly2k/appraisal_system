"use client";

import { useMemo } from "react";
import { userHasPermission, type Permission } from "@/lib/permissions";
import type { UserRole } from "@/types";

/**
 * Check if the current user's roles have a given permission.
 * Use in client components that need to show/hide or enable/disable by permission.
 */
export function useHasPermission(roles: UserRole[] | undefined, permission: Permission): boolean {
  return useMemo(() => {
    if (!roles?.length) return false;
    return userHasPermission(roles, permission);
  }, [roles, permission]);
}
