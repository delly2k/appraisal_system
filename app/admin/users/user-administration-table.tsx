"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

interface AppUser {
  id: string;
  email: string | null;
  display_name: string | null;
  role?: string | null;
  roles?: string[];
  employee_id: string | null;
  division_id: string | null;
  /** Resolved from synced `employees` (and `division_id`) on GET /api/admin/users */
  division_name?: string | null;
  is_active: boolean;
  created_at: string;
}

interface DynamicsUser {
  employee_id: string;
  full_name: string;
  email: string;
  title: string | null;
  division_id: string | null;
  division_name: string | null;
}

const SPECIAL_ROLES = ["hr", "admin"] as const;

function normalizeRoles(u: AppUser): string[] {
  const dbRoles = Array.isArray(u.roles) ? u.roles.map((r) => String(r).toLowerCase()) : [];
  if (dbRoles.length > 0) return dbRoles.filter((r) => SPECIAL_ROLES.includes(r as (typeof SPECIAL_ROLES)[number]));
  if (u.role && u.role !== "individual" && SPECIAL_ROLES.includes(u.role as (typeof SPECIAL_ROLES)[number])) {
    return [u.role];
  }
  return [];
}

function rolesSignature(roles: string[]) {
  return [...roles].slice().sort().join(",");
}

function RoleCheckboxes({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (r: string[]) => void;
}) {
  const toggle = (r: string) =>
    onChange(selected.includes(r) ? selected.filter((x) => x !== r) : [...selected, r]);

  return (
    <div className="space-y-3">
      {[
        {
          value: "hr",
          label: "HR",
          desc: "All appraisals, 360 reviews, HR administration",
          color: "bg-[#e1f5ee] text-[#0F6E56]",
        },
        {
          value: "admin",
          label: "Admin",
          desc: "HR administration, operational plan, user management",
          color: "bg-[#faeeda] text-[#854F0B]",
        },
      ].map(({ value, label, desc, color }) => (
        <label key={value} className="flex cursor-pointer items-start gap-3">
          <div
            onClick={() => toggle(value)}
            className={cn(
              "mt-0.5 flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center rounded border-2 transition-colors",
              selected.includes(value)
                ? "border-[#1D9E75] bg-[#1D9E75]"
                : "border-[#dde5f5] bg-white hover:border-[#1D9E75]"
            )}
          >
            {selected.includes(value) && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>{label}</span>
            <p className="mt-0.5 text-xs text-[#94a3b8]">{desc}</p>
          </div>
        </label>
      ))}
      <p className="mt-1 text-xs text-[#cbd5e1]">No roles selected = standard employee access</p>
    </div>
  );
}

export function UserAdministrationTable() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState<Record<string, string>>({});
  const [editIsActive, setEditIsActive] = useState<Record<string, boolean>>({});
  const [editRoles, setEditRoles] = useState<Record<string, string[]>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DynamicsUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DynamicsUser | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load users");
      }
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
      setEditDisplayName({});
      setEditIsActive({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const initial: Record<string, string[]> = {};
    users.forEach((u) => {
      initial[u.id] = normalizeRoles(u);
    });
    setEditRoles(initial);
  }, [users]);

  const getDisplayName = (u: AppUser) => (u.id in editDisplayName ? editDisplayName[u.id] : (u.display_name ?? ""));
  const getIsActive = (u: AppUser) => (u.id in editIsActive ? editIsActive[u.id] : u.is_active);

  const hasChanges = (u: AppUser) => {
    const originalRoles = rolesSignature(normalizeRoles(u));
    const draftRoles = rolesSignature(editRoles[u.id] ?? normalizeRoles(u));
    const rolesChanged = originalRoles !== draftRoles;
    return (
      rolesChanged ||
      getDisplayName(u) !== (u.display_name ?? "") ||
      getIsActive(u) !== u.is_active
    );
  };

  const saveUser = async (u: AppUser) => {
    const payload: Record<string, unknown> = {};
    if (getDisplayName(u) !== (u.display_name ?? "")) payload.display_name = getDisplayName(u) || null;
    if (getIsActive(u) !== u.is_active) payload.is_active = getIsActive(u);
    const newRoles = editRoles[u.id] ?? normalizeRoles(u);
    if (rolesSignature(newRoles) !== rolesSignature(normalizeRoles(u))) payload.roles = newRoles;
    if (Object.keys(payload).length === 0) return;

    setUpdatingId(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      const updated = (await res.json().catch(() => ({}))) as {
        user?: {
          roles?: string[] | null;
          display_name?: string | null;
          employee_id?: string | null;
          division_id?: string | null;
          is_active?: boolean;
        };
      };
      const server = updated.user;
      const resolvedRoles = Array.isArray(server?.roles)
        ? server.roles
            .map((r) => String(r).toLowerCase())
            .filter((r) => SPECIAL_ROLES.includes(r as (typeof SPECIAL_ROLES)[number]))
        : (payload.roles as string[] | undefined) ?? normalizeRoles(u);

      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? {
                ...x,
                roles: resolvedRoles,
                display_name:
                  server?.display_name !== undefined
                    ? server.display_name
                    : payload.display_name !== undefined
                      ? (payload.display_name as string | null)
                      : x.display_name,
                employee_id: server?.employee_id !== undefined ? server.employee_id : x.employee_id,
                division_id: server?.division_id !== undefined ? server.division_id : x.division_id,
                is_active:
                  server?.is_active !== undefined
                    ? server.is_active
                    : payload.is_active !== undefined
                      ? (payload.is_active as boolean)
                      : x.is_active,
              }
            : x
        )
      );
      setEditDisplayName((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
      setEditIsActive((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  useEffect(() => {
    if (!addOpen) return;
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/admin/dynamics/search-employees?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json().catch(() => ({}));
        setSearchResults(Array.isArray(data.results) ? data.results : []);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, addOpen]);

  const handleAddUser = async () => {
    if (!selectedUser) return;
    setAddSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: selectedUser.email.trim().toLowerCase(),
          display_name: selectedUser.full_name,
          roles: selectedRoles,
          employee_id: selectedUser.employee_id,
          division_id: selectedUser.division_id,
          is_active: true,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add user");
      }
      setAddOpen(false);
      setSelectedUser(null);
      setSelectedRoles([]);
      setSearchQuery("");
      setSearchResults([]);
      await fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add user");
    } finally {
      setAddSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading users…
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
        <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchUsers()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        {error && users.length > 0 && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            {error}
          </div>
        )}
        <div className="ml-auto">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>Add user</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add user</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {!selectedUser ? (
                  <div>
                    <Label htmlFor="employee-search">Search employee</Label>
                    <div className="relative mt-1.5">
                      <svg
                        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                      </svg>
                      <Input
                        id="employee-search"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type name or email to search Dynamics..."
                        className="pl-9 pr-9"
                        autoFocus
                      />
                      {searchLoading && (
                        <svg
                          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#94a3b8]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 12a9 9 0 1 1-6.2-8.56" />
                        </svg>
                      )}
                    </div>
                    {searchResults.length > 0 && (
                      <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-[#dde5f5] bg-white shadow-sm">
                        {searchResults.map((user) => (
                          <button
                            key={user.employee_id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(user);
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                            className="flex w-full items-center gap-3 border-b border-[#f0f4ff] px-4 py-3 text-left hover:bg-[#f8faff] last:border-b-0"
                          >
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#e1f5ee] text-xs font-semibold text-[#0F6E56]">
                              {user.full_name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#0f2044]">{user.full_name}</p>
                              <p className="text-xs text-[#94a3b8]">
                                {user.email}
                                {user.title ? ` · ${user.title}` : ""}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                      <p className="mt-2 text-sm text-[#94a3b8]">No employees found in Dynamics</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-[#dde5f5] bg-[#f8faff] p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e1f5ee] text-sm font-semibold text-[#0F6E56]">
                        {selectedUser.full_name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#0f2044]">{selectedUser.full_name}</p>
                        <p className="text-xs text-[#94a3b8]">{selectedUser.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedUser(null)}
                        className="text-xs text-[#94a3b8] hover:text-[#ef4444]"
                      >
                        Change
                      </button>
                    </div>
                    <div className="space-y-2">
                      <Label>Roles</Label>
                      <RoleCheckboxes selected={selectedRoles} onChange={setSelectedRoles} />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => {
                    setAddOpen(false);
                    setSelectedUser(null);
                    setSelectedRoles([]);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAddUser}
                    disabled={!selectedUser || addSubmitting}
                    className={!selectedUser ? "cursor-not-allowed bg-[#e8edf8] text-[#94a3b8] hover:bg-[#e8edf8]" : "bg-[#1D9E75] text-white hover:bg-[#178f68]"}
                  >
                    {addSubmitting ? "Adding…" : "Add user"}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
          title="No users"
          description="No app users found. Add a user to get started."
          action={
            <Button onClick={() => setAddOpen(true)}>Add user</Button>
          }
        />
      ) : (
        <div className="animate-fade-up-delay-1 rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                  <TableCell>
                    <Input
                      className="h-9 w-[180px]"
                      value={getDisplayName(u)}
                      onChange={(e) => setEditDisplayName((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      placeholder="—"
                    />
                  </TableCell>
                  <TableCell className="max-w-[260px] align-top">
                    <RoleCheckboxes
                      selected={editRoles[u.id] ?? normalizeRoles(u)}
                      onChange={(newRoles) =>
                        setEditRoles((prev) => ({ ...prev, [u.id]: newRoles }))
                      }
                    />
                  </TableCell>
                  <TableCell className="max-w-[220px] text-sm text-[#64748b]">
                    {u.division_name?.trim() ? u.division_name : "—"}
                  </TableCell>
                  <TableCell>
                    <Checkbox
                      checked={getIsActive(u)}
                      onCheckedChange={(checked) => setEditIsActive((prev) => ({ ...prev, [u.id]: !!checked }))}
                    />
                  </TableCell>
                  <TableCell>
                    {hasChanges(u) && (
                      <Button size="sm" disabled={updatingId === u.id} onClick={() => saveUser(u)}>
                        {updatingId === u.id ? "Saving…" : "Save"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
