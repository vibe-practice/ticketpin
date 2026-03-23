"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ShieldCheck,
  User,
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
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <User className="text-primary" size={26} strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-bold text-foreground">아이디 찾기</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            가입 시 등록한 휴대폰 번호로 본인인증을 진행해 주세요.
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="group relative h-12 w-full overflow-hidden text-sm font-semibold"
        >
          {/* Shine Sweep 효과 */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full"
          />
          <ShieldCheck size={16} />
          본인인증하기
        </Button>

        <div className="mt-6 space-y-3 text-center text-sm text-muted-foreground">
          <p>
            비밀번호를 잊으셨나요?{" "}
            <Link
              href="/auth/reset-password"
              className="font-medium text-primary hover:underline underline-offset-2"
            >
              비밀번호 재설정
            </Link>
          </p>
          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={13} />
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

  // 마운트 시 API 호출
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
      <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <Spinner />
          <p className="text-sm text-muted-foreground">계정을 조회하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertCircle className="text-destructive" size={26} strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold text-foreground">아이디를 찾을 수 없습니다</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </div>

        <div className="mt-6 space-y-3">
          <Button
            variant="outline"
            onClick={() => router.push("/auth/find-id")}
            className="h-11 w-full"
          >
            다시 시도하기
          </Button>
          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={13} />
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* 본인인증 완료 배너 */}
      <div className="flex items-center gap-2.5 bg-green-50 border-b border-green-200 px-6 py-3.5">
        <CheckCircle2 className="text-green-600 shrink-0" size={18} strokeWidth={2} />
        <span className="text-sm font-semibold text-green-700">본인인증 완료</span>
      </div>

      <div className="p-8">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-foreground">아이디 찾기 결과</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            본인인증으로 확인된 계정 정보입니다.
          </p>
        </div>

        {/* 아이디 결과 카드 */}
        <div className="mb-6 rounded-xl border border-border bg-gray-50 px-6 py-5">
          <p className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
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
          {/* 로그인 버튼 */}
          <Button
            onClick={() => router.push("/auth/login")}
            className="group relative h-12 w-full overflow-hidden text-sm font-semibold"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full"
            />
            <LogIn size={16} />
            로그인하기
          </Button>

          {/* 비밀번호 재설정 */}
          <Button
            variant="outline"
            onClick={() => router.push("/auth/reset-password")}
            className="h-11 w-full"
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
