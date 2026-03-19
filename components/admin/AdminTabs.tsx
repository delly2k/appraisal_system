"use client";

import { useState } from "react";
import { CyclesTab } from "./tabs/CyclesTab";
import { CompetenciesTab } from "./tabs/CompetenciesTab";
import { RatingScaleTab } from "./tabs/RatingScaleTab";
import { RecommendationRulesTab } from "./tabs/RecommendationRulesTab";
import { VisibilityTab } from "./tabs/VisibilityTab";
import { EmployeeSyncTab } from "./tabs/EmployeeSyncTab";

const TABS = [
  { id: "cycles", label: "Appraisal cycles" },
  { id: "competencies", label: "Competencies" },
  { id: "ratings", label: "Rating scale" },
  { id: "rules", label: "Recommendation rules" },
  { id: "visibility", label: "360 visibility" },
  { id: "sync", label: "Employee sync" },
] as const;

export function AdminTabs() {
  const [active, setActive] = useState<string>("cycles");

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid #dde5f5",
          marginBottom: "24px",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 16px",
              fontSize: "12px",
              fontWeight: 600,
              border: "none",
              borderBottom: active === tab.id ? "2px solid #0d9488" : "2px solid transparent",
              marginBottom: active === tab.id ? "-1px" : "-1px",
              background: "none",
              color: active === tab.id ? "#0f1f3d" : "#8a97b8",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "cycles" && <CyclesTab />}
      {active === "competencies" && <CompetenciesTab />}
      {active === "ratings" && <RatingScaleTab />}
      {active === "rules" && <RecommendationRulesTab />}
      {active === "visibility" && <VisibilityTab />}
      {active === "sync" && <EmployeeSyncTab />}
    </>
  );
}
