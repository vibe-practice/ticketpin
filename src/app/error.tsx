"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <AlertTriangle size={48} className="text-error/40" />
        </div>
        <h1 className="mb-2 text-4xl font-bold text-foreground">500</h1>
        <h2 className="mb-4 text-xl font-semibold text-foreground">서버 오류가 발생했어요</h2>
        <p className="mb-8 text-muted-foreground">
          일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>
        <Button
          onClick={() => reset()}
          className="h-11 px-6"
        >
          다시 시도
        </Button>
      </div>
    </div>
  );
}
