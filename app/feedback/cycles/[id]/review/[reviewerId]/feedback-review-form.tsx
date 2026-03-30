"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionRow {
  id: string;
  question_text: string;
  competency_group: string;
  sort_order: number;
  score: number | null;
  comment: string;
  submitted_at: string | null;
}

interface ScaleRow {
  value: number;
  label: string;
}

interface RevieweeInfo {
  full_name: string;
  job_title?: string;
  department?: string;
}

interface FeedbackReviewFormProps {
  cycleId: string;
  reviewerId: string;
  cycleName: string;
  cycleStatus: string;
  reviewerType: string;
  reviewee?: RevieweeInfo;
  questions: QuestionRow[];
  scale: ScaleRow[];
  isSubmitted: boolean;
}

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h % 360);
  return `hsl(${hue}, 45%, 42%)`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function FeedbackReviewForm({
  cycleId,
  reviewerId,
  cycleName,
  cycleStatus,
  reviewerType,
  reviewee,
  questions,
  scale,
  isSubmitted,
}: FeedbackReviewFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<null | "submitted" | "updated">(null);
  const [state, setState] = useState<Record<string, { score: number | null; comment: string }>>(() => {
    const out: Record<string, { score: number | null; comment: string }> = {};
    for (const q of questions) {
      out[q.id] = { score: q.score, comment: q.comment };
    }
    return out;
  });

  const update = (questionId: string, score: number | null, comment: string) => {
    setState((prev) => ({ ...prev, [questionId]: { score, comment } }));
  };

  const saveDraft = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/feedback/cycles/${cycleId}/review/${reviewerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: state, submit: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setError(null);
    setSubmitSuccess(null);
    const amendingSubmitted = isSubmitted;
    setSaving(true);
    try {
      const res = await fetch(`/api/feedback/cycles/${cycleId}/review/${reviewerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses: state, submit: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Submit failed");
        return;
      }
      setSubmitSuccess(amendingSubmitted ? "updated" : "submitted");
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const byGroup = new Map<string, QuestionRow[]>();
  for (const q of questions) {
    const g = q.competency_group || "Other";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(q);
  }
  const groups = Array.from(byGroup.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const answeredCount = questions.filter((q) => {
    const s = state[q.id];
    return s ? s.score != null : q.score != null;
  }).length;
  const totalCount = questions.length;
  const isComplete = totalCount > 0 && answeredCount === totalCount;
  const statusClass = isSubmitted ? "text-[#065f46]" : "text-[#92400e]";
  const allowEdit = !isSubmitted || cycleStatus === "Active";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#8a97b8] mb-1">
            {reviewerType === "SELF" ? "Self-Assessment" : "Peer Review"}
          </p>
          <h1 className="font-['Sora'] text-[20px] font-extrabold text-[#0f1f3d]">
            {reviewerType === "SELF" ? cycleName : `Reviewing: ${reviewee?.full_name ?? "Unknown"}`}
          </h1>
          <p className="text-[13px] text-[#8a97b8] mt-1">
            {reviewerType === "SELF" ? (
              <>
                {cycleName} · {isSubmitted ? <span className={statusClass}>Submitted</span> : <span className={statusClass}>Pending</span>}
              </>
            ) : (
              <>
                {cycleName}
                {reviewee?.job_title ? ` · ${reviewee.job_title}` : ""}
                {" · "}
                {isSubmitted ? <span className={statusClass}>Submitted</span> : <span className={statusClass}>Pending</span>}
              </>
            )}
          </p>
        </div>
        {allowEdit && totalCount > 0 && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] font-semibold text-[#4a5a82]">
              {answeredCount} of {totalCount} answered
            </span>
            <div className="w-[140px] h-[6px] rounded-full bg-[#eef2fb] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#7c3aed] transition-all"
                style={{ width: `${(answeredCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Reviewee identity card (peer/direct report) */}
      {reviewee && reviewerType !== "SELF" && (
        <div className="flex items-center gap-4 p-4 mb-6 bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)]">
          <div
            className="w-11 h-11 rounded-[11px] flex items-center justify-center text-[13px] font-extrabold text-white flex-shrink-0"
            style={{ background: avatarColor(reviewee.full_name) }}
          >
            {initials(reviewee.full_name)}
          </div>
          <div>
            <p className="font-['Sora'] text-[14px] font-bold text-[#0f1f3d]">{reviewee.full_name}</p>
            <p className="text-[12px] text-[#8a97b8]">
              {[reviewee.job_title, reviewee.department].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          <div className="ml-auto">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#faf5ff] border border-[#e9d5ff] text-[#7c3aed] text-[10px] font-bold">
              <UserCheck className="w-3 h-3" />
              Peer Review
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-[8px] border border-[#fecaca] bg-[#fef2f2] px-4 py-2 text-[13px] text-[#b91c1c]">
          {error}
        </div>
      )}

      {submitSuccess && (
        <div className="rounded-[8px] border border-[#a7f3d0] bg-[#ecfdf5] px-4 py-2 text-[13px] text-[#047857]">
          {submitSuccess === "updated"
            ? "Your updates were saved successfully."
            : "Your assessment was submitted successfully."}
        </div>
      )}

      {groups.map(([groupName, qs]) => (
        <div key={groupName} className="space-y-4">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-1 h-5 rounded-full bg-[#7c3aed]" />
            <h2 className="font-['Sora'] text-[15px] font-bold text-[#0f1f3d]">{groupName}</h2>
          </div>
          <ul className="space-y-0">
            {qs.map((q, questionIndex) => {
              const { score, comment } = state[q.id] ?? { score: q.score, comment: q.comment };
              return (
                <li key={q.id} className="mb-4 last:mb-0">
                  <div className="bg-white border border-[#dde5f5] rounded-[14px] shadow-[0_2px_12px_rgba(15,31,61,0.07)] overflow-hidden">
                    <div className="px-5 pt-5 pb-4 border-b border-[#dde5f5]">
                      <div className="flex items-start gap-2.5">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#faf5ff] border border-[#e9d5ff] text-[10px] font-bold text-[#7c3aed] flex-shrink-0 mt-0.5">
                          {questionIndex + 1}
                        </span>
                        <p className="text-[14px] font-medium text-[#0f1f3d] leading-relaxed">{q.question_text}</p>
                      </div>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-[240px_1fr] gap-4">
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">Rating</p>
                        {!allowEdit ? (
                          <p className="text-[13px] text-[#4a5a82]">
                            {score != null && scale.find((s) => s.value === score)
                              ? `${score} – ${scale.find((s) => s.value === score)!.label}`
                              : "—"}
                          </p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {scale.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => update(q.id, opt.value, comment)}
                                className={cn(
                                  "flex items-center gap-2.5 px-3 py-2 rounded-[8px] border-[1.5px] text-[12px] font-semibold text-left transition-all",
                                  score === opt.value
                                    ? "bg-[#faf5ff] border-[#7c3aed] text-[#7c3aed]"
                                    : "bg-white border-[#dde5f5] text-[#4a5a82] hover:border-[#7c3aed]/40"
                                )}
                              >
                                <span
                                  className={cn(
                                    "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all",
                                    score === opt.value ? "border-[#7c3aed] bg-[#7c3aed]" : "border-[#dde5f5]"
                                  )}
                                />
                                {opt.value} – {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">
                          Comment <span className="font-normal normal-case">(optional)</span>
                        </p>
                        {!allowEdit ? (
                          <p className="text-[13px] text-[#4a5a82]">{comment || "—"}</p>
                        ) : (
                          <textarea
                            value={comment}
                            onChange={(e) => update(q.id, score, e.target.value)}
                            placeholder="Add context or an example to support your rating..."
                            rows={4}
                            className="w-full border-[1.5px] border-[#dde5f5] rounded-[8px] p-3 text-[13px] text-[#0f1f3d] resize-none outline-none placeholder:text-[#8a97b8] transition-colors focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/10"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {allowEdit && (
        <div className="sticky bottom-0 left-0 right-0 z-10 bg-white border-t border-[#dde5f5] shadow-[0_-4px_16px_rgba(15,31,61,0.06)] flex items-center justify-between px-6 py-3.5">
          <span className="text-[11px] text-[#8a97b8]">
            {answeredCount} of {totalCount} questions answered
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={saveDraft}
              disabled={saving}
              className="px-5 py-2 rounded-[8px] border-[1.5px] border-[#dde5f5] bg-white text-[12px] font-semibold text-[#4a5a82] hover:border-[#0f1f3d] transition-all disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!isComplete || saving}
              className="flex items-center gap-2 px-5 py-2 rounded-[8px] bg-[#7c3aed] text-white font-['Sora'] text-[12px] font-semibold hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              {saving ? "Submitting..." : "Submit Assessment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
