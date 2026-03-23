"use client";

import { useState } from "react";
import { ShieldAlert, MessageCircleWarning, Phone, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhishingWarningProps {
  voucherCode: string;
  onConfirm: () => void;
}

const FRAUD_TYPES = [
  {
    icon: MessageCircleWarning,
    title: "카카오톡 해킹 사칭",
    description:
      "카카오톡으로 지인을 사칭하여 상품권 구매를 요청하는 경우, 반드시 전화로 본인 확인 후 진행하세요.",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    icon: Phone,
    title: "경찰/검찰 사칭",
    description:
      "수사기관은 절대 상품권 구매를 요구하지 않습니다. 경찰/검찰을 사칭한 전화를 받았다면 즉시 끊으세요.",
    color: "text-error",
    bgColor: "bg-error/10",
  },
  {
    icon: Landmark,
    title: "금융기관 사칭",
    description:
      "은행, 카드사 등 금융기관은 상품권으로 대출 수수료를 요구하지 않습니다. 의심되면 해당 기관에 직접 확인하세요.",
    color: "text-info",
    bgColor: "bg-info/10",
  },
];

export default function PhishingWarning({ voucherCode, onConfirm }: PhishingWarningProps) {
  const [isChecked, setIsChecked] = useState(false);

  const handleConfirm = () => {
    // 세션 스토리지에 확인 상태 저장 (바우처 코드별 1회만 표시)
    try {
      sessionStorage.setItem(`phishing-warning-${voucherCode}`, "confirmed");
    } catch {
      // sessionStorage 사용 불가 시 무시
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* 상단 경고 아이콘 */}
        <div className="mb-5 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-error/10">
            <ShieldAlert size={32} className="text-error" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-foreground">
            보이스피싱 주의
          </h1>
          <p className="mt-1.5 text-center text-sm leading-relaxed text-muted-foreground">
            상품권을 이용한 사기 피해가 증가하고 있습니다.
            <br />
            아래 내용을 반드시 확인해주세요.
          </p>
        </div>

        {/* 사기 유형 목록 */}
        <div className="space-y-3">
          {FRAUD_TYPES.map((fraud) => {
            const Icon = fraud.icon;
            return (
              <div
                key={fraud.title}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      fraud.bgColor
                    )}
                  >
                    <Icon size={18} className={fraud.color} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-foreground">
                      {fraud.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                      {fraud.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 체크박스 + 확인 버튼 */}
        <div className="mt-5">
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
            />
            <span className="text-sm leading-snug text-foreground">
              위 내용을 확인하였으며,{" "}
              <strong className="text-error">타인의 요청에 의한 구매가 아닙니다.</strong>
            </span>
          </label>

          <Button
            onClick={handleConfirm}
            disabled={!isChecked}
            className={cn(
              "mt-3 h-14 w-full rounded-xl text-sm font-bold transition-all",
              isChecked
                ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            )}
          >
            확인하였습니다
          </Button>
        </div>

        {/* 하단 안내 */}
        <p className="mt-4 text-center text-[13px] leading-relaxed text-muted-foreground">
          피해가 의심되면 경찰청(112) 또는 금융감독원(1332)에 신고하세요.
        </p>
      </div>
    </div>
  );
}

/** 해당 바우처 코드에 대해 이미 경고를 확인했는지 체크 */
export function hasConfirmedPhishingWarning(voucherCode: string): boolean {
  try {
    return sessionStorage.getItem(`phishing-warning-${voucherCode}`) === "confirmed";
  } catch {
    return false;
  }
}
