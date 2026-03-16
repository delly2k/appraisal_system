import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { WorkplanApprovalList } from "@/components/workplan/WorkplanApprovalList";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase URL and key required");
  return createClient(url, key);
}

const ClipboardCheckIcon = () => (
  <svg style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="m9 14 2 2 4-4" />
  </svg>
);

export default async function WorkplanApprovalsPage() {
  const user = await getCurrentUser();
  
  if (!user?.employee_id) {
    redirect("/login");
  }

  const supabase = getSupabase();

  // Get pending workplans where the current user is the manager
  const { data: pendingWorkplans } = await supabase
    .from("workplan_approval_queue")
    .select("*")
    .eq("manager_employee_id", user.employee_id);

  const pending = pendingWorkplans ?? [];

  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      {/* Page Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "4px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "#3b82f6",
            }}
          >
            <ClipboardCheckIcon />
          </div>
          <h1
            style={{
              fontFamily: "Sora, sans-serif",
              fontSize: "24px",
              fontWeight: 700,
              color: "#0f1f3d",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            Workplan Approvals
          </h1>
        </div>
        <p
          style={{
            fontSize: "13.5px",
            color: "#8a97b8",
            marginTop: "2px",
            paddingLeft: "56px",
            margin: 0,
          }}
        >
          Review and approve workplans submitted by your direct reports
        </p>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "24px",
          padding: "16px 20px",
          background: pending.length > 0 ? "#fffbeb" : "#f0fdf4",
          border: `1px solid ${pending.length > 0 ? "#fde68a" : "#bbf7d0"}`,
          borderRadius: "12px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: pending.length > 0 ? "#fef3c7" : "#dcfce7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: pending.length > 0 ? "#f59e0b" : "#22c55e",
          }}
        >
          {pending.length > 0 ? (
            <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ) : (
            <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div>
          <div style={{ fontFamily: "Sora, sans-serif", fontSize: "20px", fontWeight: 700, color: "#0f1f3d" }}>
            {pending.length}
          </div>
          <div style={{ fontSize: "13px", color: pending.length > 0 ? "#92400e" : "#166534" }}>
            {pending.length === 1 ? "Workplan" : "Workplans"} awaiting your approval
          </div>
        </div>
      </div>

      <WorkplanApprovalList initialPending={pending} />
    </div>
  );
}
