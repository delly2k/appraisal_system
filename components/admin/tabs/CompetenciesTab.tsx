"use client";

import { useAdminPanel } from "../AdminPanelContext";
import {
  CardWrapper,
  ActionButton,
  IconButton,
  ActiveBadge,
  LayersIcon,
  ListIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  thStyle,
  tdStyle,
} from "../admin-shared";

export function CompetenciesTab() {
  const {
    categories,
    factors,
    setCategoryModal,
    setFactorModal,
    setDeleteConfirm,
    toggleFactorActive,
    emptyCategoryForm,
    emptyFactorForm,
  } = useAdminPanel();

  return (
    <>
      <CardWrapper
        title="Competency Categories"
        subtitle="Group competencies by type"
        icon={<LayersIcon />}
        iconBg="#f3e8ff"
        iconColor="#7c3aed"
        delay="0.12s"
        rightAction={<ActionButton variant="primary" onClick={() => setCategoryModal({ open: true, mode: "create", data: emptyCategoryForm })}><PlusIcon /> Create Category</ActionButton>}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Applies To</th>
              <th style={{ ...thStyle, width: "120px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{cat.name}</td>
                <td style={tdStyle}>{cat.category_type}</td>
                <td style={tdStyle}>{cat.applies_to.replace("_", " ")}</td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <IconButton onClick={() => setCategoryModal({ open: true, mode: "edit", id: cat.id, data: { name: cat.name, category_type: cat.category_type, applies_to: cat.applies_to } })}><PencilIcon /></IconButton>
                    <IconButton variant="danger" onClick={() => setDeleteConfirm({ open: true, type: "category", id: cat.id, name: cat.name })}><TrashIcon /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardWrapper>

      <CardWrapper
        title="Competency Factors"
        subtitle="Individual competencies within categories"
        icon={<ListIcon />}
        iconBg="#f0fdfa"
        iconColor="#0d9488"
        delay="0.16s"
        rightAction={<ActionButton variant="primary" onClick={() => setFactorModal({ open: true, mode: "create", data: emptyFactorForm })}><PlusIcon /> Create Factor</ActionButton>}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Order</th>
              <th style={thStyle}>Weight</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, width: "180px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {factors.map((f) => (
              <tr key={f.id} style={{ transition: "background 0.13s" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#f4f8ff"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={{ ...tdStyle, fontWeight: 600, color: "#0f1f3d" }}>{f.name}</td>
                <td style={tdStyle}>{f.category_name}</td>
                <td style={tdStyle}>{f.display_order}</td>
                <td style={tdStyle}>{f.weight ?? "—"}</td>
                <td style={tdStyle}><ActiveBadge active={f.active} /></td>
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <IconButton onClick={() => setFactorModal({ open: true, mode: "edit", id: f.id, data: { category_id: f.category_id, name: f.name, description: f.description ?? "", display_order: f.display_order, weight: f.weight ?? 0 } })}><PencilIcon /></IconButton>
                    <ActionButton onClick={() => toggleFactorActive(f)}>{f.active ? "Deactivate" : "Activate"}</ActionButton>
                    <IconButton variant="danger" onClick={() => setDeleteConfirm({ open: true, type: "factor", id: f.id, name: f.name })}><TrashIcon /></IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardWrapper>
    </>
  );
}
