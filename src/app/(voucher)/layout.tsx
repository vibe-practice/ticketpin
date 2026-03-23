import Link from "next/link";

export default function VoucherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 바우처 독립 헤더: 로고만 상단 중앙에 작게 */}
      <header className="flex items-center justify-center py-4">
        <Link href="/" className="text-lg font-semibold text-primary">
          티켓핀
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center px-4 py-6">{children}</main>
    </div>
  );
}
