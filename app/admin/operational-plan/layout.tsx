import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminOperationalPlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const isHrAdmin = user?.roles?.some((r) => r === "hr" || r === "admin" || r === "super_admin") ?? false;
  if (!user || !isHrAdmin) {
    redirect("/admin");
  }
  return <>{children}</>;
}
