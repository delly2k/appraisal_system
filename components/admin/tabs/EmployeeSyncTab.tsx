"use client";

import { useAdminPanel } from "../AdminPanelContext";
import {
  CardWrapper,
  UsersIcon,
  RefreshIcon,
} from "../admin-shared";

export function EmployeeSyncTab() {
  const { syncing, runSync } = useAdminPanel();

  return (
    <CardWrapper
      title="Employee Sync"
      subtitle="Sync employees and reporting lines from Dynamics 365 Dataverse"
      icon={<UsersIcon />}
      iconBg="#f0fdfa"
      iconColor="#0d9488"
      delay="0.28s"
    >
      <div style={{ padding: "20px 24px" }}>
        <button
          onClick={runSync}
          disabled={syncing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 20px",
            borderRadius: "8px",
            background: !syncing ? "linear-gradient(135deg, #3b82f6, #1d4ed8)" : "#e2e8f0",
            border: "none",
            fontSize: "14px",
            fontWeight: 600,
            color: !syncing ? "white" : "#94a3b8",
            cursor: !syncing ? "pointer" : "not-allowed",
            boxShadow: !syncing ? "0 2px 8px rgba(59,130,246,0.35)" : "none",
            transition: "all 0.16s",
          }}
        >
          <RefreshIcon spinning={syncing} />
          {syncing ? "Syncing…" : "Sync Employees"}
        </button>
      </div>
    </CardWrapper>
  );
}
