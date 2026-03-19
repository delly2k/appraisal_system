/**
 * Appraisal status state machine.
 * Disallows skipped or reverse transitions; only the next step is allowed.
 * Phase progression is process-driven: workplan approval automatically moves to self_assessment (no HR gate).
 */

/** Phases used by this state machine (legacy workflow). */
export type StateMachinePhase =
  | "draft"
  | "self_submitted"
  | "manager_in_review"
  | "manager_completed"
  | "employee_acknowledged"
  | "hr_in_review"
  | "closed";

const ORDER: StateMachinePhase[] = [
  "draft",
  "self_submitted",
  "manager_in_review",
  "manager_completed",
  "employee_acknowledged",
  "hr_in_review",
  "closed",
];

const INDEX: Record<StateMachinePhase, number> = ORDER.reduce(
  (acc, s, i) => {
    acc[s] = i;
    return acc;
  },
  {} as Record<StateMachinePhase, number>
);

/**
 * Returns true only if `next` is the immediate successor of `current`.
 * No skipped steps, no reverse transitions.
 */
export function canTransition(
  current: StateMachinePhase,
  next: StateMachinePhase
): boolean {
  const i = INDEX[current];
  const j = INDEX[next];
  if (i === undefined || j === undefined) return false;
  return j === i + 1;
}

export class InvalidAppraisalTransitionError extends Error {
  readonly code = "INVALID_APPRAISAL_TRANSITION";
  constructor(
    public readonly current: StateMachinePhase,
    public readonly next: StateMachinePhase
  ) {
    super(
      `Invalid appraisal status transition: ${current} → ${next}. Only the next step in the workflow is allowed.`
    );
    this.name = "InvalidAppraisalTransitionError";
  }
}

/**
 * Throws InvalidAppraisalTransitionError if the transition from `current` to `next` is not allowed.
 */
export function assertTransition(
  current: StateMachinePhase,
  next: StateMachinePhase
): void {
  if (!canTransition(current, next)) {
    throw new InvalidAppraisalTransitionError(current, next);
  }
}
