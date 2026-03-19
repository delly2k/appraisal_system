"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { RatingButtons } from "./RatingButtons";
import {
  RatingGradeChip,
  RatingLegend,
  VarianceChip,
} from "./RatingPillGroup";

interface Factor {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  weight: number;
}

interface Rating {
  factor_id: string;
  self_rating_code: string | null;
  manager_rating_code: string | null;
  self_comments: string | null;
  manager_comments: string | null;
  weight?: number | null;
}

interface RatingScale {
  code: string;
  label: string;
  factor: number;
}

interface CoreCompetenciesSectionProps {
  appraisalId: string;
  canEditSelfRatings: boolean;
  canEditManagerRatings: boolean;
  /** When true (e.g. draft), weight column is editable. */
  canEditWeights?: boolean;
  /** Optional: notify parent when dirty state changes (for tab navigation guard). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Optional: register save function for parent (e.g. unsaved-changes modal Save). */
  registerSave?: (save: (() => Promise<void>) | null) => void;
}

const SaveIcon = () => (
  <svg style={{ width: 14, height: 14 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const AwardIcon = () => (
  <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="6" />
    <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
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

/** Get factor from rating scale (1-10 codes). Row score = weight × factor. */
function getFactorFromScale(code: string | null, scale: { code: string; factor: number }[]): number {
  if (!code) return 0;
  return scale.find((s) => s.code === code)?.factor ?? 0;
}

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: "8px",
  border: "1px solid #dde5f5",
  fontSize: "13px",
  color: "#0f1f3d",
  background: "white",
  outline: "none",
};

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

export function CoreCompetenciesSection({
  appraisalId,
  canEditSelfRatings,
  canEditManagerRatings,
  canEditWeights = false,
  onDirtyChange,
  registerSave,
}: CoreCompetenciesSectionProps) {
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty);

  const [factors, setFactors] = useState<Factor[]>([]);
  const [ratings, setRatings] = useState<Map<string, Rating>>(new Map());
  const [ratingScale, setRatingScale] = useState<RatingScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      const { data: categories } = await supabase
        .from("evaluation_categories")
        .select("id")
        .eq("category_type", "core")
        .eq("active", true);

      if (!categories?.length) {
        setFactors([]);
        setLoading(false);
        return;
      }

      const categoryIds = categories.map((c) => c.id);

      const { data: factorData } = await supabase
        .from("evaluation_factors")
        .select("id, name, description, display_order, weight")
        .in("category_id", categoryIds)
        .eq("active", true)
        .order("display_order");

      setFactors(
        (factorData ?? []).map((f: { id: string; name: string; description: string | null; display_order: number; weight?: number }) => ({
          id: f.id,
          name: f.name,
          description: f.description ?? null,
          display_order: f.display_order ?? 0,
          weight: Number(f.weight) || 0,
        }))
      );

      const { data: scaleData } = await supabase
        .from("rating_scale")
        .select("code, label, factor")
        .order("factor", { ascending: false });

      setRatingScale(scaleData ?? []);

      const res = await fetch(`/api/appraisals/${appraisalId}/factor-ratings`);
      const data = await res.json();
      const ratingData = res.ok && Array.isArray(data?.ratings) ? data.ratings : [];
      const ratingsMap = new Map<string, Rating>();
      for (const r of ratingData) {
        ratingsMap.set(r.factor_id, {
          factor_id: r.factor_id,
          self_rating_code: r.self_rating_code ?? null,
          manager_rating_code: r.manager_rating_code ?? null,
          self_comments: r.self_comments ?? null,
          manager_comments: r.manager_comments ?? null,
          weight: r.weight != null ? Number(r.weight) : null,
        });
      }
      setRatings(ratingsMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [appraisalId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateRating = useCallback(
    (factorId: string, field: keyof Rating, value: string | null | number) => {
      setRatings((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(factorId) ?? {
          factor_id: factorId,
          self_rating_code: null,
          manager_rating_code: null,
          self_comments: null,
          manager_comments: null,
        };
        newMap.set(factorId, { ...existing, [field]: value });
        return newMap;
      });
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
      const ratingsPayload = factors.map((factor) => {
        const r = ratings.get(factor.id);
        const effectiveWeight = r?.weight != null ? r.weight : factor.weight ?? null;
        return {
          factor_id: factor.id,
          self_rating_code: r?.self_rating_code ?? null,
          manager_rating_code: r?.manager_rating_code ?? null,
          self_comments: r?.self_comments ?? null,
          manager_comments: r?.manager_comments ?? null,
          ...(effectiveWeight !== undefined && effectiveWeight !== null ? { weight: effectiveWeight } : {}),
        };
      });
      const res = await fetch(`/api/appraisals/${appraisalId}/factor-ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings: ratingsPayload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save ratings");
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
  }, [appraisalId, ratings, factors]);

  useEffect(() => {
    if (!registerSave) return;
    registerSave(saveRatings);
    return () => registerSave(null);
  }, [registerSave, saveRatings]);

  const canEdit = canEditSelfRatings || canEditManagerRatings || canEditWeights;
  const totalWeight = factors.reduce(
    (sum, factor) => sum + (ratings.get(factor.id)?.weight != null ? Number(ratings.get(factor.id)!.weight) : factor.weight ?? 0),
    0
  );
  const weightValid = !canEditWeights || Math.abs(totalWeight - 100) < 0.01;
  const saveDisabled = saving || (canEditWeights && !weightValid);

  if (loading) {
    return <p style={{ color: "#8a97b8", padding: "16px 0" }}>Loading core competencies…</p>;
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
              <AwardIcon />
            </div>
            <div>
              <div style={{ fontFamily: "Sora, sans-serif", fontSize: "15px", fontWeight: 600, color: "#0f1f3d", letterSpacing: "-0.01em" }}>
                Core Competencies
              </div>
              <div style={{ fontSize: "12px", color: "#8a97b8", marginTop: "1px" }}>
                Value-based and soft skill competencies · Rate 1–10
                {canEditWeights && factors.length > 0 && (
                  <span style={{ marginLeft: "8px", color: weightValid ? "#15803d" : "#b91c1c" }}>
                    — Total weight: {totalWeight}%. Must equal 100%.
                  </span>
                )}
              </div>
            </div>
          </div>
          {canEdit && (
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
                boxShadow: !saving ? "0 2px 8px rgba(59,130,246,0.35)" : "none",
                transition: "all 0.16s",
              }}
            >
              <SaveIcon /> Save Ratings
            </button>
          )}
        </div>

        {/* Table */}
        {factors.length === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center" }}>
            <p style={{ color: "#8a97b8", fontSize: "13px" }}>
              No core competency factors configured. Contact HR to set up evaluation factors.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, minWidth: "200px" }}>Competency</th>
                  <th style={{ ...thStyle, width: "80px" }}>Weight</th>
                  <th style={{ ...thStyle, minWidth: "340px", textAlign: "center" }}>Self Rating (1–10)</th>
                  <th style={{ ...thStyle, minWidth: "200px" }}>Self Comments</th>
                  <th style={{ ...thStyle, width: "140px", textAlign: "center" }}>Manager Rating</th>
                  <th style={{ ...thStyle, minWidth: "200px" }}>Manager Comments</th>
                  <th style={{ ...thStyle, width: "72px", textAlign: "center" }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {factors.map((factor) => {
                  const rating = ratings.get(factor.id);
                  const effectiveWeight = rating?.weight != null ? rating.weight : factor.weight ?? 0;
                  const code = rating?.manager_rating_code ?? rating?.self_rating_code ?? null;
                  const factorVal = getFactorFromScale(code, ratingScale);
                  const rowScore = effectiveWeight * factorVal;
                  return (
                    <tr key={factor.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, fontSize: "13.5px", color: "#0f1f3d", marginBottom: "3px" }}>
                          {factor.name}
                        </div>
                        {factor.description && (
                          <div style={{ fontSize: "11.5px", color: "#8a97b8", lineHeight: 1.4 }}>
                            {factor.description}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {canEditWeights ? (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            style={{ ...inputStyle, width: "64px", padding: "6px 8px" }}
                            value={effectiveWeight}
                            onChange={(e) => {
                              const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                              updateRating(factor.id, "weight", Number.isNaN(v) ? 0 : v);
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
                            {effectiveWeight}
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, minWidth: "340px" }}>
                        <div className="flex flex-col items-center gap-1">
                          {canEditSelfRatings ? (
                            <RatingButtons
                              value={rating?.self_rating_code ?? null}
                              onChange={(code) => updateRating(factor.id, "self_rating_code", code)}
                              disabled={false}
                            />
                          ) : (
                            <RatingGradeChip value={rating?.self_rating_code ?? null} />
                          )}
                          {rating?.manager_rating_code != null && (
                            <VarianceChip
                              selfRating={rating?.self_rating_code ?? null}
                              managerRating={rating?.manager_rating_code ?? null}
                            />
                          )}
                        </div>
                      </td>
                      <td style={tdStyle}>
                        {canEditSelfRatings ? (
                          <textarea
                            style={textareaStyle}
                            value={rating?.self_comments ?? ""}
                            onChange={(e) =>
                              updateRating(factor.id, "self_comments", e.target.value || null)
                            }
                            placeholder="Comments..."
                            onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
                            onBlur={(e) => { e.target.style.borderColor = "#dde5f5"; e.target.style.boxShadow = "none"; }}
                          />
                        ) : (
                          <span style={{ fontSize: "13px", color: "#0f1f3d" }}>
                            {rating?.self_comments || "—"}
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {canEditManagerRatings ? (
                          <RatingButtons
                            value={rating?.manager_rating_code ?? null}
                            onChange={(code) => updateRating(factor.id, "manager_rating_code", code)}
                            disabled={false}
                          />
                        ) : (
                          <RatingGradeChip value={rating?.manager_rating_code ?? null} />
                        )}
                      </td>
                      <td style={tdStyle}>
                        {canEditManagerRatings ? (
                          <textarea
                            style={textareaStyle}
                            value={rating?.manager_comments ?? ""}
                            onChange={(e) =>
                              updateRating(factor.id, "manager_comments", e.target.value || null)
                            }
                            placeholder="Comments..."
                            onFocus={(e) => { e.target.style.borderColor = "#3b82f6"; e.target.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.1)"; }}
                            onBlur={(e) => { e.target.style.borderColor = "#dde5f5"; e.target.style.boxShadow = "none"; }}
                          />
                        ) : (
                          <span style={{ fontSize: "13px", color: "#0f1f3d" }}>
                            {rating?.manager_comments || "—"}
                          </span>
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
                            ...(code != null
                              ? { background: "#dcfce7", border: "1px solid #bbf7d0", color: "#166534" }
                              : { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#94a3b8" }),
                          }}
                        >
                          {code != null ? rowScore.toFixed(1) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {factors.length > 0 && (() => {
                  const coreTotal = factors.reduce((sum, factor) => {
                    const rating = ratings.get(factor.id);
                    const effectiveWeight = rating?.weight != null ? rating.weight : factor.weight ?? 0;
                    const code = rating?.manager_rating_code ?? rating?.self_rating_code ?? null;
                    const factorVal = getFactorFromScale(code, ratingScale);
                    return sum + effectiveWeight * factorVal;
                  }, 0);
                  return (
                    <tr style={{ background: "#f8faff", borderTop: "2px solid #dde5f5" }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#0f1f3d" }}>Total</td>
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
                            ...(coreTotal > 0
                              ? { background: "#dcfce7", border: "1px solid #bbf7d0", color: "#166534" }
                              : { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#94a3b8" }),
                          }}
                        >
                          {coreTotal > 0 ? coreTotal.toFixed(1) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}
        {factors.length > 0 && <RatingLegend />}
      </div>
    </div>
  );
}
