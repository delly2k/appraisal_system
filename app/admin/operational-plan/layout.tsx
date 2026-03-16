import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminOperationalPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const isHrAdmin = user?.roles?.some((r) => ["hr", "admin", "super_admin"].includes(r as string)) ?? false;
  if (!user || !isHrAdmin) {
    redirect("/admin");
  }
  return <>{children}</>;
}
