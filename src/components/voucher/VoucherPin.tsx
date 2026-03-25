"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  CopyCheck,
  CreditCard,
  KeyRound,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import { VOUCHER_MAX_ATTEMPTS } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
import PinInput from "./PinInput";
import ProductInfoCard from "./ProductInfoCard";
import VoucherProgressBar from "./VoucherProgressBar";
import { useBfcacheReload } from "@/hooks/useBfcacheReload";
import type { VoucherWithDetails } from "@/types";

interface VoucherPinProps {
  voucher: VoucherWithDetails;
  pinNumbers: string[];
}

type PageState = "verify" | "fee" | "paying" | "revealed" | "locked";

const PIN_LENGTH = 4;

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

export default function VoucherPin({ voucher, pinNumbers }: VoucherPinProps) {
  const router = useRouter();
  const { toast } = useToast();
  const firstInputRef = useRef<HTMLInputElement>(null);

  useBfcacheReload();

  const needsFeePay =
    voucher.order.fee_type === "separate" && !voucher.fee_paid && voucher.order.fee_amount > 0;

  // 모바일 수수료 결제 후 복귀 시: sessionStorage에 검증 토큰이 있으면 서버에서 핀 조회
  const [mobileReturnToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const token = sessionStorage.getItem("fee_verification_token");
    if (!token) return null;
    sessionStorage.removeItem("fee_verification_token");
    return token;
  });

  const [pageState, setPageState] = useState<PageState>(
    mobileReturnToken ? "revealed" : voucher.is_password_locked ? "locked" : "verify"
  );
  const [password, setPassword] = useState<string[]>(
    Array(PIN_LENGTH).fill("")
  );
  const [attempts, setAttempts] = useState(voucher.user_password_attempts);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [allCopied, setAllCopied] = useState(false);
  const [revealedPins, setRevealedPins] = useState<string[]>(pinNumbers);
  const [verificationToken, setVerificationToken] = useState<string>(mobileReturnToken ?? "");
  const [showOverlay, setShowOverlay] = useState(false);
  const [isLoadingPins, setIsLoadingPins] = useState(!!mobileReturnToken);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 팝업/인터벌 정리를 위한 ref
  const popupRef = useRef<Window | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageHandlerRef = useRef<((e: MessageEvent) => void) | null>(null);

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

  // 모바일 결제 복귀 시 검증 토큰으로 서버에서 핀 조회
  useEffect(() => {
    if (!mobileReturnToken) return;

    const fetchPins = async () => {
      try {
        const res = await fetch(`/api/vouchers/${voucher.code}/retrieve-pins`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verification_token: mobileReturnToken }),
        });
        const data = await res.json();

        if (data.success && data.data.pins?.length > 0) {
          setRevealedPins(data.data.pins);
        } else {
          // 토큰 만료/무효 시 비밀번호 재입력 화면으로
          toast({
            type: "error",
            title: "핀 번호 조회 실패",
            description: data.error?.message ?? "비밀번호를 다시 입력해주세요.",
            duration: 5000,
          });
          setPageState("verify");
        }
      } catch {
        toast({
          type: "error",
          title: "서버 오류",
          description: "핀 번호를 불러올 수 없습니다. 다시 시도해주세요.",
          duration: 5000,
        });
        setPageState("verify");
      } finally {
        setIsLoadingPins(false);
      }
    };

    fetchPins();
  }, [mobileReturnToken, voucher.code, toast]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      cleanup();
    };
  }, [cleanup]);

  const handleVerify = useCallback(async () => {
    const entered = password.join("");
    if (entered.length < PIN_LENGTH) {
      setErrorMessage("비밀번호 4자리를 모두 입력해주세요.");
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/vouchers/${voucher.code}/unlock-pins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: entered }),
      });
      const data = await res.json();

      if (data.success) {
        // 서버에서 발급한 검증 토큰 저장 (비밀번호 대체)
        if (data.data.verification_token) {
          setVerificationToken(data.data.verification_token);
        }
        // 서버에서 복호화된 핀 번호 수신
        if (data.data.pins && data.data.pins.length > 0) {
          setRevealedPins(data.data.pins);
        }
        if (needsFeePay) {
          setPageState("fee");
        } else {
          setPageState("revealed");
        }
      } else {
        if (data.error?.code === "VOUCHER_LOCKED" || data.data?.is_locked) {
          setPageState("locked");
          setErrorMessage(null);
        } else {
          const newAttempts = data.data?.attempts ?? attempts + 1;
          setAttempts(newAttempts);
          setPassword(Array(PIN_LENGTH).fill(""));
          setErrorMessage(data.error?.message ?? "비밀번호가 올바르지 않습니다.");
          setTimeout(() => firstInputRef.current?.focus(), 50);
        }
      }
    } catch {
      setErrorMessage("서버 오류가 발생했습니다. 다시 시도해주세요.");
    }

    setIsVerifying(false);
  }, [password, attempts, needsFeePay, voucher.code]);

  const handleFeePay = useCallback(async () => {
    setPageState("paying");

    const totalFee = voucher.order.fee_amount * voucher.order.quantity;

    try {
      // ── 1. 수수료 결제 준비 API 호출 ──
      const prepareRes = await fetch(
        `/api/vouchers/${voucher.code}/fee-payment/prepare`,
        { method: "POST" }
      );
      const prepareData = await prepareRes.json();

      if (!prepareData.success) {
        toast({
          type: "error",
          title: "결제 준비 실패",
          description: prepareData.error?.message ?? "잠시 후 다시 시도해 주세요.",
          duration: 5000,
        });
        setPageState("fee");
        return;
      }

      const {
        payment_key: paymentKey,
        amount,
        next_pc_url: nextPcUrl,
        next_mobile_url: nextMobileUrl,
        mbr_ref_no: mbrRefNo,
      } = prepareData.data;

      // ── 2. 모바일/PC 분기하여 결제창 열기 ──
      const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      if (isMobile && nextMobileUrl) {
        // 모바일: 결제 상태를 sessionStorage에 저장 후 리다이렉트
        // 비밀번호 대신 검증 토큰을 저장 (보안 개선)
        sessionStorage.setItem("mainpay_fee_pending", JSON.stringify({ paymentKey, mbrRefNo, amount, verificationToken }));
        sessionStorage.setItem("mainpay_fee_voucher_code", voucher.code);
        // 검증 토큰도 별도 저장 (결제 완료 후 핀 조회용)
        if (verificationToken) {
          sessionStorage.setItem("fee_verification_token", verificationToken);
        }
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
        "mainpay_fee",
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
        setPageState("fee");
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
            toast({
              type: "info",
              title: "결제 승인 처리 중...",
              duration: 3000,
            });

            // ── 4. 수수료 결제 승인 API 호출 ──
            const confirmRes = await fetch(
              `/api/vouchers/${voucher.code}/fee-payment/confirm`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  payment_key: paymentKey,
                  amount,
                  auth_token: authToken,
                  mbr_ref_no: mbrRefNo,
                  verification_token: verificationToken,
                }),
              }
            );
            const confirmData = await confirmRes.json();

            if (!confirmData.success) {
              toast({
                type: "error",
                title: "결제 승인 실패",
                description: confirmData.error?.message ?? "잠시 후 다시 시도해 주세요.",
                duration: 5000,
              });
              setPageState("fee");
              return;
            }

            // ── 5. 핀 번호 표시 ──
            toast({
              type: "success",
              title: "수수료 결제가 완료되었습니다",
              description: `${formatPrice(totalFee)} 결제 승인`,
              duration: 3000,
            });

            // 서버에서 반환한 복호화된 핀 번호로 갱신
            if (confirmData.data.pins && confirmData.data.pins.length > 0) {
              setRevealedPins(confirmData.data.pins);
            }

            setPageState("revealed");
          } catch {
            toast({
              type: "error",
              title: "처리 중 오류",
              description: "결제 처리 중 오류가 발생했습니다. 고객센터에 문의해 주세요.",
              duration: 5000,
            });
            setPageState("fee");
          }
        } else if (message.type === "MAINPAY_CLOSE") {
          cleanup();
          setShowOverlay(false);
          toast({
            type: "info",
            title: "결제가 취소되었습니다",
            duration: 3000,
          });
          setPageState("fee");
        }
      };

      messageHandlerRef.current = handleMessage;
      window.addEventListener("message", handleMessage);

      // ── 팝업 닫힘 감지 ──
      intervalRef.current = setInterval(() => {
        if (popupRef.current && popupRef.current.closed) {
          cleanup();
          setShowOverlay(false);
          toast({
            type: "info",
            title: "결제가 취소되었습니다",
            duration: 3000,
          });
          setPageState("fee");
        }
      }, 500);
    } catch {
      toast({
        type: "error",
        title: "결제 처리 중 오류",
        description: "잠시 후 다시 시도해 주세요.",
        duration: 5000,
      });
      setPageState("fee");
    }
  }, [voucher.order.fee_amount, voucher.order.quantity, voucher.code, toast, cleanup, verificationToken]);

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        return success;
      } catch {
        return false;
      }
    }
  }, []);

  const handleCopySingle = useCallback(async (pin: string, index: number) => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);

    const success = await copyToClipboard(pin);

    if (success) {
      setCopiedIndex(index);
      setAllCopied(false);
      copyTimerRef.current = setTimeout(() => setCopiedIndex(null), 2000);
      toast({
        type: "success",
        title: "핀 번호가 복사되었습니다",
        description: "클립보드에 복사되었습니다. 필요한 곳에 붙여넣기 해주세요.",
        duration: 3000,
      });
    } else {
      toast({
        type: "error",
        title: "복사 실패",
        description: "핀 번호를 직접 길게 눌러 복사해주세요.",
        duration: 5000,
      });
    }
  }, [copyToClipboard, toast]);

  const handleCopyAll = useCallback(async () => {
    if (revealedPins.length === 0) return;
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);

    const allPins = revealedPins.join("\n");
    const success = await copyToClipboard(allPins);

    if (success) {
      setAllCopied(true);
      setCopiedIndex(null);
      copyTimerRef.current = setTimeout(() => setAllCopied(false), 2000);
      toast({
        type: "success",
        title: `핀 번호 ${revealedPins.length}개가 모두 복사되었습니다`,
        description: "클립보드에 복사되었습니다.",
        duration: 3000,
      });
    } else {
      toast({
        type: "error",
        title: "복사 실패",
        description: "핀 번호를 직접 길게 눌러 복사해주세요.",
        duration: 5000,
      });
    }
  }, [revealedPins, copyToClipboard, toast]);

  // ── 잠금 상태 ──────────────────────────────────────
  if (pageState === "locked") {
    return (
      <div className="w-full">
        {/* 프로세스 바 */}
        <VoucherProgressBar currentStep={4} />

        {/* 큰 헤딩 */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
          입력이 잠겼어요
        </h1>
        <p className="text-[16px] text-muted-foreground mb-6">
          비밀번호를 {VOUCHER_MAX_ATTEMPTS}회 잘못 입력하여 잠금 처리되었습니다.
        </p>

        <ProductInfoCard voucher={voucher} />

        <div className="mt-5 rounded-xl border border-error/20 bg-error-bg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lock size={18} className="text-error" />
            <span className="text-[16px] font-bold text-error">잠금 안내</span>
          </div>
          <p className="text-[15px] text-muted-foreground leading-relaxed">
            주문번호 <strong className="text-foreground">{voucher.order.order_number}</strong>와 함께 고객센터에 문의해주세요.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={() => router.replace(`/v/${voucher.code}/actions`)}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} />
            돌아가기
          </button>
          <Link
            href="/"
            className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    );
  }

  // ── 수수료 결제 화면 ────────────────────────────────
  if (pageState === "fee" || pageState === "paying") {
    const isPaying = pageState === "paying";
    const quantity = voucher.order.quantity;
    const totalFee = voucher.order.fee_amount * quantity;
    return (
      <>
      {/* 결제 팝업 오버레이 */}
      {showOverlay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 cursor-pointer"
          onClick={() => popupRef.current?.focus()}
        >
          <p className="rounded-lg bg-white px-6 py-3 text-[15px] font-medium text-gray-800 shadow-lg">
            결제 창이 열려 있습니다. 결제를 완료해주세요.
          </p>
        </div>
      )}
      <div className="w-full">
        {/* 프로세스 바 */}
        <VoucherProgressBar currentStep={4} />

        {/* 큰 헤딩 */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
          수수료를 결제해주세요
        </h1>
        <p className="text-[16px] text-muted-foreground mb-6">
          핀 번호 {quantity}개 확인을 위해 수수료를 결제해주세요.
        </p>

        <ProductInfoCard voucher={voucher} />

        <div className="mt-5 rounded-xl border border-border bg-card p-5">
          <div className="mb-1 flex items-center gap-1.5">
            <CreditCard size={15} className="text-muted-foreground" />
            <span className="text-[15px] font-semibold text-foreground">
              결제 금액
            </span>
          </div>

          <div className="mt-3 rounded-lg bg-muted/50 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-[15px]">
              <span className="text-muted-foreground">상품 금액</span>
              <span className="font-medium text-foreground">
                {formatPrice(voucher.order.product_price)} x {quantity}개
              </span>
            </div>
            <div className="flex items-center justify-between text-[15px]">
              <span className="text-muted-foreground">수수료</span>
              <span className="font-bold text-foreground">
                {formatPrice(voucher.order.fee_amount)} x {quantity}개 = {formatPrice(totalFee)}
              </span>
            </div>
            <div className="border-t border-border pt-2">
              <div className="flex items-center justify-between text-[15px]">
                <span className="font-medium text-foreground">결제 금액</span>
                <span className="text-[16px] font-bold text-foreground">
                  {formatPrice(totalFee)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleFeePay}
          disabled={isPaying}
          className={cn(
            "mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-bold transition-all",
            "bg-foreground text-background hover:bg-foreground/80 active:scale-[0.98]",
            isPaying && "opacity-70 cursor-not-allowed"
          )}
          aria-busy={isPaying}
        >
          {isPaying ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              결제 중...
            </>
          ) : (
            <>
              <CreditCard size={16} />
              {formatPrice(totalFee)} 결제하기
            </>
          )}
        </button>

        <div className="mt-3 space-y-2">
          <button
            onClick={() => router.replace(`/v/${voucher.code}/actions`)}
            disabled={isPaying}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} />
            돌아가기
          </button>
          <Link
            href="/"
            className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
      </>
    );
  }

  // ── 핀 번호 표시 화면 ───────────────────────────────
  if (pageState === "revealed") {
    // 모바일 복귀 시 핀 로딩 중
    if (isLoadingPins) {
      return (
        <div className="w-full">
          <VoucherProgressBar currentStep={4} />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
            핀 번호를 불러오는 중...
          </h1>
          <p className="text-[16px] text-muted-foreground mb-6">
            잠시만 기다려주세요.
          </p>
          <ProductInfoCard voucher={voucher} />
          <div className="mt-8 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-foreground border-t-transparent" />
          </div>
        </div>
      );
    }

    const isSingle = revealedPins.length <= 1;

    return (
      <div className="w-full">
        {/* 프로세스 바 */}
        <VoucherProgressBar currentStep={4} />

        {/* 큰 헤딩 */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
          핀 번호를 확인하세요
        </h1>
        <p className="text-[16px] text-muted-foreground mb-6">
          핀 번호를 복사하여 사용해주세요.
        </p>

        <ProductInfoCard voucher={voucher} />

        {/* 성공 Badge */}
        <div className="mt-5 flex items-center justify-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-4 py-2">
            <CheckCircle2 size={15} className="text-success" />
            <span className="text-[15px] font-semibold text-success">
              인증 완료 {!isSingle && `- 핀 ${revealedPins.length}개`}
            </span>
          </div>
        </div>

        {/* 전체 복사 버튼 (2개 이상일 때) */}
        {!isSingle && revealedPins.length > 0 && (
          <button
            onClick={handleCopyAll}
            className={cn(
              "mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-medium transition-all",
              allCopied
                ? "bg-success text-white"
                : "border border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            {allCopied ? (
              <>
                <CopyCheck size={15} />
                전체 복사 완료!
              </>
            ) : (
              <>
                <Copy size={15} />
                핀 번호 {revealedPins.length}개 전체 복사
              </>
            )}
          </button>
        )}

        {/* 핀 번호 리스트 */}
        {revealedPins.length === 0 ? (
          <div className="mt-4 rounded-xl border-2 border-error/30 bg-error-bg p-5 text-center">
            <p className="text-[15px] text-error">핀 번호를 불러올 수 없습니다</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            {revealedPins.map((pin, index) => (
              <div
                key={index}
                className="rounded-xl border-2 border-border bg-muted/30 p-4"
              >
                {!isSingle && (
                  <p className="mb-1 text-[14px] font-medium text-muted-foreground">
                    #{index + 1}
                  </p>
                )}
                <p className="select-all text-center text-xl font-bold tracking-widest text-foreground sm:text-2xl">
                  {pin}
                </p>
                <button
                  onClick={() => handleCopySingle(pin, index)}
                  className={cn(
                    "mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[14px] font-medium transition-all",
                    copiedIndex === index
                      ? "bg-success text-white"
                      : "border border-border bg-card text-foreground hover:bg-muted"
                  )}
                >
                  {copiedIndex === index ? (
                    <>
                      <CheckCircle2 size={13} />
                      복사 완료!
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      복사
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 안내 */}
        <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-warning-bg px-3 py-2.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-[14px] leading-relaxed text-warning">
            핀 번호는 타인에게 절대 공유하지 마세요. 핀 번호 유출로 인한 피해는
            복구가 불가합니다.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={() => router.replace(`/v/${voucher.code}/actions`)}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft size={15} />
            돌아가기
          </button>
          <Link
            href="/"
            className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    );
  }

  // ── 비밀번호 입력 화면 (verify) ─────────────────────
  const isFilled = password.every((d) => d !== "");

  return (
    <div className="w-full">
      {/* 프로세스 바 */}
      <VoucherProgressBar currentStep={4} />

      {/* 큰 헤딩 */}
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
        비밀번호를 입력해주세요
      </h1>
      <p className="text-[16px] text-muted-foreground mb-6">
        설정한 비밀번호 <strong className="text-foreground">4자리</strong>를 입력해주세요.
      </p>

      <ProductInfoCard voucher={voucher} />

      {/* 비밀번호 입력 영역 */}
      <div className="mt-5">
        <div className="mb-1 flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-muted-foreground" />
          <label className="text-[14px] font-medium text-foreground">
            비밀번호 (숫자 4자리)
          </label>
        </div>
        <PinInput
          length={PIN_LENGTH}
          value={password}
          onChange={(value) => {
            setPassword(value);
            setErrorMessage(null);
          }}
          disabled={isVerifying}
          hasError={!!errorMessage}
          autoFocus
          label="비밀번호"
          type="password"
          firstInputRef={firstInputRef}
        />

        {/* 에러 메시지 */}
        {errorMessage && (
          <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-error-bg px-3 py-2">
            <AlertCircle size={13} className="mt-0.5 shrink-0 text-error" />
            <p className="text-[15px] leading-snug text-error">
              {errorMessage}
            </p>
          </div>
        )}

        {/* 시도 횟수 (1회 이상 실패 시) */}
        {attempts > 0 && !errorMessage && (
          <p className="mt-3 text-center text-[14px] text-muted-foreground">
            실패 {attempts}/{VOUCHER_MAX_ATTEMPTS}회
          </p>
        )}
      </div>

      <button
        onClick={handleVerify}
        disabled={!isFilled || isVerifying}
        aria-busy={isVerifying}
        className={cn(
          "mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[16px] font-bold transition-all",
          isFilled && !isVerifying
            ? "bg-foreground text-background hover:bg-foreground/80 active:scale-[0.98]"
            : "cursor-not-allowed bg-muted text-muted-foreground"
        )}
      >
        {isVerifying ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
            확인 중...
          </>
        ) : (
          <>
            <KeyRound size={16} />
            핀 번호 확인
            <ArrowRight size={16} />
          </>
        )}
      </button>

      <div className="mt-3 space-y-2">
        <button
          onClick={() => router.replace(`/v/${voucher.code}/actions`)}
          disabled={isVerifying}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft size={15} />
          돌아가기
        </button>
        <Link
          href="/"
          className="flex h-12 w-full items-center justify-center rounded-xl border border-border bg-card text-[15px] font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          홈으로 이동
        </Link>
      </div>
    </div>
  );
}
