import Link from "next/link";
import { ShieldX } from "lucide-react";

export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <ShieldX size={48} className="text-warning/40" />
        </div>
        <h1 className="mb-2 text-4xl font-bold text-foreground">403</h1>
        <h2 className="mb-4 text-xl font-semibold text-foreground">접근 권한이 없어요</h2>
        <p className="mb-8 text-muted-foreground">
          이 페이지에 접근할 권한이 없습니다.
          <br />
          로그인 후 다시 시도해주세요.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/auth/login"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            로그인
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
