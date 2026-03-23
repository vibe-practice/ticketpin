import type { Metadata } from "next";
import {
  Gift,
  Search,
  UserCheck,
  Send,
  Mail,
  KeyRound,
  Hash,
  ChevronRight,
  AlertCircle,
  ShieldAlert,
  XCircle,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "선물하기 안내 | 티켓핀",
};

interface Step {
  number: number;
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[];
  badge?: string;
  badgeVariant?: "primary" | "warning" | "error" | "info";
}

const GIFT_SEND_STEPS: Step[] = [
  {
    number: 1,
    icon: Lock,
    title: "비밀번호 설정 완료",
    description: "구매한 상품권의 비밀번호 설정을 먼저 완료합니다.",
    details: [
      "상품권 구매 후 문자로 수신한 교환권 URL에 접속합니다.",
      "임시 비밀번호 인증 후 4자리 비밀번호를 설정합니다.",
      "비밀번호 설정이 완료되어야 선물하기가 가능합니다.",
    ],
  },
  {
    number: 2,
    icon: Gift,
    title: "선물하기 선택",
    description: "교환권 액션 화면에서 '선물하기' 버튼을 클릭합니다.",
    details: [
      "비밀번호 설정 후 표시되는 액션 화면에서 선물하기를 선택합니다.",
      "핀 번호를 이미 확인(해제)한 상품권은 선물할 수 없습니다.",
    ],
    badge: "핀 해제 전에만 가능",
    badgeVariant: "warning",
  },
  {
    number: 3,
    icon: Search,
    title: "수신자 검색",
    description: "선물을 받을 회원의 아이디를 검색합니다.",
    details: [
      "선물하기는 회원 간에만 가능합니다.",
      "받는 분의 아이디를 검색하여 선택합니다.",
      "자기 자신에게는 선물할 수 없습니다.",
    ],
  },
  {
    number: 4,
    icon: Send,
    title: "선물 전송",
    description: "최종 확인 후 선물을 전송합니다.",
    details: [
      "선물 전송 전 확인 화면에서 수신자 정보와 상품 정보를 다시 한번 확인합니다.",
      "선물 전송 후에는 결제 취소가 불가합니다.",
      "전송이 완료되면 기존 교환권 URL은 비활성화됩니다.",
    ],
    badge: "전송 후 취소 불가",
    badgeVariant: "error",
  },
];

const GIFT_RECEIVE_STEPS: Step[] = [
  {
    number: 1,
    icon: Mail,
    title: "문자 수신",
    description: "선물을 보낸 분의 이름과 함께 새로운 교환권 URL을 문자로 수신합니다.",
    details: [
      "보낸 분과는 다른 새로운 교환권 URL이 발급됩니다.",
      "문자에는 새 교환권 URL과 임시 비밀번호(3자리)가 포함됩니다.",
    ],
  },
  {
    number: 2,
    icon: KeyRound,
    title: "비밀번호 설정",
    description: "새 교환권 URL에 접속하여 비밀번호를 설정합니다.",
    details: [
      "보이스피싱 주의 확인 후 임시 비밀번호를 입력합니다.",
      "나만의 4자리 비밀번호를 새로 설정합니다.",
      "이후 절차는 직접 구매한 상품권과 동일합니다.",
    ],
  },
  {
    number: 3,
    icon: Hash,
    title: "핀 번호 확인 또는 재선물",
    description: "비밀번호 인증 후 핀 번호를 확인하거나 다른 분께 다시 선물할 수 있습니다.",
    details: [
      "핀 번호 해제를 통해 상품권 핀 번호를 확인할 수 있습니다.",
      "핀 해제 전이라면 다른 회원에게 다시 선물하는 것도 가능합니다.",
    ],
  },
];

interface NoticeItem {
  icon: React.ElementType;
  title: string;
  desc: string;
  variant: "info" | "warning" | "success" | "error";
}

const NOTICES: NoticeItem[] = [
  {
    icon: UserCheck,
    title: "회원 간 선물만 가능",
    desc: "선물하기는 티켓핀 회원 간에만 가능합니다. 비회원에게는 선물할 수 없으니, 받는 분이 먼저 회원가입을 완료해야 합니다.",
    variant: "info",
  },
  {
    icon: ShieldAlert,
    title: "핀 해제 후 선물 불가",
    desc: "핀 번호를 이미 확인(해제)한 상품권은 선물할 수 없습니다. 선물하려면 핀 번호 확인 전에 선물하기를 진행해 주세요.",
    variant: "warning",
  },
  {
    icon: XCircle,
    title: "선물 후 결제 취소 불가",
    desc: "선물 전송이 완료되면 결제 취소가 불가합니다. 선물 전송 전에 수신자 정보를 반드시 확인해 주세요.",
    variant: "error",
  },
  {
    icon: Gift,
    title: "교환권 URL 변경",
    desc: "선물이 전송되면 기존 교환권 URL은 비활성화되고, 받는 분에게 새로운 URL이 발급됩니다. 기존 URL로는 더 이상 접근할 수 없습니다.",
    variant: "info",
  },
];

const badgeStyles: Record<NonNullable<Step["badgeVariant"]>, string> = {
  primary: "bg-brand-primary-soft text-primary",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
  info: "bg-info-bg text-info",
};

const noticeStyles: Record<NoticeItem["variant"], { container: string; icon: string; title: string }> = {
  info: {
    container: "bg-info-bg border-info/20",
    icon: "text-info",
    title: "text-info",
  },
  success: {
    container: "bg-success-bg border-success/20",
    icon: "text-success",
    title: "text-success",
  },
  warning: {
    container: "bg-warning-bg border-warning/20",
    icon: "text-warning",
    title: "text-warning",
  },
  error: {
    container: "bg-error-bg border-error/20",
    icon: "text-error",
    title: "text-error",
  },
};

function StepTimeline({ steps }: { steps: Step[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        const isLast = idx === steps.length - 1;

        return (
          <div key={step.number} className="flex gap-4">
            {/* 타임라인 축 */}
            <div className="flex flex-col items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-primary-soft ring-2 ring-primary/20">
                <Icon size={18} className="text-primary" />
              </div>
              {!isLast && (
                <div className="mt-1 w-px flex-1 bg-border" style={{ minHeight: "32px" }} />
              )}
            </div>

            {/* 콘텐츠 */}
            <div className={cn("flex-1 pb-8", isLast && "pb-0")}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[12px] font-semibold text-muted-foreground">
                  STEP {step.number}
                </span>
                {step.badge && step.badgeVariant && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[12px] font-semibold ${badgeStyles[step.badgeVariant]}`}
                  >
                    <AlertCircle size={10} />
                    {step.badge}
                  </span>
                )}
              </div>
              <h3 className="text-[15px] font-semibold text-foreground leading-tight">
                {step.title}
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {step.description}
              </p>

              <ul className="mt-3 space-y-1.5 rounded-xl border border-border bg-card p-4">
                {step.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight
                      size={13}
                      className="mt-[3px] shrink-0 text-primary"
                    />
                    <span className="text-[13px] text-muted-foreground leading-relaxed">
                      {detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GiftGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 페이지 헤더 */}
      <div className="border-b border-border bg-card">
        <div className="px-6 py-8 lg:px-12">
          <h1 className="text-xl font-bold text-foreground">선물하기 안내</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            보유한 상품권을 다른 회원에게 선물하는 방법을 안내합니다.
          </p>
        </div>
      </div>

      <div className="px-6 py-8 lg:px-12">
        <div className="max-w-3xl space-y-10">

          {/* 선물 보내기 절차 */}
          <section>
            <h2 className="mb-5 text-base font-semibold text-foreground">선물 보내기 절차</h2>
            <StepTimeline steps={GIFT_SEND_STEPS} />
          </section>

          {/* 선물 받기 절차 */}
          <section>
            <h2 className="mb-5 text-base font-semibold text-foreground">선물 받기 절차</h2>
            <StepTimeline steps={GIFT_RECEIVE_STEPS} />
          </section>

          {/* 유의사항 */}
          <section>
            <h2 className="mb-4 text-base font-semibold text-foreground">유의사항</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {NOTICES.map((notice) => {
                const Icon = notice.icon;
                const style = noticeStyles[notice.variant];
                return (
                  <div
                    key={notice.title}
                    className={`rounded-xl border p-4 ${style.container}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={15} className={style.icon} />
                      <span className={`text-[13px] font-semibold ${style.title}`}>
                        {notice.title}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {notice.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
