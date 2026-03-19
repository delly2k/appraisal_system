"use client";

const STEPS = ["Upload file", "Select sheet", "Map columns", "Review & confirm"];

interface UploadStepIndicatorProps {
  currentStep: number;
}

export function UploadStepIndicator({ currentStep }: UploadStepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 flex-wrap">
      {STEPS.map((label, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;
        const stepNum = i + 1;
        return (
          <div key={i} className="flex items-center gap-1">
            <div
              className={`
                flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-semibold
                ${isCompleted ? "bg-[#0d9488] text-white" : ""}
                ${isActive ? "bg-[#0f1f3d] text-white" : ""}
                ${!isCompleted && !isActive ? "bg-[#e2e8f0] text-[#8a97b8]" : ""}
              `}
            >
              {isCompleted ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                stepNum
              )}
            </div>
            <span
              className={`text-[11px] font-medium max-w-[90px] truncate hidden sm:inline
                ${isActive ? "text-[#0f1f3d]" : ""}
                ${isCompleted ? "text-[#0d9488]" : ""}
                ${!isCompleted && !isActive ? "text-[#8a97b8]" : ""}
              `}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="text-[#8a97b8] text-[10px] mx-0.5">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
