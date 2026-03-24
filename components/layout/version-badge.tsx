"use client";

import { usePathname } from "next/navigation";

export function VersionBadge({ version }: { version: string }) {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <div
      className="pointer-events-none fixed bottom-2 right-3 z-[60] select-none rounded-md border border-[#e2e8f0] bg-white/85 px-2 py-1 text-[10px] font-medium text-[#64748b] shadow-sm backdrop-blur-sm"
      aria-label="application-version"
    >
      {version}
    </div>
  );
}
