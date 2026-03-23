"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type ReviewerType = "SELF" | "MANAGER" | "PEER" | "DIRECT_REPORT";

type QuestionRow = {
  id: string;
  reviewer_type: ReviewerType;
  competency_group: string;
  question_text: string;
  sort_order: number;
};

type ScaleRow = {
  id: string;
  value: number;
  label: string;
  sort_order: number;
};

const TABS: ReviewerType[] = ["SELF", "MANAGER", "PEER", "DIRECT_REPORT"];

function prettyType(type: ReviewerType) {
  return type === "DIRECT_REPORT" ? "DIRECT REPORT" : type;
}

export default function Admin360QuestionBankPage() {
  const [activeType, setActiveType] = useState<ReviewerType>("SELF");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [scale, setScale] = useState<ScaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [draftText, setDraftText] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addCategoryMode, setAddCategoryMode] = useState<"existing" | "new">("existing");
  const [addCategory, setAddCategory] = useState("");
  const [addNewCategory, setAddNewCategory] = useState("");
  const [addQuestionText, setAddQuestionText] = useState("");

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const load = async (reviewerType: ReviewerType) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback/questions?reviewer_type=${reviewerType}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load question bank");
        setQuestions([]);
        return;
      }
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
      setScale(Array.isArray(data.scale) ? data.scale : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load question bank");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(activeType);
  }, [activeType]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const categories = useMemo(() => {
    return [...new Set(questions.map((q) => q.competency_group))].sort((a, b) => a.localeCompare(b));
  }, [questions]);

  const grouped = useMemo(() => {
    const map = new Map<string, QuestionRow[]>();
    for (const q of [...questions].sort((a, b) => a.sort_order - b.sort_order || a.question_text.localeCompare(b.question_text))) {
      const list = map.get(q.competency_group) ?? [];
      list.push(q);
      map.set(q.competency_group, list);
    }
    return [...map.entries()];
  }, [questions]);

  const onSaveInline = async (id: string) => {
    const question_text = (draftText[id] ?? "").trim();
    if (!question_text) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to save question");
        return;
      }
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, question_text } : q)));
      setEditingId(null);
      showSuccess("Question updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedback/questions/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to delete question");
        return;
      }
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      showSuccess("Question deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete question");
    } finally {
      setSaving(false);
    }
  };

  const onCreate = async () => {
    const competency_group = (addCategoryMode === "new" ? addNewCategory : addCategory).trim();
    const question_text = addQuestionText.trim();
    if (!competency_group || !question_text) {
      setError("Category and question text are required.");
      return;
    }

    const currentInCategory = questions.filter((q) => q.competency_group === competency_group);
    const nextSort = (currentInCategory.reduce((m, q) => Math.max(m, Number(q.sort_order) || 0), 0) || 0) + 1;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/feedback/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer_type: activeType,
          competency_group,
          question_text,
          sort_order: nextSort,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create question");
        return;
      }
      if (data.question) setQuestions((prev) => [...prev, data.question]);
      setShowAddModal(false);
      setAddCategoryMode("existing");
      setAddCategory("");
      setAddNewCategory("");
      setAddQuestionText("");
      showSuccess("Question added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create question");
    } finally {
      setSaving(false);
    }
  };

  const reorderWithinCategory = async (category: string, sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const list = questions
      .filter((q) => q.competency_group === category)
      .sort((a, b) => a.sort_order - b.sort_order);
    const from = list.findIndex((q) => q.id === sourceId);
    const to = list.findIndex((q) => q.id === targetId);
    if (from < 0 || to < 0) return;

    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    const updates = next.map((q, i) => ({ id: q.id, sort_order: i + 1 }));

    setQuestions((prev) =>
      prev.map((q) => {
        const found = updates.find((u) => u.id === q.id);
        return found ? { ...q, sort_order: found.sort_order } : q;
      })
    );

    for (const u of updates) {
      await fetch(`/api/admin/feedback/questions/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: u.sort_order }),
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff]">
      <div className="mx-auto max-w-7xl px-5 pb-12 pt-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold text-[#0f2044]">360 Question Bank</h1>
            <p className="mt-1 text-[13px] text-[#64748b]">Manage feedback questions by reviewer type</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-lg border border-[#dde5f5] bg-white px-3 py-2 text-xs font-semibold text-[#4a5a82] hover:bg-[#f8fafc]"
            >
              Back to HR Administration
            </Link>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="rounded-lg bg-[#0d9488] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0f766e]"
            >
              + Add question
            </button>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534]">{success}</div>}

        <div className="mb-4 rounded-2xl border border-[#e8edf8] bg-white p-4 shadow-sm">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#8a97b8]">Rating scale</p>
          <div className="flex flex-wrap gap-2">
            {scale.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center rounded-full border border-[#dbeafe] bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#1d4ed8]"
              >
                {s.value} {s.label}
              </span>
            ))}
            {scale.length === 0 && <span className="text-xs text-[#94a3b8]">No rating scale configured.</span>}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveType(t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                activeType === t
                  ? "border-[#0d9488] bg-[#ecfdf5] text-[#065f46]"
                  : "border-[#dde5f5] bg-white text-[#64748b] hover:bg-[#f8fafc]"
              )}
            >
              {prettyType(t)}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-[#e8edf8] bg-white p-4 text-sm text-[#8a97b8]">Loading questions…</div>
          ) : grouped.length === 0 ? (
            <div className="rounded-2xl border border-[#e8edf8] bg-white p-6 text-sm text-[#8a97b8]">
              No questions for this reviewer type.
            </div>
          ) : (
            grouped.map(([category, list]) => (
              <section key={category} className="rounded-2xl border border-[#e8edf8] bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-[#eef2fb] px-4 py-3">
                  <h2 className="text-sm font-semibold text-[#0f2044]">Category: {category}</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(true);
                      setAddCategoryMode("existing");
                      setAddCategory(category);
                    }}
                    className="text-xs font-semibold text-[#0d9488] hover:text-[#0f766e]"
                  >
                    + Add to category
                  </button>
                </div>
                <div className="divide-y divide-[#eef2fb]">
                  {list.map((q) => {
                    const isEditing = editingId === q.id;
                    return (
                      <div
                        key={q.id}
                        draggable
                        onDragStart={() => setDraggingId(q.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!draggingId) return;
                          void reorderWithinCategory(category, draggingId, q.id);
                          setDraggingId(null);
                        }}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#8a97b8]">#{q.sort_order}</div>
                          {isEditing ? (
                            <input
                              value={draftText[q.id] ?? q.question_text}
                              onChange={(e) => setDraftText((prev) => ({ ...prev, [q.id]: e.target.value }))}
                              className="w-full rounded-lg border border-[#dde5f5] px-3 py-2 text-sm text-[#0f2044]"
                            />
                          ) : (
                            <p className="text-sm text-[#0f2044]">{q.question_text}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void onSaveInline(q.id)}
                                className="rounded-lg bg-[#0d9488] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(null);
                                  setDraftText((prev) => ({ ...prev, [q.id]: q.question_text }));
                                }}
                                className="rounded-lg border border-[#dde5f5] bg-white px-3 py-1.5 text-xs font-semibold text-[#4a5a82]"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(q.id);
                                  setDraftText((prev) => ({ ...prev, [q.id]: q.question_text }));
                                }}
                                className="rounded-lg border border-[#dde5f5] bg-white px-3 py-1.5 text-xs font-semibold text-[#4a5a82]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => void onDelete(q.id)}
                                className="rounded-lg border border-[#fecaca] bg-[#fff1f2] px-3 py-1.5 text-xs font-semibold text-[#b91c1c] disabled:opacity-60"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={() => setShowAddModal(false)}>
            <div className="w-full max-w-lg rounded-2xl border border-[#dde5f5] bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-[#0f2044]">Add question</h3>
              <p className="mt-1 text-xs text-[#8a97b8]">Reviewer type is locked to {prettyType(activeType)}.</p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#64748b]">Category mode</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAddCategoryMode("existing")}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                        addCategoryMode === "existing"
                          ? "border-[#0d9488] bg-[#ecfdf5] text-[#065f46]"
                          : "border-[#dde5f5] bg-white text-[#64748b]"
                      )}
                    >
                      Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddCategoryMode("new")}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                        addCategoryMode === "new"
                          ? "border-[#0d9488] bg-[#ecfdf5] text-[#065f46]"
                          : "border-[#dde5f5] bg-white text-[#64748b]"
                      )}
                    >
                      New category
                    </button>
                  </div>
                </div>

                {addCategoryMode === "existing" ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#64748b]">Category</label>
                    <select
                      value={addCategory}
                      onChange={(e) => setAddCategory(e.target.value)}
                      className="w-full rounded-lg border border-[#dde5f5] px-3 py-2 text-sm"
                    >
                      <option value="">Select category…</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#64748b]">New category</label>
                    <input
                      value={addNewCategory}
                      onChange={(e) => setAddNewCategory(e.target.value)}
                      placeholder="e.g. Reliability"
                      className="w-full rounded-lg border border-[#dde5f5] px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#64748b]">Question text</label>
                  <textarea
                    value={addQuestionText}
                    onChange={(e) => setAddQuestionText(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border border-[#dde5f5] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-[#dde5f5] bg-white px-3 py-2 text-xs font-semibold text-[#4a5a82]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void onCreate()}
                  disabled={saving}
                  className="rounded-lg bg-[#0d9488] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0f766e] disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Add question"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
