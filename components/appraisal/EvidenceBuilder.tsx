"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/utils/cn";
import type { ScanReport } from "@/types/evidence";

interface EvidenceBuilderProps {
  appraisalId: string;
  employeeId: string;
  reviewStart: string;
  reviewEnd: string;
  status: string;
  onAccept?: (text: string) => void;
}

interface Suggestion {
  id: string;
  achievement_text: string;
  confidence_level: string;
  evidence_summary: string[];
}

type State = "idle" | "loading" | "results" | "empty";

export function EvidenceBuilder({
  appraisalId,
  employeeId,
  reviewStart,
  reviewEnd,
  status,
  onAccept,
}: EvidenceBuilderProps) {
  const [state, setState] = useState<State>("idle");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [diagnosis, setDiagnosis] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status !== "SELF_ASSESSMENT" || !appraisalId || !employeeId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/evidence/suggestions?appraisalId=${encodeURIComponent(appraisalId)}&employeeId=${encodeURIComponent(employeeId)}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const list = (data.suggestions ?? []) as Suggestion[];
        setSuggestions(list);
        if (list.length > 0) setState("results");
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, appraisalId, employeeId]);

  const generate = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/evidence/generate-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          appraisalId,
          reviewStart,
          reviewEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate");
      const newList = (data.suggestions ?? []) as Suggestion[];
      const mergedCountRef = { current: 0 };
      setSuggestions((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]));
        for (const s of newList) byId.set(s.id, s);
        const merged = [...byId.values()];
        mergedCountRef.current = merged.length;
        return merged;
      });
      setScanReport(data.scanReport ?? null);
      setDiagnosis(data.diagnosis ?? null);
      setState(mergedCountRef.current > 0 ? "results" : "empty");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setState("empty");
    }
  }, [employeeId, appraisalId, reviewStart, reviewEnd]);

  const updateStatus = useCallback(
    async (id: string, newStatus: "accepted" | "edited" | "rejected", editedText?: string) => {
      const s = suggestions.find((x) => x.id === id);
      if (!s) return;
      try {
        const res = await fetch(`/api/evidence/suggestions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: newStatus,
            edited_text: newStatus === "edited" ? editedText : undefined,
          }),
        });
        if (!res.ok) throw new Error("Failed");
        setSuggestions((prev) => prev.filter((x) => x.id !== id));
        if (newStatus === "accepted" || newStatus === "edited") {
          const text = newStatus === "edited" && editedText ? editedText : s.achievement_text;
          onAccept?.(text);
          try {
            await fetch(`/api/appraisals/${appraisalId}/summary/append-achievement`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text }),
            });
          } catch {
            // append API may not exist yet; onAccept still fired
          }
        }
      } catch {
        setError("Failed to update");
      }
    },
    [suggestions, onAccept, appraisalId]
  );

  if (status !== "SELF_ASSESSMENT") return null;

  return (
    <div
      className="mb-6 overflow-hidden rounded-[14px] border border-[#dde5f5] bg-white"
      style={{ boxShadow: "0 2px 12px rgba(15,31,61,0.07)" }}
    >
      <div
        className="flex items-start justify-between gap-4 border-b border-[#dde5f5] px-5 py-4"
        style={{ background: "#f8faff" }}
      >
        <div>
          <h3 className="font-['Sora'] text-[15px] font-bold text-[#0f1f3d]">AI Evidence Builder</h3>
          <p className="mt-0.5 text-[12px] text-[#8a97b8]">
            Automatically detect achievements from your work activity during this review period.
          </p>
        </div>
        {state === "idle" && (
          <button
            type="button"
            onClick={generate}
            className="shrink-0 rounded-[8px] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #0d9488, #0f766e)" }}
          >
            Generate
          </button>
        )}
      </div>

      {error && (
        <div className="border-b border-[#fde68a] bg-[#fffbeb] px-5 py-3 text-[13px] text-[#92400e]">
          {error}
        </div>
      )}

      {state === "loading" && (
        <div className="px-5 py-8 text-center text-[13px] text-[#8a97b8]">
          Scanning your activity…
        </div>
      )}

      {state === "empty" && !error && (
        <div className="px-5 py-8 text-center text-[13px] text-[#8a97b8]">
          No significant activity clusters found for this period.
        </div>
      )}

      {state === "results" && (
        <div className="p-4">
          {suggestions.map((s) => {
            const editing = editingId === s.id;
            const showEvidence = expandedId === s.id;
            const handleAccept = (text: string, kind: "accepted" | "edited") => {
              setSaving(true);
              updateStatus(s.id, kind, kind === "edited" ? text : undefined)
                .then(() => { if (kind === "edited") { setEditingId(null); setEditText(""); } })
                .finally(() => setSaving(false));
            };
            const handleDiscard = () => {
              setSaving(true);
              updateStatus(s.id, "rejected").finally(() => setSaving(false));
            };
            return (
              <div
                key={s.id}
                className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden mb-3"
              >
                <div
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 border-b border-[#dde5f5]",
                    s.confidence_level === "high" && "bg-[#ecfdf5]",
                    s.confidence_level === "medium" && "bg-[#fffbeb]",
                    s.confidence_level === "low" && "bg-[#f8faff]"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border",
                      s.confidence_level === "high" && "bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]",
                      s.confidence_level === "medium" && "bg-[#fffbeb] border-[#fcd34d] text-[#92400e]",
                      s.confidence_level === "low" && "bg-[#f8faff] border-[#dde5f5] text-[#4a5a82]"
                    )}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        s.confidence_level === "high" && "bg-[#059669]",
                        s.confidence_level === "medium" && "bg-[#d97706]",
                        s.confidence_level === "low" && "bg-[#8a97b8]"
                      )}
                    />
                    {s.confidence_level.charAt(0).toUpperCase() + s.confidence_level.slice(1)} confidence
                  </span>
                </div>

                <div className="px-4 py-4">
                  {editing ? (
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full text-[13px] text-[#0f1f3d] leading-relaxed border border-[#dde5f5] rounded-[8px] p-3 outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10 resize-none mb-3"
                    />
                  ) : (
                    <p className="text-[13px] font-medium text-[#0f1f3d] leading-relaxed mb-3">
                      {s.achievement_text}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandedId(showEvidence ? null : s.id)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#3b82f6] hover:text-[#1d4ed8] transition-colors mb-2"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {showEvidence ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                    {showEvidence ? "Hide evidence" : "View evidence"}
                  </button>

                  {showEvidence && (
                    <ul className="mb-4 space-y-1.5 pl-1">
                      {(s.evidence_summary as string[]).map((bullet, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px] text-[#4a5a82]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#8a97b8] flex-shrink-0 mt-[5px]" />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-[#dde5f5]">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAccept(editText, "edited")}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-[#0d9488] text-white text-[11px] font-semibold hover:bg-[#0f766e] transition-colors disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save & accept"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingId(null); setEditText(""); }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] border border-[#dde5f5] text-[11px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] hover:text-[#0f1f3d] transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAccept(s.achievement_text, "accepted")}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] bg-[#0d9488] text-white text-[11px] font-semibold hover:bg-[#0f766e] transition-colors disabled:opacity-50"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingId(s.id); setEditText(s.achievement_text); }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] border border-[#dde5f5] text-[11px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] hover:text-[#0f1f3d] transition-colors"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleDiscard}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-[8px] border border-[#fecaca] text-[11px] font-semibold text-[#dc2626] hover:bg-[#fff1f2] transition-colors ml-auto"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          Discard
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {scanReport && process.env.NEXT_PUBLIC_EVIDENCE_DEBUG === "true" && (
        <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden mt-4">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#dde5f5] bg-[#f8faff]">
            <div className="flex items-center gap-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8a97b8" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">
                Sources checked · {new Date(scanReport.generatedAt).toLocaleTimeString()}
              </p>
            </div>
            <p className="text-[10px] text-[#8a97b8]">
              {scanReport.totalCollected} total items collected
            </p>
          </div>
          <div className="divide-y divide-[#dde5f5]">
            {scanReport.sources.map((source) => (
              <div key={source.name} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full flex-shrink-0",
                    source.status === "live" ? "bg-[#059669]" : source.status === "error" ? "bg-[#dc2626]" : !source.attempted ? "bg-[#dde5f5]" : "bg-[#8a97b8]"
                  )}
                />
                <span className="text-[12px] font-medium text-[#0f1f3d] flex-1">{source.name}</span>
                <span
                  className={cn(
                    "text-[11px] font-semibold min-w-[60px] text-right",
                    source.status === "live" ? "text-[#0f1f3d]" : "text-[#8a97b8]"
                  )}
                >
                  {source.attempted ? `${source.collected} item${source.collected !== 1 ? "s" : ""}` : "Not attempted"}
                </span>
                {source.note && (
                  <span className="text-[10px] text-[#8a97b8] max-w-[200px] truncate hidden md:block">
                    {source.note}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {diagnosis && process.env.NEXT_PUBLIC_EVIDENCE_DEBUG === "true" && (
        <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden mt-3">
          <div className="px-4 py-3 border-b border-[#dde5f5] bg-[#f8faff]">
            <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">
              Pipeline diagnosis
            </p>
          </div>
          <div className="divide-y divide-[#dde5f5]">
            {diagnosis.appraisal && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[.06em] text-[#8a97b8] mb-1.5">
                  Appraisal collector
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {[
                    ["Workplan items", (diagnosis.appraisal as { workplanItemsConsidered?: number }).workplanItemsConsidered],
                    ["With actual result", (diagnosis.appraisal as { rowsWithActualResult?: number }).rowsWithActualResult],
                    ["Task only", (diagnosis.appraisal as { rowsTaskOnly?: number }).rowsTaskOnly],
                    ["Stored", (diagnosis.appraisal as { stored?: number }).stored],
                  ].map(([label, val]) => (
                    <span key={label as string} className="text-[11px] text-[#4a5a82]">
                      <span className="font-medium text-[#0f1f3d]">{String(val)}</span> {label}
                    </span>
                  ))}
                </div>
                {(diagnosis.appraisal as { activityDateRange?: string }).activityDateRange && (
                  <p className="text-[10px] text-[#8a97b8] mt-1">
                    Dates: {(diagnosis.appraisal as { activityDateRange?: string }).activityDateRange}
                  </p>
                )}
              </div>
            )}
            {diagnosis.calendar && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[.06em] text-[#8a97b8] mb-1.5">
                  Calendar collector
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="text-[11px] text-[#4a5a82]">
                    <span className="font-medium text-[#0f1f3d]">
                      {(diagnosis.calendar as { graphEventsReturned?: number }).graphEventsReturned}
                    </span>{" "}
                    from Graph
                  </span>
                  <span className="text-[11px] text-[#4a5a82]">
                    <span className="font-medium text-[#059669]">
                      {(diagnosis.calendar as { stored?: number }).stored}
                    </span>{" "}
                    stored
                  </span>
                </div>
                {(diagnosis.calendar as { dropped?: Record<string, number> }).dropped && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                    {Object.entries((diagnosis.calendar as { dropped: Record<string, number> }).dropped)
                      .filter(([, v]) => (v as number) > 0)
                      .map(([k, v]) => (
                        <span key={k} className="text-[10px] text-[#8a97b8]">
                          {k}: <span className="text-[#dc2626] font-medium">{v as number}</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}
            {diagnosis.sharePoint && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[.06em] text-[#8a97b8] mb-1.5">
                  SharePoint / OneDrive collector
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {[
                    ["OneDrive raw", (diagnosis.sharePoint as { oneDrive?: { raw?: number } }).oneDrive?.raw],
                    ["OneDrive stored", (diagnosis.sharePoint as { oneDrive?: { stored?: number } }).oneDrive?.stored],
                    ["SharePoint raw", (diagnosis.sharePoint as { sharePoint?: { raw?: number } }).sharePoint?.raw],
                    ["SharePoint stored", (diagnosis.sharePoint as { sharePoint?: { stored?: number } }).sharePoint?.stored],
                  ].map(([label, val]) => (
                    <span key={label as string} className="text-[11px] text-[#4a5a82]">
                      <span className="font-medium text-[#0f1f3d]">{val ?? 0}</span> {label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {diagnosis.clustering && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[.06em] text-[#8a97b8] mb-1.5">
                  Clustering engine
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                  {[
                    ["In window", (diagnosis.clustering as { itemsInWindow?: number }).itemsInWindow],
                    ["Raw clusters", (diagnosis.clustering as { rawClusterCount?: number }).rawClusterCount],
                    ["Qualifying", (diagnosis.clustering as { qualifyingClusterCount?: number }).qualifyingClusterCount],
                  ].map(([label, val]) => (
                    <span key={label as string} className="text-[11px] text-[#4a5a82]">
                      <span className="font-medium text-[#0f1f3d]">{String(val)}</span> {label}
                    </span>
                  ))}
                </div>
                {(diagnosis.clustering as { disqualified?: unknown[] })?.disqualified?.length > 0 && (
                  <div className="space-y-1">
                    {((diagnosis.clustering as { disqualified: Array<{ topic: string; itemCount: number; score: number; reason: string }> }).disqualified).map((d, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-[10px] text-[#8a97b8] bg-[#fff1f2] border border-[#fecaca] rounded-[6px] px-2.5 py-1.5"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        <span className="text-[#0f1f3d] font-medium truncate max-w-[200px]">&quot;{d.topic}&quot;</span>
                        <span>
                          {d.itemCount} items · score {d.score} · {d.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
