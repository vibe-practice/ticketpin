import Link from "next/link";

export default function VoucherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 바우처 헤더 */}
      <header className="border-b border-border">
        <div className="flex items-center justify-between max-w-3xl mx-auto px-4 sm:px-6 h-14">
          <Link href="/" className="text-lg font-bold text-foreground tracking-tight">
            티켓핀
          </Link>
          <Link
            href="/my/vouchers"
            className="text-[14px] text-muted-foreground hover:text-foreground transition-colors"
          >
            내 상품권
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-lg">
          {children}
        </div>
      </main>
    </div>
  );
}
