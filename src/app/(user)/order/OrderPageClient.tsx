"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Tag,
  Info,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  AlertCircle,
  Loader2,
  BadgeCheck,
  Receipt,
} from "lucide-react";
import type { FeeType, ProductWithCategory } from "@/types";
import { formatPrice, calcFeeAmount, formatFeePercent, cn, formatPhone } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

// ── 타입 ────────────────────────────────────────────────────
interface OrderFormData {
  agreeTerms: boolean;
}

interface FieldError {
  agreeTerms?: string;
}

interface MainPayApprovalMessage {
  type: "MAINPAY_APPROVAL";
  aid: string;
  authToken: string;
  payType: string;
  merchantData: string;
}

interface MainPayCloseMessage {
  type: "MAINPAY_CLOSE";
}

type MainPayMessage = MainPayApprovalMessage | MainPayCloseMessage;

// ── 서브 컴포넌트: 금액 요약 행 ─────────────────────────────
function AmountRow({
  label,
  value,
  isTotal = false,
  isMuted = false,
  badge,
}: {
  label: string;
  value: string;
  isTotal?: boolean;
  isMuted?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between",
        isTotal && "pt-3 mt-1 border-t border-border"
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5",
          isTotal
            ? "text-sm font-semibold text-foreground"
            : "text-sm text-muted-foreground"
        )}
      >
        {label}
        {badge}
      </span>
      <span
        className={cn(
          isTotal
            ? "text-2xl font-bold tracking-tight text-primary"
            : isMuted
              ? "text-sm font-medium text-muted-foreground"
              : "text-sm font-semibold text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
export function OrderPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  // URL 파라미터 파싱
  const productId = searchParams.get("productId") ?? "";
  const rawQuantity = parseInt(searchParams.get("quantity") ?? "1", 10);
  const quantity = Math.max(1, Math.min(30, Number.isNaN(rawQuantity) ? 1 : rawQuantity));
  const rawFeeType = searchParams.get("feeMode") ?? searchParams.get("feeType");
  const feeType: FeeType = rawFeeType === "separate" ? "separate" : "included";

  // 로그인 사용자 정보
  const user = useAuthStore((s) => s.user);

  // 상품 조회 (API에서 가져오기)
  const [product, setProduct] = useState<ProductWithCategory | null>(null);
  const [productLoading, setProductLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setProductLoading(false);
      return;
    }
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products/${productId}`);
        if (res.ok) {
          const data = await res.json();
          setProduct(data.data ?? data);
        }
      } catch (err) {
        console.error("[OrderPageClient] 상품 조회 실패:", err);
      } finally {
        setProductLoading(false);
      }
    }
    fetchProduct();
  }, [productId]);

  // 폼 상태
  const [formData, setFormData] = useState<OrderFormData>({
    agreeTerms: false,
  });
  const [errors, setErrors] = useState<FieldError>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // 팝업/인터벌 정리를 위한 ref
  const popupRef = useRef<Window | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);

  // cleanup 함수
  const cleanup = useCallback(() => {
    if (messageHandlerRef.current) {
      window.removeEventListener("message", messageHandlerRef.current);
      messageHandlerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    popupRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 약관 체크
  const handleAgreeTerms = useCallback((checked: boolean) => {
    setFormData((prev) => ({ ...prev, agreeTerms: checked }));
    if (checked) {
      setErrors((prev) => ({ ...prev, agreeTerms: undefined }));
    }
  }, []);

  // 유효성 검사
  const validate = useCallback((): boolean => {
    const newErrors: FieldError = {};
    if (!formData.agreeTerms) {
      newErrors.agreeTerms = "구매 진행을 위해 약관에 동의해주세요.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // 결제 버튼 핸들러
  const handlePayment = useCallback(async () => {
    if (!validate() || !product) return;

    setIsLoading(true);

    try {
      // ── 1. 결제 준비 API 호출 ──
      const readyRes = await fetch("/api/payment/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          quantity,
          feeType,
          goodsName: product.name.slice(0, 30),
        }),
      });

      const readyData = await readyRes.json();

      if (!readyData.success) {
        toast({
          type: "error",
          title: "결제 준비 실패",
          description: readyData.error?.message ?? "잠시 후 다시 시도해 주세요.",
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }

      const { aid, nextPcUrl, nextMobileUrl, mbrRefNo, amount } = readyData.data;

      // ── 2. 모바일/PC 분기하여 결제창 열기 ──
      const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      if (isMobile && nextMobileUrl) {
        // 모바일: 결제 상태를 sessionStorage에 저장 후 리다이렉트
        sessionStorage.setItem("mainpay_pending", JSON.stringify({ aid, mbrRefNo, amount, productName: product?.name ?? "", pinCount: quantity }));
        window.location.href = nextMobileUrl;
        return;
      }

      // PC: 팝업으로 결제창 열기 (화면 중앙 배치)
      const popupW = 650;
      const popupH = 650;
      const left = Math.round((window.screen.width - popupW) / 2);
      const top = Math.round((window.screen.height - popupH) / 2);
      const popup = window.open(
        nextPcUrl,
        "mainpay",
        `width=${popupW},height=${popupH},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      // 브라우저 크롬(주소창 등) 보정 → 콘텐츠 영역이 정확히 popupW x popupH 되도록
      if (popup) {
        try {
          const chromeW = popup.outerWidth - popup.innerWidth;
          const chromeH = popup.outerHeight - popup.innerHeight;
          popup.resizeTo(popupW + chromeW, popupH + chromeH);
          popup.moveTo(
            Math.round((window.screen.width - popup.outerWidth) / 2),
            Math.round((window.screen.height - popup.outerHeight) / 2)
          );
        } catch {
          // cross-origin 제한 시 무시
        }
      }

      if (!popup || popup.closed) {
        toast({
          type: "error",
          title: "팝업이 차단되었습니다",
          description: "브라우저 팝업 차단을 해제한 후 다시 시도해 주세요.",
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }

      popupRef.current = popup;
      setShowOverlay(true);

      // ── 3. postMessage 수신 대기 ──
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        const message = event.data as MainPayMessage;

        if (message.type === "MAINPAY_APPROVAL") {
          cleanup();
          setShowOverlay(false);
          const { authToken } = message as MainPayApprovalMessage;

          try {
            // ── 4. receiverPhone 사전 검증 ──
            const receiverPhone = user?.phone?.replace(/-/g, "") ?? "";
            if (!receiverPhone) {
              toast({
                type: "error",
                title: "전화번호 정보 없음",
                description: "마이페이지에서 전화번호를 등록한 후 결제를 진행해 주세요.",
                duration: 5000,
              });
              setIsLoading(false);
              return;
            }

            // ── 5. 결제 승인 + 주문 생성 API 호출 (원자성 보장) ──
            toast({
              type: "info",
              title: "결제 승인 처리 중...",
              duration: 3000,
            });

            const payRes = await fetch("/api/payment/pay", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                aid,
                authToken,
                mbrRefNo,
                amount,
                receiverPhone,
              }),
            });

            const payData = await payRes.json();

            if (!payData.success) {
              toast({
                type: "error",
                title: "결제 처리 실패",
                description: payData.error?.message ?? "잠시 후 다시 시도해 주세요.",
                duration: 5000,
              });
              setIsLoading(false);
              return;
            }

            // ── 5. 완료 페이지 이동 ──
            setIsLoading(false);
            const completeParams = new URLSearchParams({
              orderNumber: payData.data.order_number ?? "",
              totalAmount: String(payData.data.total_amount ?? 0),
              pinCount: String(payData.data.pin_count ?? 0),
              productName: product?.name ?? "",
            });
            router.push(`/order/complete?${completeParams.toString()}`);
          } catch (err) {
            console.error("[OrderPageClient] 결제/주문 처리 오류:", err);
            toast({
              type: "error",
              title: "처리 중 오류",
              description: "결제 처리 중 오류가 발생했습니다. 고객센터에 문의해 주세요.",
              duration: 5000,
            });
            setIsLoading(false);
          }
        } else if (message.type === "MAINPAY_CLOSE") {
          cleanup();
          setShowOverlay(false);
          toast({
            type: "info",
            title: "결제가 취소되었습니다",
            duration: 3000,
          });
          setIsLoading(false);
        }
      };

      messageHandlerRef.current = handleMessage;
      window.addEventListener("message", handleMessage);

      // ── 4. 팝업 닫힘 감지 ──
      intervalRef.current = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          cleanup();
          setShowOverlay(false);
          toast({
            type: "info",
            title: "결제가 취소되었습니다",
            duration: 3000,
          });
          setIsLoading(false);
        }
      }, 500);
    } catch (err) {
      console.error("[OrderPageClient] handlePayment error:", err);
      toast({
        type: "error",
        title: "결제 처리 중 오류",
        description: "잠시 후 다시 시도해 주세요.",
        duration: 5000,
      });
      setIsLoading(false);
    }
  }, [validate, product, quantity, feeType, user, router, toast, cleanup]);

  // ── 로딩 / 에러 ────────────────────────────────────────────
  if (productLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <AlertCircle size={40} className="text-muted-foreground" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">상품 정보를 불러올 수 없습니다.</p>
        <Button
          variant="link"
          onClick={() => router.back()}
          className="text-sm font-medium text-primary underline underline-offset-2 hover:text-brand-primary-dark"
        >
          이전 페이지로 돌아가기
        </Button>
      </div>
    );
  }

  const feeAmount = calcFeeAmount(product.price, product.fee_rate, product.fee_unit);
  const unitPrice =
    feeType === "included"
      ? product.price + feeAmount
      : product.price;
  const subtotal = unitPrice * quantity;
  const feeSubtotal = feeType === "included" ? feeAmount * quantity : 0;
  const totalAmount = subtotal;

  return (
    <div className="bg-background">
      {/* 결제 팝업 오버레이 */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 cursor-pointer"
          onClick={() => popupRef.current?.focus()}
        >
          <p className="rounded-lg bg-white px-6 py-3 text-sm font-medium text-gray-800 shadow-lg">
            결제 창이 열려 있습니다. 결제를 완료해주세요.
          </p>
        </div>
      )}
      {/* 상단 네비게이션 */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="w-full px-6 lg:px-12 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground h-auto px-2 py-1"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
            <span>뒤로가기</span>
          </Button>
          <span className="text-muted-foreground/40 select-none">|</span>
          <span className="text-sm font-semibold text-foreground">주문/결제</span>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="w-full px-6 lg:px-12 pt-6 md:pt-8 pb-12">
        {/* 페이지 제목 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground md:text-2xl">주문/결제</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            주문 내용을 확인하고 결제를 진행해주세요.
          </p>
        </div>

        {/* 2컬럼 레이아웃 (데스크탑) / 단일 컬럼 (모바일) */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px] lg:gap-8 xl:grid-cols-[1fr_400px]">

          {/* ── 왼쪽 영역 ── */}
          <div className="flex flex-col gap-5">

            {/* (1) 주문 상품 확인 카드 */}
            <section
              className="rounded-xl border border-border bg-card overflow-hidden"
              aria-labelledby="order-product-heading"
            >
              <div className="border-b border-border px-5 py-3.5">
                <h2
                  id="order-product-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  주문 상품
                </h2>
              </div>
              <div className="p-5">
                <div className="flex gap-4">
                  {/* 상품 이미지 */}
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-24 sm:w-24">
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.name}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <span className="text-[13px] text-muted-foreground">이미지 없음</span>
                      </div>
                    )}
                  </div>

                  {/* 상품 정보 */}
                  <div className="flex flex-1 flex-col justify-between gap-2 min-w-0">
                    {/* 카테고리 뱃지 */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-sm bg-brand-primary-soft px-2 py-0.5 text-[13px] font-semibold text-brand-primary-dark">
                        <Tag size={10} strokeWidth={2} />
                        {product.category.name}
                      </span>
                      {/* 수수료 방식 뱃지 */}
                      {feeType === "included" ? (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-success-bg px-2 py-0.5 text-[13px] font-semibold text-success">
                          <BadgeCheck size={11} strokeWidth={2} />
                          수수료 포함
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-sm bg-info-bg px-2 py-0.5 text-[13px] font-semibold text-info">
                          <Info size={11} strokeWidth={2} />
                          수수료 별도
                        </span>
                      )}
                    </div>

                    {/* 상품명 */}
                    <p className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
                      {product.name}
                    </p>

                    {/* 가격 + 수량 */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">
                        {formatPrice(unitPrice)} × {quantity}장
                      </span>
                      <span className="text-base font-bold text-foreground">
                        {formatPrice(subtotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 수수료 별도 안내 */}
                {feeType === "separate" && (
                  <div className="mt-4 flex items-start gap-2 rounded-lg bg-info-bg px-3.5 py-3">
                    <Info
                      size={13}
                      className="mt-0.5 shrink-0 text-info"
                      strokeWidth={2}
                    />
                    <p className="text-sm leading-relaxed text-info">
                      핀 번호 조회 시 수수료{" "}
                      <strong>
                        {formatPrice(feeAmount)} (
                        {formatFeePercent(feeAmount, product.price)})
                      </strong>
                      가 장당 추가 결제됩니다.
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* (2) 구매자 정보 */}
            <section
              className="rounded-xl border border-border bg-card overflow-hidden"
              aria-labelledby="buyer-info-heading"
            >
              <div className="border-b border-border px-5 py-3.5">
                <h2
                  id="buyer-info-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  구매자 정보
                </h2>
              </div>
              <div className="p-5">
                <div className="flex flex-col gap-3">
                  <Label className="text-sm font-semibold text-foreground">
                    수신 번호
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    구매 완료 문자(교환권 링크)는 본인 번호로 발송됩니다.
                  </p>
                  <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/50 px-4 py-3">
                    <MessageSquare
                      size={15}
                      className="shrink-0 text-muted-foreground"
                      strokeWidth={1.75}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {user?.phone ? formatPhone(user.phone) : "전화번호 정보 없음"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* (3) 약관 동의 */}
            <section
              className="rounded-xl border border-border bg-card overflow-hidden"
              aria-labelledby="terms-heading"
            >
              <div className="border-b border-border px-5 py-3.5">
                <h2
                  id="terms-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  구매 동의
                </h2>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {/* 유의사항 목록 */}
                <div className="rounded-lg bg-muted/50 p-4 flex flex-col gap-2">
                  {[
                    "구매한 상품권의 핀 번호 확인 후에는 취소/환불이 불가합니다.",
                    "수수료 별도 방식은 핀 조회 시 추가 결제가 발생합니다.",
                    "교환권 링크는 입력하신 수신 번호로 문자 발송됩니다.",
                    "유효기간: 발행일로부터 5년 (상품에 따라 상이)",
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <ShieldCheck
                        size={13}
                        className="mt-0.5 shrink-0 text-muted-foreground"
                        strokeWidth={1.75}
                      />
                      <span className="text-sm leading-relaxed text-muted-foreground">
                        {text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 약관 동의 체크박스 */}
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="agree-terms"
                    checked={formData.agreeTerms}
                    onCheckedChange={(checked) => handleAgreeTerms(!!checked)}
                    aria-describedby={errors.agreeTerms ? "terms-error" : undefined}
                    className={cn(
                      "mt-0.5",
                      errors.agreeTerms && !formData.agreeTerms
                        ? "border-error"
                        : ""
                    )}
                  />
                  <Label
                    htmlFor="agree-terms"
                    className="text-sm font-medium text-foreground leading-relaxed cursor-pointer"
                  >
                    위 유의사항을 모두 확인하였으며, 구매 진행에 동의합니다.{" "}
                    <span className="text-error">(필수)</span>
                  </Label>
                </div>

                {/* 에러 메시지 */}
                {errors.agreeTerms && (
                  <p
                    id="terms-error"
                    role="alert"
                    className="flex items-center gap-1.5 text-sm text-error"
                  >
                    <AlertCircle size={13} strokeWidth={2} />
                    {errors.agreeTerms}
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* ── 오른쪽 영역: 금액 요약 + 결제 버튼 ── */}
          <div className="lg:sticky lg:top-[57px] h-fit">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* 금액 요약 헤더 */}
              <div className="border-b border-border px-5 py-3.5">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Receipt size={15} className="text-primary" strokeWidth={1.75} />
                  결제 금액 요약
                </h2>
              </div>

              <div className="p-5 flex flex-col gap-3">
                {/* 금액 상세 */}
                <AmountRow
                  label="상품 금액"
                  value={formatPrice(product.price * quantity)}
                />
                <AmountRow
                  label="수수료"
                  value={
                    feeType === "included"
                      ? formatPrice(feeSubtotal)
                      : "핀 번호 확인 시 별도 결제"
                  }
                  isMuted={feeType === "separate"}
                  badge={
                    feeType === "separate" ? (
                      <span className="rounded-sm bg-info-bg px-1.5 py-0.5 text-[13px] font-semibold text-info leading-none">
                        별도
                      </span>
                    ) : undefined
                  }
                />
                <AmountRow
                  label="총 결제금액"
                  value={formatPrice(totalAmount)}
                  isTotal
                />

                {/* 수수료 별도 안내 문구 */}
                {feeType === "separate" && (
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    * 수수료{" "}
                    <span className="font-semibold text-foreground">
                      {formatPrice(feeAmount * quantity)}
                    </span>
                    은 핀 번호 조회 시 별도 결제됩니다.
                  </p>
                )}

                {/* 결제 버튼 */}
                <Button
                  type="button"
                  onClick={handlePayment}
                  disabled={isLoading}
                  aria-busy={isLoading}
                  className="mt-1 h-14 w-full rounded-xl text-base font-bold shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={20} strokeWidth={2} className="animate-spin" />
                      결제 처리 중...
                    </>
                  ) : (
                    <>
                      <CreditCard size={20} strokeWidth={1.75} />
                      {formatPrice(totalAmount)} 결제하기
                    </>
                  )}
                </Button>

                {/* 보안 안내 */}
                <div className="flex items-center justify-center gap-1.5">
                  <ShieldCheck size={12} className="text-muted-foreground" strokeWidth={1.75} />
                  <span className="text-[13px] text-muted-foreground">
                    안전한 암호화 결제가 적용됩니다.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
