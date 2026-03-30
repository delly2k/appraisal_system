export const EVIDENCE_WEIGHTS: Record<string, number> = {
  goal_milestone_completed: 100,
  document_created: 90,
  document_finalized: 90,
  task_completed: 85,
  meeting_organized: 60,
  document_edited: 50,
  document_shared: 40,
  meeting_attended: 10,
  email_sent: 10,
  email_sent_external: 35,
};

export const CLUSTER_THRESHOLDS = {
  MIN_SCORE: 120,
  MIN_SIGNALS: 2,
  TIME_WINDOW: 30,
};

export const STRONG_SIGNAL_TYPES = new Set([
  "goal_milestone_completed",
  "document_created",
  "document_finalized",
  "task_completed",
  "meeting_organized",
]);
