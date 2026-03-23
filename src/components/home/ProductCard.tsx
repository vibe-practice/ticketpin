"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PackageX } from "lucide-react";
import type { ProductWithCategory } from "@/types";
import { formatPrice } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

interface ProductCardProps {
  product: ProductWithCategory;
  className?: string;
}

export function ProductCard({ product, className = "" }: ProductCardProps) {
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
        className={`flex flex-col overflow-hidden rounded-xl bg-card ${
          isInactive ? "pointer-events-none opacity-60" : ""
        } ${className}`}
        tabIndex={isDisabled ? -1 : undefined}
        aria-disabled={isDisabled}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className={`object-cover ${isSoldout ? "grayscale" : ""}`}
              loading="lazy"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-muted ${isSoldout ? "grayscale" : ""}`}>
              <span className="text-[13px] text-muted-foreground">이미지 없음</span>
            </div>
          )}
          {isSoldout && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="rounded-md bg-black/60 px-4 py-2 text-[14px] font-bold text-white">
                품절
              </span>
            </div>
          )}
          {isInactive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-sm bg-white/90 px-3 py-1.5 text-[13px] font-bold text-foreground">
                판매중지
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1 px-0.5 pt-3 pb-1">
          <h3 className={`line-clamp-2 text-base font-semibold leading-snug tracking-tight ${isSoldout ? "text-muted-foreground" : "text-foreground"}`}>
            {product.name}
          </h3>
          <p className={`mt-0.5 text-[14px] font-bold ${isSoldout ? "text-muted-foreground" : "text-foreground"}`}>
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
            className="mx-4 flex w-full max-w-[320px] flex-col items-center gap-4 rounded-2xl bg-card px-8 py-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <PackageX size={28} className="text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-center text-[15px] font-semibold text-foreground">
              품절된 상품권입니다.
            </p>
            <button
              onClick={() => setShowSoldout(false)}
              className="mt-1 h-10 w-full rounded-lg bg-primary text-sm font-semibold text-white transition-colors hover:bg-brand-primary-dark"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
