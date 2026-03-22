"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { UploadStepIndicator } from "./UploadStepIndicator";
import type { ColumnMapping } from "@/app/api/appraisals/[id]/workplan/analyse-columns/route";
import {
  parseWorkplanWeight,
  parseWorksheetToWorkplanRows,
  shouldSkipMappingTarget,
} from "@/lib/workplan-excel-parse";

type Step = "upload" | "sheet" | "mapping" | "review" | "importing";

const TARGET_FIELD_OPTIONS = [
  { value: "", label: "— Skip —" },
  { value: "row_number", label: "Row # (skip)" },
  { value: "corporate_objective", label: "Corporate objective" },
  { value: "division_objective", label: "Division objective" },
  { value: "individual_objective", label: "Individual objective" },
  { value: "major_task", label: "Major task" },
  { value: "activities", label: "Activities" },
  { value: "key_output", label: "Key output" },
  { value: "performance_standard", label: "Performance standard" },
  { value: "weight", label: "Weight (%)" },
  { value: "metric_type", label: "Metric type" },
  { value: "metric_target", label: "Target" },
  { value: "metric_deadline", label: "Deadline / due date" },
];

const CONFIDENCE_STYLES: Record<string, string> = {
  HIGH: "bg-[#ecfdf5] border-[#6ee7b7] text-[#065f46]",
  MEDIUM: "bg-[#fffbeb] border-[#fcd34d] text-[#92400e]",
  LOW: "bg-[#fff1f2] border-[#fecaca] text-[#dc2626]",
  SKIP: "bg-[#f8faff] border-[#dde5f5] text-[#8a97b8]",
};
const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: "● High",
  MEDIUM: "● Medium",
  LOW: "● Low",
  SKIP: "— Skip",
};

interface WorkplanUploadModalProps {
  appraisalId: string;
  workplanId: string;
  onComplete: (importedCount: number, filename: string) => void;
  onClose: () => void;
}

type WorkbookState = { workbook: XLSX.WorkBook; filename: string } | null;

function applyMappingClient(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping[]
): Record<string, unknown>[] {
  const typeMap: Record<string, string> = {
    NUMBER: "NUMBER",
    NUM: "NUMBER",
    "#": "NUMBER",
    PERCENTAGE: "PERCENT",
    PERCENT: "PERCENT",
    "%": "PERCENT",
    DATE: "DATE",
    DEADLINE: "DATE",
    BOOLEAN: "PERCENT",
    "YES/NO": "PERCENT",
    BOOL: "PERCENT",
    TEXT: "PERCENT",
    NARRATIVE: "PERCENT",
  };

  const nonEmpty = rows.filter((row) =>
    Object.values(row).some((v) => v !== null && v !== "" && v !== undefined)
  );

  return nonEmpty
    .map((row) => {
      const item: Record<string, unknown> = {};
      const activitiesParts: string[] = [];

      for (const m of mapping) {
        if (shouldSkipMappingTarget(m.targetField)) continue;
        const rawValue = row[m.excelColumn];
        if (rawValue === undefined || rawValue === null || rawValue === "") continue;

        if (m.targetField === "weight") {
          item.weight = parseWorkplanWeight(rawValue);
        } else if (m.targetField === "metric_target") {
          const parsed = parseFloat(String(rawValue));
          item.metric_target = Number.isNaN(parsed) ? null : parsed;
        } else if (m.targetField === "metric_type") {
          const v = String(rawValue).toUpperCase().trim();
          item.metric_type = typeMap[v] ?? "PERCENT";
        } else if (m.targetField === "metric_deadline") {
          if (typeof rawValue === "number") {
            const date = XLSX.SSF.parse_date_code(rawValue);
            if (date && date.y && date.m && date.d) {
              item.metric_deadline = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
            } else {
              item.metric_deadline = String(rawValue).trim();
            }
          } else {
            item.metric_deadline = String(rawValue).trim();
          }
        } else if (m.targetField === "activities") {
          activitiesParts.push(String(rawValue).trim());
        } else if (m.targetField) {
          item[m.targetField] = String(rawValue).trim();
        }
      }

      if (activitiesParts.length > 0) {
        const act = activitiesParts.join("\n");
        const ko = item.key_output != null ? String(item.key_output).trim() : "";
        item.key_output = ko ? `${act}\n${ko}` : act;
      }

      return item;
    })
    .filter((item) => item.major_task && (item.weight as number) > 0);
}

export function WorkplanUploadModal({
  appraisalId,
  workplanId,
  onComplete,
  onClose,
}: WorkplanUploadModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [workbookState, setWorkbookState] = useState<WorkbookState>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [allRows, setAllRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetPreviewRows, setSheetPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [sheetPreviewHeaders, setSheetPreviewHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [templateMeta, setTemplateMeta] = useState<Record<string, string>>({});
  /** 0-based sheet row where data headers were found; used to show B1:E3 metadata only for DBJ-style sheets. */
  const [dataHeaderRowIndex, setDataHeaderRowIndex] = useState(0);

  useEffect(() => {
    if (step !== "sheet" || !workbookState?.workbook || !selectedSheet) return;
    const sheet = workbookState.workbook.Sheets[selectedSheet];
    const { rows, headers, templateMeta: meta, headerRowIndex } = parseWorksheetToWorkplanRows(sheet);
    setSheetPreviewRows(rows);
    setSheetPreviewHeaders(headers);
    setTemplateMeta(meta);
    setDataHeaderRowIndex(headerRowIndex);
  }, [step, workbookState, selectedSheet]);

  const stepIndex = step === "upload" ? 0 : step === "sheet" ? 1 : step === "mapping" ? 2 : step === "review" ? 3 : 3;

  const handleFile = useCallback((file: File) => {
    const accept = ".xlsx,.xls";
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const ab = e.target?.result as ArrayBuffer;
      if (!ab) return;
      const wb = XLSX.read(ab, { type: "array", cellDates: true });
      setWorkbookState({ workbook: wb, filename: file.name });
      setSelectedSheet(wb.SheetNames[0] ?? "");
      setStep("sheet");
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onSheetSelected = useCallback(() => {
    if (!workbookState || !selectedSheet) return;
    const sheet = workbookState.workbook.Sheets[selectedSheet];
    const { rows, headers: h, templateMeta: meta, headerRowIndex } = parseWorksheetToWorkplanRows(sheet);
    setAllRows(rows);
    setHeaders(h);
    setTemplateMeta(meta);
    setDataHeaderRowIndex(headerRowIndex);
    setMappings([]);
    setStep("mapping");
    setAnalysing(true);
    fetch(`/api/appraisals/${appraisalId}/workplan/analyse-columns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ headers: h, sampleRows: rows.slice(0, 5) }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.mappings && Array.isArray(data.mappings)) {
          setMappings(data.mappings);
        }
      })
      .finally(() => setAnalysing(false));
  }, [workbookState, selectedSheet, appraisalId]);

  const previewItems = step === "review" ? applyMappingClient(allRows, mappings) : [];
  const totalWeight = previewItems.reduce((s, i) => s + ((i.weight as number) ?? 0), 0);
  const weightValid = Math.abs(totalWeight - 100) <= 2;
  const hasRequired = previewItems.every(
    (i) => i.major_task && String(i.major_task).trim() && Number(i.weight ?? 0) > 0
  );
  const majorTaskSet = new Set(previewItems.map((i) => String(i.major_task).toLowerCase()));
  const hasDupe = majorTaskSet.size < previewItems.length;

  const handleConfirmImport = useCallback(async () => {
    setImportError(null);
    setStep("importing");
    try {
      const res = await fetch(`/api/appraisals/${appraisalId}/workplan/import-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workplanId,
          rows: allRows,
          mapping: mappings,
          filename: workbookState?.filename ?? "",
          sheetName: selectedSheet,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.errors?.join(" ") || data.error || "Import failed");
        setStep("review");
        return;
      }
      onComplete(data.imported ?? 0, workbookState?.filename ?? "");
      onClose();
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed");
      setStep("review");
    }
  }, [appraisalId, workplanId, allRows, mappings, workbookState, selectedSheet, onComplete, onClose]);

  const mappedCount = mappings.filter((m) => m.targetField && !shouldSkipMappingTarget(m.targetField)).length;
  const skipCount = mappings.length - mappedCount;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={(e) => e.target === e.currentTarget && step !== "importing" && onClose()}
    >
      <div
        className="bg-white rounded-[16px] w-full max-w-[640px] max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#dde5f5]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-['Sora'] text-[16px] font-bold text-[#0f1f3d]">
              Import workplan from Excel
            </h2>
            {step !== "importing" && (
              <button
                type="button"
                onClick={onClose}
                className="text-[#8a97b8] hover:text-[#0f1f3d] text-[20px] leading-none"
              >
                ×
              </button>
            )}
          </div>
          <UploadStepIndicator currentStep={stepIndex} />
        </div>

        <div className="p-6">
          {step === "upload" && (
            <>
              <div
                className="border-2 border-dashed border-[#dde5f5] rounded-[12px] p-10 text-center hover:border-[#0d9488] hover:bg-[#f0fdfa] transition-colors"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#0d9488]", "bg-[#f0fdfa]"); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-[#0d9488]", "bg-[#f0fdfa]"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-[#0d9488]", "bg-[#f0fdfa]");
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  id="workplan-excel-upload"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    e.target.value = "";
                  }}
                />
                <label htmlFor="workplan-excel-upload" className="cursor-pointer block">
                  <div className="w-12 h-12 rounded-[12px] bg-[#f8faff] border border-[#dde5f5] flex items-center justify-center mx-auto mb-3">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8a97b8" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                  </div>
                  <p className="text-[13px] font-medium text-[#0f1f3d]">Drop your Excel file here or click to browse</p>
                  <p className="text-[11px] text-[#8a97b8] mt-1">.xlsx or .xls only</p>
                </label>
              </div>
              <p className="text-[11px] text-[#8a97b8] mt-3 text-center">
                Expected columns: Corporate objective · Division objective · Major task · Key output · Performance standard · Weight (%) · Metric type · Target
              </p>
            </>
          )}

          {step === "sheet" && workbookState && (
            <>
              <p className="text-[12px] text-[#0f1f3d] font-medium mb-2">Select sheet</p>
              {(() => {
                const parts = [
                  templateMeta.employeeName,
                  templateMeta.division || templateMeta.unit,
                  templateMeta.position,
                ].filter(Boolean);
                if (parts.length === 0 || dataHeaderRowIndex < 4) return null;
                return (
                  <p className="text-[11px] text-[#4a5a82] mb-3 px-1 py-2 rounded-[8px] bg-[#f8faff] border border-[#dde5f5]">
                    <span className="font-semibold text-[#0f1f3d]">Detected:</span> {parts.join(" · ")}
                  </p>
                );
              })()}
              <div className="flex flex-wrap gap-2 mb-4">
                {workbookState.workbook.SheetNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setSelectedSheet(name)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors
                      ${selectedSheet === name ? "bg-[#0d9488] text-white" : "bg-[#f8faff] border border-[#dde5f5] text-[#4a5a82] hover:border-[#0d9488]"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[#8a97b8] mb-2">Preview (first 5 rows)</p>
              <div className="max-h-[200px] overflow-auto rounded-[8px] border border-[#dde5f5] mb-4">
                <table className="w-full text-[11px]">
                  <thead className="bg-[#f8faff] sticky top-0">
                    <tr>
                      {sheetPreviewHeaders.slice(0, 8).map((h) => (
                        <th key={h} className="text-left p-2 border-b border-[#dde5f5] font-medium text-[#0f1f3d] truncate max-w-[120px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheetPreviewRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-[#dde5f5]">
                        {sheetPreviewHeaders.slice(0, 8).map((h) => (
                          <td key={h} className="p-2 text-[#4a5a82] truncate max-w-[120px]">
                            {String((row as Record<string, unknown>)[h] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={onSheetSelected}
                className="w-full py-2.5 rounded-[8px] bg-[#0d9488] text-white text-[13px] font-semibold hover:bg-[#0f766e] transition-colors"
              >
                Analyse columns →
              </button>
            </>
          )}

          {step === "mapping" && (
            <>
              {analysing ? (
                <div className="flex items-center gap-2 py-6 text-[#6d28d9]">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#f5f3ff] border border-[#c4b5fd]">
                    AI
                  </span>
                  <span className="text-[13px]">Analysing your columns...</span>
                </div>
              ) : (
                <>
                  <div className="max-h-[280px] overflow-auto rounded-[8px] border border-[#dde5f5] mb-4">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[#f8faff] sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium text-[#0f1f3d]">Excel column</th>
                          <th className="text-left p-2 font-medium text-[#0f1f3d]">Map to</th>
                          <th className="text-left p-2 font-medium text-[#0f1f3d]">Confidence</th>
                          <th className="text-left p-2 font-medium text-[#0f1f3d]">Reasoning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((m, i) => (
                          <tr
                            key={i}
                            className={`border-b border-[#dde5f5] ${m.confidence === "LOW" ? "bg-[#fffbeb]" : ""}`}
                          >
                            <td className="p-2">
                              <span className="font-mono text-[10px] bg-[#f1f5f9] px-2 py-0.5 rounded">
                                {m.excelColumn}
                              </span>
                            </td>
                            <td className="p-2">
                              <select
                                value={m.targetField ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setMappings((prev) => {
                                    const next = [...prev];
                                    next[i] = { ...next[i], targetField: v || null };
                                    return next;
                                  });
                                }}
                                className="text-[11px] border border-[#dde5f5] rounded-[6px] px-2 py-1 bg-white"
                              >
                                {TARGET_FIELD_OPTIONS.map((opt) => (
                                  <option key={opt.value || "skip"} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${CONFIDENCE_STYLES[m.confidence] ?? CONFIDENCE_STYLES.SKIP}`}
                              >
                                {CONFIDENCE_LABELS[m.confidence] ?? "— Skip"}
                              </span>
                            </td>
                            <td className="p-2 text-[10px] text-[#8a97b8] max-w-[160px] truncate">
                              {m.reasoning}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#8a97b8] mb-4">
                    <span>
                      {mappedCount} mapped · {skipCount} skipped
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep("review")}
                      className="px-3 py-2 rounded-[8px] bg-[#0d9488] text-white text-[11px] font-semibold hover:bg-[#0f766e]"
                    >
                      Preview import →
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {step === "review" && (
            <>
              {!weightValid && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[#fffbeb] border border-[#fcd34d] mb-4 text-[11px] text-[#92400e]">
                Weights sum to {totalWeight.toFixed(1)}% — adjust before confirming
              </div>
              )}
              {!hasRequired && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[#fef2f2] border border-[#fecaca] mb-4 text-[11px] text-[#dc2626]">
                  Some rows are missing required fields (Major task, Weight)
                </div>
              )}
              {hasDupe && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[#fffbeb] border border-[#fcd34d] mb-4 text-[11px] text-[#92400e]">
                  Duplicate major task detected
                </div>
              )}
              {importError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[#fef2f2] border border-[#fecaca] mb-4 text-[11px] text-[#dc2626]">
                  {importError}
                </div>
              )}
              <div className="max-h-[300px] overflow-auto space-y-3 mb-4">
                {previewItems.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-[12px] border border-[#dde5f5] p-3 bg-[#f8faff]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#eff6ff] text-[#1d4ed8] text-[11px] font-semibold flex items-center justify-center">
                          {i + 1}
                        </span>
                        <span className="font-medium text-[13px] text-[#0f1f3d] truncate">
                          {String(item.major_task ?? "")}
                        </span>
                      </div>
                      <span className="flex-shrink-0 text-[12px] font-bold text-[#0d9488]">
                        {(item.weight as number) ?? 0}%
                      </span>
                    </div>
                    <p className="text-[10px] text-[#8a97b8] mt-1 truncate">
                      {String(item.corporate_objective ?? "")} → {String(item.division_objective ?? "")}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.key_output != null && String(item.key_output).trim() !== "" && (
                        <span className="inline-flex px-2 py-0.5 rounded bg-white border border-[#dde5f5] text-[10px] text-[#4a5a82]">
                          {String(item.key_output)}
                        </span>
                      )}
                      {item.performance_standard != null && String(item.performance_standard).trim() !== "" && (
                        <span className="inline-flex px-2 py-0.5 rounded bg-white border border-[#dde5f5] text-[10px] text-[#4a5a82]">
                          {String(item.performance_standard)}
                        </span>
                      )}
                      {item.metric_type != null && String(item.metric_type).trim() !== "" && (
                        <span className="inline-flex px-2 py-0.5 rounded bg-[#f0fdfa] border border-[#99f6e4] text-[10px] text-[#0d9488]">
                          {String(item.metric_type)}
                        </span>
                      )}
                      {item.metric_target != null && (
                        <span className="inline-flex px-2 py-0.5 rounded bg-[#f0fdfa] border border-[#99f6e4] text-[10px] text-[#0d9488]">
                          Target: {String(item.metric_target)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStep("mapping")}
                  className="px-3 py-2 rounded-[8px] border border-[#dde5f5] bg-white text-[#4a5a82] text-[11px] font-semibold hover:bg-[#f8faff]"
                >
                  Edit mapping
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!weightValid || !hasRequired}
                  className="px-3 py-2 rounded-[8px] bg-[#0d9488] text-white text-[11px] font-semibold hover:bg-[#0f766e] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm & create workplan
                </button>
              </div>
            </>
          )}

          {step === "importing" && (
            <div className="py-8 text-center text-[#0d9488] text-[13px] font-medium">
              Importing objectives...
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : null;
}
