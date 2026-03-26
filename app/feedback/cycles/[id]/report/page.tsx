import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadGapAnalysisForParticipant } from "@/lib/feedback-gap-analysis";
import { GapAnalysisCard } from "@/components/feedback/gap-analysis-card";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase config required");
  return createClient(url, key);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default async function FeedbackReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return (
      <div className="w-full px-7 py-6">
        <div className="rounded-[14px] border border-[#dde5f5] bg-white p-6 shadow-[0_2px_12px_rgba(15,31,61,.07)]">
          <p className="text-[13px] text-[#8a97b8]">Please sign in to view your feedback report.</p>
        </div>
      </div>
    );
  }

  const { id } = await params;
  const supabase = getSupabase();
  const { data: cycle, error } = await supabase
    .from("feedback_cycle")
    .select("id, cycle_name, description, end_date, status, peer_feedback_visible_to_reviewee, direct_report_feedback_visible_to_reviewee")
    .eq("id", id)
    .maybeSingle();

  if (error || !cycle) {
    notFound();
  }

  const employeeId = user.employee_id ?? null;
  let peerSubmittedCount = 0;
  let directReportSubmittedCount = 0;
  let showPeerSection = false;
  let showDirectReportSection = false;

  if (employeeId) {
    const { data: reviewerRows } = await supabase
      .from("feedback_reviewer")
      .select("reviewer_type, status")
      .eq("cycle_id", id)
      .eq("participant_employee_id", employeeId);
    peerSubmittedCount = (reviewerRows ?? []).filter((r) => r.reviewer_type === "PEER" && r.status === "Submitted").length;
    directReportSubmittedCount = (reviewerRows ?? []).filter((r) => r.reviewer_type === "DIRECT_REPORT" && r.status === "Submitted").length;
    showPeerSection = Boolean(cycle.peer_feedback_visible_to_reviewee) && peerSubmittedCount >= 2;
    showDirectReportSection = Boolean(cycle.direct_report_feedback_visible_to_reviewee) && directReportSubmittedCount >= 2;
  }

  const gapAnalysis =
    employeeId ? await loadGapAnalysisForParticipant(supabase, id, employeeId) : [];

  return (
    <div className="w-full px-7 py-6 space-y-6">
      <div className="mb-5">
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#3b82f6] hover:text-[#1d4ed8] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to 360 Feedback
        </Link>
      </div>
      <div
        className="rounded-[14px] overflow-hidden mb-6"
        style={{
          background: "linear-gradient(135deg, #0a1628 0%, #0f1f3d 40%, #1a3260 75%, #1e3a73 100%)",
          boxShadow: "0 8px 32px rgba(15,31,61,0.20)",
        }}
      >
        <div className="px-6 py-6">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-white/40 mb-1">
            360 Feedback Report
          </p>
          <h1 className="font-['Sora'] text-[22px] font-extrabold text-white mb-0.5">{cycle.cycle_name}</h1>
          <p className="text-[13px] text-white/50">Closed {formatDate(cycle.end_date)}</p>
        </div>
      </div>
      {employeeId && (
        <div className="mb-6">
          <GapAnalysisCard gaps={gapAnalysis} />
        </div>
      )}
      <div className="rounded-[14px] border border-[#dde5f5] bg-white shadow-[0_2px_12px_rgba(15,31,61,.07)] overflow-hidden">
        <div className="p-5 space-y-3">
          <p className="text-[13px] text-[#4a5a82]">
            Your consolidated 360 feedback report for this cycle will appear here once the cycle is closed and reports are generated.
          </p>
          {employeeId && (
            <p className="text-[12px] text-[#8a97b8]">
              Peer feedback visible: {showPeerSection ? "Yes" : "No"} (need ≥2 submitted). Direct report feedback visible: {showDirectReportSection ? "Yes" : "No"} (need ≥2 submitted).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
