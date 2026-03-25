import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";
import { AuthProvider } from "@/components/providers/AuthProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "티켓매니아 - 상품권 교환권 플랫폼",
    template: "%s | 티켓매니아",
  },
  description: "신뢰할 수 있는 상품권 교환권 플랫폼. 다양한 상품권을 간편하게 구매하세요.",
  keywords: ["상품권", "교환권", "기프티콘", "티켓매니아"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* CDN preconnect로 DNS/TLS 사전 연결 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        {/* Pretendard Variable 폰트 (font-display: swap 포함 CSS) */}
        <link
          rel="preload"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="antialiased">
          <AuthProvider>
            <ToastProvider>
              <ConfirmDialogProvider>
                {children}
              </ConfirmDialogProvider>
            </ToastProvider>
          </AuthProvider>
        </body>
    </html>
  );
}
