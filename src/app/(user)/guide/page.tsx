import type { Metadata } from "next";
import {
  ShoppingCart,
  CreditCard,
  MessageSquare,
  KeyRound,
  Lock,
  Hash,
  AlertCircle,
  Gift,
  RefreshCw,
  XCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: "이용방법 | 티켓매니아",
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

const STEPS: Step[] = [
  {
    number: 1,
    icon: ShoppingCart,
    title: "상품권 선택",
    description: "원하는 상품권을 카테고리에서 찾아 선택합니다.",
    details: [
      "카테고리별로 다양한 상품권을 탐색할 수 있습니다.",
      "구매 수량을 선택하고 수수료 방식을 결정합니다.",
      "수수료 포함: 결제 시 수수료가 포함된 금액으로 결제",
      "수수료 별도: 핀 번호 확인 시 수수료를 추가 결제",
    ],
  },
  {
    number: 2,
    icon: CreditCard,
    title: "결제",
    description: "신용카드로 간편하게 결제합니다.",
    details: [
      "신용카드 결제를 지원합니다.",
      "결제 정보를 입력하고 최종 금액을 확인한 뒤 결제를 완료합니다.",
      "결제 완료 즉시 교환권이 발급됩니다.",
    ],
  },
  {
    number: 3,
    icon: MessageSquare,
    title: "문자 수신",
    description: "결제 완료 후 휴대폰으로 교환권 링크와 임시 비밀번호를 수신합니다.",
    details: [
      "구매자 휴대폰 번호로 문자 메시지가 자동 발송됩니다.",
      "문자에는 교환권 접근 링크와 임시 비밀번호(3자리)가 포함됩니다.",
      "문자를 받지 못한 경우 마이페이지 > 내 상품권에서 확인하세요.",
    ],
    badge: "임시 비밀번호 3자리",
    badgeVariant: "info",
  },
  {
    number: 4,
    icon: KeyRound,
    title: "임시 비밀번호 인증",
    description: "문자의 링크를 클릭하고 수신한 임시 비밀번호를 입력합니다.",
    details: [
      "링크 클릭 후 20분 이내에 임시 비밀번호를 입력해야 합니다.",
      "5회 연속 입력 실패 시 교환권이 잠금 처리됩니다.",
      "잠금 시 고객센터 문의 또는 임시 비밀번호 재발행(최대 5회)이 필요합니다.",
    ],
    badge: "20분 이내 인증 필요",
    badgeVariant: "warning",
  },
  {
    number: 5,
    icon: Lock,
    title: "비밀번호 설정",
    description: "본인만의 4자리 비밀번호를 설정합니다.",
    details: [
      "임시 비밀번호 인증 완료 후 나만의 4자리 비밀번호를 설정합니다.",
      "설정한 비밀번호는 이후 핀 번호 확인 시마다 사용됩니다.",
      "비밀번호 설정 완료 후에는 결제 취소가 불가합니다.",
      "비밀번호 설정 전에는 선물하기가 불가합니다.",
    ],
    badge: "이후 취소 불가",
    badgeVariant: "error",
  },
  {
    number: 6,
    icon: Hash,
    title: "핀 번호 확인",
    description: "설정한 비밀번호로 인증하면 핀 번호가 표시됩니다.",
    details: [
      "설정한 4자리 비밀번호를 입력하면 핀 번호가 화면에 표시됩니다.",
      "핀 번호를 복사하여 해당 서비스(쇼핑몰, 앱 등)에서 사용하세요.",
      "수수료 별도 방식인 경우 이 단계에서 수수료를 추가 결제합니다.",
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
    icon: CreditCard,
    title: "수수료 안내",
    desc: "수수료 포함 방식은 결제 시 수수료가 포함됩니다. 수수료 별도 방식은 핀 번호 확인 시 수수료를 추가 결제합니다.",
    variant: "info",
  },
  {
    icon: Gift,
    title: "선물하기",
    desc: "비밀번호 설정 후, 핀 번호 확인 전 단계에서 다른 회원에게 교환권을 선물할 수 있습니다.",
    variant: "success",
  },
  {
    icon: RefreshCw,
    title: "임시 비밀번호 재발행",
    desc: "임시 비밀번호 만료(20분 초과) 시 마이페이지에서 재발행을 요청할 수 있으며, 최대 5회까지 재발행이 가능합니다.",
    variant: "warning",
  },
  {
    icon: XCircle,
    title: "결제 취소",
    desc: "비밀번호 설정 전까지만 결제 취소가 가능합니다. 비밀번호를 설정하면 취소할 수 없으니 신중하게 결정해 주세요.",
    variant: "error",
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

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* 페이지 헤더 */}
      <div className="border-b border-border bg-card">
        <div className="container-main py-8">
          <h1 className="text-2xl font-bold text-foreground">이용방법</h1>
          <p className="mt-1 text-[16px] text-muted-foreground">
            티켓매니아 상품권 교환권 서비스 이용 절차를 안내합니다.
          </p>
        </div>
      </div>

      <div className="container-main py-10">
        <div className="space-y-12">

          {/* 이용 절차 섹션 — 가로 카드 그리드 */}
          <section>
            <h2 className="mb-6 text-xl font-semibold text-foreground">이용 절차</h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.number}
                    className="group relative flex flex-col rounded-xl border border-border bg-card p-6 transition-shadow duration-200 hover:shadow-md"
                  >
                    {/* 스텝 번호 + 아이콘 */}
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                        <Icon size={20} />
                      </div>
                      <span className="text-[14px] font-semibold tracking-widest text-muted-foreground uppercase">
                        Step {step.number}
                      </span>
                    </div>

                    {/* 배지 */}
                    {step.badge && step.badgeVariant && (
                      <span
                        className={`mb-3 inline-flex w-fit items-center gap-1 rounded-sm px-2 py-0.5 text-[14px] font-semibold ${badgeStyles[step.badgeVariant]}`}
                      >
                        <AlertCircle size={12} />
                        {step.badge}
                      </span>
                    )}

                    {/* 제목 + 설명 */}
                    <h3 className="text-[18px] font-bold text-foreground leading-tight">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>

                    {/* 세부 안내 */}
                    <ul className="mt-4 space-y-2 border-t border-border pt-4">
                      {step.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                          <span className="text-[14px] text-muted-foreground leading-relaxed">
                            {detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 추가 안내 섹션 */}
          <section>
            <h2 className="mb-6 text-xl font-semibold text-foreground">추가 안내</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {NOTICES.map((notice) => {
                const Icon = notice.icon;
                const style = noticeStyles[notice.variant];
                return (
                  <div
                    key={notice.title}
                    className={`rounded-xl border p-5 ${style.container}`}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <Icon size={18} className={style.icon} />
                      <span className={`text-[16px] font-semibold ${style.title}`}>
                        {notice.title}
                      </span>
                    </div>
                    <p className="text-[15px] text-muted-foreground leading-relaxed">
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
