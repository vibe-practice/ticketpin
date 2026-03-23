"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="ko">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#fafafa",
            padding: "1rem",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                marginBottom: "1rem",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <AlertTriangle size={48} color="#ef4444" opacity={0.4} />
            </div>
            <h1
              style={{
                marginBottom: "0.5rem",
                fontSize: "2.25rem",
                fontWeight: "bold",
                color: "#18181b",
              }}
            >
              500
            </h1>
            <h2
              style={{
                marginBottom: "1rem",
                fontSize: "1.25rem",
                fontWeight: 600,
                color: "#18181b",
              }}
            >
              서버 오류가 발생했어요
            </h2>
            <p
              style={{
                marginBottom: "2rem",
                color: "#71717a",
              }}
            >
              일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
            </p>
            <button
              onClick={() => reset()}
              style={{
                height: "2.75rem",
                padding: "0 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                backgroundColor: "#7c3aed",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
