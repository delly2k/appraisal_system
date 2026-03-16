"use client";

import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";
import type { MetricType } from "@/lib/metric-calc";

interface MetricTypePickerProps {
  current: MetricType;
  onSelect: (type: MetricType) => void;
  onClose: () => void;
}

const OPTIONS: Array<{
  type: MetricType;
  icon: string;
  title: string;
  titleColor: string;
  selectedClass: string;
  desc: React.ReactNode;
}> = [
  {
    type: "NUMBER",
    icon: "🔢",
    title: "Number — Fraction",
    titleColor: "text-blue-700",
    selectedClass: "border-blue-300 bg-blue-50",
    desc: (
      <>
        Enter <strong className="text-slate-600">actual / target</strong> e.g. <strong className="text-slate-600">4 / 5</strong> policies completed
        <br />
        System calculates: 4 ÷ 5 = <strong className="text-slate-600">80%</strong>
      </>
    ),
  },
  {
    type: "DATE",
    icon: "📅",
    title: "Date — Deadline Based",
    titleColor: "text-purple-700",
    selectedClass: "border-purple-300 bg-purple-50",
    desc: (
      <>
        Enter <strong className="text-slate-600">deadline & completion date</strong>
        <br />
        On/before deadline = <strong className="text-slate-600">100%</strong>. Late = score reduced by days overdue.
      </>
    ),
  },
  {
    type: "PERCENT",
    icon: "%",
    title: "Percentage — Direct Entry",
    titleColor: "text-emerald-700",
    selectedClass: "border-emerald-300 bg-emerald-50",
    desc: (
      <>
        Enter the <strong className="text-slate-600">% directly</strong> e.g. <strong className="text-slate-600">99.2%</strong> uptime
        <br />
        Used when the metric is already expressed as a percentage.
      </>
    ),
  },
];

export function MetricTypePicker({ current, onSelect, onClose }: MetricTypePickerProps) {
  const content = (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-[#0f1f3d]/40 backdrop-blur-sm"
        aria-hidden
      />
      <div className="fixed left-1/2 top-1/2 z-[9999] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] bg-white p-6 shadow-[0_20px_60px_rgba(15,31,61,0.2)]">
        <h3 className="mb-1 font-['Sora'] text-[15px] font-bold text-[#0f1f3d]">Select Metric Type</h3>
        <p className="mb-5 text-[12px] text-[#8a97b8]">
          This determines how the system calculates the % from your actual entry
        </p>

        <div className="flex flex-col gap-3">
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => onSelect(opt.type)}
              className={cn(
                "flex items-start gap-4 rounded-[10px] border-[1.5px] px-4 py-3.5 text-left transition-all duration-150 hover:translate-x-0.5 hover:border-blue-300 hover:bg-slate-50",
                current === opt.type ? opt.selectedClass : "border-[#dde5f5] bg-white"
              )}
            >
              <span className="mt-0.5 flex-shrink-0 text-[22px]">{opt.icon}</span>
              <div>
                <div className={cn("mb-0.5 text-[13px] font-bold", opt.titleColor)}>{opt.title}</div>
                <div className="text-[11px] leading-[1.5] text-[#8a97b8]">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-[8px] border-[1.5px] border-[#dde5f5] py-2.5 text-[13px] text-[#8a97b8] transition-colors hover:bg-[#f8faff]"
        >
          Cancel
        </button>
      </div>
    </>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
