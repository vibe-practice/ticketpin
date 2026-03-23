"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PackageX } from "lucide-react";
import type { ProductWithCategory } from "@/types";
import { formatPrice } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: ProductWithCategory;
  className?: string;
  rank?: number; // 인기 랭킹 번호
}

export function ProductCard({ product, className = "", rank }: ProductCardProps) {
  const isInactive = product.status === "inactive";
  const isSoldout = product.status === "soldout";
  const isDisabled = isInactive || isSoldout;
  const user = useAuthStore((s) => s.user);
  const [showSoldout, setShowSoldout] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (isSoldout) {
      e.preventDefault();
      setShowSoldout(true);
      return;
    }
    if (!user) {
      e.preventDefault();
      window.location.href = `/auth/login?redirect=/product/${product.id}`;
    }
  };

  return (
    <>
      <Link
        href={isSoldout ? "#" : `/product/${product.id}`}
        onClick={handleClick}
        className={cn(
          "group flex flex-col overflow-hidden",
          isInactive ? "pointer-events-none opacity-50" : "",
          className
        )}
        tabIndex={isDisabled ? -1 : undefined}
        aria-disabled={isDisabled}
      >
        {/* 이미지 영역 */}
        <div className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
          {/* 랭킹 번호 */}
          {rank != null && (
            <div
              className={cn(
                "absolute left-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-sm text-[14px] font-bold",
                rank <= 3
                  ? "bg-neutral-950 text-white"
                  : "bg-white/80 text-secondary-foreground"
              )}
            >
              {rank}
            </div>
          )}

          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className={cn(
                "object-cover transition-transform duration-500 group-hover:scale-105",
                isSoldout ? "grayscale" : ""
              )}
              loading="lazy"
            />
          ) : (
            <div className={cn(
              "flex h-full w-full items-center justify-center bg-neutral-100",
              isSoldout ? "grayscale" : ""
            )}>
              <span className="text-[14px] font-medium text-muted-foreground">이미지 없음</span>
            </div>
          )}

          {/* 품절 오버레이 */}
          {isSoldout && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <span className="rounded-sm bg-black/70 px-3 py-1 text-[14px] font-bold tracking-wide text-white">
                SOLD OUT
              </span>
            </div>
          )}

          {/* 판매중지 오버레이 */}
          {isInactive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-sm bg-white/90 px-3 py-1 text-[14px] font-bold text-foreground">
                판매중지
              </span>
            </div>
          )}
        </div>

        {/* 텍스트 영역 */}
        <div className="flex flex-col gap-1.5 pt-3">
          <h3 className={cn(
            "line-clamp-2 text-[16px] font-semibold leading-snug tracking-[-0.015em]",
            isSoldout ? "text-muted-foreground" : "text-foreground"
          )}>
            {product.name}
          </h3>
          <p className={cn(
            "text-[18px] font-bold tracking-[-0.02em]",
            isSoldout ? "text-muted-foreground" : "text-foreground"
          )}>
            {formatPrice(product.price)}
          </p>
        </div>
      </Link>

      {/* 품절 팝업 */}
      {showSoldout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowSoldout(false)}
        >
          <div
            className="mx-4 flex w-full max-w-[320px] flex-col items-center gap-5 rounded-2xl bg-white px-8 py-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <PackageX size={24} className="text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="text-center">
              <p className="text-[17px] font-bold text-foreground">품절된 상품입니다</p>
              <p className="mt-1 text-[14px] text-muted-foreground">빠른 시일 내에 재입고될 예정입니다.</p>
            </div>
            <button
              onClick={() => setShowSoldout(false)}
              className="h-11 w-full rounded-lg bg-neutral-950 text-[15px] font-semibold text-white transition-colors hover:bg-neutral-800 active:scale-[0.98]"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
