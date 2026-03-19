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
import { AdminPanelContext } from "./AdminPanelContext";
import { AdminTabs } from "./AdminTabs";
import type { Cycle, Category, Factor, RatingRow, Rule, FeedbackCycle } from "./admin-shared";
import {
  emptyCategoryForm,
  emptyFactorForm,
  emptyRuleForm,
  emptyCycleForm,
} from "./admin-shared";

const AlertIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

type CategoryForm = { name: string; category_type: string; applies_to: string };
type FactorForm = { category_id: string; name: string; description: string; display_order: number; weight: number };
type RuleForm = { rating_label: string; recommendation: string; description: string };
type CycleForm = { cycle_type: string; fiscal_year: string; start_date: string; end_date: string };

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

  const contextValue = {
    cycles,
    categories,
    factors,
    ratingScale,
    rules,
    feedbackCycles,
    loading,
    syncing,
    error,
    success,
    cycleModal,
    setCycleModal,
    categoryModal,
    setCategoryModal,
    factorModal,
    setFactorModal,
    ruleModal,
    setRuleModal,
    deleteConfirm,
    setDeleteConfirm,
    load,
    handleVisibilityChange,
    saveCycle,
    setCycleStatus,
    openAssessmentPhase,
    saveCategory,
    deleteCategory,
    saveFactor,
    toggleFactorActive,
    deleteFactor,
    saveRule,
    toggleRuleActive,
    deleteRule,
    handleDeleteConfirm,
    runSync,
    emptyCycleForm,
    emptyCategoryForm,
    emptyFactorForm,
    emptyRuleForm,
  };

  return (
    <AdminPanelContext.Provider value={contextValue}>
      <div>
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

        <AdminTabs />
      </div>

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
    </AdminPanelContext.Provider>
  );
}
