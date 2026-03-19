"use client";

import { useAdminPanel } from "../AdminPanelContext";
import {
  CardWrapper,
  ActionButton,
  IconButton,
  StatusBadge,
  CalendarIcon,
  RefreshIcon,
  PlusIcon,
  PencilIcon,
  PlayIcon,
  LockIcon,
  thStyle,
  tdStyle,
} from "../admin-shared";

export function CyclesTab() {
  const {
    cycles,
    load,
    setCycleModal,
    setCycleStatus,
    openAssessmentPhase,
    emptyCycleForm,
  } = useAdminPanel();

  return (
    <CardWrapper
      title="Appraisal Cycles"
      subtitle="Manage appraisal periods and their status"
      icon={<CalendarIcon />}
      iconBg="#eff6ff"
      iconColor="#3b82f6"
      delay="0.08s"
      rightAction={
        <div style={{ display: "flex", gap: "8px" }}>
          <IconButton onClick={load}><RefreshIcon /></IconButton>
          <ActionButton variant="primary" onClick={() => setCycleModal({ open: true, mode: "create", data: emptyCycleForm })}><PlusIcon /> Create Cycle</ActionButton>
        </div>
      }
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Fiscal Year</th>
            <th style={thStyle}>Start</th>
            <th style={thStyle}>End</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Phase</th>
            <th style={{ ...thStyle, width: "260px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cycles.map((c) => (
            <tr key={c.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{c.name}</td>
              <td style={tdStyle}>{c.cycle_type.replace("_", " ")}</td>
              <td style={tdStyle}>{c.fiscal_year}</td>
              <td style={tdStyle}>{c.start_date}</td>
              <td style={tdStyle}>{c.end_date}</td>
              <td style={tdStyle}><StatusBadge status={c.status} /></td>
              <td style={tdStyle}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    background: c.phase === "planning" ? "#eff6ff" : c.phase === "assessment" ? "#f0fdf4" : "#f1f5f9",
                    color: c.phase === "planning" ? "#1d4ed8" : c.phase === "assessment" ? "#166534" : "#64748b",
                    border: `1px solid ${c.phase === "planning" ? "#bfdbfe" : c.phase === "assessment" ? "#bbf7d0" : "#e2e8f0"}`,
                    textTransform: "capitalize",
                  }}
                >
                  <span
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      background: c.phase === "planning" ? "#3b82f6" : c.phase === "assessment" ? "#22c55e" : "#94a3b8",
                      display: "inline-block",
                    }}
                  />
                  {c.phase || "—"}
                </span>
              </td>
              <td style={tdStyle}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                  <IconButton onClick={() => setCycleModal({ open: true, mode: "edit", id: c.id, data: { cycle_type: c.cycle_type, fiscal_year: c.fiscal_year, start_date: c.start_date, end_date: c.end_date } })}><PencilIcon /></IconButton>
                  {c.status === "draft" && <ActionButton onClick={() => setCycleStatus(c.id, "open")}><PlayIcon /> Open</ActionButton>}
                  {c.status === "open" && c.phase === "planning" && <ActionButton variant="primary" onClick={() => openAssessmentPhase(c.id)}><PlayIcon /> Start Assessment</ActionButton>}
                  {(c.status === "open" || c.status === "draft") && <ActionButton onClick={() => setCycleStatus(c.id, "closed")}><LockIcon /> Close</ActionButton>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardWrapper>
  );
}
