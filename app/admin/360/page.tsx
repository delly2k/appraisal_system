"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssignReviewerModal } from "@/components/feedback/AssignReviewerModal";

interface FeedbackCycle {
  id: string;
  cycle_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  linked_appraisal_cycle_id: string;
  peer_feedback_visible_to_reviewee?: boolean;
  direct_report_feedback_visible_to_reviewee?: boolean;
}

interface ParticipantResult {
  employee_id: string;
  full_name: string;
  self: { count: number; avg: number; comments: string[] } | null;
  peer: { count: number; avg: number; comments: string[] } | null;
  direct_report: { count: number; avg: number; comments: string[] } | null;
}

interface CycleResults {
  cycle: { id: string; cycle_name: string; status: string };
  results: ParticipantResult[];
}

interface AssignmentReviewer {
  id: string;
  reviewer_employee_id: string;
  reviewer_name: string;
  reviewer_type: string;
  status: string;
}

interface ParticipantAssignment {
  participant_employee_id: string;
  participant_name: string;
  participant_department_name?: string;
  participant_job_title?: string;
  reviewers: AssignmentReviewer[];
}

interface CycleAssignments {
  cycle: { id: string; cycle_name: string; status: string; end_date?: string | null };
  participants: ParticipantAssignment[];
}

interface EligibleEmployee {
  employee_id: string;
  full_name: string | null;
  email?: string | null;
  job_title?: string | null;
  department_name?: string | null;
}

const Feedback360Icon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

/** Deterministic soft background from string (e.g. employee id or name) */
function avatarColor(id: string): string {
  let n = 0;
  for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
  const hues = ["#e9d5ff", "#c7d2fe", "#bbf7d0", "#fde68a", "#fed7aa", "#fbcfe8"];
  return hues[n % hues.length];
}

function getInitials(name: string, fallbackId?: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (name.length >= 2) return name.slice(0, 2).toUpperCase();
  return (fallbackId ?? "?").slice(0, 2).toUpperCase();
}

function formatDueDate(date: string | null | undefined): string {
  if (!date) return "—";
  try {
    const d = new Date(date);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

/** Status pill: Completed=green, In Progress=blue, Pending=amber, Not Started/else=grey; Active=green, Closed=grey */
function statusPillStyle(status: string, isCycle = false): React.CSSProperties {
  const s = (status || "").toLowerCase();
  if (isCycle) {
    if (s === "active") return { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" };
    return { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" };
  }
  if (s === "completed") return { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" };
  if (s === "in progress") return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
  if (s === "pending") return { background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" };
  return { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" };
}

function typePillStyle(type: string): React.CSSProperties {
  const t = (type || "").toUpperCase();
  if (t === "SELF") return { background: "#f3e8ff", color: "#6b21a8", border: "1px solid #e9d5ff" };
  if (t === "PEER") return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
  if (t === "DIRECT_REPORT") return { background: "#fce7f3", color: "#9d174d", border: "1px solid #fbcfe8" };
  if (t === "MANAGER") return { background: "#ecfccb", color: "#365314", border: "1px solid #bef264" };
  return { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" };
}

function reviewerChipColor(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "completed") return "#22c55e";
  if (s === "in progress") return "#3b82f6";
  if (s === "pending") return "#f59e0b";
  return "#94a3b8";
}

const AVATAR_COLORS = ["#4f46e5", "#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6"];

function StatusPill({ status }: { status: string }) {
  const normalized = (status || "").toUpperCase().replace(/\s+/g, "_");
  const map: Record<string, { label: string; className: string }> = {
    SUBMITTED: { label: "Submitted", className: "bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]" },
    IN_PROGRESS: { label: "In progress", className: "bg-[#fffbeb] border-[#fcd34d] text-[#92400e]" },
    COMPLETED: { label: "Completed", className: "bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]" },
    PENDING: { label: "Pending", className: "bg-[#f8faff] border-[#dde5f5] text-[#8a97b8]" },
    NOT_STARTED: { label: "Not started", className: "bg-[#f8faff] border-[#dde5f5] text-[#8a97b8]" },
  };
  const s = map[normalized] ?? map.PENDING;
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-semibold", s.className)}>
      {s.label}
    </span>
  );
}

function scoreBarColor(score: number): string {
  if (score >= 4) return "#22c55e";
  if (score >= 3) return "#3b82f6";
  return "#f59e0b";
}

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: "10.5px",
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "#8a97b8",
  background: "#f8faff",
  borderBottom: "1px solid #dde5f5",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13.5px",
  verticalAlign: "middle",
  borderBottom: "1px solid #dde5f5",
};

export default function Admin360Page() {
  const [cycles, setCycles] = useState<FeedbackCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultsCycleId, setResultsCycleId] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<CycleResults | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [assignmentsCycleId, setAssignmentsCycleId] = useState<string | null>(null);
  const [assignmentsData, setAssignmentsData] = useState<CycleAssignments | null>(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  /** Detail modal: one participant in one cycle for results + reviewers + add/remove */
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCycleId, setDetailCycleId] = useState<string | null>(null);
  const [detailParticipant, setDetailParticipant] = useState<ParticipantAssignment | null>(null);
  const [detailResults, setDetailResults] = useState<CycleResults | null>(null);
  const [detailResultsLoading, setDetailResultsLoading] = useState(false);
  /** Which cycle is expanded to show participants table (overview) */
  const [participantsOverviewCycleId, setParticipantsOverviewCycleId] = useState<string | null>(null);
  const [participantsOverviewData, setParticipantsOverviewData] = useState<CycleAssignments | null>(null);
  const [participantsOverviewLoading, setParticipantsOverviewLoading] = useState(false);

  /** Cycle cards: expanded cycle and cache of assignments + results per cycle */
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [cycleDataCache, setCycleDataCache] = useState<Record<string, { assignments: CycleAssignments; results: CycleResults | null }>>({});
  const [cycleDataLoading, setCycleDataLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  /** Assign reviewer modal: participant + cycle when opened from a row */
  const [assignTarget, setAssignTarget] = useState<{ participant: ParticipantAssignment; cycleId: string } | null>(null);

  /** Add reviewer from the detail modal (participant is fixed) */
  const [modalAddReviewerEmployeeId, setModalAddReviewerEmployeeId] = useState("");
  const [modalAddReviewerType, setModalAddReviewerType] = useState<"PEER" | "DIRECT_REPORT" | "MANAGER">("PEER");
  const [modalAddSubmitting, setModalAddSubmitting] = useState(false);

  /** Eligible employees for reviewer lookup (detail modal) */
  const [modalEligibleEmployees, setModalEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [modalEligibleLoading, setModalEligibleLoading] = useState(false);

  /** Close cycle / reopen / remove response in progress */
  const [closeCycleLoading, setCloseCycleLoading] = useState<string | null>(null);
  const [reopenLoading, setReopenLoading] = useState<string | null>(null);
  const [removeResponseLoading, setRemoveResponseLoading] = useState<string | null>(null);

  const loadCycles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feedback/cycles");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load 360 cycles");
        setCycles([]);
        return;
      }
      setCycles(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  /** Fetch eligible reviewers for modal when participant and type are set */
  useEffect(() => {
    if (!detailOpen || !detailParticipant) {
      setModalEligibleEmployees([]);
      return;
    }
    setModalEligibleLoading(true);
    const params = new URLSearchParams({
      participant_employee_id: detailParticipant.participant_employee_id,
      reviewer_type: modalAddReviewerType,
    });
    fetch(`/api/admin/feedback/eligible-reviewers?${params}`)
      .then((r) => r.json().catch(() => ({})))
      .then((data) => setModalEligibleEmployees(Array.isArray(data.employees) ? data.employees : []))
      .finally(() => setModalEligibleLoading(false));
  }, [detailOpen, detailParticipant?.participant_employee_id, modalAddReviewerType]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 3000);
  };

  const loadResults = async (cycleId: string) => {
    if (resultsCycleId === cycleId && resultsData) {
      setResultsCycleId(null);
      setResultsData(null);
      return;
    }
    setResultsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback/cycles/${cycleId}/results`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load results");
        return;
      }
      setResultsCycleId(cycleId);
      setResultsData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load results");
    } finally {
      setResultsLoading(false);
    }
  };

  const loadAssignments = async (cycleId: string) => {
    if (assignmentsCycleId === cycleId && assignmentsData) {
      setAssignmentsCycleId(null);
      setAssignmentsData(null);
      return;
    }
    setAssignmentsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback/cycles/${cycleId}/assignments`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load assignments");
        return;
      }
      setAssignmentsCycleId(cycleId);
      setAssignmentsData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load assignments");
    } finally {
      setAssignmentsLoading(false);
    }
  };

  /** Load participants for overview (reviewee + status + reviewers); used for "View participants" */
  const loadParticipantsOverview = async (cycleId: string) => {
    if (participantsOverviewCycleId === cycleId && participantsOverviewData) {
      setParticipantsOverviewCycleId(null);
      setParticipantsOverviewData(null);
      return;
    }
    setParticipantsOverviewLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback/cycles/${cycleId}/assignments`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load participants");
        return;
      }
      setParticipantsOverviewCycleId(cycleId);
      setParticipantsOverviewData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load participants");
    } finally {
      setParticipantsOverviewLoading(false);
    }
  };

  /** Load assignments + results for a cycle and cache; used when expanding a cycle card */
  const loadCycleData = useCallback(async (cycleId: string) => {
    if (cycleDataCache[cycleId]) return;
    setCycleDataLoading(cycleId);
    setError(null);
    try {
      const [assignRes, resultsRes] = await Promise.all([
        fetch(`/api/admin/feedback/cycles/${cycleId}/assignments`),
        fetch(`/api/admin/feedback/cycles/${cycleId}/results`),
      ]);
      const assignments = await assignRes.json().catch(() => ({}));
      const results = await resultsRes.json().catch(() => ({}));
      if (!assignRes.ok || !assignments.participants) {
        setError(assignments.error ?? "Failed to load cycle data");
        return;
      }
      setCycleDataCache((prev) => ({
        ...prev,
        [cycleId]: {
          assignments,
          results: results.results ? results : null,
        },
      }));
      setAssignmentsCycleId(cycleId);
      setAssignmentsData(assignments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cycle data");
    } finally {
      setCycleDataLoading(null);
    }
  }, [cycleDataCache]);

  const toggleCycleExpand = useCallback(
    async (cycleId: string) => {
      if (expandedCycleId === cycleId) {
        setExpandedCycleId(null);
        return;
      }
      setExpandedCycleId(cycleId);
      await loadCycleData(cycleId);
    },
    [expandedCycleId, loadCycleData]
  );

  const openDetailModal = (cycleId: string, participant: ParticipantAssignment) => {
    setDetailCycleId(cycleId);
    setDetailParticipant(participant);
    setDetailResults(null);
    setDetailOpen(true);
    setDetailResultsLoading(true);
    setError(null);
    fetch(`/api/admin/feedback/cycles/${cycleId}/results`)
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (data.cycle && data.results) {
          setDetailResults(data);
        }
      })
      .catch(() => {})
      .finally(() => setDetailResultsLoading(false));
  };

  const closeDetailModal = () => {
    setDetailOpen(false);
    setDetailCycleId(null);
    setDetailParticipant(null);
    setDetailResults(null);
  };

  const removeReviewer = async (cycleId: string, reviewerId: string) => {
    setError(null);
    const res = await fetch(`/api/admin/feedback/cycles/${cycleId}/reviewers/${reviewerId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to remove reviewer");
      return;
    }
    showSuccess("Reviewer removed.");
    if (assignmentsCycleId === cycleId && assignmentsData) {
      loadAssignments(cycleId);
    }
    // Refresh participants overview and detail modal if showing this cycle
    const refetch = () =>
      fetch(`/api/admin/feedback/cycles/${cycleId}/assignments`)
        .then((r) => r.json().catch(() => ({})))
        .then((refetched) => {
          if (!refetched.participants) return;
          if (detailCycleId === cycleId && detailParticipant) {
            const next = refetched.participants.find(
              (p: ParticipantAssignment) => p.participant_employee_id === detailParticipant.participant_employee_id
            );
            if (next) setDetailParticipant(next);
          }
          if (participantsOverviewCycleId === cycleId) {
            setParticipantsOverviewData((prev) => (prev ? { ...prev, participants: refetched.participants } : null));
          }
          setCycleDataCache((prev) => {
            const cur = prev[cycleId];
            if (!cur) return prev;
            return { ...prev, [cycleId]: { ...cur, assignments: { ...cur.assignments, participants: refetched.participants } } };
          });
        });
    refetch();
  };

  const closeCycle = async (cycleId: string) => {
    setError(null);
    setCloseCycleLoading(cycleId);
    try {
      const res = await fetch(`/api/admin/feedback/cycles/${cycleId}/close`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to close cycle");
        return;
      }
      showSuccess("Cycle closed.");
      loadCycles();
      setCycleDataCache((prev) => {
        const next = { ...prev };
        delete next[cycleId];
        return next;
      });
      if (expandedCycleId === cycleId) setExpandedCycleId(null);
    } finally {
      setCloseCycleLoading(null);
    }
  };

  const reopenReviewer = async (cycleId: string, reviewerId: string) => {
    setError(null);
    setReopenLoading(reviewerId);
    try {
      const res = await fetch(`/api/admin/feedback/cycles/${cycleId}/reviewers/${reviewerId}/reopen`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to reopen");
        return;
      }
      showSuccess("Review reopened.");
      const refetched = await fetch(`/api/admin/feedback/cycles/${cycleId}/assignments`).then((r) => r.json().catch(() => ({})));
      if (refetched.participants && detailCycleId === cycleId && detailParticipant) {
        const next = refetched.participants.find(
          (p: ParticipantAssignment) => p.participant_employee_id === detailParticipant.participant_employee_id
        );
        if (next) setDetailParticipant(next);
      }
      setCycleDataCache((prev) => {
        const cur = prev[cycleId];
        if (!cur) return prev;
        return { ...prev, [cycleId]: { ...cur, assignments: { ...cur.assignments, participants: refetched.participants } } };
      });
    } finally {
      setReopenLoading(null);
    }
  };

  const removeResponse = async (cycleId: string, reviewerId: string) => {
    setError(null);
    setRemoveResponseLoading(reviewerId);
    try {
      const res = await fetch(`/api/admin/feedback/cycles/${cycleId}/reviewers/${reviewerId}/remove-response`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to remove response");
        return;
      }
      showSuccess("Response removed.");
      const refetched = await fetch(`/api/admin/feedback/cycles/${cycleId}/assignments`).then((r) => r.json().catch(() => ({})));
      if (refetched.participants && detailCycleId === cycleId && detailParticipant) {
        const next = refetched.participants.find(
          (p: ParticipantAssignment) => p.participant_employee_id === detailParticipant.participant_employee_id
        );
        if (next) setDetailParticipant(next);
      }
      setCycleDataCache((prev) => {
        const cur = prev[cycleId];
        if (!cur) return prev;
        return { ...prev, [cycleId]: { ...cur, assignments: { ...cur.assignments, participants: refetched.participants } } };
      });
    } finally {
      setRemoveResponseLoading(null);
    }
  };

  const addReviewerInModal = async () => {
    if (!detailCycleId || !detailParticipant || !modalAddReviewerEmployeeId.trim()) {
      setError("Select a reviewer.");
      return;
    }
    setError(null);
    setModalAddSubmitting(true);
    try {
      const res = await fetch(`/api/admin/feedback/cycles/${detailCycleId}/reviewers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_employee_id: detailParticipant.participant_employee_id,
          reviewer_employee_id: modalAddReviewerEmployeeId.trim(),
          reviewer_type: modalAddReviewerType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add reviewer");
        return;
      }
      showSuccess("Reviewer added.");
      setModalAddReviewerEmployeeId("");
      const refetched = await fetch(`/api/admin/feedback/cycles/${detailCycleId}/assignments`).then((r) => r.json().catch(() => ({})));
      if (refetched.participants && detailParticipant) {
        const next = refetched.participants.find(
          (p: ParticipantAssignment) => p.participant_employee_id === detailParticipant.participant_employee_id
        );
        if (next) setDetailParticipant(next);
      }
      if (participantsOverviewCycleId === detailCycleId) {
        setParticipantsOverviewData((prev) => (prev ? { ...prev, participants: refetched.participants } : null));
      }
      setCycleDataCache((prev) => {
        const cur = prev[detailCycleId];
        if (!cur) return prev;
        return { ...prev, [detailCycleId]: { ...cur, assignments: { ...cur.assignments, participants: refetched.participants } } };
      });
      if (assignmentsCycleId === detailCycleId) {
        loadAssignments(detailCycleId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add reviewer");
    } finally {
      setModalAddSubmitting(false);
    }
  };

  const refetchCycleAssignments = useCallback((cycleId: string) => {
    fetch(`/api/admin/feedback/cycles/${cycleId}/assignments`)
      .then((r) => r.json().catch(() => ({})))
      .then((refetched) => {
        if (!refetched.participants) return;
        setCycleDataCache((prev) => {
          const cur = prev[cycleId];
          if (!cur) return prev;
          return { ...prev, [cycleId]: { ...cur, assignments: { ...cur.assignments, participants: refetched.participants } } };
        });
        if (participantsOverviewCycleId === cycleId) {
          setParticipantsOverviewData((prev) => (prev ? { ...prev, participants: refetched.participants } : null));
        }
        if (assignmentsCycleId === cycleId) {
          setAssignmentsData((prev) => (prev ? { ...prev, participants: refetched.participants } : null));
        }
      });
  }, [participantsOverviewCycleId, assignmentsCycleId]);

  return (
    <div style={{ animation: "fadeUp 0.4s ease both" }}>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "4px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #f3e8ff, #e9d5ff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "#7c3aed",
            }}
          >
            <Feedback360Icon />
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
            All 360 Reviews
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
          View all 360 cycle results, participants, and assignments.
        </p>
      </div>

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            padding: "14px 16px",
            borderRadius: "10px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            marginBottom: "20px",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "#991b1b" }}>Error</div>
            <div style={{ fontSize: "13px", color: "#b91c1b" }}>{error}</div>
          </div>
        </div>
      )}
      {success && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
            padding: "14px 16px",
            borderRadius: "10px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            marginBottom: "20px",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "#166534" }}>Success</div>
            <div style={{ fontSize: "13px", color: "#15803d" }}>{success}</div>
          </div>
        </div>
      )}

      {/* All 360 cycles & results — cycle cards, participants table, detail modal */}
      <div
        style={{
          background: "white",
          borderRadius: "14px",
          border: "1px solid #dde5f5",
          boxShadow: "0 2px 12px rgba(15,31,61,0.07), 0 0 1px rgba(15,31,61,0.1)",
          overflow: "hidden",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "1px solid #dde5f5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "9px",
                background: "#eff6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#3b82f6",
              }}
            >
              <Feedback360Icon />
            </div>
            <div>
              <div style={{ fontFamily: "Sora, sans-serif", fontSize: "15px", fontWeight: 600, color: "#0f1f3d" }}>
                All 360 cycles and results
              </div>
              <div style={{ fontSize: "12px", color: "#8a97b8", marginTop: "1px" }}>
                View aggregate results by participant for each cycle
              </div>
            </div>
          </div>
          <input
            type="search"
            placeholder="Search participants by name or department…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #dde5f5",
              fontSize: "13px",
              minWidth: "260px",
              background: "#f8faff",
            }}
          />
        </div>

        <div style={{ padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: "72px",
                    borderRadius: "12px",
                    background: "#f1f5f9",
                  }}
                />
              ))}
            </div>
          ) : cycles.length === 0 ? (
            <p style={{ textAlign: "center", fontSize: "13px", color: "#8a97b8", padding: "24px" }}>No 360 feedback cycles yet.</p>
          ) : (
            cycles.map((c) => {
              const cached = cycleDataCache[c.id];
              const assignments = cached?.assignments;
              const results = cached?.results;
              const isExpanded = expandedCycleId === c.id;
              const isLoading = cycleDataLoading === c.id;
              const participantCount = assignments?.participants?.length ?? 0;
              const allReviewers = assignments?.participants?.flatMap((p) => p.reviewers) ?? [];
              const completed = allReviewers.filter((r) => (r.status || "").toLowerCase() === "completed").length;
              const inProgress = allReviewers.filter((r) => (r.status || "").toLowerCase() === "in progress").length;
              const pending = allReviewers.filter((r) => (r.status || "").toLowerCase() === "pending").length;
              const notStarted = allReviewers.length - completed - inProgress - pending;
              const q = searchQuery.trim().toLowerCase();
              const filteredParticipants =
                assignments?.participants.filter((p) => {
                  if (!q) return true;
                  const name = (p.participant_name ?? "").toLowerCase();
                  const dept = (p.participant_department_name ?? "").toLowerCase();
                  return name.includes(q) || dept.includes(q);
                }) ?? [];

              return (
                <div
                  key={c.id}
                  className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden mb-4"
                >
                  <div className="w-full flex items-center justify-between gap-4 px-5 py-4 border-b border-[#dde5f5] bg-[#f8faff]">
                    <button
                      type="button"
                      onClick={() => toggleCycleExpand(c.id)}
                      className="flex-1 flex items-center gap-3 min-w-0 text-left"
                    >
                      <div className="w-9 h-9 rounded-[10px] bg-[#f5f3ff] border border-[#ddd6fe] flex items-center justify-center flex-shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                          <circle cx="12" cy="12" r="4" />
                          <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-['Sora'] text-[14px] font-bold text-[#0f1f3d]">
                            {c.cycle_name}
                          </span>
                          {c.status === "Active" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ecfdf5] border border-[#6ee7b7] text-[10px] font-semibold text-[#065f46]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" />
                              Active
                            </span>
                          )}
                          {c.status !== "Active" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f1f5f9] border border-[#e2e8f0] text-[10px] font-semibold text-[#64748b]">
                              {c.status}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8a97b8] mt-0.5">
                          Due {formatDueDate(c.end_date)}
                          {assignments != null && ` · ${participantCount} participant${participantCount !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <input
                        type="search"
                        placeholder="Search participants..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="border border-[#dde5f5] rounded-[8px] px-3 py-2 text-[11px] w-[200px] outline-none bg-white focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
                      />
                      {c.status === "Active" && (
                        <button
                          type="button"
                          onClick={() => closeCycle(c.id)}
                          disabled={closeCycleLoading === c.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#0d9488] bg-[#ccfbf1] text-[10px] font-semibold text-[#0f766e] hover:bg-[#99f6e4] disabled:opacity-50"
                        >
                          {closeCycleLoading === c.id ? "Closing…" : "Close cycle"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleCycleExpand(c.id)}
                        aria-expanded={isExpanded}
                        className={cn("transition-transform duration-200 text-[#8a97b8]", isExpanded && "rotate-90")}
                      >
                        <ChevronDown size={20} />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      overflow: "hidden",
                      transition: "max-height 0.35s ease-out",
                      maxHeight: isExpanded ? (filteredParticipants.length === 0 && !isLoading ? 120 : 8000) : 0,
                    }}
                  >
                    {isExpanded && (
                      <>
                        {isLoading ? (
                          <div className="p-6 flex flex-col gap-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <div key={i} className="h-12 rounded-lg bg-[#e2e8f0] opacity-70" />
                            ))}
                          </div>
                        ) : filteredParticipants.length === 0 ? (
                          <p className="text-center text-[13px] text-[#8a97b8] py-6">
                            {searchQuery.trim() ? "No participants match your search." : "No participants in this cycle yet."}
                          </p>
                        ) : (
                          <>
                            <div className="grid grid-cols-3 divide-x divide-[#dde5f5]">
                              {[
                                { label: "Completed", value: completed, color: "#059669" },
                                { label: "In progress", value: inProgress, color: "#3b82f6" },
                                { label: "Pending", value: pending + notStarted, color: "#d97706" },
                              ].map((kpi) => (
                                <div key={kpi.label} className="flex flex-col items-center py-4 gap-0.5">
                                  <span className="font-['Sora'] text-[22px] font-bold" style={{ color: kpi.color }}>
                                    {kpi.value}
                                  </span>
                                  <span className="text-[10px] font-medium uppercase tracking-[.06em] text-[#8a97b8]">
                                    {kpi.label}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="bg-[#f8faff] border-t border-[#dde5f5]">
                                  {["Participant", "Reviewers", "Self score", "Peer avg", "Self status", "Progress", ""].map((h) => (
                                    <th
                                      key={h}
                                      className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[.06em] text-[#8a97b8] whitespace-nowrap"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {filteredParticipants.map((p) => {
                                  const selfReviewer = p.reviewers.find((r) => r.reviewer_type === "SELF");
                                  const completedCount = p.reviewers.filter((r) => (r.status || "").toLowerCase() === "completed").length;
                                  const totalCount = p.reviewers.length;
                                  const resultRow = results?.results?.find((r) => r.employee_id === p.participant_employee_id);
                                  const selfScore = resultRow?.self?.avg;
                                  const peerScore = resultRow?.peer?.avg;
                                  return (
                                    <tr key={p.participant_employee_id} className="border-t border-[#dde5f5] hover:bg-[#f8faff] transition-colors">
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                          <div
                                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
                                            style={{ background: "#4f46e5" }}
                                          >
                                            {getInitials(p.participant_name, p.participant_employee_id)}
                                          </div>
                                          <div>
                                            <p className="text-[12px] font-semibold text-[#0f1f3d]">{p.participant_name}</p>
                                            <p className="text-[10px] text-[#8a97b8]">{p.participant_department_name ?? "—"}</p>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex">
                                          {p.reviewers.slice(0, 5).map((r, i) => (
                                            <div
                                              key={r.id}
                                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-white flex-shrink-0"
                                              style={{
                                                background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                                                marginLeft: i === 0 ? 0 : -6,
                                                zIndex: 5 - i,
                                              }}
                                            >
                                              {getInitials(r.reviewer_name, r.reviewer_employee_id)}
                                            </div>
                                          ))}
                                          {p.reviewers.length === 0 && (
                                            <span className="text-[11px] text-[#8a97b8]">None assigned</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        {selfScore != null ? (
                                          <div className="flex items-center gap-2">
                                            <div className="w-14 h-1 rounded-full bg-[#dde5f5] overflow-hidden">
                                              <div
                                                className="h-full rounded-full bg-[#d97706]"
                                                style={{ width: `${(selfScore / 5) * 100}%` }}
                                              />
                                            </div>
                                            <span className="text-[12px] text-[#0f1f3d]">{selfScore.toFixed(1)}</span>
                                          </div>
                                        ) : (
                                          <span className="text-[12px] text-[#8a97b8]">—</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        {peerScore != null ? (
                                          <span className="text-[12px] text-[#0f1f3d]">{peerScore.toFixed(1)}</span>
                                        ) : (
                                          <span className="text-[12px] text-[#8a97b8]">—</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        <StatusPill status={selfReviewer?.status ?? "PENDING"} />
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-14 h-1 rounded-full bg-[#dde5f5] overflow-hidden">
                                            <div
                                              className="h-full rounded-full bg-[#0d9488]"
                                              style={{
                                                width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%",
                                              }}
                                            />
                                          </div>
                                          <span className="text-[11px] text-[#8a97b8]">
                                            {completedCount}/{totalCount}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setAssignTarget({ participant: p, cycleId: c.id });
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] text-[11px] font-semibold hover:bg-[#dbeafe] transition-colors"
                                          >
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                              <line x1="12" y1="5" x2="12" y2="19" />
                                              <line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                            Assign reviewer
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openDetailModal(c.id, p);
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#dde5f5] bg-white text-[#4a5a82] text-[11px] font-semibold hover:border-[#0f1f3d] hover:text-[#0f1f3d] transition-colors"
                                          >
                                            View details
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AssignReviewerModal
        isOpen={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        participant={assignTarget ? assignTarget.participant : null}
        cycleId={assignTarget?.cycleId ?? ""}
        cycleLabel={assignTarget ? cycles.find((x) => x.id === assignTarget.cycleId)?.cycle_name ?? "" : ""}
        onSuccess={() => {
          if (assignTarget) {
            showSuccess("Reviewer added.");
            refetchCycleAssignments(assignTarget.cycleId);
            setAssignTarget(null);
          }
        }}
      />

      {/* Detail modal: one reviewee in one cycle — results + reviewers + add/remove; portaled to body so overlay covers entire screen */}
      {detailOpen && detailCycleId && detailParticipant && typeof document !== "undefined" && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(15,31,61,0.35)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            padding: "24px",
            boxSizing: "border-box",
          }}
          onClick={(e) => e.target === e.currentTarget && closeDetailModal()}
        >
          <div
            style={{
              background: "white",
              borderRadius: "14px",
              border: "1px solid #dde5f5",
              boxShadow: "0 20px 60px rgba(15,31,61,0.2)",
              maxWidth: "700px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                background: "white",
                padding: "20px 24px",
                borderBottom: "1px solid #dde5f5",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: avatarColor(detailParticipant.participant_employee_id),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#0f1f3d",
                    flexShrink: 0,
                  }}
                >
                  {getInitials(detailParticipant.participant_name, detailParticipant.participant_employee_id)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2 id="detail-modal-title" style={{ fontFamily: "Sora, sans-serif", fontSize: "18px", fontWeight: 600, color: "#0f1f3d", margin: 0 }}>
                    {detailParticipant.participant_name}
                  </h2>
                  <p style={{ fontSize: "13px", color: "#8a97b8", marginTop: "2px" }}>
                    {[detailParticipant.participant_job_title, detailParticipant.participant_department_name].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p style={{ fontSize: "12px", color: "#8a97b8", marginTop: "6px" }}>
                    {cycles.find((c) => c.id === detailCycleId)?.cycle_name ?? ""}
                    {cycles.find((c) => c.id === detailCycleId)?.status && (
                      <span
                        style={{
                          marginLeft: "8px",
                          display: "inline-flex",
                          padding: "2px 8px",
                          borderRadius: "20px",
                          fontSize: "10.5px",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          ...statusPillStyle(cycles.find((c) => c.id === detailCycleId)!.status, true),
                        }}
                      >
                        {cycles.find((c) => c.id === detailCycleId)?.status}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                aria-label="Close"
                style={{
                  padding: "8px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: "transparent",
                  color: "#64748b",
                  border: "none",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f1f5f9";
                  e.currentTarget.style.color = "#0f1f3d";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#64748b";
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", overflow: "auto", flex: 1 }}>
              {/* Results: three score cards */}
              <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: "11px", fontWeight: 600, color: "#8a97b8", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Results
              </h3>
              {detailResultsLoading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ height: "80px", borderRadius: "10px", background: "#f1f5f9" }} />
                  ))}
                </div>
              ) : detailResults ? (
                (() => {
                  const resultRow = detailResults.results.find((r) => r.employee_id === detailParticipant.participant_employee_id);
                  const selfVal = resultRow?.self?.avg;
                  const peerVal = resultRow?.peer?.avg;
                  const directVal = resultRow?.direct_report?.avg;
                  const cards = [
                    { label: "Self", value: selfVal, empty: selfVal == null },
                    { label: "Peer avg", value: peerVal, empty: peerVal == null },
                    { label: "Direct reports avg", value: directVal, empty: directVal == null },
                  ];
                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
                      {cards.map((card) => (
                        <div
                          key={card.label}
                          style={{
                            padding: "14px 16px",
                            borderRadius: "10px",
                            background: card.empty ? "#f8fafc" : "white",
                            border: "1px solid #dde5f5",
                            opacity: card.empty ? 0.85 : 1,
                          }}
                        >
                          <div style={{ fontSize: "10px", fontWeight: 600, color: "#8a97b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                            {card.label}
                          </div>
                          {card.empty ? (
                            <span style={{ fontSize: "15px", color: "#94a3b8" }}>—</span>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "48px", height: "6px", borderRadius: "3px", background: "#e2e8f0", overflow: "hidden" }}>
                                <div
                                  style={{
                                    width: `${((card.value ?? 0) / 5) * 100}%`,
                                    height: "100%",
                                    background: scoreBarColor(card.value ?? 0),
                                    borderRadius: "3px",
                                  }}
                                />
                              </div>
                              <span style={{ fontWeight: 600, fontSize: "15px" }}>{(card.value ?? 0).toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
                  {["Self", "Peer avg", "Direct reports avg"].map((label) => (
                    <div key={label} style={{ padding: "14px 16px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #dde5f5" }}>
                      <div style={{ fontSize: "10px", fontWeight: 600, color: "#8a97b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>{label}</div>
                      <span style={{ fontSize: "15px", color: "#94a3b8" }}>—</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Reviewers */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                <h3 style={{ fontFamily: "Sora, sans-serif", fontSize: "11px", fontWeight: 600, color: "#8a97b8", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Reviewers
                </h3>
                {detailParticipant.reviewers.length > 0 && (
                  <span style={{ fontSize: "12px", color: "#8a97b8" }}>
                    {detailParticipant.reviewers.filter((r) => (r.status || "").toLowerCase() === "completed").length}/{detailParticipant.reviewers.length} completed
                  </span>
                )}
              </div>
              {cycles.find((c) => c.id === detailCycleId)?.status === "Active" && (
                <div style={{ marginBottom: "16px", padding: "14px", background: "#f1f5f9", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", color: "#8a97b8", marginBottom: "4px" }}>Employee ID</label>
                      <select
                        value={modalAddReviewerEmployeeId}
                        onChange={(e) => setModalAddReviewerEmployeeId(e.target.value)}
                        disabled={modalEligibleLoading}
                        style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #dde5f5", fontSize: "13px", minWidth: "200px" }}
                      >
                        <option value="">{modalEligibleLoading ? "Loading…" : "Select reviewer…"}</option>
                        {modalEligibleEmployees.map((emp) => (
                          <option key={emp.employee_id} value={emp.employee_id}>
                            {emp.full_name ?? emp.employee_id} {emp.department_name ? ` · ${emp.department_name}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "11px", color: "#8a97b8", marginBottom: "4px" }}>Type</label>
                      <select
                        value={modalAddReviewerType}
                        onChange={(e) => {
                          setModalAddReviewerType(e.target.value as "PEER" | "DIRECT_REPORT" | "MANAGER");
                          setModalAddReviewerEmployeeId("");
                        }}
                        style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #dde5f5", fontSize: "13px" }}
                      >
                        <option value="PEER">Peer</option>
                        <option value="DIRECT_REPORT">Direct Report</option>
                        <option value="MANAGER">Manager</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={addReviewerInModal}
                      disabled={modalAddSubmitting}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: 500,
                        cursor: modalAddSubmitting ? "not-allowed" : "pointer",
                        background: "#7c3aed",
                        color: "white",
                        border: "none",
                      }}
                    >
                      {modalAddSubmitting ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #dde5f5", borderRadius: "8px", overflow: "hidden" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Reviewer</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, width: "140px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detailParticipant.reviewers.map((r) => (
                    <tr key={r.id}>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: avatarColor(r.reviewer_employee_id),
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "#0f1f3d",
                            }}
                          >
                            {getInitials(r.reviewer_name, r.reviewer_employee_id)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{r.reviewer_name}</div>
                            <div style={{ fontSize: "11px", color: "#8a97b8" }}>{r.reviewer_employee_id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "3px 8px",
                            borderRadius: "20px",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            ...typePillStyle(r.reviewer_type),
                          }}
                        >
                          {r.reviewer_type === "DIRECT_REPORT" ? "Direct Report" : r.reviewer_type === "MANAGER" ? "Manager" : r.reviewer_type}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-flex",
                            padding: "3px 8px",
                            borderRadius: "20px",
                            fontSize: "10.5px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            ...statusPillStyle(r.status),
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                          {r.reviewer_type !== "SELF" && (
                            <>
                              {(r.status || "").toLowerCase() === "submitted" && cycles.find((x) => x.id === detailCycleId)?.status === "Active" && (
                                <button
                                  type="button"
                                  onClick={() => reopenReviewer(detailCycleId, r.id)}
                                  disabled={reopenLoading === r.id}
                                  style={{
                                    padding: 0,
                                    fontSize: "11px",
                                    fontWeight: 500,
                                    cursor: reopenLoading === r.id ? "not-allowed" : "pointer",
                                    background: "none",
                                    color: "#0d9488",
                                    border: "none",
                                  }}
                                >
                                  {reopenLoading === r.id ? "…" : "Reopen"}
                                </button>
                              )}
                              {(r.status || "").toLowerCase() === "submitted" && (
                                <button
                                  type="button"
                                  onClick={() => removeResponse(detailCycleId, r.id)}
                                  disabled={removeResponseLoading === r.id}
                                  style={{
                                    padding: 0,
                                    fontSize: "11px",
                                    fontWeight: 500,
                                    cursor: removeResponseLoading === r.id ? "not-allowed" : "pointer",
                                    background: "none",
                                    color: "#b45309",
                                    border: "none",
                                  }}
                                >
                                  {removeResponseLoading === r.id ? "…" : "Remove response"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeReviewer(detailCycleId, r.id)}
                                style={{
                                  padding: 0,
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  background: "none",
                                  color: "#b91c1c",
                                  border: "none",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "#991b1b";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "#b91c1c";
                                }}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detailParticipant.reviewers.length === 0 && (
                <p style={{ textAlign: "center", fontSize: "13px", color: "#8a97b8", padding: "16px 0" }}>No reviewers assigned.</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
