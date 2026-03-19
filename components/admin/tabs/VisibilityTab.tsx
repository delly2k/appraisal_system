"use client";

import { useAdminPanel } from "../AdminPanelContext";
import {
  CardWrapper,
  Feedback360Icon,
  thStyle,
  tdStyle,
} from "../admin-shared";

export function VisibilityTab() {
  const { feedbackCycles, handleVisibilityChange } = useAdminPanel();

  return (
    <CardWrapper
      title="Reviewee visibility"
      subtitle="Control whether the person being reviewed can see peer and direct report feedback in their report"
      icon={<Feedback360Icon />}
      iconBg="#f3e8ff"
      iconColor="#7c3aed"
      delay="0.32s"
    >
      {feedbackCycles.length === 0 ? (
        <p style={{ padding: "20px 24px", color: "#8a97b8" }}>No 360 feedback cycles yet. Create an appraisal cycle to generate a linked 360 cycle.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Cycle</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Peer visible to reviewee</th>
              <th style={thStyle}>Direct reports visible to reviewee</th>
            </tr>
          </thead>
          <tbody>
            {feedbackCycles.map((c) => (
              <tr key={c.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{c.cycle_name}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: "inline-flex",
                      padding: "3px 10px",
                      borderRadius: "20px",
                      fontSize: "11.5px",
                      fontWeight: 600,
                      background: c.status === "Active" ? "#f0fdf4" : "#f1f5f9",
                      color: c.status === "Active" ? "#166534" : "#64748b",
                      border: `1px solid ${c.status === "Active" ? "#bbf7d0" : "#e2e8f0"}`,
                    }}
                  >
                    {c.status}
                  </span>
                </td>
                <td style={tdStyle}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={c.peer_feedback_visible_to_reviewee !== false}
                      onChange={(e) =>
                        handleVisibilityChange(c.id, "peer_feedback_visible_to_reviewee", e.target.checked)
                      }
                      style={{ width: "16px", height: "16px" }}
                    />
                    <span style={{ fontSize: "13px" }}>Show to reviewee</span>
                  </label>
                </td>
                <td style={tdStyle}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={c.direct_report_feedback_visible_to_reviewee !== false}
                      onChange={(e) =>
                        handleVisibilityChange(c.id, "direct_report_feedback_visible_to_reviewee", e.target.checked)
                      }
                      style={{ width: "16px", height: "16px" }}
                    />
                    <span style={{ fontSize: "13px" }}>Show to reviewee</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CardWrapper>
  );
}
