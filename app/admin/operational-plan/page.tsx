import { redirect } from "next/navigation";

/**
 * Redirect /admin/operational-plan to the HR operational plan list.
 */
export default function AdminOperationalPlanPage() {
  redirect("/hr/operational-plan");
}
