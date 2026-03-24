"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/lib/notifications/types";

async function loadUnreadCount(): Promise<number> {
  try {
    const r = await fetch("/api/notifications/count");
    const d = (await r.json()) as { count?: number };
    return d.count ?? 0;
  } catch {
    return 0;
  }
}

function typeIcon(type: string): { bg: string; color: string; label: string } {
  if (type.startsWith("appraisal.")) return { bg: "#e1f5ee", color: "#1D9E75", label: "A" };
  if (type.startsWith("feedback.")) return { bg: "#e6f1fb", color: "#185FA5", label: "360" };
  if (type.startsWith("checkin.")) return { bg: "#faeeda", color: "#854F0B", label: "CI" };
  return { bg: "#f1f5fd", color: "#64748b", label: "!" };
}

const BellIcon = () => (
  <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadUnreadCount().then(setCount);
    const interval = setInterval(() => {
      void loadUnreadCount().then(setCount);
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadUnreadCount().then(setCount);
    setLoading(true);
    fetch("/api/notifications?limit=20")
      .then((r) => r.json())
      .then((d: { notifications?: AppNotification[] }) => setNotifications(d.notifications ?? []))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id: string) => {
    const prev = notifications.find((n) => n.id === id);
    const wasUnread = prev && !prev.read_at;
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setNotifications((p) =>
      p.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    if (wasUnread) setCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setCount(0);
  };

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex h-[34px] w-[34px] items-center justify-center rounded-lg border text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
        )}
        style={{ borderColor: "var(--border-color)" }}
        aria-label="Notifications"
        title="Notifications"
      >
        <BellIcon />
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[70] mt-2 w-80 overflow-hidden rounded-2xl border border-[#e8edf8] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#f0f4ff] px-4 py-3">
            <span className="text-sm font-semibold text-[#0f2044]">
              Notifications{" "}
              {count > 0 && <span className="text-[#1D9E75]">({count})</span>}
            </span>
            {count > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs text-[#1D9E75] hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="mb-1.5 h-3 w-[75%] rounded bg-[#f0f4ff]" />
                    <div className="h-2.5 w-full rounded bg-[#f0f4ff]" />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-[#94a3b8]">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const icon = typeIcon(n.type as NotificationType | string);
                return (
                  <div
                    key={n.id}
                    className={cn(
                      "flex gap-3 border-b border-[#f8faff] px-4 py-3 transition-colors hover:bg-[#f8faff]",
                      !n.read_at && "bg-[#f0fdf9]"
                    )}
                  >
                    <div
                      className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
                      style={{ backgroundColor: icon.bg, color: icon.color }}
                    >
                      {icon.label}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium leading-snug text-[#0f2044]">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-[#64748b]">{n.body}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-[#94a3b8]">
                          {new Date(n.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <div className="flex gap-2">
                          {n.link && (
                            <Link
                              href={n.link}
                              onClick={() => {
                                void markRead(n.id);
                                setOpen(false);
                              }}
                              className="text-[10px] text-[#1D9E75] hover:underline"
                            >
                              View
                            </Link>
                          )}
                          {!n.read_at && (
                            <button
                              type="button"
                              onClick={() => void markRead(n.id)}
                              className="text-[10px] text-[#94a3b8] hover:text-[#64748b]"
                            >
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
