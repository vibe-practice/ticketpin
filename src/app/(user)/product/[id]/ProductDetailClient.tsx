"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Minus,
  Plus,
  ShoppingCart,
  Tag,

  Info,
  PackageX,
  AlertCircle,
  ShieldCheck,
  Clock,
  CreditCard,
} from "lucide-react";
import type { ProductWithCategory } from "@/types";
import { formatPrice, calcFeeAmount, formatFeePercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ProductDetailClientProps {
  product: ProductWithCategory;
}

type FeeMode = "included" | "separate";

const USAGE_GUIDE_ITEMS = [
  {
    icon: ShieldCheck,
    text: "구매 후 핀 번호는 마이페이지에서도 확인하실 수 있습니다.",
  },
  {
    icon: AlertCircle,
    text: "핀 번호 확인 시 취소/환불이 불가합니다.",
  },
  {
    icon: CreditCard,
    text: "수수료 별도 선택 시 핀 조회 버튼 클릭 때 수수료가 결제됩니다.",
  },
  {
    icon: Clock,
    text: "상품권 유효기간은 발행일로부터 5년입니다.",
  },
];

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [feeMode, setFeeMode] = useState<FeeMode>("included");

  const isSoldout = product.status === "soldout";
  const isInactive = product.status === "inactive";
  const isUnavailable = isInactive || isSoldout;
  const feeAmount = calcFeeAmount(product.price, product.fee_rate, product.fee_unit);

  // 품절 상품 접근 시 팝업 + 메인 이동
  useEffect(() => {
    if (isSoldout) {
      alert("품절된 상품입니다.");
      router.replace("/");
    }
  }, [isSoldout, router]);

  // 총액 계산
  const unitPrice =
    feeMode === "included" ? product.price + feeAmount : product.price;
  const totalAmount = unitPrice * quantity;

  // 수량 조절
  const handleDecrement = () => setQuantity((prev) => Math.max(1, prev - 1));
  const handleIncrement = () => setQuantity((prev) => Math.min(30, prev + 1));
  const handleDecrement10 = () => setQuantity((prev) => Math.max(1, prev - 10));
  const handleIncrement10 = () => setQuantity((prev) => Math.min(30, prev + 10));

  // 구매 버튼 → 주문 페이지 이동
  const handlePurchase = () => {
    router.push(
      `/order?productId=${product.id}&quantity=${quantity}&feeMode=${feeMode}`
    );
  };

  return (
    <div className="bg-background">
      {/* 상단 네비게이션 브레드크럼 */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-12 py-3">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="h-auto px-0 text-sm text-muted-foreground hover:text-foreground hover:bg-transparent"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
            <span>뒤로가기</span>
          </Button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-12 pt-6 md:pt-10 pb-4">

        {/* ── 상단 2컬럼: 이미지 + 정보 패널 ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10 xl:gap-16 lg:items-start">

          {/* ── 왼쪽: 이미지 영역 ── */}
          <div className="flex flex-col gap-4">
            {/* 메인 이미지 */}
            <div className="relative aspect-[4/3] w-full max-h-[520px] overflow-hidden rounded-2xl bg-muted shadow-sm">
              {isUnavailable && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
                  <div className="flex flex-col items-center gap-2">
                    <PackageX size={40} className="text-white/80" strokeWidth={1.5} />
                    <span className="rounded-md bg-white/90 px-4 py-2 text-sm font-bold text-foreground">
                      현재 품절된 상품입니다
                    </span>
                  </div>
                </div>
              )}
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <span className="text-sm text-muted-foreground">이미지 없음</span>
                </div>
              )}
            </div>

            {/* 상품 설명 (데스크탑 기준 이미지 하단) */}
            {product.description && (
              <div className="hidden rounded-xl border border-border bg-card p-5 lg:block">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Info size={15} className="text-primary" strokeWidth={1.75} />
                  상품 설명
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              </div>
            )}
          </div>

          {/* ── 오른쪽: 정보 패널 ── */}
          <div className="flex flex-col gap-5">
            {/* 카테고리 + 판매량 */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand-primary-soft px-2.5 py-1 text-sm font-semibold tracking-wide text-brand-primary-dark">
                <Tag size={12} strokeWidth={2} />
                {product.category.name}
              </span>
              {/* 품절 뱃지 */}
              {isUnavailable && (
                <span className="rounded-sm bg-error-bg px-2.5 py-1 text-sm font-bold text-error">
                  품절
                </span>
              )}


            </div>

            {/* 상품명 */}
            <div>
              <h1 className="text-2xl font-bold leading-snug tracking-tight text-foreground md:text-3xl">
                {product.name}
              </h1>
            </div>

            {/* 상품 가격 정보 */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">상품 가격</span>
                  <span className="text-base font-semibold text-foreground">
                    {formatPrice(product.price)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">수수료</span>
                  <span className="text-base font-medium text-foreground">
                    {formatPrice(feeAmount)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({formatFeePercent(feeAmount, product.price)})
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* 구분선 */}
            <div className="h-px bg-border" />

            {/* 수수료 방식 RadioGroup */}
            <div>
              <label className="mb-3 block text-sm font-semibold text-foreground">
                수수료 결제 방식
              </label>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {/* 수수료 포함 */}
                <button
                  type="button"
                  onClick={() => setFeeMode("included")}
                  className={`group relative flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                    feeMode === "included"
                      ? "border-primary bg-brand-primary-muted shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-brand-primary-muted"
                  }`}
                  aria-pressed={feeMode === "included"}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                        feeMode === "included"
                          ? "border-primary bg-primary"
                          : "border-muted-foreground group-hover:border-primary"
                      }`}
                    >
                      {feeMode === "included" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        feeMode === "included" ? "text-primary" : "text-foreground"
                      }`}
                    >
                      수수료 포함
                    </span>
                  </div>
                  <p className="pl-6 text-sm text-muted-foreground">
                    지금 수수료 포함하여 결제
                    <br />
                    핀 조회 시 추가 결제 없음
                  </p>
                  <div
                    className={`pl-6 text-sm font-bold transition-colors ${
                      feeMode === "included" ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {formatPrice(product.price + feeAmount)} / 장
                  </div>
                </button>

                {/* 수수료 별도 */}
                <button
                  type="button"
                  onClick={() => setFeeMode("separate")}
                  className={`group relative flex flex-col gap-1.5 rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                    feeMode === "separate"
                      ? "border-primary bg-brand-primary-muted shadow-sm"
                      : "border-border bg-card hover:border-primary/40 hover:bg-brand-primary-muted"
                  }`}
                  aria-pressed={feeMode === "separate"}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                        feeMode === "separate"
                          ? "border-primary bg-primary"
                          : "border-muted-foreground group-hover:border-primary"
                      }`}
                    >
                      {feeMode === "separate" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        feeMode === "separate" ? "text-primary" : "text-foreground"
                      }`}
                    >
                      수수료 별도
                    </span>
                  </div>
                  <p className="pl-6 text-sm text-muted-foreground">
                    상품 가격만 지금 결제
                    <br />
                    핀 조회 시 수수료 별도 결제
                  </p>
                  <div
                    className={`pl-6 text-sm font-bold transition-colors ${
                      feeMode === "separate" ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {formatPrice(product.price)} / 장
                  </div>
                </button>
              </div>

              {/* 수수료 안내 */}
              {feeMode === "separate" && (
                <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-info-bg px-3 py-2.5">
                  <Info size={13} className="mt-0.5 shrink-0 text-info" strokeWidth={2} />
                  <p className="text-sm leading-relaxed text-info">
                    핀 번호 조회 시 수수료{" "}
                    <strong>
                      {formatPrice(feeAmount)} ({formatFeePercent(feeAmount, product.price)})
                    </strong>
                    가 장당 추가 결제됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* 수량 선택 */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <label className="text-sm font-semibold text-foreground">
                  수량 선택
                </label>
                <span className="text-[12px] text-muted-foreground">
                  (최대 30개)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {/* -10 버튼 */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDecrement10}
                    disabled={quantity <= 1 || isUnavailable}
                    aria-label="10개 감소"
                    className="h-10 w-11 rounded-xl text-[13px] font-semibold"
                  >
                    -10
                  </Button>
                  {/* ±1 버튼 그룹 */}
                  <div className="flex items-center rounded-xl border border-border bg-card overflow-hidden">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleDecrement}
                      disabled={quantity <= 1 || isUnavailable}
                      aria-label="수량 감소"
                      className="h-10 w-10 rounded-none"
                    >
                      <Minus size={16} strokeWidth={2} />
                    </Button>
                    <div className="flex h-10 w-12 items-center justify-center border-x border-border">
                      <span className="text-base font-bold tabular-nums text-foreground">
                        {quantity}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleIncrement}
                      disabled={quantity >= 30 || isUnavailable}
                      aria-label="수량 증가"
                      className="h-10 w-10 rounded-none"
                    >
                      <Plus size={16} strokeWidth={2} />
                    </Button>
                  </div>
                  {/* +10 버튼 */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleIncrement10}
                    disabled={quantity >= 30 || isUnavailable}
                    aria-label="10개 증가"
                    className="h-10 w-11 rounded-xl text-[13px] font-semibold"
                  >
                    +10
                  </Button>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatPrice(unitPrice)} × {quantity}장
                </span>
              </div>
            </div>

            {/* 총액 영역 */}
            <div className="rounded-xl border-2 border-primary bg-brand-primary-muted p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-brand-primary-dark">최종 결제금액</span>
                  {feeMode === "separate" && (
                    <div className="mt-0.5">
                      <p className="text-sm text-muted-foreground">
                        * 수수료 {formatPrice(feeAmount * quantity)} 별도
                      </p>
                      <p className="text-[12px] text-muted-foreground">
                        핀 번호 확인 시 결제됩니다
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
                    {formatPrice(totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* 구매 버튼 */}
            <Button
              type="button"
              onClick={handlePurchase}
              disabled={isUnavailable}
              className={`h-14 w-full rounded-xl text-base font-bold ${
                isUnavailable
                  ? "bg-muted text-muted-foreground hover:bg-muted"
                  : "shadow-sm hover:shadow-md active:scale-[0.98]"
              }`}
              aria-disabled={isUnavailable}
            >
              {isUnavailable ? (
                <>
                  <PackageX size={20} strokeWidth={1.75} />
                  품절된 상품입니다
                </>
              ) : (
                <>
                  <ShoppingCart size={20} strokeWidth={1.75} />
                  {formatPrice(totalAmount)} 구매하기
                </>
              )}
            </Button>


            {/* 모바일 전용: 상품 설명 */}
            {product.description && (
              <div className="rounded-xl border border-border bg-card p-5 lg:hidden">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Info size={15} className="text-primary" strokeWidth={1.75} />
                  상품 설명
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── 하단 전체 폭: 이용 안내 ── */}
        <div className="mt-8 rounded-xl border border-border bg-card p-6 lg:mt-10">
          <h3 className="mb-4 text-sm font-semibold text-foreground">이용 안내</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {USAGE_GUIDE_ITEMS.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-muted/40 px-4 py-3"
                >
                  <Icon
                    size={15}
                    className="mt-0.5 shrink-0 text-primary"
                    strokeWidth={1.75}
                  />
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {item.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
