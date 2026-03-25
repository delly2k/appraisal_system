"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COMPETENCY_LABELS, SCALE_LABELS, calculateTotals, type EQQuestion } from "@/lib/eq-questions";

const PAGES = 5;
const PER_PAGE = 10;

export default function EQTakePage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<EQQuestion[]>([]);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const saveTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/development/eq")
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Failed to load EQ questions");
        }
        return res.json();
      })
      .then((d) => {
        if (!cancelled) {
          if (Array.isArray(d.questions)) setQuestions(d.questions);
          if (d.draft) {
            setResponses(d.draft.responses ?? {});
            setPage(d.draft.last_page ?? 0);
          }
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load EQ questions");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDraft(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loadingDraft) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch("/api/development/eq", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, last_page: page }),
      });
    }, 1000);
    return () => clearTimeout(saveTimer.current);
  }, [responses, page, loadingDraft]);

  const pageQs = questions.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const pageAnswered = pageQs.filter((q) => responses[q.id]).length;
  const totalAnswered = Object.keys(responses).length;
  const pageComplete = pageAnswered === PER_PAGE;
  const isLast = page === PAGES - 1;

  async function handleSubmit() {
    if (totalAnswered < 50) return;
    setSubmitting(true);
    try {
      const totals = calculateTotals(responses, questions);
      const res = await fetch("/api/development/eq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sa_total: totals.SA,
          me_total: totals.ME,
          mo_total: totals.MO,
          e_total: totals.E,
          ss_total: totals.SS,
          responses,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      router.push("/development");
    } catch (e: any) {
      setError(e.message ?? "Submission failed. Please try again.");
      setSubmitting(false);
    }
  }

  if (loadingDraft) {
    return (
      <main className="flex-1 overflow-auto p-6 md:p-8" style={{ backgroundColor: "var(--surface)" }}>
        <div className="mx-auto max-w-3xl pt-20 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#0d9488] border-t-transparent rounded-full animate-spin" />
          <p className="text-[13px] text-[#8a97b8]">Loading your progress...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-auto p-6 md:p-8" style={{ backgroundColor: "var(--surface)" }}>
      <div className="space-y-5">
        <Link
          href="/development"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#8a97b8] hover:text-[#0f1f3d] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Development Profile
        </Link>

        <div className="flex items-start gap-4">
          <div
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl"
            style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)" }}
          >
            <svg className="h-6 w-6 text-[#3b82f6]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="pt-0.5">
            <h1 className="font-['Sora'] text-[22px] font-extrabold text-[#0f1f3d]">EQ Assessment</h1>
            <p className="text-[13px] text-[#8a97b8] mt-1">
              {totalAnswered}/50 answered · Page {page + 1} of {PAGES}
            </p>
          </div>
        </div>

        <div className="rounded-[14px] border border-[#dde5f5] shadow-[0_2px_12px_rgba(15,31,61,.07),0_0_1px_rgba(15,31,61,.1)] bg-white overflow-hidden">
          <div className="px-6 py-3 bg-[#f8faff] border-b border-[#dde5f5] flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">Scale:</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className="text-[11px] text-[#8a97b8]">
                <strong className="text-[#0f1f3d] font-semibold">{n}</strong> = {SCALE_LABELS[n]}
              </span>
            ))}
          </div>

          <div className="px-6 pt-4 pb-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[.07em] text-[#8a97b8]">Overall progress</span>
              <span className="text-[11px] font-semibold text-[#0f1f3d]">{totalAnswered}/50</span>
            </div>
            <div className="h-[4px] bg-[#f0f4ff] rounded-full overflow-hidden">
              <div className="h-full bg-[#0d9488] rounded-full transition-all" style={{ width: `${(totalAnswered / 50) * 100}%` }} />
            </div>
          </div>

          <div className="divide-y divide-[#f0f4ff] px-6">
            {pageQs.map((q) => (
              <div key={q.id} className="py-4">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-[11px] text-[#c0cce0] font-mono mt-0.5 w-5 shrink-0 text-right">{q.id}</span>
                  <p className="text-[13.5px] text-[#0f1f3d] leading-relaxed flex-1">{q.text}</p>
                  <span
                    title={COMPETENCY_LABELS[q.competency]}
                    className="text-[9px] font-bold uppercase tracking-wider text-[#8a97b8] shrink-0 mt-0.5 w-5 text-right"
                  >
                    {q.competency}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-8">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => setResponses((prev) => ({ ...prev, [q.id]: val }))}
                      className={`w-9 h-9 rounded-full border-2 text-[12px] font-bold transition-all ${
                        responses[q.id] === val
                          ? "bg-[#0d9488] border-[#0d9488] text-white"
                          : "border-[#dde5f5] text-[#8a97b8] hover:border-[#0d9488] hover:text-[#0d9488] bg-white"
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  {responses[q.id] && <span className="text-[11px] text-[#8a97b8] ml-1">{SCALE_LABELS[responses[q.id]]}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 bg-[#f8faff] border-t border-[#dde5f5] flex items-center justify-between">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] border border-[#dde5f5] text-[12px] font-semibold text-[#8a97b8] hover:text-[#0f1f3d] hover:border-[#8a97b8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous
            </button>

            <span className="text-[10px] text-[#8a97b8]">{totalAnswered > 0 ? "Progress saved automatically" : ""}</span>

            <div className="flex gap-1.5 items-center">
              {Array.from({ length: PAGES }).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all ${
                    i < page ? "w-5 h-1.5 bg-[#0d9488]" : i === page ? "w-5 h-1.5 bg-[#0f1f3d]" : "w-1.5 h-1.5 bg-[#dde5f5]"
                  }`}
                />
              ))}
            </div>

            {!isLast ? (
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!pageComplete}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-[8px] text-[12px] font-['Sora'] font-semibold transition-colors ${
                  pageComplete ? "bg-[#0d9488] text-white hover:bg-[#0f766e]" : "bg-[#e8edf8] text-[#8a97b8] cursor-not-allowed"
                }`}
              >
                Next
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={totalAnswered < 50 || submitting}
                className={`flex items-center gap-2 px-5 py-2 rounded-[8px] text-[12px] font-['Sora'] font-semibold transition-colors ${
                  totalAnswered === 50 && !submitting
                    ? "bg-[#0d9488] text-white hover:bg-[#0f766e]"
                    : "bg-[#e8edf8] text-[#8a97b8] cursor-not-allowed"
                }`}
              >
                {submitting ? "Submitting…" : "Submit assessment"}
              </button>
            )}
          </div>

          {error && <p className="px-6 pb-4 text-[12px] text-red-500 text-center">{error}</p>}
        </div>
      </div>
    </main>
  );
}
