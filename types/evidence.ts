export interface AchievementSuggestion {
  id: string;
  employee_id: string;
  cluster_id: string;
  achievement_text: string;
  confidence_level: "high" | "medium" | "low";
  evidence_summary: string[];
  status: "pending" | "accepted" | "edited" | "rejected";
  edited_text?: string;
  appraisal_id: string;
  created_at: string;
}

export interface ScanSource {
  name: string;
  attempted: boolean;
  collected: number;
  status: "live" | "stub" | "error";
  note?: string;
}

export interface ScanReport {
  generatedAt: string;
  totalCollected: number;
  sources: ScanSource[];
}
