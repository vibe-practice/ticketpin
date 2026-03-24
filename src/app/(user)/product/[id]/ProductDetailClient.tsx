"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Minus,
  Plus,
  PackageX,
  AlertCircle,
  ShieldCheck,
  Clock,
  CreditCard,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { ProductWithCategory } from "@/types";
import { formatPrice, calcFeeAmount, formatFeePercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ProductDetailClientProps {
  product: ProductWithCategory;
}

type FeeMode = "included" | "separate";
type TabKey = "description" | "notice" | "refund";

const TABS: { key: TabKey; label: string }[] = [
  { key: "description", label: "상품 설명" },
  { key: "notice", label: "유의사항" },
  { key: "refund", label: "환불 정책" },
];

const NOTICE_ITEMS = [
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

const REFUND_ITEMS = [
  "핀 번호 확인(조회) 전에는 구매 취소 및 환불이 가능합니다.",
  "핀 번호 확인 이후에는 취소/환불이 불가능합니다.",
  "단순 변심에 의한 환불 요청은 핀 번호 미확인 상태에서만 처리됩니다.",
  "부정 사용이 의심될 경우 환불이 제한될 수 있습니다.",
  "환불 처리 시 결제 수단에 따라 3~5 영업일 소요될 수 있습니다.",
];

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [feeMode, setFeeMode] = useState<FeeMode>("included");
  const [activeTab, setActiveTab] = useState<TabKey>("description");
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);

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
    <div className="min-h-screen bg-white">
      {/* ── 브레드크럼 ── */}
      <div className="border-b border-neutral-300">
        <div className="container-main py-3.5">
          <nav className="flex items-center gap-1.5 text-[14px] text-muted-foreground">
            <Link
              href="/"
              className="hover:text-secondary-foreground transition-colors duration-150"
            >
              HOME
            </Link>
            <ChevronRight size={12} strokeWidth={2} className="text-muted-foreground" />
            <Link
              href={`/category/${product.category.slug}`}
              className="hover:text-secondary-foreground transition-colors duration-150"
            >
              {product.category.name}
            </Link>
            <ChevronRight size={12} strokeWidth={2} className="text-muted-foreground" />
            <span className="text-secondary-foreground font-medium truncate max-w-[200px] sm:max-w-none">
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div className="container-main py-10 lg:py-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16 xl:gap-24 lg:items-start">

          {/* ── 왼쪽: 이미지 영역 ── */}
          <div className="relative">
            {/* 메인 이미지 */}
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-50">
              {isUnavailable && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                  <div className="flex flex-col items-center gap-3">
                    <PackageX size={36} className="text-white/80" strokeWidth={1.5} />
                    <span className="rounded-full bg-white px-5 py-2 text-[14px] font-semibold text-foreground tracking-wide">
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
                <div className="flex h-full w-full items-center justify-center bg-neutral-100">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center">
                      <PackageX size={24} className="text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <span className="text-[14px] text-muted-foreground">이미지 없음</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 오른쪽: 상품 정보 패널 ── */}
          <div className="flex flex-col">
            {/* 카테고리 레이블 */}
            <div className="mb-3">
              <span className="text-[14px] font-semibold tracking-wide text-secondary-foreground uppercase">
                {product.category.name}
              </span>
            </div>

            {/* 상품명 */}
            <h1 className="text-[26px] font-bold leading-snug tracking-tight text-foreground mb-4">
              {product.name}
            </h1>

            {/* 가격 블록 */}
            <div className="mb-6 pb-6 border-b border-neutral-300">
              <div className="flex items-baseline gap-3">
                <span className="text-[32px] font-bold tracking-tight text-foreground">
                  {formatPrice(product.price)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-[14px] text-muted-foreground">수수료</span>
                <span className="text-[14px] font-medium text-secondary-foreground">
                  {formatPrice(feeAmount)}
                </span>
                <span className="text-[14px] text-muted-foreground">
                  ({formatFeePercent(feeAmount, product.price)})
                </span>
              </div>
            </div>

            {/* 수수료 결제 방식 */}
            <div className="mb-6">
              <p className="mb-3 text-[14px] font-semibold tracking-wide text-secondary-foreground uppercase">
                수수료 결제 방식
              </p>
              <div className="grid grid-cols-2 gap-2">
                {/* 수수료 포함 */}
                <button
                  type="button"
                  onClick={() => setFeeMode("included")}
                  className={`group relative flex flex-col gap-1 rounded-xl border p-4 text-left transition-all duration-200 ${
                    feeMode === "included"
                      ? "border-neutral-900 bg-neutral-900"
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                  }`}
                  aria-pressed={feeMode === "included"}
                >
                  {/* 라디오 인디케이터 */}
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                        feeMode === "included"
                          ? "border-white bg-transparent"
                          : "border-neutral-300"
                      }`}
                    >
                      {feeMode === "included" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span
                      className={`text-[14px] font-semibold ${
                        feeMode === "included" ? "text-white" : "text-secondary-foreground"
                      }`}
                    >
                      수수료 포함
                    </span>
                  </div>
                  <p
                    className={`text-[14px] leading-relaxed ${
                      feeMode === "included" ? "text-white/70" : "text-muted-foreground"
                    }`}
                  >
                    지금 바로 수수료 포함
                    <br />
                    핀 조회 시 추가 결제 없음
                  </p>
                  <div
                    className={`mt-1.5 text-[14px] font-bold ${
                      feeMode === "included" ? "text-white" : "text-foreground"
                    }`}
                  >
                    {formatPrice(product.price + feeAmount)} / 장
                  </div>
                </button>

                {/* 수수료 별도 */}
                <button
                  type="button"
                  onClick={() => setFeeMode("separate")}
                  className={`group relative flex flex-col gap-1 rounded-xl border p-4 text-left transition-all duration-200 ${
                    feeMode === "separate"
                      ? "border-neutral-900 bg-neutral-900"
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                  }`}
                  aria-pressed={feeMode === "separate"}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ${
                        feeMode === "separate"
                          ? "border-white bg-transparent"
                          : "border-neutral-300"
                      }`}
                    >
                      {feeMode === "separate" && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span
                      className={`text-[14px] font-semibold ${
                        feeMode === "separate" ? "text-white" : "text-secondary-foreground"
                      }`}
                    >
                      수수료 별도
                    </span>
                  </div>
                  <p
                    className={`text-[14px] leading-relaxed ${
                      feeMode === "separate" ? "text-white/70" : "text-muted-foreground"
                    }`}
                  >
                    상품 가격만 지금 결제
                    <br />
                    핀 조회 시 수수료 별도
                  </p>
                  <div
                    className={`mt-1.5 text-[14px] font-bold ${
                      feeMode === "separate" ? "text-white" : "text-foreground"
                    }`}
                  >
                    {formatPrice(product.price)} / 장
                  </div>
                </button>
              </div>

              {/* 수수료 별도 안내 */}
              {feeMode === "separate" && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-3">
                  <AlertCircle size={13} className="mt-0.5 shrink-0 text-muted-foreground" strokeWidth={2} />
                  <p className="text-[14px] leading-relaxed text-muted-foreground">
                    핀 번호 조회 시 수수료{" "}
                    <strong className="font-semibold text-secondary-foreground">
                      {formatPrice(feeAmount)} ({formatFeePercent(feeAmount, product.price)})
                    </strong>
                    가 장당 추가로 결제됩니다.
                  </p>
                </div>
              )}
            </div>

            {/* 수량 선택 */}
            <div className="mb-6 pb-6 border-b border-neutral-300">
              <p className="mb-3 text-[14px] font-semibold tracking-wide text-secondary-foreground uppercase">
                수량 선택
                <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
                  최대 30개
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {/* 수량 컨트롤 */}
                <div className="flex items-center rounded-xl border border-neutral-200 overflow-hidden">
                  {/* -10 버튼 */}
                  <button
                    type="button"
                    onClick={handleDecrement10}
                    disabled={quantity <= 1 || isUnavailable}
                    aria-label="10개 감소"
                    className="flex items-center justify-center h-11 px-3 text-[14px] font-semibold text-muted-foreground hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed border-r border-neutral-200 transition-colors duration-150"
                  >
                    -10
                  </button>
                  {/* -1 버튼 */}
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={quantity <= 1 || isUnavailable}
                    aria-label="수량 감소"
                    className="flex items-center justify-center h-11 w-11 text-secondary-foreground hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed border-r border-neutral-200 transition-colors duration-150"
                  >
                    <Minus size={15} strokeWidth={2} />
                  </button>
                  {/* 수량 표시 */}
                  <div className="flex h-11 w-14 items-center justify-center">
                    <span className="text-[16px] font-bold tabular-nums text-foreground">
                      {quantity}
                    </span>
                  </div>
                  {/* +1 버튼 */}
                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={quantity >= 30 || isUnavailable}
                    aria-label="수량 증가"
                    className="flex items-center justify-center h-11 w-11 text-secondary-foreground hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed border-l border-neutral-200 transition-colors duration-150"
                  >
                    <Plus size={15} strokeWidth={2} />
                  </button>
                  {/* +10 버튼 */}
                  <button
                    type="button"
                    onClick={handleIncrement10}
                    disabled={quantity >= 30 || isUnavailable}
                    aria-label="10개 증가"
                    className="flex items-center justify-center h-11 px-3 text-[14px] font-semibold text-muted-foreground hover:bg-neutral-50 disabled:opacity-30 disabled:cursor-not-allowed border-l border-neutral-200 transition-colors duration-150"
                  >
                    +10
                  </button>
                </div>
                <span className="text-[14px] text-muted-foreground">
                  {formatPrice(unitPrice)} × {quantity}장
                </span>
              </div>
            </div>

            {/* 총 결제금액 */}
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[14px] font-semibold tracking-wide text-secondary-foreground uppercase mb-1">
                  총 결제금액
                </p>
                {feeMode === "separate" && (
                  <p className="text-[14px] text-muted-foreground">
                    + 수수료 {formatPrice(feeAmount * quantity)} 별도 (핀 조회 시)
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-[34px] font-bold tracking-tight text-foreground">
                  {formatPrice(totalAmount)}
                </span>
              </div>
            </div>

            {/* 구매하기 버튼 */}
            <Button
              type="button"
              onClick={handlePurchase}
              disabled={isUnavailable}
              className={`h-[52px] w-full rounded-xl text-[15px] font-bold tracking-wide transition-all duration-200 ${
                isUnavailable
                  ? "bg-neutral-200 text-muted-foreground cursor-not-allowed hover:bg-neutral-200"
                  : "bg-neutral-900 text-white hover:bg-neutral-700 active:scale-[0.98] shadow-sm"
              }`}
              aria-disabled={isUnavailable}
            >
              {isUnavailable ? (
                <>
                  <PackageX size={18} strokeWidth={1.75} className="mr-2" />
                  품절된 상품입니다
                </>
              ) : (
                <>{formatPrice(totalAmount)} 구매하기</>
              )}
            </Button>

            {/* 간단 안내 — 모바일용 접기/펼치기 */}
            <div className="mt-5 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileInfoOpen((prev) => !prev)}
                className="flex w-full items-center justify-between py-3 border-t border-neutral-300 text-[14px] text-muted-foreground"
              >
                <span className="font-medium">구매 안내</span>
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className={`transition-transform duration-200 ${mobileInfoOpen ? "rotate-180" : ""}`}
                />
              </button>
              {mobileInfoOpen && (
                <div className="pb-4 flex flex-col gap-2.5 border-b border-neutral-300">
                  {NOTICE_ITEMS.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <Icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                        <span className="text-[15px] leading-relaxed text-muted-foreground">
                          {item.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 데스크탑용 안내 목록 */}
            <div className="mt-5 hidden lg:flex flex-col gap-2.5 pt-5 border-t border-neutral-300">
              {NOTICE_ITEMS.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <Icon size={14} className="mt-0.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <span className="text-[15px] leading-relaxed text-muted-foreground">
                      {item.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 하단: 상품 상세 탭 영역 ── */}
        <div className="mt-16 lg:mt-20">
          {/* 탭 헤더 */}
          <div className="border-b border-neutral-200">
            <div className="flex">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-6 py-4 text-[14px] font-semibold tracking-wide transition-colors duration-150 ${
                    activeTab === tab.key
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-secondary-foreground"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-neutral-900" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 탭 콘텐츠 */}
          <div className="py-10">
            {/* 상품 설명 탭 */}
            {activeTab === "description" && (
              <div className="max-w-2xl">
                {product.description ? (
                  <p className="text-[15px] leading-[1.85] text-secondary-foreground whitespace-pre-line">
                    {product.description}
                  </p>
                ) : (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-[15px] text-muted-foreground">
                      등록된 상품 설명이 없습니다.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 유의사항 탭 */}
            {activeTab === "notice" && (
              <div className="max-w-2xl">
                <div className="flex flex-col divide-y divide-neutral-300">
                  {NOTICE_ITEMS.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="flex items-start gap-4 py-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                          <Icon size={15} className="text-muted-foreground" strokeWidth={1.75} />
                        </div>
                        <p className="pt-1 text-[14px] leading-relaxed text-secondary-foreground">
                          {item.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 환불 정책 탭 */}
            {activeTab === "refund" && (
              <div className="max-w-2xl">
                <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
                  <p className="text-[14px] font-semibold text-secondary-foreground mb-1">환불 안내</p>
                  <p className="text-[15px] text-muted-foreground leading-relaxed">
                    상품권 특성상 핀 번호 확인 후에는 환불이 불가합니다.
                    구매 전 충분히 확인해 주세요.
                  </p>
                </div>
                <ul className="flex flex-col gap-3">
                  {REFUND_ITEMS.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[14px] font-bold text-white">
                        {i + 1}
                      </span>
                      <p className="text-[14px] leading-relaxed text-secondary-foreground">
                        {item}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
