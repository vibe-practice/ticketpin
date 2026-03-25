"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, AlertCircle, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useIdentityVerification } from "@/hooks/use-identity-verification";

// -------------------------------------------------------------------
// 본인인증 모달 (다날 T-PAY UAS 연동)
// - "본인인증 하기" 버튼 클릭 → 다날 팝업 열림 → 인증 완료 → 결과 반환
// - VerificationResult 인터페이스는 기존과 동일하게 유지 (소비자 코드 변경 최소화)
// -------------------------------------------------------------------

export interface VerificationResult {
  name: string;
  phone: string;
  verified: boolean;
  username?: string;
  resetToken?: string;
}

interface IdentityVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: (result: VerificationResult) => void;
  purpose?: "register" | "find-id" | "reset-password";
}

export function IdentityVerificationModal({
  open,
  onClose,
  onVerified,
  purpose = "register",
}: IdentityVerificationModalProps) {
  // 매 열림마다 훅을 초기화하기 위해 open=false 시 언마운트.
  // 내부 컴포넌트(IdentityVerificationModalInner)가 조건부 마운트되므로
  // 훅 호출 순서가 변하지 않아 React 훅 규칙을 준수한다.
  if (!open) return null;

  return (
    <IdentityVerificationModalInner
      open={open}
      onClose={onClose}
      onVerified={onVerified}
      purpose={purpose}
    />
  );
}

function IdentityVerificationModalInner({
  open,
  onClose,
  onVerified,
  purpose = "register",
}: IdentityVerificationModalProps) {
  const router = useRouter();
  const [existingUsername, setExistingUsername] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const { startVerification, isLoading, error, popupRef } = useIdentityVerification({
    purpose,
    onVerified: (result) => {
      onVerified(result);
    },
    onExistingUser: (username) => {
      setExistingUsername(username);
    },
    onNotFound: () => {
      setNotFound(true);
    },
    onError: () => {
      // error state는 훅 내부에서 관리, UI에 표시됨
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // 팝업이 열려 있으면 닫기
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="text-primary" size={18} />
            </div>
            <DialogTitle>본인인증</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            본인인증을 진행합니다. 인증 버튼을 클릭하면 다날 인증 팝업이 열립니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 계정을 찾을 수 없음 (비밀번호 재설정) */}
          {notFound ? (
            <>
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3">
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0 text-destructive"
                />
                <p className="text-sm text-destructive">
                  인증하신 정보와 일치하는 계정을 찾을 수 없습니다.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/auth/login");
                }}
                className="h-11 w-full"
              >
                확인
              </Button>
            </>
          ) : /* 이미 가입된 계정 안내 */
          existingUsername ? (
            <>
              <div className="flex items-start gap-2 rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3">
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0 text-secondary-foreground"
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    이미 가입된 계정이 있습니다.
                  </p>
                  <p className="text-sm text-secondary-foreground">
                    가입된 아이디: <span className="font-mono font-semibold">{existingUsername}</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="h-11 flex-1"
                >
                  확인
                </Button>
                <Button
                  type="button"
                  asChild
                  className="h-11 flex-1"
                >
                  <Link href="/auth/find-id">
                    <Search size={16} />
                    아이디 찾기
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* 안내 문구 */}
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  본인인증 버튼을 클릭하면 인증 팝업이 열립니다.
                  <br />
                  휴대폰 SMS 인증을 통해 본인확인이 진행됩니다.
                </p>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3">
                  <AlertCircle
                    size={16}
                    className="mt-0.5 shrink-0 text-destructive"
                  />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {/* 인증 버튼 */}
              <Button
                type="button"
                disabled={isLoading}
                onClick={startVerification}
                className="h-12 w-full text-sm font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    인증 진행 중...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    본인인증 하기
                  </>
                )}
              </Button>

              {isLoading && (
                <p className="text-center text-[14px] text-muted-foreground">
                  인증 팝업에서 인증을 완료해 주세요.
                  <br />
                  팝업이 보이지 않으면 팝업 차단을 해제해 주세요.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
