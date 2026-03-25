import Link from "next/link";
import { Phone, Clock } from "lucide-react";

const FOOTER_LINK_GROUPS = [
  {
    title: "서비스 안내",
    links: [
      { label: "이용약관", href: "/terms" },
      { label: "개인정보처리방침", href: "/privacy" },
      { label: "환불정책", href: "/refund-policy" },
    ],
  },
  {
    title: "이용안내",
    links: [
      { label: "이용가이드", href: "/guide" },
      { label: "선물가이드", href: "/guide/gift" },
    ],
  },
  {
    title: "고객지원",
    links: [
      { label: "FAQ", href: "/support/faq" },
      { label: "공지사항", href: "/support/notice" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="container-main py-10 lg:py-12">
        {/* 상단: 링크 그리드 + 고객센터 */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:gap-12">
          {/* 링크 그룹 3개 */}
          {FOOTER_LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 text-[14px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {group.title}
              </h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[14px] font-medium text-secondary-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* 고객센터 */}
          <div>
            <h3 className="mb-3 text-[14px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
              고객센터
            </h3>
            <div className="flex items-center gap-1.5">
              <Phone size={16} strokeWidth={2} className="text-muted-foreground" />
              <span className="text-[20px] font-bold tracking-[-0.02em] text-foreground">
                1811-0689
              </span>
            </div>
            <div className="mt-2 flex items-start gap-1.5">
              <Clock size={14} strokeWidth={1.75} className="mt-[3px] flex-shrink-0 text-muted-foreground" />
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                평일 09:00 ~ 18:00<br />
                <span className="text-muted-foreground">(점심 12:00 ~ 13:00)</span>
              </p>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div className="my-8 border-t border-neutral-200" />

        {/* 하단: 브랜드 + 사업자 정보 */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* 브랜드 워드마크 */}
          <Link
            href="/"
            className="text-[20px] font-bold tracking-[-0.04em] text-foreground transition-opacity hover:opacity-60"
          >
            ticketpin
          </Link>

          {/* 사업자 정보 */}
          <div className="flex flex-col gap-1">
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              (주)티켓매니아 &nbsp;|&nbsp; 대표: OOO &nbsp;|&nbsp; 사업자등록번호: 359-86-01899
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              통신판매업신고: 2025-서울성동-1648 &nbsp;|&nbsp; 주소: 서울특별시 성동구 성수일로8길 55, A동 6층 7호
            </p>
            <p className="mt-2 text-[14px] font-medium text-muted-foreground">
              Copyright &copy; 2026 ticketpin. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
