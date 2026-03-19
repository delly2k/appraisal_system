"use client";

interface RatingButtonsProps {
  value: string | null;
  onChange: (code: string) => void;
  disabled?: boolean;
}

const BAND = (n: number) => {
  if (n <= 2) return { bg: "#fff1f2", border: "#fecaca", text: "#dc2626", glow: "rgba(252,165,165,.3)" };
  if (n <= 4) return { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412", glow: "rgba(253,186,116,.3)" };
  if (n <= 6) return { bg: "#fffbeb", border: "#fcd34d", text: "#92400e", glow: "rgba(252,211,77,.3)" };
  if (n <= 8) return { bg: "#f0fdf4", border: "#86efac", text: "#166534", glow: "rgba(134,239,172,.25)" };
  return { bg: "#ecfdf5", border: "#6ee7b7", text: "#065f46", glow: "rgba(110,231,183,.25)" };
};

const LABEL: Record<number, string> = {
  1: "Far below expectations",
  2: "Far below expectations",
  3: "Below expectations",
  4: "Below expectations",
  5: "Approaching expectations",
  6: "Meets expectations",
  7: "Meets expectations well",
  8: "Exceeds expectations",
  9: "Highly exceeds expectations",
  10: "Exceptional performance",
};

export function RatingButtons({ value, onChange, disabled = false }: RatingButtonsProps) {
  const selected = value ? parseInt(value, 10) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const isSelected = selected === n;
          const band = BAND(n);
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(String(n))}
              className={`h-[30px] w-[30px] flex-shrink-0 rounded-full text-[11px] font-semibold flex items-center justify-center transition-all duration-150
                ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                ${isSelected ? "border-[2px] scale-110" : "border-[1.5px] border-[#dde5f5] bg-transparent text-[#8a97b8] hover:border-[#8a97b8] hover:bg-[#f8faff] hover:text-[#0f1f3d]"}`}
              style={
                isSelected
                  ? {
                      background: band.bg,
                      borderColor: band.border,
                      color: band.text,
                      boxShadow: `0 0 0 3px ${band.glow}`,
                    }
                  : {}
              }
              title={`${n} — ${LABEL[n]}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        {[6, 7, 8, 9, 10].map((n) => {
          const isSelected = selected === n;
          const band = BAND(n);
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onChange(String(n))}
              className={`h-[30px] w-[30px] flex-shrink-0 rounded-full text-[11px] font-semibold flex items-center justify-center transition-all duration-150
                ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
                ${isSelected ? "border-[2px] scale-110" : "border-[1.5px] border-[#dde5f5] bg-transparent text-[#8a97b8] hover:border-[#8a97b8] hover:bg-[#f8faff] hover:text-[#0f1f3d]"}`}
              style={
                isSelected
                  ? {
                      background: band.bg,
                      borderColor: band.border,
                      color: band.text,
                      boxShadow: `0 0 0 3px ${band.glow}`,
                    }
                  : {}
              }
              title={`${n} — ${LABEL[n]}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p
        className={`text-[9px] font-medium leading-none transition-colors ${selected ? "" : "text-[#8a97b8]"}`}
        style={selected ? { color: BAND(selected).text } : {}}
      >
        {selected ? `${selected} — ${LABEL[selected]}` : "Select a rating"}
      </p>
    </div>
  );
}
