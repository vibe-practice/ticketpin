"use client";

import { useState, useEffect, useCallback } from "react";
import { HelpCircle, Loader2, AlertCircle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { FaqCategory, FaqItem } from "@/types";

const FAQ_CATEGORIES: FaqCategory[] = [
  "전체",
  "구매",
  "교환권",
  "선물",
  "환불",
  "계정",
];

interface FaqApiResponse {
  success: boolean;
  data: FaqItem[];
  categoryCounts: Record<string, number>;
  error?: { code: string; message: string };
}

export default function FaqPage() {
  const [activeCategory, setActiveCategory] = useState<FaqCategory>("전체");
  const [items, setItems] = useState<FaqItem[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const fetchFaqs = useCallback(async (category: FaqCategory) => {
    setIsLoading(true);
    setIsError(false);
    try {
      const params = new URLSearchParams();
      if (category !== "전체") {
        params.set("category", category);
      }
      const res = await fetch(`/api/faqs?${params.toString()}`);
      const json: FaqApiResponse = await res.json();

      if (json.success) {
        setItems(json.data);
        setCategoryCounts(json.categoryCounts);
      } else {
        setIsError(true);
      }
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaqs(activeCategory);
  }, [activeCategory, fetchFaqs]);

  function handleCategoryChange(cat: FaqCategory) {
    setActiveCategory(cat);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 페이지 헤더 */}
      <div className="border-b border-border bg-card">
        <div className="container-main py-8">
          <h1 className="text-2xl font-bold text-foreground">자주 묻는 질문</h1>
          <p className="mt-1 text-[16px] text-muted-foreground">
            티켓매니아 이용에 관한 자주 묻는 질문을 모았습니다.
          </p>
        </div>
      </div>

      <div className="container-main py-8">
        <div className="space-y-6">

          {/* 카테고리 필터 탭 */}
          <div className="flex flex-wrap gap-2">
            {FAQ_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[15px] font-medium transition-all duration-150",
                    isActive
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-card border border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  {cat}
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[14px] font-semibold tabular-nums",
                      isActive
                        ? "bg-white/25 text-background"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {categoryCounts[cat] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 로딩 / 에러 / 빈 상태 */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
              <Loader2 size={32} className="mb-4 animate-spin text-muted-foreground/60" />
              <p className="text-[16px] text-muted-foreground">불러오는 중...</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
              <AlertCircle size={44} className="mb-4 text-muted-foreground/40" />
              <p className="text-[16px] font-semibold text-foreground">
                데이터를 불러오지 못했습니다
              </p>
              <p className="mt-1 text-[15px] text-muted-foreground">
                잠시 후 다시 시도해 주세요.
              </p>
              <button
                type="button"
                onClick={() => fetchFaqs(activeCategory)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-[14px] font-medium text-foreground transition hover:bg-muted/30"
              >
                <RotateCw size={14} strokeWidth={2} />
                다시 시도
              </button>
            </div>
          ) : items.length === 0 ? (
            /* 빈 상태 */
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
              <HelpCircle size={44} className="mb-4 text-muted-foreground/40" />
              <p className="text-[16px] font-semibold text-foreground">
                등록된 질문이 없습니다
              </p>
              <p className="mt-1 text-[15px] text-muted-foreground">
                다른 카테고리를 선택하거나 고객센터로 문의해 주세요.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* 결과 카운트 */}
              <div className="border-b border-border px-5 py-3 bg-muted/30">
                <span className="text-[15px] text-muted-foreground">
                  총{" "}
                  <span className="font-semibold text-foreground">
                    {items.length}
                  </span>
                  개의 질문
                </span>
              </div>

              <Accordion type="multiple" className="divide-y divide-border">
                {items.map((item) => (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    className="border-0 px-5 group"
                  >
                    <AccordionTrigger className="py-4 text-left hover:no-underline gap-3 [&>svg]:shrink-0 [&>svg]:text-muted-foreground group-data-[state=open]:[&>svg]:text-foreground">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Q 마커 */}
                        <span className="mt-0.5 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-sm bg-foreground text-[14px] font-bold text-background">
                          Q
                        </span>
                        <span className="text-[16px] font-medium text-foreground leading-snug group-data-[state=open]:font-semibold transition-all duration-150">
                          {item.question}
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-5">
                      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
                        {/* A 마커 */}
                        <span className="mt-0.5 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-sm bg-success-bg text-[14px] font-bold text-success">
                          A
                        </span>
                        <p className="text-[16px] text-muted-foreground leading-relaxed whitespace-pre-line">
                          {item.answer}
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
