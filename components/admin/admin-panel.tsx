"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Cycle {
  id: string;
  name: string;
  cycle_type: string;
  fiscal_year: string;
  start_date: string;
  end_date: string;
  status: string;
  phase?: string;
}

interface Category {
  id: string;
  name: string;
  category_type: string;
  applies_to: string;
  active: boolean;
}

interface Factor {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  display_order: number;
  weight: number | null;
  active: boolean;
  category_name?: string;
}

interface RatingRow {
  id: string;
  code: string;
  factor: number;
  label: string;
}

interface Rule {
  id: string;
  rating_label: string;
  recommendation: string;
  description: string | null;
  active: boolean;
}

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

type CategoryForm = { name: string; category_type: string; applies_to: string };
type FactorForm = { category_id: string; name: string; description: string; display_order: number; weight: number };
type RuleForm = { rating_label: string; recommendation: string; description: string };
type CycleForm = { cycle_type: string; fiscal_year: string; start_date: string; end_date: string };

const emptyCategoryForm: CategoryForm = { name: "", category_type: "core", applies_to: "both" };
const emptyFactorForm: FactorForm = { category_id: "", name: "", description: "", display_order: 0, weight: 0 };
const emptyRuleForm: RuleForm = { rating_label: "", recommendation: "", description: "" };
const emptyCycleForm: CycleForm = { cycle_type: "annual", fiscal_year: "", start_date: "", end_date: "" };

// Icons
const CalendarIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const LayersIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const ListIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const StarIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const AwardIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
  </svg>
);

const UsersIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
  <svg style={{ width: 14, height: 14, animation: spinning ? "spin 1s linear infinite" : "none" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const PlusIcon = () => (
  <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const PencilIcon = () => (
  <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>
);

const TrashIcon = () => (
  <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const PlayIcon = () => (
  <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const LockIcon = () => (
  <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const AlertIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const Feedback360Icon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

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

const statusStyles: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  draft: { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0", dot: "#94a3b8" },
  open: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", dot: "#22c55e" },
  closed: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", dot: "#dc2626" },
};

export function AdminPanel() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [ratingScale, setRatingScale] = useState<RatingRow[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [feedbackCycles, setFeedbackCycles] = useState<FeedbackCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [cycleModal, setCycleModal] = useState<{ open: boolean; mode: "create" | "edit"; data: CycleForm; id?: string }>({ open: false, mode: "create", data: emptyCycleForm });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; mode: "create" | "edit"; data: CategoryForm; id?: string }>({ open: false, mode: "create", data: emptyCategoryForm });
  const [factorModal, setFactorModal] = useState<{ open: boolean; mode: "create" | "edit"; data: FactorForm; id?: string }>({ open: false, mode: "create", data: emptyFactorForm });
  const [ruleModal, setRuleModal] = useState<{ open: boolean; mode: "create" | "edit"; data: RuleForm; id?: string }>({ open: false, mode: "create", data: emptyRuleForm });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: string; id: string; name: string }>({ open: false, type: "", id: "", name: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const [cyclesRes, feedbackCyclesRes, catResp, facResp, scaleResp, ruleResp] = await Promise.all([
        fetch("/api/admin/cycles").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/admin/feedback/cycles").then((r) => (r.ok ? r.json() : [])),
        supabase.from("evaluation_categories").select("*").order("category_type"),
        supabase.from("evaluation_factors").select("id, category_id, name, description, display_order, weight, active").order("display_order"),
        supabase.from("rating_scale").select("id, code, factor, label").order("factor", { ascending: false }),
        supabase.from("recommendation_rules").select("*").order("rating_label"),
      ]);
      setCycles(Array.isArray(cyclesRes) ? (cyclesRes as Cycle[]) : []);
      setFeedbackCycles(Array.isArray(feedbackCyclesRes) ? (feedbackCyclesRes as FeedbackCycle[]) : []);
      const cats = (catResp.data ?? []) as Category[];
      setCategories(cats);
      const catMap = new Map(cats.map((c) => [c.id, c.name]));
      const facData = (facResp.data ?? []) as Factor[];
      setFactors(facData.map((f) => ({ ...f, category_name: catMap.get(f.category_id) ?? "—" })));
      setRatingScale((scaleResp.data ?? []) as RatingRow[]);
      setRules((ruleResp.data ?? []) as Rule[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleVisibilityChange = async (
    cycleId: string,
    field: "peer_feedback_visible_to_reviewee" | "direct_report_feedback_visible_to_reviewee",
    value: boolean
  ) => {
    setError(null);
    const res = await fetch(`/api/admin/feedback/cycles/${cycleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Update failed");
      return;
    }
    setFeedbackCycles((prev) =>
      prev.map((c) => (c.id === cycleId ? { ...c, [field]: value } : c))
    );
    showSuccess("Visibility updated.");
  };

  const saveCycle = async () => {
    const { data, mode, id } = cycleModal;
    if (!data.fiscal_year.trim() || !data.start_date || !data.end_date) {
      setError("All fields are required.");
      return;
    }
    setError(null);
    if (mode === "create") {
      const res = await fetch("/api/admin/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscal_year: data.fiscal_year, cycle_type: data.cycle_type, start_date: data.start_date, end_date: data.end_date }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { setError(result.error ?? "Failed to create cycle"); return; }
      showSuccess("Cycle created.");
    } else if (id) {
      const res = await fetch(`/api/admin/cycles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscal_year: data.fiscal_year, cycle_type: data.cycle_type, start_date: data.start_date, end_date: data.end_date }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { setError(result.error ?? "Failed to update cycle"); return; }
      showSuccess("Cycle updated.");
    }
    setCycleModal({ open: false, mode: "create", data: emptyCycleForm });
    load();
  };

  const setCycleStatus = async (id: string, status: string) => {
    setError(null);
    if (status === "open") {
      const res = await fetch(`/api/cycles/${id}/open`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Failed to open cycle"); return; }
      const created = data.data?.appraisalsCreated ?? 0;
      showSuccess(created > 0 ? `Cycle opened (Planning Phase). ${created} appraisal(s) created.` : "Cycle opened (Planning Phase).");
    } else {
      const res = await fetch(`/api/admin/cycles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Failed to update cycle"); return; }
      showSuccess(`Cycle ${status}.`);
    }
    load();
  };

  const openAssessmentPhase = async (cycleId: string) => {
    setError(null);
    const res = await fetch(`/api/cycles/${cycleId}/open-assessment`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { 
      setError(data.error ?? "Failed to open assessment phase"); 
      return; 
    }
    const stats = data.stats ?? {};
    showSuccess(`Assessment phase opened. ${stats.approved_workplans ?? 0} approved workplans ready for evaluation.`);
    load();
  };

  const saveCategory = async () => {
    const { data, mode, id } = categoryModal;
    if (!data.name.trim()) { setError("Name is required."); return; }
    setError(null);
    const supabase = createClient();
    if (mode === "create") {
      const { error: e } = await supabase.from("evaluation_categories").insert({ name: data.name, category_type: data.category_type, applies_to: data.applies_to });
      if (e) { setError(e.message); return; }
      showSuccess("Category created.");
    } else if (id) {
      const { error: e } = await supabase.from("evaluation_categories").update({ name: data.name, category_type: data.category_type, applies_to: data.applies_to }).eq("id", id);
      if (e) { setError(e.message); return; }
      showSuccess("Category updated.");
    }
    setCategoryModal({ open: false, mode: "create", data: emptyCategoryForm });
    load();
  };

  const deleteCategory = async (id: string) => {
    const supabase = createClient();
    const { error: e } = await supabase.from("evaluation_categories").delete().eq("id", id);
    if (e) {
      if (e.code === "23503" || e.message.includes("violates foreign key")) {
        setError("Cannot delete category: It has related factors. Delete the factors first.");
      } else { setError(e.message); }
      return;
    }
    showSuccess("Category deleted.");
    load();
  };

  const saveFactor = async () => {
    const { data, mode, id } = factorModal;
    if (!data.category_id || !data.name.trim()) { setError("Category and name are required."); return; }
    setError(null);
    const supabase = createClient();
    if (mode === "create") {
      const { error: e } = await supabase.from("evaluation_factors").insert({ category_id: data.category_id, name: data.name, description: data.description || null, display_order: data.display_order, weight: data.weight || null });
      if (e) { setError(e.message); return; }
      showSuccess("Factor created.");
    } else if (id) {
      const { error: e } = await supabase.from("evaluation_factors").update({ category_id: data.category_id, name: data.name, description: data.description || null, display_order: data.display_order, weight: data.weight || null }).eq("id", id);
      if (e) { setError(e.message); return; }
      showSuccess("Factor updated.");
    }
    setFactorModal({ open: false, mode: "create", data: emptyFactorForm });
    load();
  };

  const toggleFactorActive = async (factor: Factor) => {
    const supabase = createClient();
    const { error: e } = await supabase.from("evaluation_factors").update({ active: !factor.active }).eq("id", factor.id);
    if (e) { setError(e.message); return; }
    showSuccess("Factor updated.");
    load();
  };

  const deleteFactor = async (id: string) => {
    const supabase = createClient();
    const { error: e } = await supabase.from("evaluation_factors").delete().eq("id", id);
    if (e) {
      if (e.code === "23503" || e.message.includes("violates foreign key")) {
        setError("Cannot delete factor: It has related appraisal ratings. Deactivate it instead.");
      } else { setError(e.message); }
      return;
    }
    showSuccess("Factor deleted.");
    load();
  };

  const saveRule = async () => {
    const { data, mode, id } = ruleModal;
    if (!data.rating_label.trim() || !data.recommendation.trim()) { setError("Rating label and recommendation are required."); return; }
    setError(null);
    const supabase = createClient();
    if (mode === "create") {
      const { error: e } = await supabase.from("recommendation_rules").insert({ rating_label: data.rating_label, recommendation: data.recommendation, description: data.description || null });
      if (e) { setError(e.message); return; }
      showSuccess("Rule created.");
    } else if (id) {
      const { error: e } = await supabase.from("recommendation_rules").update({ rating_label: data.rating_label, recommendation: data.recommendation, description: data.description || null }).eq("id", id);
      if (e) { setError(e.message); return; }
      showSuccess("Rule updated.");
    }
    setRuleModal({ open: false, mode: "create", data: emptyRuleForm });
    load();
  };

  const toggleRuleActive = async (rule: Rule) => {
    const supabase = createClient();
    const { error: e } = await supabase.from("recommendation_rules").update({ active: !rule.active }).eq("id", rule.id);
    if (e) { setError(e.message); return; }
    showSuccess("Rule updated.");
    load();
  };

  const deleteRule = async (id: string) => {
    const supabase = createClient();
    const { error: e } = await supabase.from("recommendation_rules").delete().eq("id", id);
    if (e) {
      if (e.code === "23503" || e.message.includes("violates foreign key")) {
        setError("Cannot delete rule: It has related records. Deactivate it instead.");
      } else { setError(e.message); }
      return;
    }
    showSuccess("Rule deleted.");
    load();
  };

  const handleDeleteConfirm = async () => {
    const { type, id } = deleteConfirm;
    setDeleteConfirm({ open: false, type: "", id: "", name: "" });
    if (type === "category") await deleteCategory(id);
    else if (type === "factor") await deleteFactor(id);
    else if (type === "rule") await deleteRule(id);
  };

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/employees", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      showSuccess(`Synced: ${data.employees_synced ?? 0} employees, ${data.reporting_lines_synced ?? 0} reporting lines.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <p style={{ color: "#8a97b8", padding: "16px 0" }}>Loading admin…</p>;

  const CardWrapper = ({ children, title, subtitle, icon, iconBg, iconColor, rightAction, delay }: { children: React.ReactNode; title: string; subtitle?: string; icon: React.ReactNode; iconBg: string; iconColor: string; rightAction?: React.ReactNode; delay?: string }) => (
    <div style={{ background: "white", borderRadius: "14px", border: "1px solid #dde5f5", boxShadow: "0 2px 12px rgba(15,31,61,0.07), 0 0 1px rgba(15,31,61,0.1)", overflow: "hidden", marginBottom: "20px", animation: "fadeUp 0.4s ease both", animationDelay: delay }}>
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #dde5f5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: iconColor }}>{icon}</div>
          <div>
            <div style={{ fontFamily: "Sora, sans-serif", fontSize: "15px", fontWeight: 600, color: "#0f1f3d", letterSpacing: "-0.01em" }}>{title}</div>
            {subtitle && <div style={{ fontSize: "12px", color: "#8a97b8", marginTop: "1px" }}>{subtitle}</div>}
          </div>
        </div>
        {rightAction}
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );

  const ActionButton = ({ onClick, variant = "secondary", children, disabled }: { onClick: () => void; variant?: "primary" | "secondary" | "danger"; children: React.ReactNode; disabled?: boolean }) => {
    const styles: Record<string, React.CSSProperties> = {
      primary: { background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white", border: "none", boxShadow: "0 2px 8px rgba(59,130,246,0.35)" },
      secondary: { background: "white", color: "#4a5a82", border: "1px solid #dde5f5" },
      danger: { background: "#fff1f2", color: "#e11d48", border: "1px solid #fecdd3" },
    };
    return (
      <button onClick={onClick} disabled={disabled} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all 0.15s", ...styles[variant] }}>
        {children}
      </button>
    );
  };

  const IconButton = ({ onClick, variant = "default", children }: { onClick: () => void; variant?: "default" | "danger"; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      style={{
        width: "30px", height: "30px", borderRadius: "8px",
        background: variant === "danger" ? "#fff1f2" : "white",
        border: `1px solid ${variant === "danger" ? "#fecdd3" : "#dde5f5"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: variant === "danger" ? "#e11d48" : "#4a5a82",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );

  const StatusBadge = ({ status }: { status: string }) => {
    const style = statusStyles[status] || statusStyles.draft;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600, background: style.bg, color: style.text, border: `1px solid ${style.border}`, textTransform: "capitalize" }}>
        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: style.dot }} />
        {status}
      </span>
    );
  };

  const ActiveBadge = ({ active }: { active: boolean }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 10px", borderRadius: "20px", fontSize: "11.5px", fontWeight: 600, background: active ? "#f0fdf4" : "#f1f5f9", color: active ? "#166534" : "#64748b", border: `1px solid ${active ? "#bbf7d0" : "#e2e8f0"}` }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: active ? "#22c55e" : "#94a3b8" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );

  return (
    <div>
      {/* Alerts */}
      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 16px", borderRadius: "10px", background: "#fef2f2", border: "1px solid #fecaca", marginBottom: "20px" }}>
          <span style={{ color: "#dc2626", marginTop: "2px" }}><AlertIcon /></span>
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "#991b1b" }}>Error</div>
            <div style={{ fontSize: "13px", color: "#b91c1c" }}>{error}</div>
          </div>
        </div>
      )}
      {success && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 16px", borderRadius: "10px", background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: "20px" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "#166534" }}>Success</div>
            <div style={{ fontSize: "13px", color: "#15803d" }}>{success}</div>
          </div>
        </div>
      )}

      {/* Appraisal Cycles */}
      <CardWrapper
        title="Appraisal Cycles"
        subtitle="Manage appraisal periods and their status"
        icon={<CalendarIcon />}
        iconBg="#eff6ff"
        iconColor="#3b82f6"
        delay="0.08s"
        rightAction={
          <div style={{ display: "flex", gap: "8px" }}>
            <IconButton onClick={load}><RefreshIcon /></IconButton>
            <ActionButton variant="primary" onClick={() => setCycleModal({ open: true, mode: "create", data: emptyCycleForm })}><PlusIcon /> Create Cycle</ActionButton>
          </div>
        }
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Fiscal Year</th>
              <th style={thStyle}>Start</th>
              <th style={thStyle}>End</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Phase</th>
              <th style={{ ...thStyle, width: "260px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{c.name}</td>
                <td style={tdStyle}>{c.cycle_type.replace("_", " ")}</td>
                <td style={tdStyle}>{c.fiscal_year}</td>
                <td style={tdStyle}>{c.start_date}</td>
                <td style={tdStyle}>{c.end_date}</td>
                <td style={tdStyle}><StatusBadge status={c.status} /></td>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 10px",
                      borderRadius: "20px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      background: c.phase === "planning" ? "#eff6ff" : c.phase === "assessment" ? "#f0fdf4" : "#f1f5f9",
                      color: c.phase === "planning" ? "#1d4ed8" : c.phase === "assessment" ? "#166534" : "#64748b",
                      border: `1px solid ${c.phase === "planning" ? "#bfdbfe" : c.phase === "assessment" ? "#bbf7d0" : "#e2e8f0"}`,
                      textTransform: "capitalize",
                    }}
                  >
                    <span
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: c.phase === "planning" ? "#3b82f6" : c.phase === "assessment" ? "#22c55e" : "#94a3b8",
                        display: "inline-block",
                      }}
                    />
                    {c.phase || "—"}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                    <IconButton onClick={() => setCycleModal({ open: true, mode: "edit", id: c.id, data: { cycle_type: c.cycle_type, fiscal_year: c.fiscal_year, start_date: c.start_date, end_date: c.end_date } })}><PencilIcon /></IconButton>
                    {c.status === "draft" && <ActionButton onClick={() => setCycleStatus(c.id, "open")}><PlayIcon /> Open</ActionButton>}
                    {c.status === "open" && c.phase === "planning" && <ActionButton variant="primary" onClick={() => openAssessmentPhase(c.id)}><PlayIcon /> Start Assessment</ActionButton>}
                    {(c.status === "open" || c.status === "draft") && <ActionButton onClick={() => setCycleStatus(c.id, "closed")}><LockIcon /> Close</ActionButton>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardWrapper>

      {/* Competency Categories */}
      <CardWrapper
        title="Competency Categories"
        subtitle="Group competencies by type"
        icon={<LayersIcon />}
        iconBg="#f3e8ff"
        iconColor="#7c3aed"
        delay="0.12s"
        rightAction={<ActionButton variant="primary" onClick={() => setCategoryModal({ open: true, mode: "create", data: emptyCategoryForm })}><PlusIcon /> Create Category</ActionButton>}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Applies To</th>
              <th style={{ ...thStyle, width: "120px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{cat.name}</td>
                <td style={tdStyle}>{cat.category_type}</td>
                <td style={tdStyle}>{cat.applies_to.replace("_", " ")}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <IconButton onClick={() => setCategoryModal({ open: true, mode: "edit", id: cat.id, data: { name: cat.name, category_type: cat.category_type, applies_to: cat.applies_to } })}><PencilIcon /></IconButton>
                    <IconButton variant="danger" onClick={() => setDeleteConfirm({ open: true, type: "category", id: cat.id, name: cat.name })}><TrashIcon /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardWrapper>

      {/* Competency Factors */}
      <CardWrapper
        title="Competency Factors"
        subtitle="Individual competencies within categories"
        icon={<ListIcon />}
        iconBg="#f0fdfa"
        iconColor="#0d9488"
        delay="0.16s"
        rightAction={<ActionButton variant="primary" onClick={() => setFactorModal({ open: true, mode: "create", data: emptyFactorForm })}><PlusIcon /> Create Factor</ActionButton>}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Order</th>
              <th style={thStyle}>Weight</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, width: "180px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{f.name}</td>
                <td style={tdStyle}>{f.category_name}</td>
                <td style={tdStyle}>{f.display_order}</td>
                <td style={tdStyle}>{f.weight ?? "—"}</td>
                <td style={tdStyle}><ActiveBadge active={f.active} /></td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <IconButton onClick={() => setFactorModal({ open: true, mode: "edit", id: f.id, data: { category_id: f.category_id, name: f.name, description: f.description ?? "", display_order: f.display_order, weight: f.weight ?? 0 } })}><PencilIcon /></IconButton>
                    <ActionButton onClick={() => toggleFactorActive(f)}>{f.active ? "Deactivate" : "Activate"}</ActionButton>
                    <IconButton variant="danger" onClick={() => setDeleteConfirm({ open: true, type: "factor", id: f.id, name: f.name })}><TrashIcon /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardWrapper>

      {/* Rating Scale */}
      <CardWrapper
        title="Rating Scale"
        subtitle="A–E scale used in self-assessment and manager review"
        icon={<StarIcon />}
        iconBg="#fffbeb"
        iconColor="#f59e0b"
        delay="0.20s"
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Factor</th>
              <th style={thStyle}>Label</th>
            </tr>
          </thead>
          <tbody>
            {ratingScale.map((r) => (
              <tr key={r.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={{ ...tdStyle, fontWeight: 700, color: "#0f1f3d" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontFamily: "Sora, sans-serif", fontSize: "12px" }}>{r.code}</span>
                </td>
                <td style={tdStyle}>{r.factor}</td>
                <td style={tdStyle}>{r.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardWrapper>

      {/* Recommendation Rules */}
      <CardWrapper
        title="Recommendation Rules"
        subtitle="Map rating labels to HR actions"
        icon={<AwardIcon />}
        iconBg="#fff1f2"
        iconColor="#e11d48"
        delay="0.24s"
        rightAction={<ActionButton variant="primary" onClick={() => setRuleModal({ open: true, mode: "create", data: emptyRuleForm })}><PlusIcon /> Create Rule</ActionButton>}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Rating Label</th>
              <th style={thStyle}>Recommendation</th>
              <th style={thStyle}>Description</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, width: "180px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{r.rating_label}</td>
                <td style={tdStyle}>{r.recommendation}</td>
                <td style={{ ...tdStyle, color: "#8a97b8" }}>{r.description ?? "—"}</td>
                <td style={tdStyle}><ActiveBadge active={r.active} /></td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <IconButton onClick={() => setRuleModal({ open: true, mode: "edit", id: r.id, data: { rating_label: r.rating_label, recommendation: r.recommendation, description: r.description ?? "" } })}><PencilIcon /></IconButton>
                    <ActionButton onClick={() => toggleRuleActive(r)}>{r.active ? "Deactivate" : "Activate"}</ActionButton>
                    <IconButton variant="danger" onClick={() => setDeleteConfirm({ open: true, type: "rule", id: r.id, name: r.rating_label })}><TrashIcon /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardWrapper>

      {/* Employee Sync */}
      <CardWrapper
        title="Employee Sync"
        subtitle="Sync employees and reporting lines from Dynamics 365 Dataverse"
        icon={<UsersIcon />}
        iconBg="#f0fdfa"
        iconColor="#0d9488"
        delay="0.28s"
      >
        <div style={{ padding: "20px 24px" }}>
          <button
            onClick={runSync}
            disabled={syncing}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "10px 20px", borderRadius: "8px",
              background: !syncing ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" : "#e2e8f0",
              border: "none", fontSize: "14px", fontWeight: 600,
              color: !syncing ? "white" : "#94a3b8",
              cursor: !syncing ? "pointer" : "not-allowed",
              boxShadow: !syncing ? "0 2px 8px rgba(59,130,246,0.35)" : "none",
              transition: "all 0.16s",
            }}
          >
            <RefreshIcon spinning={syncing} />
            {syncing ? "Syncing…" : "Sync Employees"}
          </button>
        </div>
      </CardWrapper>

      {/* Reviewee visibility */}
      <CardWrapper
        title="Reviewee visibility"
        subtitle="Control whether the person being reviewed can see peer and direct report feedback in their report"
        icon={<Feedback360Icon />}
        iconBg="#f3e8ff"
        iconColor="#7c3aed"
        delay="0.32s"
      >
        {feedbackCycles.length === 0 ? (
          <p style={{ padding: "20px 24px", color: "#8a97b8" }}>No 360 feedback cycles yet. Create an appraisal cycle to generate a linked 360 cycle.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Cycle</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Peer visible to reviewee</th>
                <th style={thStyle}>Direct reports visible to reviewee</th>
              </tr>
            </thead>
            <tbody>
              {feedbackCycles.map((c) => (
                <tr key={c.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{c.cycle_name}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "3px 10px",
                        borderRadius: "20px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        background: c.status === "Active" ? "#f0fdf4" : "#f1f5f9",
                        color: c.status === "Active" ? "#166534" : "#64748b",
                        border: `1px solid ${c.status === "Active" ? "#bbf7d0" : "#e2e8f0"}`,
                      }}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={c.peer_feedback_visible_to_reviewee !== false}
                        onChange={(e) =>
                          handleVisibilityChange(c.id, "peer_feedback_visible_to_reviewee", e.target.checked)
                        }
                        style={{ width: "16px", height: "16px" }}
                      />
                      <span style={{ fontSize: "13px" }}>Show to reviewee</span>
                    </label>
                  </td>
                  <td style={tdStyle}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={c.direct_report_feedback_visible_to_reviewee !== false}
                        onChange={(e) =>
                          handleVisibilityChange(c.id, "direct_report_feedback_visible_to_reviewee", e.target.checked)
                        }
                        style={{ width: "16px", height: "16px" }}
                      />
                      <span style={{ fontSize: "13px" }}>Show to reviewee</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardWrapper>

      {/* Cycle Modal */}
      <Dialog open={cycleModal.open} onOpenChange={(open) => !open && setCycleModal({ ...cycleModal, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{cycleModal.mode === "create" ? "Create Cycle" : "Edit Cycle"}</DialogTitle>
            <DialogDescription>{cycleModal.mode === "create" ? "Add a new appraisal cycle." : "Update the appraisal cycle details."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={cycleModal.data.cycle_type} onChange={(e) => setCycleModal((p) => ({ ...p, data: { ...p.data, cycle_type: e.target.value } }))}>
                <option value="quarterly">Quarterly</option>
                <option value="mid_year">Mid Year</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div className="space-y-2"><Label>Fiscal Year</Label><Input placeholder="2026" value={cycleModal.data.fiscal_year} onChange={(e) => setCycleModal((p) => ({ ...p, data: { ...p.data, fiscal_year: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={cycleModal.data.start_date} onChange={(e) => setCycleModal((p) => ({ ...p, data: { ...p.data, start_date: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>End Date</Label><Input type="date" value={cycleModal.data.end_date} onChange={(e) => setCycleModal((p) => ({ ...p, data: { ...p.data, end_date: e.target.value } }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCycleModal({ ...cycleModal, open: false })}>Cancel</Button>
            <Button onClick={saveCycle}>{cycleModal.mode === "create" ? "Create" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Modal */}
      <Dialog open={categoryModal.open} onOpenChange={(open) => !open && setCategoryModal({ ...categoryModal, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryModal.mode === "create" ? "Create Category" : "Edit Category"}</DialogTitle>
            <DialogDescription>{categoryModal.mode === "create" ? "Add a new competency category." : "Update the category details."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Name</Label><Input placeholder="Category name" value={categoryModal.data.name} onChange={(e) => setCategoryModal((p) => ({ ...p, data: { ...p.data, name: e.target.value } }))} /></div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={categoryModal.data.category_type} onChange={(e) => setCategoryModal((p) => ({ ...p, data: { ...p.data, category_type: e.target.value } }))}>
                <option value="core">Core</option>
                <option value="productivity">Productivity</option>
                <option value="leadership">Leadership</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Applies To</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={categoryModal.data.applies_to} onChange={(e) => setCategoryModal((p) => ({ ...p, data: { ...p.data, applies_to: e.target.value } }))}>
                <option value="both">Both</option>
                <option value="management">Management</option>
                <option value="non_management">Non-management</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryModal({ ...categoryModal, open: false })}>Cancel</Button>
            <Button onClick={saveCategory}>{categoryModal.mode === "create" ? "Create" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Factor Modal */}
      <Dialog open={factorModal.open} onOpenChange={(open) => !open && setFactorModal({ ...factorModal, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{factorModal.mode === "create" ? "Create Factor" : "Edit Factor"}</DialogTitle>
            <DialogDescription>{factorModal.mode === "create" ? "Add a new competency factor." : "Update the factor details."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={factorModal.data.category_id} onChange={(e) => setFactorModal((p) => ({ ...p, data: { ...p.data, category_id: e.target.value } }))}>
                <option value="">Select category</option>
                {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div className="space-y-2"><Label>Name</Label><Input placeholder="Factor name" value={factorModal.data.name} onChange={(e) => setFactorModal((p) => ({ ...p, data: { ...p.data, name: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Description (optional)</Label><Input placeholder="Description" value={factorModal.data.description} onChange={(e) => setFactorModal((p) => ({ ...p, data: { ...p.data, description: e.target.value } }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Display Order</Label><Input type="number" value={factorModal.data.display_order} onChange={(e) => setFactorModal((p) => ({ ...p, data: { ...p.data, display_order: Number(e.target.value) || 0 } }))} /></div>
              <div className="space-y-2"><Label>Weight (optional)</Label><Input type="number" value={factorModal.data.weight || ""} onChange={(e) => setFactorModal((p) => ({ ...p, data: { ...p.data, weight: Number(e.target.value) || 0 } }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFactorModal({ ...factorModal, open: false })}>Cancel</Button>
            <Button onClick={saveFactor} disabled={!factorModal.data.category_id || !factorModal.data.name}>{factorModal.mode === "create" ? "Create" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Modal */}
      <Dialog open={ruleModal.open} onOpenChange={(open) => !open && setRuleModal({ ...ruleModal, open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ruleModal.mode === "create" ? "Create Rule" : "Edit Rule"}</DialogTitle>
            <DialogDescription>{ruleModal.mode === "create" ? "Add a new recommendation rule." : "Update the rule details."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Rating Label</Label><Input placeholder="e.g. Exceeds Expectations" value={ruleModal.data.rating_label} onChange={(e) => setRuleModal((p) => ({ ...p, data: { ...p.data, rating_label: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Recommendation</Label><Input placeholder="e.g. Pay Increment" value={ruleModal.data.recommendation} onChange={(e) => setRuleModal((p) => ({ ...p, data: { ...p.data, recommendation: e.target.value } }))} /></div>
            <div className="space-y-2"><Label>Description (optional)</Label><Input placeholder="Description" value={ruleModal.data.description} onChange={(e) => setRuleModal((p) => ({ ...p, data: { ...p.data, description: e.target.value } }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleModal({ ...ruleModal, open: false })}>Cancel</Button>
            <Button onClick={saveRule} disabled={!ruleModal.data.rating_label || !ruleModal.data.recommendation}>{ruleModal.mode === "create" ? "Create" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ ...deleteConfirm, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteConfirm.type}?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete &quot;{deleteConfirm.name}&quot;? This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
