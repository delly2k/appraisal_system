import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { UserAdministrationTable } from "./user-administration-table";

const UsersIcon = () => (
  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  const isHR = user?.roles?.some((r) => r === "hr" || r === "admin") ?? false;
  if (!user || !isHR) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        icon={<UsersIcon />}
        title="User administration"
        subtitle="Manage app users: roles, employee links, and active status"
      />
      <UserAdministrationTable />
    </div>
  );
}
