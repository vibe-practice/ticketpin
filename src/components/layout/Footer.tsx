import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="px-6 py-10 lg:px-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* 이용안내 */}
          <div>
            <h3 className="mb-3 text-[15px] font-semibold text-foreground">이용안내</h3>
            <ul className="space-y-2 text-[15px] text-muted-foreground">
              <li>
                <Link href="/guide" className="hover:text-foreground">
                  이용방법
                </Link>
              </li>
              <li>
                <Link href="/guide/gift" className="hover:text-foreground">
                  선물하기 안내
                </Link>
              </li>
            </ul>
          </div>

          {/* 고객센터 */}
          <div>
            <h3 className="mb-3 text-[15px] font-semibold text-foreground">고객센터</h3>
            <ul className="space-y-2 text-[15px] text-muted-foreground">
              <li>
                <Link href="/support/faq" className="hover:text-foreground">
                  자주 묻는 질문
                </Link>
              </li>
              <li>
                <Link href="/support/notice" className="hover:text-foreground">
                  공지사항
                </Link>
              </li>
            </ul>
          </div>

          {/* 약관/정책 */}
          <div>
            <h3 className="mb-3 text-[15px] font-semibold text-foreground">약관/정책</h3>
            <ul className="space-y-2 text-[15px] text-muted-foreground">
              <li>
                <Link href="/terms" className="hover:text-foreground">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-foreground">
                  환불/취소 정책
                </Link>
              </li>
            </ul>
          </div>

          {/* 회사정보 */}
          <div>
            <h3 className="mb-3 text-[15px] font-bold text-primary">티켓핀</h3>
            <p className="text-[15px] text-muted-foreground">신뢰할 수 있는 기프티콘 플랫폼</p>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 space-y-1">
          <p className="text-[13px] text-muted-foreground">
            상호명 : 티켓핀 | 대표자명 : 윤진수 | 사업자등록번호 : 359-86-01899
          </p>
          <p className="text-[13px] text-muted-foreground">
            통신판매업 : 2025-서울성동-1648 | 고객센터 : 1811-0689
          </p>
          <p className="text-[13px] text-muted-foreground">
            주소 : 서울특별시 성동구 성수일로8길 55, A동 6층 7호
          </p>
          <p className="mt-3 text-[13px] text-muted-foreground">
            © 2026 티켓핀. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
