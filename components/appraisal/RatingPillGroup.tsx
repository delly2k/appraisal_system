import { cn } from "@/lib/utils";

const GRADES = [
  { value: "A", label: "Highly\nExceeds" },
  { value: "B", label: "Exceeds\nExpects." },
  { value: "C", label: "Meets\nExpects." },
  { value: "D", label: "Below\nExpects." },
  { value: "E", label: "Far Below\nExpects." },
] as const;

export type Grade = (typeof GRADES)[number]["value"];

const gradeStyles: Record<Grade, { selected: string; ring: string }> = {
  A: {
    selected:
      "bg-emerald-50 border-emerald-500 shadow-[0_0_0_2px_rgba(5,150,105,0.15)]",
    ring: "text-emerald-600",
  },
  B: {
    selected:
      "bg-blue-50 border-blue-600 shadow-[0_0_0_2px_rgba(37,99,235,0.15)]",
    ring: "text-blue-600",
  },
  C: {
    selected: "bg-sky-50 border-sky-500 shadow-[0_0_0_2px_rgba(2,132,199,0.15)]",
    ring: "text-sky-600",
  },
  D: {
    selected:
      "bg-amber-50 border-amber-500 shadow-[0_0_0_2px_rgba(217,119,6,0.15)]",
    ring: "text-amber-600",
  },
  E: {
    selected: "bg-red-50 border-red-500 shadow-[0_0_0_2px_rgba(220,38,38,0.15)]",
    ring: "text-red-600",
  },
};

export const gradeChipStyles: Record<Grade, string> = {
  A: "bg-emerald-50 text-emerald-600",
  B: "bg-blue-50 text-blue-600",
  C: "bg-sky-50 text-sky-600",
  D: "bg-amber-50 text-amber-600",
  E: "bg-red-50 text-red-600",
};

const VALID_GRADES: Grade[] = ["A", "B", "C", "D", "E"];

/** 1-10 numeric rating codes (replaces A-E). */
export type RatingCode = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10";

const VALID_RATING_CODES: RatingCode[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export function isGrade(value: string | null): value is RatingCode {
  return value != null && VALID_RATING_CODES.includes(value as RatingCode);
}

export function VarianceChip({
  selfRating,
  managerRating,
}: {
  selfRating: string | null;
  managerRating: string | null;
}) {
  if (!selfRating || !managerRating) return null;

  const selfNum = parseInt(selfRating, 10);
  const managerNum = parseInt(managerRating, 10);
  if (Number.isNaN(selfNum) || Number.isNaN(managerNum)) return null;

  const delta = managerNum - selfNum;
  if (delta === 0) return null;

  const isUp = delta > 0;
  const abs = Math.abs(delta);

  const colour = isUp
    ? "text-emerald-600"
    : abs >= 3
      ? "text-rose-600"
      : abs === 2
        ? "text-amber-600"
        : "text-orange-500";

  return (
    <span className={cn("text-[10px] font-bold tabular-nums leading-none", colour)}>
      {isUp ? "↑" : "↓"}
      {abs}
    </span>
  );
}

interface RatingPillGroupProps {
  name: string;
  value: Grade | null;
  onChange: (value: Grade) => void;
  disabled?: boolean;
}

export function RatingPillGroup({
  name,
  value,
  onChange,
  disabled = false,
}: RatingPillGroupProps) {
  return (
    <div className="flex gap-[5px] items-center">
      {GRADES.map((grade) => {
        const isSelected = value === grade.value;
        const styles = gradeStyles[grade.value];
        return (
          <label
            key={grade.value}
            className={cn(
              "flex flex-col items-center justify-center px-1 py-[7px] rounded-lg border-[1.5px] cursor-pointer",
              "min-w-[54px] flex-1 text-center select-none",
              "transition-all duration-150",
              isSelected
                ? styles.selected
                : "bg-white border-[#dde5f5] hover:border-[#3b82f6] hover:bg-[#eef2fb] hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(59,130,246,0.12)]",
              disabled && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
          >
            <input
              type="radio"
              name={name}
              value={grade.value}
              checked={isSelected}
              onChange={() => !disabled && onChange(grade.value)}
              className="sr-only"
            />
            <span
              className={cn(
                'font-["Sora",sans-serif] text-[13px] font-bold leading-none mb-[3px]',
                isSelected ? styles.ring : "text-[#0f1f3d]"
              )}
            >
              {grade.value}
            </span>
            <span
              className={cn(
                "text-[9px] font-medium leading-[1.2] whitespace-pre-line",
                isSelected ? styles.ring : "text-[#8a97b8]"
              )}
            >
              {grade.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

const RATING_BAND_COLOR: Record<number, string> = {
  1: "bg-red-50 text-red-600",
  2: "bg-red-50 text-red-600",
  3: "bg-orange-50 text-orange-700",
  4: "bg-orange-50 text-orange-700",
  5: "bg-amber-50 text-amber-600",
  6: "bg-amber-50 text-amber-600",
  7: "bg-emerald-50 text-emerald-600",
  8: "bg-emerald-50 text-emerald-600",
  9: "bg-emerald-50 text-emerald-700",
  10: "bg-emerald-50 text-emerald-700",
};

interface RatingGradeChipProps {
  value: Grade | RatingCode | string | null;
  className?: string;
}

export function RatingGradeChip({ value, className }: RatingGradeChipProps) {
  if (value == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center w-7 h-7 rounded-[6px] border-[1.5px] border-dashed border-[#dde5f5] text-[#8a97b8] text-base",
          className
        )}
      >
        —
      </span>
    );
  }
  if (isGrade(value)) {
    const n = parseInt(value, 10);
    const bandClass = !Number.isNaN(n) && n >= 1 && n <= 10 ? RATING_BAND_COLOR[n] : "bg-[#eff6ff] text-[#1d4ed8]";
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center w-7 h-7 rounded-[6px] font-['Sora',sans-serif] text-[13px] font-bold",
          bandClass,
          className
        )}
      >
        {value}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-[6px] border-[1.5px] border-dashed border-[#dde5f5] text-[#8a97b8] text-base",
        className
      )}
    >
      —
    </span>
  );
}

export function RatingLegend() {
  const items = [
    { range: "1–2", label: "Far below", color: "#dc2626" },
    { range: "3–4", label: "Below", color: "#9a3412" },
    { range: "5–6", label: "Meets", color: "#92400e" },
    { range: "7–8", label: "Exceeds", color: "#166534" },
    { range: "9–10", label: "Highly exceeds", color: "#065f46" },
  ];
  return (
    <div
      className="flex flex-wrap items-center gap-4 border-t border-[#dde5f5] bg-[#f8faff] px-5 py-2.5"
      style={{ fontFamily: "DM Sans, sans-serif" }}
    >
      {items.map((b) => (
        <div key={b.range} className="flex items-center gap-1.5 text-[10px]" style={{ color: "#8a97b8" }}>
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: b.color }} />
          <span style={{ color: b.color, fontWeight: 500 }}>{b.range}</span>
          <span>— {b.label}</span>
        </div>
      ))}
    </div>
  );
}
