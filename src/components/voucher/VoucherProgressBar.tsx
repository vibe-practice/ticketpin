"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "임시 비밀번호", step: 1 },
  { label: "비밀번호 설정", step: 2 },
  { label: "선택", step: 3 },
  { label: "완료", step: 4 },
];

interface VoucherProgressBarProps {
  currentStep: 1 | 2 | 3 | 4;
}

export default function VoucherProgressBar({ currentStep }: VoucherProgressBarProps) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => {
          const isCompleted = s.step < currentStep;
          const isCurrent = s.step === currentStep;
          const isLast = i === STEPS.length - 1;

          return (
            <div key={s.step} className="flex items-center flex-1 last:flex-none">
              {/* 스텝 원 + 라벨 */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-bold transition-colors",
                    isCompleted && "bg-foreground text-background",
                    isCurrent && "bg-foreground text-background ring-4 ring-foreground/10",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check size={14} strokeWidth={3} /> : s.step}
                </div>
                <span
                  className={cn(
                    "text-[14px] font-medium whitespace-nowrap",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>

              {/* 연결선 */}
              {!isLast && (
                <div className="flex-1 mx-2 mt-[-18px]">
                  <div
                    className={cn(
                      "h-[2px] w-full rounded-full",
                      isCompleted ? "bg-foreground" : "bg-border"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
