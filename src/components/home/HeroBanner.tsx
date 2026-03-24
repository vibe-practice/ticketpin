"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const FALLBACK_SLIDES = [
  { id: "f1", imageUrl: "https://placehold.co/760x420/f5f5f5/a3a3a3?text=Banner+1", alt: "티켓핀 배너 1", link: "/category" },
  { id: "f2", imageUrl: "https://placehold.co/760x420/e5e5e5/737373?text=Banner+2", alt: "티켓핀 배너 2", link: "/category" },
  { id: "f3", imageUrl: "https://placehold.co/760x420/d4d4d4/525252?text=Banner+3", alt: "티켓핀 배너 3", link: "/guide/gift" },
];

interface BannerSlide {
  id: string;
  imageUrl: string;
  alt: string;
  link: string;
}

const SLIDE_INTERVAL = 5000;
const TRANSITION_DURATION = 500;

export function HeroBanner() {
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>(FALLBACK_SLIDES);

  // API에서 배너 데이터 fetch
  useEffect(() => {
    async function fetchBanners() {
      try {
        const res = await fetch("/api/banners");
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          setBannerSlides(
            json.data.map((b: { id: string; image_url: string; alt_text: string; link_url: string }) => ({
              id: b.id,
              imageUrl: b.image_url,
              alt: b.alt_text || "배너",
              link: b.link_url || "/",
            }))
          );
        }
      } catch {
        // API 실패 시 fallback 유지
      }
    }
    fetchBanners();
  }, []);

  const TOTAL = bannerSlides.length;
  const totalRef = useRef(TOTAL);
  useEffect(() => { totalRef.current = TOTAL; }, [TOTAL]);
  // innerIndex: 0=복제마지막, 1~TOTAL=실제, TOTAL+1=복제첫번째
  const [innerIndex, setInnerIndex] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const isMoving = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const displayIndex =
    innerIndex <= 0 ? TOTAL - 1
    : innerIndex > TOTAL ? 0
    : innerIndex - 1;

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const moveTo = useCallback((nextIndex: number) => {
    if (isMoving.current) return;
    const t = totalRef.current;
    isMoving.current = true;
    setAnimate(true);
    setInnerIndex(nextIndex);

    setTimeout(() => {
      if (nextIndex > t) {
        setAnimate(false);
        setInnerIndex(1);
      } else if (nextIndex < 1) {
        setAnimate(false);
        setInnerIndex(t);
      }
      requestAnimationFrame(() => {
        isMoving.current = false;
      });
    }, TRANSITION_DURATION);
  }, []);

  // 자동 재생용
  useEffect(() => {
    if (!isPaused) {
      stopInterval();
      intervalRef.current = setInterval(() => {
        setInnerIndex((prev) => {
          if (isMoving.current) return prev;
          isMoving.current = true;
          setAnimate(true);
          const next = prev + 1;

          setTimeout(() => {
            if (next > totalRef.current) {
              setAnimate(false);
              setInnerIndex(1);
            }
            requestAnimationFrame(() => {
              isMoving.current = false;
            });
          }, TRANSITION_DURATION);

          return next;
        });
      }, SLIDE_INTERVAL);
    } else {
      stopInterval();
    }
    return stopInterval;
  }, [isPaused, stopInterval]);

  const goPrev = useCallback(() => {
    moveTo(innerIndex - 1);
  }, [innerIndex, moveTo]);

  const goNext = useCallback(() => {
    moveTo(innerIndex + 1);
  }, [innerIndex, moveTo]);

  // 슬라이드 배열: [복제 마지막] + [실제 1~5] + [복제 첫번째]
  const slides = [
    bannerSlides[TOTAL - 1],
    ...bannerSlides,
    bannerSlides[0],
  ];

  return (
    <section className="relative w-full overflow-hidden rounded-2xl">
      <div
        className={cn("flex", animate && "transition-transform duration-500 ease-in-out")}
        style={{ transform: `translateX(-${innerIndex * 100}%)` }}
      >
        {slides.map((slide, i) => (
          <div key={`${slide.id}-${i}`} className="min-w-full">
            <Link href={slide.link} className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.imageUrl}
                alt={slide.alt}
                className="aspect-[16/9] w-full object-cover"
                loading={i <= 1 ? "eager" : "lazy"}
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

      {/* 하단 우측 컨트롤 */}
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
          {displayIndex + 1}
          <span className="text-white/50"> / {TOTAL}</span>
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
          className="flex h-5 w-5 items-center justify-center text-white/70 hover:text-white"
        >
          {isPaused ? <Play size={10} strokeWidth={2.5} /> : <Pause size={10} strokeWidth={2.5} />}
        </button>
      </div>
    </section>
  );
}
