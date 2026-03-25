export type EQCompetency = "SA" | "ME" | "MO" | "E" | "SS";

export interface EQQuestion {
  id: number;
  text: string;
  competency: EQCompetency;
}

export const COMPETENCY_LABELS: Record<EQCompetency, string> = {
  SA: "Self awareness",
  ME: "Managing emotions",
  MO: "Motivating oneself",
  E: "Empathy",
  SS: "Social skills",
};

export const SCALE_LABELS: Record<number, string> = {
  1: "Does not apply",
  2: "Applies occasionally",
  3: "About half the time",
  4: "Applies often",
  5: "Always applies",
};

export function calculateTotals(responses: Record<number, number>, questions: EQQuestion[]) {
  const totals: Record<EQCompetency, number> = { SA: 0, ME: 0, MO: 0, E: 0, SS: 0 };
  questions.forEach((q) => {
    totals[q.competency] += responses[q.id] ?? 0;
  });
  return totals;
}

export function getStatus(score: number): "strength" | "attention" | "priority" {
  if (score >= 35) return "strength";
  if (score >= 18) return "attention";
  return "priority";
}
