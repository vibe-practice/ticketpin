"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const BANNER_SLIDES = [
  {
    id: 1,
    imageUrl: "https://placehold.co/760x420/f5f5f5/a3a3a3?text=Banner+1",
    alt: "티켓핀 배너 1",
    link: "/category",
  },
  {
    id: 2,
    imageUrl: "https://placehold.co/760x420/e5e5e5/737373?text=Banner+2",
    alt: "티켓핀 배너 2",
    link: "/category",
  },
  {
    id: 3,
    imageUrl: "https://placehold.co/760x420/d4d4d4/525252?text=Banner+3",
    alt: "티켓핀 배너 3",
    link: "/guide/gift",
  },
  {
    id: 4,
    imageUrl: "https://placehold.co/760x420/fafafa/a3a3a3?text=Banner+4",
    alt: "티켓핀 배너 4",
    link: "/category",
  },
  {
    id: 5,
    imageUrl: "https://placehold.co/760x420/e5e5e5/525252?text=Banner+5",
    alt: "티켓핀 배너 5",
    link: "/category",
  },
];

const SLIDE_INTERVAL = 5000;

export function HeroBanner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback(() => {
    stopInterval();
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % BANNER_SLIDES.length);
    }, SLIDE_INTERVAL);
  }, [stopInterval]);

  useEffect(() => {
    if (!isPaused) {
      startInterval();
    } else {
      stopInterval();
    }
    return stopInterval;
  }, [isPaused, startInterval, stopInterval]);

  const goPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + BANNER_SLIDES.length) % BANNER_SLIDES.length);
    if (!isPaused) startInterval();
  }, [isPaused, startInterval]);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % BANNER_SLIDES.length);
    if (!isPaused) startInterval();
  }, [isPaused, startInterval]);

  return (
    <section className="relative w-full overflow-hidden rounded-2xl">
      {/* 슬라이드 트랙 */}
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {BANNER_SLIDES.map((slide) => (
          <div key={slide.id} className="min-w-full">
            <Link href={slide.link} className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.imageUrl}
                alt={slide.alt}
                className="aspect-[16/9] w-full object-cover"
                loading={slide.id === 1 ? "eager" : "lazy"}
              />
            </Link>
          </div>
        ))}
      </div>

      {/* 좌 화살표 */}
      <button
        type="button"
        onClick={goPrev}
        aria-label="이전 배너"
        className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/45"
      >
        <ChevronLeft size={18} strokeWidth={2} />
      </button>

      {/* 우 화살표 */}
      <button
        type="button"
        onClick={goNext}
        aria-label="다음 배너"
        className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/45"
      >
        <ChevronRight size={18} strokeWidth={2} />
      </button>

      {/* 하단 우측 컨트롤 (배너 안에 위치) */}
      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1.5 backdrop-blur-sm">
        <button
          type="button"
          onClick={goPrev}
          aria-label="이전"
          className="flex h-5 w-5 items-center justify-center text-white/70 hover:text-white"
        >
          <ChevronLeft size={12} strokeWidth={2.5} />
        </button>
        <span className="min-w-[40px] text-center font-mono text-[14px] font-semibold tabular-nums text-white">
          {activeIndex + 1}
          <span className="text-white/50"> / {BANNER_SLIDES.length}</span>
        </span>
        <button
          type="button"
          onClick={goNext}
          aria-label="다음"
          className="flex h-5 w-5 items-center justify-center text-white/70 hover:text-white"
        >
          <ChevronRight size={12} strokeWidth={2.5} />
        </button>
        <div className="mx-0.5 h-3 w-px bg-white/20" />
        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          aria-label={isPaused ? "재생" : "일시정지"}
          className={cn(
            "flex h-5 w-5 items-center justify-center text-white/70 hover:text-white"
          )}
        >
          {isPaused ? <Play size={10} strokeWidth={2.5} /> : <Pause size={10} strokeWidth={2.5} />}
        </button>
      </div>
    </section>
  );
}
