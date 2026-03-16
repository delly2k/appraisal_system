"use client";

import dynamic from "next/dynamic";
import type { AppraisalStatus } from "@/types/appraisal";
import type { WorkflowRole } from "@/lib/appraisal-workflow";

const CompletionBarWrapper = dynamic(
  () => import("@/components/appraisal/CompletionBarWrapper").then((m) => ({ default: m.CompletionBarWrapper })),
  { ssr: false }
);

interface CompletionBarWrapperClientProps {
  appraisalId: string;
  status: AppraisalStatus;
  userRole: WorkflowRole;
  showLeadership: boolean;
  isEmployee: boolean;
  isManager: boolean;
  isHR: boolean;
  approvals?: { role: string }[];
  signoffs?: { role: string; stage: string }[];
}

export function CompletionBarWrapperClient(props: CompletionBarWrapperClientProps) {
  return <CompletionBarWrapper {...props} />;
}
