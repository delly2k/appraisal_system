"use client";

import { useState, useEffect } from "react";
import { History } from "lucide-react";

export interface AuditTrailTabProps {
  appraisalId: string;
}

export interface AuditEvent {
  id: string;
  action_type: string;
  acted_at: string;
  summary: string;
  actor_id: string | null;
  actor_name: string;
}

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function AuditTrailTab({ appraisalId }: AuditTrailTabProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appraisalId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/appraisals/${appraisalId}/audit`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setEvents(Array.isArray(data?.events) ? data.events : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appraisalId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#8a97b8] text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-[#dde5f5] rounded-[14px] overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 bg-[#f8faff] border-b border-[#dde5f5]">
          <div className="w-8 h-8 rounded-[8px] bg-[#e0f2fe] border border-[#bae6fd] flex items-center justify-center">
            <History className="w-4 h-4 text-[#0284c7]" />
          </div>
          <div>
            <p className="font-['Sora'] text-[13px] font-bold">Audit trail</p>
            <p className="text-[11px] text-[#8a97b8]">Who, when, what</p>
          </div>
        </div>
        <div className="p-5">
          {events.length === 0 ? (
            <p className="text-[13px] text-[#8a97b8] py-4">No activity recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-0">
              {events.map((evt, index) => (
                <li
                  key={evt.id}
                  className={index < events.length - 1 ? "border-b border-[#dde5f5]" : ""}
                  style={{ padding: "12px 0" }}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-[12px] text-[#8a97b8] shrink-0">
                      {formatDateTime(evt.acted_at)}
                    </span>
                    <span className="text-[13px] font-medium text-[#0f1f3d]">
                      {evt.actor_name}
                    </span>
                    <span className="text-[13px] text-[#0f1f3d]">
                      {evt.summary}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
