"use client";

import dynamic from "next/dynamic";

const SessionProvider = dynamic(
  () => import("@/components/providers/session-provider").then((m) => m.SessionProvider),
  { ssr: false }
);

export function ClientSessionWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
