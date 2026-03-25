"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Phone, Clock, HelpCircle, Bell, BookOpen, LogIn } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

interface SideBannerItem {
  id: string;
  image_url: string;
  link_url: string;
  alt_text: string;
}

export function HomeSidebar() {
  const { user } = useAuthStore();
  const [sideBanners, setSideBanners] = useState<SideBannerItem[]>([]);

  useEffect(() => {
    async function fetchSideBanners() {
      try {
        const res = await fetch("/api/side-banners");
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          setSideBanners(json.data);
        }
      } catch {
        // API 실패 시 사이드 배너 숨김
      }
    }
    fetchSideBanners();
  }, []);

  return (
    <aside className="flex flex-col gap-4 w-full">
      {/* ── 로그인 카드 / 유저 카드 ── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        {user ? (
          /* 로그인 상태 */
          <div>
            <p className="text-[16px] font-bold text-foreground">
              {user.name || user.username}님, 안녕하세요
            </p>
            <p className="mt-1 text-[14px] text-muted-foreground">
              오늘도 좋은 하루 되세요.
            </p>
            <Link
              href="/my"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-neutral-950 py-2.5 text-[14px] font-semibold text-white transition hover:bg-neutral-800"
            >
              마이페이지
            </Link>
            <div className="mt-3 flex items-center justify-center gap-4 text-[14px] text-muted-foreground">
              <Link href="/my/orders" className="hover:text-foreground transition-colors">
                주문내역
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/my/vouchers" className="hover:text-foreground transition-colors">
                내 상품권
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/my/gifts/sent" className="hover:text-foreground transition-colors">
                선물내역
              </Link>
            </div>
          </div>
        ) : (
          /* 비로그인 상태 */
          <div>
            <p className="text-[16px] font-bold text-foreground">
              지금 바로 티켓핀과 함께하세요
            </p>
            <Link
              href="/auth/login"
              className="mt-4 flex items-center justify-center gap-1.5 rounded-lg bg-neutral-950 py-2.5 text-[14px] font-semibold text-white transition hover:bg-neutral-800"
            >
              <LogIn size={15} strokeWidth={2} />
              로그인
            </Link>
            <div className="mt-3 flex items-center justify-center gap-2 text-[14px] text-muted-foreground whitespace-nowrap">
              <Link href="/auth/register" className="hover:text-foreground transition-colors">
                회원가입
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/auth/find-id" className="hover:text-foreground transition-colors">
                아이디찾기
              </Link>
              <span className="text-muted-foreground">|</span>
              <Link href="/auth/reset-password" className="hover:text-foreground transition-colors">
                비밀번호찾기
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── 사이드 배너 (API 연동) ── */}
      {sideBanners.map((banner) => (
        <Link key={banner.id} href={banner.link_url || "/"} className="block overflow-hidden rounded-xl border border-neutral-200 group">
          <Image
            src={banner.image_url}
            alt={banner.alt_text || "배너"}
            width={280}
            height={280}
            sizes="280px"
            className="w-full h-auto transition-transform duration-300 group-hover:scale-[1.02]"
          />
        </Link>
      ))}

      {/* ── 고객센터 ── */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="mb-3 text-[15px] font-bold text-foreground">
          고객센터
        </h3>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-100">
            <Phone size={16} strokeWidth={2} className="text-secondary-foreground" />
          </div>
          <span className="text-[22px] font-bold tracking-[-0.03em] text-foreground">
            1811-0689
          </span>
        </div>
        <div className="mt-3 flex items-start gap-2">
          <Clock size={14} strokeWidth={1.75} className="mt-[3px] flex-shrink-0 text-muted-foreground" />
          <div className="text-[14px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-secondary-foreground">평일 09:00 ~ 18:00</p>
            <p className="text-muted-foreground">점심 12:00 ~ 13:00 제외</p>
            <p className="mt-0.5 text-muted-foreground">주말·공휴일 휴무</p>
          </div>
        </div>

        {/* 링크 그리드 */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link
            href="/guide"
            className="flex items-center justify-center gap-1 rounded-lg border border-neutral-200 py-2 text-[14px] font-medium text-secondary-foreground transition hover:bg-neutral-50 hover:text-foreground"
          >
            <BookOpen size={14} strokeWidth={2} />
            이용가이드
          </Link>
          <Link
            href="/support/notice"
            className="flex items-center justify-center gap-1 rounded-lg border border-neutral-200 py-2 text-[14px] font-medium text-secondary-foreground transition hover:bg-neutral-50 hover:text-foreground"
          >
            <Bell size={14} strokeWidth={2} />
            공지사항
          </Link>
          <Link
            href="/support/faq"
            className="flex items-center justify-center gap-1 rounded-lg border border-neutral-200 py-2 text-[14px] font-medium text-secondary-foreground transition hover:bg-neutral-50 hover:text-foreground"
          >
            <HelpCircle size={14} strokeWidth={2} />
            FAQ
          </Link>
        </div>
      </div>
    </aside>
  );
}
