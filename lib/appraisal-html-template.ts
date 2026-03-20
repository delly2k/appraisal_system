/**
 * HTML template for appraisal PDF (Puppeteer). DBJ branding, page breaks, Adobe Sign anchors.
 */

export interface AppraisalPDFData {
  employee: { full_name: string | null; email: string | null; job_title?: string | null; division_name?: string | null };
  manager: { full_name: string | null; email: string | null } | null;
  cycleName: string;
  fiscalYear?: string;
  workplanItems: { corporate_objective: string; individual_objective: string; task: string; output: string; performance_standard: string; weight: number; actual_result: string | null; points: number | null }[];
  coreFactors: { name: string; self_rating_code: string | null; manager_rating_code: string | null; self_comments: string | null; manager_comments: string | null; weight: number | null }[];
  technicalFactors: { name: string; self_rating_code: string | null; manager_rating_code: string | null; self_comments: string | null; manager_comments: string | null }[];
  productivityFactors: { name: string; self_rating_code: string | null; manager_rating_code: string | null; self_comments: string | null; manager_comments: string | null; weight: number | null }[];
  leadershipFactors: { name: string; self_rating_code: string | null; manager_rating_code: string | null; self_comments: string | null; manager_comments: string | null; weight: number | null }[];
  summaryTotalPoints?: number;
  summaryTotalWeight?: number;
  overallGrade?: string;
  managerComments?: string | null;
}

const PAGE_HEADER = `
  <header class="page-header">
    <img src="{{LOGO_SRC}}" alt="DBJ" class="dbj-logo" />
  </header>
`;

export function buildAppraisalHTML(data: AppraisalPDFData, logoDataUrl: string | null): string {
  const emp = data.employee;
  const mgr = data.manager;
  const logo = logoDataUrl ?? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'/%3E";

  const headerHtml = PAGE_HEADER.replace("{{LOGO_SRC}}", logo);

  const workplanRows = (data.workplanItems || []).map(
    (i) =>
      `<tr>
        <td>${escapeHtml(i.corporate_objective)}</td>
        <td>${escapeHtml(i.individual_objective)}</td>
        <td>${escapeHtml(i.task)}</td>
        <td>${escapeHtml(i.output)}</td>
        <td>${escapeHtml(i.performance_standard)}</td>
        <td class="num">${i.weight ?? ""}</td>
        <td>${escapeHtml(i.actual_result ?? "")}</td>
        <td class="num">${i.points ?? ""}</td>
      </tr>`
  ).join("");

  const factorRow = (f: { name: string; self_rating_code: string | null; manager_rating_code: string | null; self_comments: string | null; manager_comments: string | null; weight?: number | null }) =>
    `<tr>
      <td>${escapeHtml(f.name)}</td>
      <td>${f.self_rating_code ?? "—"}</td>
      <td>${f.manager_rating_code ?? "—"}</td>
      <td>${escapeHtml((f.self_comments ?? "") || "—")}</td>
      <td>${escapeHtml((f.manager_comments ?? "") || "—")}</td>
      ${f.weight != null ? `<td class="num">${f.weight}</td>` : ""}
    </tr>`;

  const coreRows = (data.coreFactors || []).map(factorRow).join("");
  const techRows = (data.technicalFactors || []).map(factorRow).join("");
  const prodRows = (data.productivityFactors || []).map(factorRow).join("");
  const leadRows = (data.leadershipFactors || []).map(factorRow).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 10pt; color: #0f1f3d; margin: 0; padding: 0; }
    .page { position: relative; padding: 18mm 16mm; min-height: 100vh; }
    .page-header { position: absolute; top: 0; left: 0; right: 0; height: 24mm; padding: 0 16mm; }
    .dbj-logo { position: absolute; top: 4mm; right: 16mm; height: 14mm; width: auto; }
    .section { page-break-before: always; }
    .section:first-of-type { page-break-before: auto; }
    h1 { font-size: 14pt; margin: 0 0 8px 0; color: #0f1f3d; }
    h2 { font-size: 11pt; margin: 16px 0 8px 0; color: #0f1f3d; border-bottom: 1px solid #dde5f5; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 9pt; }
    th, td { border: 1px solid #dde5f5; padding: 6px 8px; text-align: left; }
    th { background: #f8faff; font-weight: 600; }
    .num { text-align: right; }
    .signature-block { margin-top: 24px; }
    .signature-line { margin: 24px 0 8px 0; border-bottom: 1px solid #0f1f3d; width: 60%; }
    .adobe-anchors { display: none; }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="page">
    <h1>Performance Appraisal — ${escapeHtml(emp.full_name ?? "Employee")}</h1>
    <p><strong>Cycle:</strong> ${escapeHtml(data.cycleName)} ${data.fiscalYear ? ` · FY ${escapeHtml(data.fiscalYear)}` : ""}</p>
    <p><strong>Employee:</strong> ${escapeHtml(emp.full_name ?? "")} · ${escapeHtml(emp.email ?? "")}</p>
    <p><strong>Manager:</strong> ${mgr ? escapeHtml(mgr.full_name ?? "") + " · " + escapeHtml(mgr.email ?? "") : "—"}</p>
  </div>

  <div class="section page">
    ${headerHtml}
    <h2>Workplan Assessment</h2>
    <table>
      <thead><tr><th>Corporate</th><th>Individual</th><th>Task</th><th>Output</th><th>Standard</th><th>Wt</th><th>Actual</th><th>Pts</th></tr></thead>
      <tbody>${workplanRows || "<tr><td colspan='8'>No items</td></tr>"}</tbody>
    </table>
  </div>

  <div class="section page">
    ${headerHtml}
    <h2>Core Competencies</h2>
    <table>
      <thead><tr><th>Factor</th><th>Self</th><th>Manager</th><th>Self comments</th><th>Manager comments</th><th>Wt</th></tr></thead>
      <tbody>${coreRows || "<tr><td colspan='6'>—</td></tr>"}</tbody>
    </table>
  </div>

  <div class="section page">
    ${headerHtml}
    <h2>Technical Competencies</h2>
    <table>
      <thead><tr><th>Factor</th><th>Self</th><th>Manager</th><th>Self comments</th><th>Manager comments</th></tr></thead>
      <tbody>${techRows || "<tr><td colspan='5'>—</td></tr>"}</tbody>
    </table>
  </div>

  <div class="section page">
    ${headerHtml}
    <h2>Productivity</h2>
    <table>
      <thead><tr><th>Factor</th><th>Self</th><th>Manager</th><th>Self comments</th><th>Manager comments</th><th>Wt</th></tr></thead>
      <tbody>${prodRows || "<tr><td colspan='6'>—</td></tr>"}</tbody>
    </table>
  </div>

  <div class="section page">
    ${headerHtml}
    <h2>Leadership</h2>
    <table>
      <thead><tr><th>Factor</th><th>Self</th><th>Manager</th><th>Self comments</th><th>Manager comments</th><th>Wt</th></tr></thead>
      <tbody>${leadRows || "<tr><td colspan='6'>—</td></tr>"}</tbody>
    </table>
  </div>

  <div class="section page">
    ${headerHtml}
    <h2>Summary &amp; Score</h2>
    <p><strong>Total points:</strong> ${data.summaryTotalPoints ?? "—"} / ${data.summaryTotalWeight ?? "—"} · Grade: ${escapeHtml(data.overallGrade ?? "—")}</p>
    ${data.managerComments ? `<p><strong>Manager comments:</strong></p><p>${escapeHtml(data.managerComments)}</p>` : ""}
  </div>

  <div class="section page">
    ${headerHtml}
    <h2>Signatures</h2>
    <p>Employee:</p>
    <div class="signature-line"></div>
    <span class="adobe-anchors">{{BigSig_es_:signer1:signature:dimension(width=70mm, height=20mm)}}</span>
    <p>Manager:</p>
    <div class="signature-line"></div>
    <span class="adobe-anchors">{{BigSig_es_:signer2:signature:dimension(width=70mm, height=20mm)}}</span>
    <p>HR Officer:</p>
    <div class="signature-line"></div>
    <span class="adobe-anchors">{{BigSig_es_:signer3:signature:dimension(width=70mm, height=20mm)}}</span>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
