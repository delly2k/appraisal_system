"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CardWrapper,
  UsersIcon,
  RefreshIcon
} from "../admin-shared";

type SyncLogEntry = {
  id: string;
  triggered_by: "cron" | "manual" | string;
  triggered_at: string;
  status: "running" | "completed" | "failed" | string;
  employees_synced: number | null;
  employees_added: number | null;
  employees_deactivated: number | null;
  new_employee_ids: string[] | null;
  duration_ms: number | null;
};

type SyncResult = {
  ok?: boolean;
  employees_synced?: number;
  employees_added?: number;
  employees_deactivated?: number;
  new_without_appraisal?: number;
  duration_ms?: number;
  error?: string;
};

export function EmployeeSyncTab() {
  const [syncing, setSyncing] = useState(false);
  const [loadingLog, setLoadingLog] = useState(true);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const loadLog = useCallback(async () => {
    setLoadingLog(true);
    try {
      const res = await fetch("/api/sync/employees", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { log?: SyncLogEntry[] };
      setSyncLog(Array.isArray(data.log) ? data.log : []);
    } finally {
      setLoadingLog(false);
    }
  }, []);

  useEffect(() => {
    void loadLog();
  }, [loadLog]);

  const runManualSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/employees", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as SyncResult;
      setSyncResult(data);
      await loadLog();
    } catch {
      setSyncResult({ error: "Sync failed" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <CardWrapper
      title="Employee Sync"
      subtitle="Auto-syncs nightly from Dynamics 365 (active @dbankjm.com users)"
      icon={<UsersIcon />}
      iconBg="#f0fdfa"
      iconColor="#0d9488"
      delay="0.28s"
    >
      <div style={{ padding: "16px 24px 20px" }}>
        <button
          onClick={runManualSync}
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
          {syncing ? "Syncing…" : "Sync now"}
        </button>

        {syncResult && !syncResult.error && (
          <div
            style={{
              marginTop: "14px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "#f0fdf9",
              border: "1px solid #99f6e4",
              fontSize: "12px",
              color: "#0f1f3d",
              display: "flex",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "#0d9488", fontWeight: 700 }}>Sync complete</span>
            <span>{syncResult.employees_synced ?? 0} synced</span>
            <span style={{ color: "#16a34a", fontWeight: 600 }}>+{syncResult.employees_added ?? 0} new</span>
            <span style={{ color: "#dc2626", fontWeight: 600 }}>-{syncResult.employees_deactivated ?? 0} deactivated</span>
            <span style={{ color: "#d97706", fontWeight: 700 }}>
              {syncResult.new_without_appraisal ?? 0} without appraisal
            </span>
          </div>
        )}

        {syncResult?.error && (
          <div
            style={{
              marginTop: "14px",
              padding: "10px 12px",
              borderRadius: "8px",
              background: "#fff1f2",
              border: "1px solid #fecaca",
              fontSize: "12px",
              color: "#991b1b",
            }}
          >
            {syncResult.error}
          </div>
        )}

        <div style={{ marginTop: "18px" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8a97b8", marginBottom: "8px" }}>
            Sync history
          </p>
          {loadingLog ? (
            <p style={{ fontSize: "12px", color: "#8a97b8" }}>Loading sync history…</p>
          ) : syncLog.length === 0 ? (
            <p style={{ fontSize: "12px", color: "#8a97b8" }}>No sync runs recorded yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #eef2ff", color: "#8a97b8", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  <th style={{ padding: "8px 6px" }}>Time</th>
                  <th style={{ padding: "8px 6px" }}>By</th>
                  <th style={{ padding: "8px 6px" }}>Status</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Synced</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Added</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Deactivated</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>No appraisal</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {syncLog.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid #f8faff" }}>
                    <td style={{ padding: "9px 6px", color: "#0f1f3d" }}>
                      {new Date(entry.triggered_at).toLocaleString("en-JM", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td style={{ padding: "9px 6px", color: "#4a5a82" }}>{entry.triggered_by === "cron" ? "Auto" : "Manual"}</td>
                    <td style={{ padding: "9px 6px", color: entry.status === "failed" ? "#dc2626" : entry.status === "completed" ? "#0d9488" : "#8a97b8", fontWeight: 600 }}>
                      {entry.status}
                    </td>
                    <td style={{ padding: "9px 6px", textAlign: "right", color: "#0f1f3d" }}>{entry.employees_synced ?? "—"}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>{entry.employees_added ?? "—"}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", color: "#dc2626", fontWeight: 600 }}>{entry.employees_deactivated ?? "—"}</td>
                    <td style={{ padding: "9px 6px", textAlign: "right", color: "#d97706", fontWeight: 700 }}>
                      {Array.isArray(entry.new_employee_ids) ? entry.new_employee_ids.length : "—"}
                    </td>
                    <td style={{ padding: "9px 6px", textAlign: "right", color: "#8a97b8" }}>
                      {entry.duration_ms ? `${(entry.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </CardWrapper>
  );
}
