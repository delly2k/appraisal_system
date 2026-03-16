"use client";

import { useState, useEffect } from "react";
import { ClipboardCheck } from "lucide-react";

export interface HRActionsTabProps {
  appraisalId: string;
  status: string;
  isHR: boolean;
}

const REC_KEYS_LEFT: { key: string; label: string }[] = [
  { key: "pay_increment", label: "Pay Increment" },
  { key: "withhold_increment", label: "Withhold Increment" },
  { key: "suitable_for_promotion", label: "Suitable for Promotion" },
  { key: "remedial_action", label: "Remedial Action" },
  { key: "probation", label: "Probation" },
];

const REC_KEYS_RIGHT: { key: string; label: string }[] = [
  { key: "eligible_for_award", label: "Eligible for Award" },
  { key: "not_eligible_for_award", label: "Not Eligible for Award" },
  { key: "job_enrichment", label: "Job Enrichment" },
  { key: "reassignment", label: "Reassignment" },
  { key: "separation", label: "Separation" },
];

const DEFAULT_REC: Record<string, boolean> = {
  pay_increment: false,
  withhold_increment: false,
  eligible_for_award: false,
  not_eligible_for_award: false,
  suitable_for_promotion: false,
  job_enrichment: false,
  reassignment: false,
  remedial_action: false,
  probation: false,
  separation: false,
};

function normalizeRec(o: unknown): Record<string, boolean> {
  if (o == null || typeof o !== "object") return { ...DEFAULT_REC };
  const out = { ...DEFAULT_REC };
  for (const k of Object.keys(DEFAULT_REC)) {
    if (typeof (o as Record<string, unknown>)[k] === "boolean") {
      out[k] = (o as Record<string, boolean>)[k];
    }
  }
  return out;
}

export function HRActionsTab({ appraisalId, status, isHR }: HRActionsTabProps) {
  const [recs, setRecs] = useState<Record<string, boolean>>({ ...DEFAULT_REC });
  const [otherNotes, setOtherNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentUserRole = isHR ? "HR" : "";
  const isHRReview = status === "HR_REVIEW";

  useEffect(() => {
    if (!appraisalId || !isHR) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/appraisals/${appraisalId}/hr-recommendations`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setRecs(normalizeRec(data.recommendations));
          setOtherNotes(typeof data.other_notes === "string" ? data.other_notes : "");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appraisalId, isHR]);

  if (status !== "HR_REVIEW" || currentUserRole !== "HR") {
    return (
      <div className="flex items-center justify-center py-20 text-[#8a97b8] text-sm">
        HR recommendations are only available during HR Review phase.
      </div>
    );
  }

  const handleSave = async () => {
    if (!isHRReview) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/hr-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendations: recs, other_notes: otherNotes }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Failed to save");
      else window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#8a97b8] text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-[#dde5f5] rounded-[14px] overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 bg-[#f8faff] border-b border-[#dde5f5]">
          <div className="w-8 h-8 rounded-[8px] bg-[#ccfbf1] border border-[#99f6e4] flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4 text-[#0d9488]" />
          </div>
          <div>
            <p className="font-['Sora'] text-[13px] font-bold">Section B — HR Recommendations</p>
            <p className="text-[11px] text-[#8a97b8]">For HR use only</p>
          </div>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
            <div className="flex flex-col">
              {REC_KEYS_LEFT.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 py-2.5 px-3 rounded-[8px] cursor-pointer hover:bg-[#f0fdfa] transition-colors group"
                >
                  <input
                    type="checkbox"
                    checked={recs[key] ?? false}
                    onChange={(e) => setRecs((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#dde5f5] accent-[#0d9488]"
                  />
                  <span className="text-[13px] font-medium text-[#0f1f3d]">{label}</span>
                </label>
              ))}
            </div>
            <div className="flex flex-col">
              {REC_KEYS_RIGHT.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 py-2.5 px-3 rounded-[8px] cursor-pointer hover:bg-[#f0fdfa] transition-colors group"
                >
                  <input
                    type="checkbox"
                    checked={recs[key] ?? false}
                    onChange={(e) => setRecs((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#dde5f5] accent-[#0d9488]"
                  />
                  <span className="text-[13px] font-medium text-[#0f1f3d]">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <textarea
            value={otherNotes}
            onChange={(e) => setOtherNotes(e.target.value)}
            placeholder="Additional notes or recommendations..."
            className="w-full border border-[#dde5f5] rounded-[8px] p-3 text-[13px] text-[#0f1f3d] resize-none min-h-[80px] focus:outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/10"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!isHRReview || saving}
            className="self-end px-5 py-2 rounded-[8px] bg-[#0d9488] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
