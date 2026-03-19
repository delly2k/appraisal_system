"use client";

import { useAdminPanel } from "../AdminPanelContext";
import {
  CardWrapper,
  ActionButton,
  IconButton,
  ActiveBadge,
  AwardIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  thStyle,
  tdStyle,
} from "../admin-shared";

export function RecommendationRulesTab() {
  const {
    rules,
    setRuleModal,
    setDeleteConfirm,
    toggleRuleActive,
    emptyRuleForm,
  } = useAdminPanel();

  return (
    <CardWrapper
      title="Recommendation Rules"
      subtitle="Map rating labels to HR actions"
      icon={<AwardIcon />}
      iconBg="#fff1f2"
      iconColor="#e11d48"
      delay="0.24s"
      rightAction={<ActionButton variant="primary" onClick={() => setRuleModal({ open: true, mode: "create", data: emptyRuleForm })}><PlusIcon /> Create Rule</ActionButton>}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Rating Label</th>
            <th style={thStyle}>Recommendation</th>
            <th style={thStyle}>Description</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, width: "180px" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{r.rating_label}</td>
              <td style={tdStyle}>{r.recommendation}</td>
              <td style={{ ...tdStyle, color: "#8a97b8" }}>{r.description ?? "—"}</td>
              <td style={tdStyle}><ActiveBadge active={r.active} /></td>
              <td style={tdStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <IconButton onClick={() => setRuleModal({ open: true, mode: "edit", id: r.id, data: { rating_label: r.rating_label, recommendation: r.recommendation, description: r.description ?? "" } })}><PencilIcon /></IconButton>
                  <ActionButton onClick={() => toggleRuleActive(r)}>{r.active ? "Deactivate" : "Activate"}</ActionButton>
                  <IconButton variant="danger" onClick={() => setDeleteConfirm({ open: true, type: "rule", id: r.id, name: r.rating_label })}><TrashIcon /></IconButton>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </CardWrapper>
  );
}
