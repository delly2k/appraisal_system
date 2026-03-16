import type { UserRole } from "@/types";

/**
 * Role-based access control (RBAC) for the Appraisal Portal.
 * Permissions are derived from user roles; route and UI visibility use these helpers.
 */

export const ROLES = {
  EMPLOYEE: "employee",
  MANAGER: "manager",
  HR: "hr",
  ADMIN: "admin",
  GM: "gm",
  INDIVIDUAL: "individual",
} as const;

export type Permission =
  | "dashboard:view"
  | "appraisals:view_own"
  | "appraisals:submit"
  | "workplans:view_own"
  | "workplans:manage"
  | "development:view_own"
  | "development:edit"
  | "team_reviews:view"
  | "team_reviews:approve"
  | "admin:view"
  | "admin:manage_users"
  | "admin:manage_cycles"
  | "admin:reports";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  employee: [
    "dashboard:view",
    "appraisals:view_own",
    "appraisals:submit",
    "workplans:view_own",
    "development:view_own",
    "development:edit",
  ],
  manager: [
    "dashboard:view",
    "appraisals:view_own",
    "appraisals:submit",
    "workplans:view_own",
    "workplans:manage",
    "development:view_own",
    "development:edit",
    "team_reviews:view",
    "team_reviews:approve",
  ],
  hr: [
    "dashboard:view",
    "appraisals:view_own",
    "workplans:view_own",
    "development:view_own",
    "team_reviews:view",
    "admin:view",
    "admin:reports",
  ],
  admin: [
    "dashboard:view",
    "appraisals:view_own",
    "appraisals:submit",
    "workplans:view_own",
    "workplans:manage",
    "development:view_own",
    "development:edit",
    "team_reviews:view",
    "team_reviews:approve",
    "admin:view",
    "admin:manage_users",
    "admin:manage_cycles",
    "admin:reports",
  ],
  gm: [
    "dashboard:view",
    "appraisals:view_own",
    "appraisals:submit",
    "workplans:view_own",
    "workplans:manage",
    "development:view_own",
    "development:edit",
    "team_reviews:view",
    "team_reviews:approve",
  ],
  individual: [
    "dashboard:view",
    "appraisals:view_own",
    "appraisals:submit",
    "workplans:view_own",
    "development:view_own",
    "development:edit",
  ],
  super_admin: [
    "dashboard:view",
    "appraisals:view_own",
    "appraisals:submit",
    "workplans:view_own",
    "workplans:manage",
    "development:view_own",
    "development:edit",
    "team_reviews:view",
    "team_reviews:approve",
    "admin:view",
    "admin:manage_users",
    "admin:manage_cycles",
    "admin:reports",
  ],
};

/**
 * Check if a role has a given permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.includes(permission);
}

/**
 * Check if any of the user's roles have the given permission.
 */
export function userHasPermission(roles: UserRole[], permission: Permission): boolean {
  return roles.some((role) => hasPermission(role, permission));
}

/**
 * Get all permissions for a role.
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
