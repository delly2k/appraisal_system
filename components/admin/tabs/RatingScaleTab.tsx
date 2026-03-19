"use client";

import { useMemo } from "react";
import { useAdminPanel } from "../AdminPanelContext";
import {
  CardWrapper,
  StarIcon,
  thStyle,
  tdStyle,
} from "../admin-shared";

function factorColor(factor: number): string {
  if (factor <= 0.2) return "#dc2626";
  if (factor <= 0.4) return "#9a3412";
  if (factor <= 0.6) return "#d97706";
  if (factor <= 0.8) return "#16a34a";
  return "#059669";
}

export function RatingScaleTab() {
  const { ratingScale } = useAdminPanel();
  const sorted = useMemo(
    () => [...ratingScale].sort((a, b) => (Number(a.factor) ?? 0) - (Number(b.factor) ?? 0)),
    [ratingScale]
  );

  return (
    <CardWrapper
      title="Rating Scale"
      subtitle="1–10 numeric scale used in self-assessment and manager review"
      icon={<StarIcon />}
      iconBg="#fffbeb"
      iconColor="#f59e0b"
      delay="0.20s"
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Code</th>
            <th style={thStyle}>Factor</th>
            <th style={thStyle}>Label</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const f = Number(r.factor) ?? 0;
            const color = factorColor(f);
            return (
              <tr key={r.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={{ ...tdStyle, fontWeight: 700, color: "#0f1f3d" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "6px", background: "#f1f5f9", border: "1px solid #e2e8f0", fontFamily: "ui-monospace, monospace", fontSize: "12px" }}>{r.code}</span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 600, color }}>{f}</td>
                <td style={tdStyle}>{r.label}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{ marginTop: 12, fontSize: "11px", color: "#8a97b8", borderTop: "1px solid #dde5f5", paddingTop: 10 }}>
        Ratings 1–10. Score = rating factor × competency weight.
      </p>
    </CardWrapper>
  );
}
