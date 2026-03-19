"use client";

import { useCallback, useEffect, useState } from "react";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { createClient } from "@/lib/supabase";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RatingButtons } from "./RatingButtons";
import {
  RatingGradeChip,
  RatingLegend,
  VarianceChip,
} from "./RatingPillGroup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TechnicalCompetency {
  id: string;
  name: string;
  required_level: string;
  weight: number;
  self_rating: string | null;
  manager_rating: string | null;
  self_comments: string | null;
  manager_comments: string | null;
  display_order: number;
}

interface RatingScaleRow {
  code: string;
  label: string;
  factor?: number;
}

interface TechnicalCompetenciesSectionProps {
  appraisalId: string;
  canEditSetup: boolean;
  /** If false, delete (trash) buttons are hidden. Set false once appraisal is approved (e.g. SELF_ASSESSMENT or later). */
  canDeleteCompetencies: boolean;
  canEditSelfRatings: boolean;
  canEditManagerRatings: boolean;
  /** Optional: notify parent when dirty state changes (for tab navigation guard). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Optional: register save function for parent (e.g. unsaved-changes modal Save). */
  registerSave?: (save: (() => Promise<void>) | null) => void;
}

const PlusIcon = () => (
  <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const SaveIcon = () => (
  <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const TrashIcon = () => (
  <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const WrenchIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const AlertIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
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
  padding: "14px 16px",
  fontSize: "13.5px",
  verticalAlign: "top",
  borderBottom: "1px solid #dde5f5",
};

function getFactorFromScale(code: string | null, scale: RatingScaleRow[]): number {
  if (!code) return 0;
  const row = scale.find((s) => s.code === code);
  return row?.factor != null ? Number(row.factor) : 0;
}

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "1px solid #dde5f5",
  fontSize: "13px",
  color: "#0f1f3d",
  background: "white",
  resize: "vertical",
  minHeight: "72px",
  outline: "none",
  fontFamily: "DM Sans, sans-serif",
  transition: "border-color 0.15s, box-shadow 0.15s",
  lineHeight: 1.5,
};

export function TechnicalCompetenciesSection({
  appraisalId,
  canEditSetup,
  canDeleteCompetencies,
  canEditSelfRatings,
  canEditManagerRatings,
  onDirtyChange,
  registerSave,
}: TechnicalCompetenciesSectionProps) {
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty);

  const [competencies, setCompetencies] = useState<TechnicalCompetency[]>([]);
  const [ratingScale, setRatingScale] = useState<RatingScaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCompName, setNewCompName] = useState("");
  const [newCompLevel, setNewCompLevel] = useState("6");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/technical-competencies`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load competencies");
      }
      const data = await res.json();
      const raw = data.competencies ?? [];
      setCompetencies(raw.map((c: TechnicalCompetency & { weight?: number }) => ({
        ...c,
        weight: c.weight != null ? Number(c.weight) : 0,
      })));

      const supabase = createClient();
      const { data: scaleData } = await supabase
        .from("rating_scale")
        .select("code, label, factor")
        .order("factor", { ascending: false });

      setRatingScale(scaleData ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [appraisalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addCompetency = useCallback(async () => {
    if (!newCompName.trim()) return;

    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/technical-competencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCompName.trim(),
          required_level: newCompLevel,
          display_order: competencies.length,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add competency");
      }

      setShowAddModal(false);
      setNewCompName("");
      setNewCompLevel("6");
      loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add competency");
    }
  }, [appraisalId, newCompName, newCompLevel, competencies.length, loadData]);

  const deleteCompetency = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(
          `/api/appraisals/${appraisalId}/technical-competencies?competencyId=${id}`,
          { method: "DELETE" }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to delete competency");
        }

        loadData();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete competency");
      }
    },
    [appraisalId, loadData]
  );

  const updateCompetency = useCallback(
    (id: string, field: keyof TechnicalCompetency, value: string | null | number) => {
      setCompetencies((prev) =>
        prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
      );
      setIsDirty(true);
      onDirtyChange?.(true);
    },
    [onDirtyChange]
  );

  const saveRatings = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/technical-competencies`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competencies: competencies.map((c) => ({
            id: c.id,
            name: c.name,
            required_level: c.required_level,
            self_rating: c.self_rating,
            manager_rating: c.manager_rating,
            self_comments: c.self_comments,
            manager_comments: c.manager_comments,
            weight: c.weight,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save ratings");
      }

      setIsDirty(false);
      onDirtyChange?.(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
      window.dispatchEvent(new CustomEvent("appraisal-completion-invalidate"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save ratings");
    } finally {
      setSaving(false);
    }
  }, [appraisalId, competencies, onDirtyChange]);

  useEffect(() => {
    if (!registerSave) return;
    registerSave(saveRatings);
    return () => registerSave(null);
  }, [registerSave, saveRatings]);

  const canEdit = canEditSelfRatings || canEditManagerRatings;
  const canEditOrSetup = canEdit || canEditSetup;
  const totalWeight = competencies.reduce((sum, c) => sum + (c.weight ?? 0), 0);
  const weightValid = !canEditSetup || competencies.length === 0 || Math.abs(totalWeight - 100) < 0.01;
  const saveDisabled = saving || (canEditSetup && competencies.length > 0 && !weightValid);

  if (loading) {
    return <p style={{ color: "#8a97b8", padding: "16px 0" }}>Loading technical competencies…</p>;
  }

  return (
    <div>
      {/* Alerts */}
      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 16px", borderRadius: "10px", background: "#fef2f2", border: "1px solid #fecaca", marginBottom: "16px" }}>
          <span style={{ color: "#dc2626", marginTop: "2px" }}><AlertIcon /></span>
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "#991b1b" }}>Error</div>
            <div style={{ fontSize: "13px", color: "#b91c1c" }}>{error}</div>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "14px 16px", borderRadius: "10px", background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: "16px" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "#166534" }}>Success</div>
            <div style={{ fontSize: "13px", color: "#15803d" }}>Ratings saved successfully.</div>
          </div>
        </div>
      )}

      {/* Card */}
      <div
        style={{
          background: "white",
          borderRadius: "14px",
          border: "1px solid #dde5f5",
          boxShadow: "0 2px 12px rgba(15,31,61,0.07), 0 0 1px rgba(15,31,61,0.1)",
          overflow: "hidden",
        }}
      >
        {/* Card header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #dde5f5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
              <WrenchIcon />
            </div>
            <div>
              <div style={{ fontFamily: "Sora, sans-serif", fontSize: "15px", fontWeight: 600, color: "#0f1f3d", letterSpacing: "-0.01em" }}>
                Technical Competencies
              </div>
              <div style={{ fontSize: "12px", color: "#8a97b8", marginTop: "1px" }}>
                Critical functional and technical competencies specific to this role
                {canEditSetup && competencies.length > 0 && (
                  <span style={{ marginLeft: "8px", color: weightValid ? "#15803d" : "#b91c1c" }}>
                    — Total weight: {totalWeight}%. Must equal 100%.
                  </span>
                )}
              </div>
            </div>
          </div>
          {(canDeleteCompetencies || (canEditOrSetup && competencies.length > 0)) && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {canDeleteCompetencies && (
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    background: "white",
                    border: "1px solid #dde5f5",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#4a5a82",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <PlusIcon /> Add Technical Competency
                </button>
              )}
              {canEditOrSetup && competencies.length > 0 && (
                <button
                  onClick={saveRatings}
                  disabled={saveDisabled}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 20px",
                    borderRadius: "8px",
                    background: !saveDisabled ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" : "#e2e8f0",
                    border: "none",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: !saveDisabled ? "white" : "#94a3b8",
                    cursor: !saveDisabled ? "pointer" : "not-allowed",
                    boxShadow: !saveDisabled ? "0 2px 8px rgba(59,130,246,0.35)" : "none",
                    transition: "all 0.16s",
                  }}
                >
                  <SaveIcon /> Save Ratings
                </button>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        {competencies.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <p style={{ color: "#8a97b8", fontSize: "13px" }}>
              No technical competencies defined yet.
              {canDeleteCompetencies && " Click \"Add Technical Competency\" to add one."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, minWidth: "180px" }}>Competency</th>
                  <th style={{ ...thStyle, width: "80px" }}>Required</th>
                  <th style={{ ...thStyle, width: "80px" }}>Weight</th>
                  <th style={{ ...thStyle, minWidth: "340px", textAlign: "center" }}>Self</th>
                  <th style={{ ...thStyle, minWidth: "150px" }}>Self Comments</th>
                  <th style={{ ...thStyle, width: "80px", textAlign: "center" }}>Manager</th>
                  <th style={{ ...thStyle, minWidth: "150px" }}>Manager Comments</th>
                  <th style={{ ...thStyle, width: "72px", textAlign: "center" }}>Score</th>
                  {canDeleteCompetencies && <th style={{ ...thStyle, width: "50px" }} />}
                </tr>
              </thead>
              <tbody>
                {competencies.map((comp) => (
                  <tr key={comp.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <td style={tdStyle}>
                      {canEditSetup ? (
                        <input
                          type="text"
                          value={comp.name}
                          onChange={(e) => updateCompetency(comp.id, "name", e.target.value)}
                          style={{
                            width: "100%",
                            minWidth: "140px",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #dde5f5",
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#0f1f3d",
                            background: "white",
                            outline: "none",
                          }}
                          onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
                          onBlur={(e) => { e.target.style.borderColor = "#dde5f5"; e.target.style.boxShadow = "none"; }}
                        />
                      ) : (
                        <div style={{ fontWeight: 600, fontSize: "13.5px", color: "#0f1f3d" }}>
                          {comp.name}
                        </div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {canEditSetup ? (
                        <select
                          value={comp.required_level}
                          onChange={(e) => updateCompetency(comp.id, "required_level", e.target.value)}
                          style={{
                            width: "52px",
                            padding: "6px 8px",
                            borderRadius: "8px",
                            border: "1px solid #dde5f5",
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#92400e",
                            background: "#fef9c3",
                            outline: "none",
                            cursor: "pointer",
                            fontFamily: "Sora, sans-serif",
                          }}
                          onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
                          onBlur={(e) => { e.target.style.borderColor = "#dde5f5"; e.target.style.boxShadow = "none"; }}
                        >
                          {ratingScale.map((s) => (
                            <option key={s.code} value={s.code}>{s.code}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "26px",
                            height: "26px",
                            borderRadius: "6px",
                            background: "#fef9c3",
                            border: "1px solid #fde68a",
                            color: "#92400e",
                            fontFamily: "Sora, sans-serif",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          {comp.required_level}
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {canEditSetup ? (
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          style={{
                            width: "64px",
                            padding: "6px 8px",
                            borderRadius: "8px",
                            border: "1px solid #dde5f5",
                            fontSize: "13px",
                            color: "#0f1f3d",
                            background: "white",
                            outline: "none",
                          }}
                          value={comp.weight}
                          onChange={(e) => {
                            const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                            updateCompetency(comp.id, "weight", Number.isNaN(v) ? 0 : v);
                          }}
                        />
                      ) : (
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "3px 10px",
                          borderRadius: "20px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          color: "#1d4ed8",
                          fontFamily: "Sora, sans-serif",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}>
                          {comp.weight}
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, minWidth: "340px" }}>
                      <div className="flex flex-col items-center gap-1">
                        {canEditSelfRatings ? (
                          <RatingButtons
                            value={comp.self_rating ?? null}
                            onChange={(code) => updateCompetency(comp.id, "self_rating", code)}
                            disabled={false}
                          />
                        ) : (
                          <RatingGradeChip value={comp.self_rating ?? null} />
                        )}
                        {comp.manager_rating != null && (
                          <VarianceChip
                            selfRating={comp.self_rating ?? null}
                            managerRating={comp.manager_rating ?? null}
                          />
                        )}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {canEditSelfRatings ? (
                        <textarea
                          style={textareaStyle}
                          value={comp.self_comments ?? ""}
                          onChange={(e) =>
                            updateCompetency(comp.id, "self_comments", e.target.value || null)
                          }
                          placeholder="Comments..."
                          onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
                          onBlur={(e) => { e.target.style.borderColor = "#dde5f5"; e.target.style.boxShadow = "none"; }}
                        />
                      ) : (
                        <span style={{ fontSize: "13px", color: "#0f1f3d" }}>{comp.self_comments || "—"}</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      {canEditManagerRatings ? (
                        <RatingButtons
                          value={comp.manager_rating ?? null}
                          onChange={(code) => updateCompetency(comp.id, "manager_rating", code)}
                          disabled={false}
                        />
                      ) : (
                        <RatingGradeChip value={comp.manager_rating ?? null} />
                      )}
                    </td>
                    <td style={tdStyle}>
                      {canEditManagerRatings ? (
                        <textarea
                          style={textareaStyle}
                          value={comp.manager_comments ?? ""}
                          onChange={(e) =>
                            updateCompetency(comp.id, "manager_comments", e.target.value || null)
                          }
                          placeholder="Comments..."
                          onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
                          onBlur={(e) => { e.target.style.borderColor = "#dde5f5"; e.target.style.boxShadow = "none"; }}
                        />
                      ) : (
                        <span style={{ fontSize: "13px", color: "#0f1f3d" }}>{comp.manager_comments || "—"}</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, width: "72px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "4px 10px",
                          borderRadius: "20px",
                          fontSize: "13px",
                          fontWeight: 600,
                          ...((comp.manager_rating ?? comp.self_rating) != null
                            ? { background: "#dcfce7", border: "1px solid #bbf7d0", color: "#166534" }
                            : { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#94a3b8" }),
                        }}
                      >
                        {(comp.manager_rating ?? comp.self_rating) != null
                          ? (comp.weight * getFactorFromScale(comp.manager_rating ?? comp.self_rating ?? null, ratingScale)).toFixed(1)
                          : "—"}
                      </span>
                    </td>
                    {canDeleteCompetencies && (
                      <td style={tdStyle}>
                        <button
                          onClick={() => deleteCompetency(comp.id)}
                          style={{
                            width: "30px",
                            height: "30px",
                            borderRadius: "8px",
                            background: "#fff1f2",
                            border: "1px solid #fecdd3",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#e11d48",
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "#e11d48"; e.currentTarget.style.color = "white"; e.currentTarget.style.borderColor = "#e11d48"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "#fff1f2"; e.currentTarget.style.color = "#e11d48"; e.currentTarget.style.borderColor = "#fecdd3"; }}
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {competencies.length > 0 && (() => {
                  const techTotal = competencies.reduce(
                    (sum, comp) => {
                      const code = comp.manager_rating ?? comp.self_rating;
                      return sum + (code != null ? comp.weight * getFactorFromScale(code, ratingScale) : 0);
                    },
                    0
                  );
                  return (
                    <tr style={{ background: "#f8faff", borderTop: "2px solid #dde5f5" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#0f1f3d" }}>Total</td>
                      <td style={tdStyle} />
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{totalWeight}</td>
                      <td style={tdStyle} colSpan={4} />
                      <td style={{ ...tdStyle, width: "72px", textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontSize: "13px",
                            fontWeight: 700,
                            ...(techTotal > 0
                              ? { background: "#dcfce7", border: "1px solid #bbf7d0", color: "#166534" }
                              : { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#94a3b8" }),
                          }}
                        >
                          {techTotal > 0 ? techTotal.toFixed(1) : "—"}
                        </span>
                      </td>
                      {canDeleteCompetencies && <td style={tdStyle} />}
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}
        {competencies.length > 0 && <RatingLegend />}
      </div>

      {/* Add Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Technical Competency</DialogTitle>
            <DialogDescription>
              Define a technical competency that will be evaluated for this appraisal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comp-name">Competency Name</Label>
              <Input
                id="comp-name"
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
                placeholder="e.g., Software Development"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comp-level">Required Level</Label>
              <Select value={newCompLevel} onValueChange={setNewCompLevel}>
                <SelectTrigger id="comp-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ratingScale.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} - {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={addCompetency} disabled={!newCompName.trim()}>
              Add Competency
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
