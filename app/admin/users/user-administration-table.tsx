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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  role: string;
  employee_id: string | null;
  division_id: string | null;
  is_active: boolean;
  created_at: string;
}

const ROLES = ["admin", "hr", "gm", "manager", "individual"] as const;

export function UserAdministrationTable() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Record<string, string>>({});
  const [editDisplayName, setEditDisplayName] = useState<Record<string, string>>({});
  const [editEmployeeId, setEditEmployeeId] = useState<Record<string, string>>({});
  const [editDivisionId, setEditDivisionId] = useState<Record<string, string>>({});
  const [editIsActive, setEditIsActive] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addForm, setAddForm] = useState({
    email: "",
    display_name: "",
    role: "individual",
    employee_id: "",
    division_id: "",
    is_active: true,
  });

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
      setEditRole({});
      setEditDisplayName({});
      setEditEmployeeId({});
      setEditDivisionId({});
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

  const getRole = (u: AppUser) => editRole[u.id] ?? u.role;
  const getDisplayName = (u: AppUser) => (u.id in editDisplayName ? editDisplayName[u.id] : (u.display_name ?? ""));
  const getEmployeeId = (u: AppUser) => (u.id in editEmployeeId ? editEmployeeId[u.id] : (u.employee_id ?? ""));
  const getDivisionId = (u: AppUser) => (u.id in editDivisionId ? editDivisionId[u.id] : (u.division_id ?? ""));
  const getIsActive = (u: AppUser) => (u.id in editIsActive ? editIsActive[u.id] : u.is_active);

  const hasChanges = (u: AppUser) =>
    getRole(u) !== u.role ||
    getDisplayName(u) !== (u.display_name ?? "") ||
    getEmployeeId(u) !== (u.employee_id ?? "") ||
    getDivisionId(u) !== (u.division_id ?? "") ||
    getIsActive(u) !== u.is_active;

  const saveUser = async (u: AppUser) => {
    const payload: Record<string, unknown> = {};
    if (getRole(u) !== u.role) payload.role = getRole(u);
    if (getDisplayName(u) !== (u.display_name ?? "")) payload.display_name = getDisplayName(u) || null;
    if (getEmployeeId(u) !== (u.employee_id ?? "")) payload.employee_id = getEmployeeId(u) || null;
    if (getDivisionId(u) !== (u.division_id ?? "")) payload.division_id = getDivisionId(u) || null;
    if (getIsActive(u) !== u.is_active) payload.is_active = getIsActive(u);
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
      setUsers((prev) =>
        prev.map((x) =>
          x.id === u.id
            ? {
                ...x,
                role: (payload.role as string) ?? x.role,
                display_name: payload.display_name !== undefined ? (payload.display_name as string | null) : x.display_name,
                employee_id: payload.employee_id !== undefined ? (payload.employee_id as string | null) : x.employee_id,
                division_id: payload.division_id !== undefined ? (payload.division_id as string | null) : x.division_id,
                is_active: payload.is_active !== undefined ? (payload.is_active as boolean) : x.is_active,
              }
            : x
        )
      );
      setEditRole((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
      setEditDisplayName((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
      setEditEmployeeId((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
      setEditDivisionId((prev) => {
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

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = addForm.email.trim().toLowerCase();
    if (!email) {
      setError("Email is required");
      return;
    }
    setAddSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          display_name: addForm.display_name.trim() || null,
          role: addForm.role,
          employee_id: addForm.employee_id.trim() || null,
          division_id: addForm.division_id.trim() || null,
          is_active: addForm.is_active,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add user");
      }
      setAddOpen(false);
      setAddForm({ email: "", display_name: "", role: "individual", employee_id: "", division_id: "", is_active: true });
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
              <form onSubmit={handleAddUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-email">Email *</Label>
                  <Input
                    id="add-email"
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="user@company.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-display_name">Display name</Label>
                  <Input
                    id="add-display_name"
                    value={addForm.display_name}
                    onChange={(e) => setAddForm((f) => ({ ...f, display_name: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-role">Role *</Label>
                  <Select
                    value={addForm.role}
                    onValueChange={(value) => setAddForm((f) => ({ ...f, role: value }))}
                  >
                    <SelectTrigger id="add-role">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-employee_id">Employee ID</Label>
                  <Input
                    id="add-employee_id"
                    value={addForm.employee_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, employee_id: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-division_id">Division ID</Label>
                  <Input
                    id="add-division_id"
                    value={addForm.division_id}
                    onChange={(e) => setAddForm((f) => ({ ...f, division_id: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={addForm.is_active}
                    onCheckedChange={(checked) => setAddForm((f) => ({ ...f, is_active: !!checked }))}
                  />
                  <Label>Active</Label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addSubmitting}>
                    {addSubmitting ? "Adding…" : "Add user"}
                  </Button>
                </DialogFooter>
              </form>
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
                <TableHead>Role</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Division ID</TableHead>
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
                  <TableCell>
                    <Select value={getRole(u)} onValueChange={(value) => setEditRole((prev) => ({ ...prev, [u.id]: value }))}>
                      <SelectTrigger className={cn("w-[140px]", getRole(u) !== u.role && "border-amber-500")}>
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-9 w-[120px]"
                      value={getEmployeeId(u)}
                      onChange={(e) => setEditEmployeeId((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      placeholder="—"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-9 w-[120px]"
                      value={getDivisionId(u)}
                      onChange={(e) => setEditDivisionId((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      placeholder="—"
                    />
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
