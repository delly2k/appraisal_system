"use client";

import { useState } from "react";
import {
  Menu,
  Search,
  HelpCircle,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "My Work",
    items: [{ label: "Approvals" }, { label: "Assigned to me" }],
  },
  {
    label: "Time & Attendance",
    items: [{ label: "Timesheets" }, { label: "Absence requests" }],
  },
  {
    label: "Leave & Absence",
    items: [{ label: "Leave requests" }, { label: "Balance" }],
  },
  {
    label: "Administration",
    items: [{ label: "HR Deadline Dashboard" }, { label: "Settings" }],
  },
] as const;

export function PowerAppsShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(["Administration"])
  );
  const [searchFocused, setSearchFocused] = useState(false);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div
      className="flex h-full w-full font-segoe text-[14px] antialiased"
      style={{ color: "#323130" }}
    >
      {/* Top navbar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex h-12 flex-col bg-white border-b border-[#edebe9]">
        <div className="flex h-12 flex-1 items-center gap-2 px-2">
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-[#323130] hover:bg-[#f3f2f1]"
            aria-label="Menu"
            onClick={() => setSidebarCollapsed((c) => !c)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div
            className="flex h-8 items-center gap-1 px-2 text-[#742774] font-semibold"
            style={{ fontSize: "14px" }}
          >
            <span>Power Apps</span>
            <span className="text-[#605e5c] font-normal">|</span>
            <span className="text-[#323130] font-normal">
              HR HUB Administration
            </span>
          </div>
          <div className="flex-1 flex justify-center max-w-xl mx-auto">
            <div
              className={`flex h-8 w-full items-center gap-2 rounded border bg-white px-3 transition-colors ${
                searchFocused ? "border-[#0078d4] ring-1 ring-[#0078d4]" : "border-[#edebe9]"
              }`}
            >
              <Search className="h-4 w-4 shrink-0 text-[#605e5c]" />
              <input
                type="search"
                placeholder="Search"
                className="flex-1 min-w-0 bg-transparent text-[14px] text-[#323130] placeholder:text-[#605e5c] outline-none"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded text-[#605e5c] hover:bg-[#f3f2f1]"
              aria-label="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded text-[#605e5c] hover:bg-[#f3f2f1]"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded text-[#605e5c] hover:bg-[#f3f2f1]"
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div
          className="h-1 w-full shrink-0"
          style={{ backgroundColor: "#742774" }}
          aria-hidden
        />
      </div>

      {/* Left sidebar */}
      <aside
        className={`fixed left-0 top-12 z-20 flex flex-col border-r bg-white transition-[width] duration-200 ${
          sidebarCollapsed ? "w-14" : "w-56"
        }`}
        style={{ borderColor: "#edebe9", bottom: 0 }}
      >
        <nav className="flex flex-1 flex-col overflow-y-auto py-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="px-2">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded py-2 px-2 text-left text-[14px] font-semibold text-[#323130] hover:bg-[#f3f2f1]"
                onClick={() => toggleGroup(group.label)}
              >
                {expandedGroups.has(group.label) ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#605e5c]" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#605e5c]" />
                )}
                {!sidebarCollapsed && <span>{group.label}</span>}
              </button>
              {expandedGroups.has(group.label) && !sidebarCollapsed && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[#edebe9] pl-2">
                  {group.items.map((item) => (
                    <a
                      key={item.label}
                      href="#"
                      className="block py-1.5 pl-2 text-[14px] text-[#323130] hover:bg-[#f3f2f1] rounded"
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main
        className="flex-1 overflow-auto pt-12 min-h-screen"
        style={{
          backgroundColor: "#f3f2f1",
          marginLeft: sidebarCollapsed ? 56 : 224,
        }}
      >
        <div className="p-4">{children}</div>
      </main>
    </div>
  );
}
