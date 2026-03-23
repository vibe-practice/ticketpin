import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "환불/취소 정책 | 티켓핀",
};

const SECTIONS = [
  {
    title: "1. 취소 가능 조건",
    content: `교환권의 취소는 다음 조건을 모두 충족하는 경우에만 가능합니다.

· 핀 번호가 조회(사용)되지 않은 상태
· 선물하기가 완료되지 않은 상태
· 구매일로부터 3일 이내

위 조건 중 하나라도 충족하지 않는 경우 취소가 불가합니다.`,
  },
  {
    title: "2. 취소 불가 사유",
    content: `다음의 경우에는 취소 및 환불이 불가능합니다.

· 핀 번호가 이미 조회(노출)된 경우 — 상품권 사용 여부와 관계없이 조회 시점에서 취소 불가
· 선물하기가 완료된 경우 — 수신자에게 교환권이 이전된 이후에는 취소 불가
· 구매일로부터 3일이 경과한 경우
· 이벤트, 프로모션 등 별도 취소 조건이 명시된 상품`,
  },
  {
    title: "3. 환불 금액",
    content: `· 취소 시 결제한 금액 전액이 환불됩니다.
· 수수료 포함 결제의 경우: 상품 가격 + 수수료 전액 환불
· 수수료 별도 결제의 경우: 상품 가격 전액 환불 (수수료 미결제 상태이므로 별도 환불 없음)`,
  },
  {
    title: "4. 환불 처리 기간",
    content: `· 취소 요청 즉시 환불이 진행됩니다.
· 결제 수단별 환불 소요 기간:
  - 신용카드: 취소 후 3~5 영업일 이내 카드사 승인 취소
  - 카카오페이/네이버페이: 취소 후 즉시~1 영업일 이내
  - 계좌이체: 취소 후 3~5 영업일 이내 입금

환불 소요 기간은 결제 수단 및 금융기관 사정에 따라 달라질 수 있습니다.`,
  },
  {
    title: "5. 취소 방법",
    content: `교환권 취소는 다음 방법으로 요청할 수 있습니다.

· 교환권 페이지에서 직접 취소: 교환권 링크 접속 → 취소 버튼 클릭
· 마이페이지에서 취소: 마이페이지 → 주문 내역 → 해당 주문 취소

취소 완료 시 SMS로 취소 확인 문자가 발송됩니다.`,
  },
  {
    title: "6. 부분 취소",
    content:
      "부분 취소는 지원하지 않습니다. 한 번의 주문에 여러 장의 교환권을 구매한 경우, 전체 단위로만 취소가 가능합니다. 일부 교환권만 선택하여 취소할 수 없습니다.",
  },
  {
    title: "7. 관련 법령",
    content: `본 정책은 다음 법령에 근거합니다.

· 전자상거래 등에서의 소비자보호에 관한 법률
· 콘텐츠산업 진흥법
· 소비자기본법

관련 법령과 본 정책이 상충하는 경우 법령이 우선 적용됩니다.`,
  },
  {
    title: "시행일",
    content: "본 환불/취소 정책은 2026년 3월 1일부터 시행합니다.",
  },
];

export default function RefundPolicyPage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <div className="border-b border-border bg-card">
        <div className="px-6 py-8 lg:px-12">
          <h1 className="text-xl font-bold text-foreground">환불/취소 정책</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            시행일: 2026년 3월 1일
          </p>
        </div>
      </div>

      <div className="px-6 py-8 lg:px-12">
        <div className="max-w-3xl space-y-6">
          {/* 핵심 안내 배너 */}
          <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-bg px-5 py-4">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-warning"
              strokeWidth={2}
            />
            <div>
              <p className="text-[14px] font-semibold text-foreground">
                핀 번호가 조회된 교환권은 환불이 불가합니다.
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                교환권 구매 전 상품 정보를 충분히 확인해 주세요.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="divide-y divide-border">
              {SECTIONS.map((section, i) => (
                <div key={i} className="px-6 py-5">
                  <h2 className="text-[15px] font-semibold text-foreground">
                    {section.title}
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
