/**
 * Maps app_users.roles[] to the legacy NOT NULL app_users.role enum.
 * RLS and older policies still read single role; admin wins over hr; none → individual.
 */
export function legacyRoleForRoles(roles: readonly string[]): "admin" | "hr" | "gm" | "manager" | "individual" {
  const lowered = new Set(roles.map((r) => String(r).toLowerCase()));
  if (lowered.has("admin")) return "admin";
  if (lowered.has("hr")) return "hr";
  return "individual";
}
