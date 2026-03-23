"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ShieldCheck,
  ArrowLeft,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  IdentityVerificationModal,
  type VerificationResult,
} from "@/components/ui/identity-verification-modal";

interface FindIdResult {
  username: string;
  joinedAt: string;
}

// Step 1: 본인인증
function Step1({
  onVerified,
}: {
  onVerified: (result: VerificationResult) => void;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-10 shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-foreground">아이디 찾기</h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          가입 시 등록한 휴대폰 번호로 본인인증을 진행해 주세요.
        </p>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="h-[52px] w-full rounded-xl bg-neutral-950 text-base font-semibold text-white hover:bg-neutral-800 active:scale-[0.99]"
        >
          <ShieldCheck size={17} />
          본인인증하기
        </Button>

        <div className="mt-7 space-y-3.5 text-center">
          <p className="text-sm text-muted-foreground">
            비밀번호를 잊으셨나요?{" "}
            <Link
              href="/auth/reset-password"
              className="font-semibold text-foreground hover:opacity-70 transition-opacity duration-150"
            >
              비밀번호 재설정
            </Link>
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <ArrowLeft size={14} />
            로그인으로 돌아가기
          </Link>
        </div>
      </div>

      <IdentityVerificationModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        purpose="find-id"
        onVerified={(result) => {
          setIsModalOpen(false);
          onVerified(result);
        }}
      />
    </>
  );
}

// Step 2: API 호출 + 결과 표시
function Step2({ verification }: { verification: VerificationResult }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<FindIdResult | null>(null);
  const [error, setError] = useState("");
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchId = async () => {
      try {
        const res = await fetch("/api/auth/find-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: verification.name,
            phone: verification.phone,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error?.message || "아이디 찾기에 실패했습니다.");
          return;
        }

        setResult(data.data);
      } catch {
        setError("서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchId();
  }, [verification.name, verification.phone]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-12 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm text-muted-foreground">계정을 조회하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white px-8 py-10 shadow-sm">
        <div className="flex flex-col items-center text-center mb-7">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
            <AlertCircle className="text-foreground" size={28} strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold text-foreground">아이디를 찾을 수 없습니다</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => router.push("/auth/find-id")}
            className="h-[52px] w-full rounded-xl border-neutral-300 text-base font-medium text-foreground hover:border-foreground hover:bg-white"
          >
            다시 시도하기
          </Button>
          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
          >
            <ArrowLeft size={14} />
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* 본인인증 완료 배너 */}
      <div className="flex items-center gap-2.5 bg-neutral-950 px-6 py-3.5">
        <CheckCircle2 className="text-white shrink-0" size={16} strokeWidth={2.5} />
        <span className="text-sm font-semibold text-white">본인인증 완료</span>
      </div>

      <div className="px-8 py-8">
        <h2 className="mb-1.5 text-xl font-bold text-foreground">아이디 찾기 결과</h2>
        <p className="mb-7 text-sm text-muted-foreground">
          본인인증으로 확인된 계정 정보입니다.
        </p>

        {/* 아이디 결과 카드 */}
        <div className="mb-7 rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            회원 아이디
          </p>
          <p className="text-2xl font-bold tracking-wide text-foreground">
            {result?.username}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            가입일: {result?.joinedAt}
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => router.push("/auth/login")}
            className="h-[52px] w-full rounded-xl bg-neutral-950 text-base font-semibold text-white hover:bg-neutral-800 active:scale-[0.99]"
          >
            <LogIn size={17} />
            로그인하기
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push("/auth/reset-password")}
            className="h-[52px] w-full rounded-xl border-neutral-300 text-base font-medium text-secondary-foreground hover:border-foreground hover:text-foreground hover:bg-white"
          >
            비밀번호 재설정하기
          </Button>
        </div>
      </div>
    </div>
  );
}

// 메인 페이지
export default function FindIdPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [verification, setVerification] = useState<VerificationResult | null>(null);

  return (
    <div className="w-full">
      <div
        key={step}
        className="animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        {step === 1 && (
          <Step1
            onVerified={(result) => {
              setVerification(result);
              setStep(2);
            }}
          />
        )}
        {step === 2 && verification && <Step2 verification={verification} />}
      </div>
    </div>
  );
}
