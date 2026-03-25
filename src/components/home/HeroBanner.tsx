"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface BannerSlide {
  id: string;
  imageUrl: string;
  alt: string;
  link: string;
}

const SLIDE_INTERVAL = 5000;
const TRANSITION_DURATION = 500;

export function HeroBanner() {
  const [bannerSlides, setBannerSlides] = useState<BannerSlide[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // innerIndex: 0=복제마지막, 1~TOTAL=실제, TOTAL+1=복제첫번째
  const [innerIndex, setInnerIndex] = useState(1);
  const [animate, setAnimate] = useState(false); // 초기값 false로 변경 — 첫 렌더 시 transition 방지
  const [isPaused, setIsPaused] = useState(false);
  const isMoving = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalRef = useRef(0);
  const innerIndexRef = useRef(1); // interval 콜백에서 최신값 참조용

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
        // API 실패 시 배너 영역 숨김
      } finally {
        setIsLoaded(true);
      }
    }
    fetchBanners();
  }, []);

  const TOTAL = bannerSlides.length;
  useEffect(() => { totalRef.current = TOTAL; }, [TOTAL]);
  useEffect(() => { innerIndexRef.current = innerIndex; }, [innerIndex]);

  const displayIndex =
    TOTAL === 0 ? 0
    : innerIndex <= 0 ? TOTAL - 1
    : innerIndex > TOTAL ? 0
    : innerIndex - 1;

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 슬라이드 이동 — 경계 리셋 시 2-frame 접근으로 팅김 방지
  const moveTo = useCallback((nextIndex: number) => {
    if (isMoving.current) return;
    const t = totalRef.current;
    if (t === 0) return;

    isMoving.current = true;
    setAnimate(true);
    setInnerIndex(nextIndex);

    setTimeout(() => {
      const needsReset = nextIndex > t || nextIndex < 1;
      if (needsReset) {
        const resetTo = nextIndex > t ? 1 : t;
        // 1프레임: transition 제거
        setAnimate(false);
        // 2프레임: transition 없는 상태에서 위치 리셋 (눈에 안 보임)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setInnerIndex(resetTo);
            innerIndexRef.current = resetTo;
            isMoving.current = false;
          });
        });
      } else {
        isMoving.current = false;
      }
    }, TRANSITION_DURATION);
  }, []);

  // 자동 재생 — updater 함수 안에서 side effect 호출하지 않음
  useEffect(() => {
    if (TOTAL === 0 || isPaused) {
      stopInterval();
      return stopInterval;
    }

    stopInterval();
    intervalRef.current = setInterval(() => {
      const next = innerIndexRef.current + 1;
      moveTo(next);
    }, SLIDE_INTERVAL);

    return stopInterval;
  }, [isPaused, stopInterval, TOTAL, moveTo]);

  const goPrev = useCallback(() => {
    stopInterval();
    moveTo(innerIndexRef.current - 1);
  }, [moveTo, stopInterval]);

  const goNext = useCallback(() => {
    stopInterval();
    moveTo(innerIndexRef.current + 1);
  }, [moveTo, stopInterval]);

  // 수동 조작 후 자동 재생 재시작
  useEffect(() => {
    if (isPaused || TOTAL === 0) return;
    // goPrev/goNext가 interval을 멈추므로, 다음 틱에서 재시작
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        const next = innerIndexRef.current + 1;
        moveTo(next);
      }, SLIDE_INTERVAL);
    }
    return stopInterval;
  }, [innerIndex, isPaused, TOTAL, moveTo, stopInterval]);

  // 로딩 중 placeholder
  if (!isLoaded) {
    return (
      <section className="w-full overflow-hidden rounded-2xl">
        <div className="aspect-[16/9] w-full bg-gradient-to-br from-neutral-100 to-neutral-200 animate-pulse" />
      </section>
    );
  }

  // 배너 데이터 없으면 영역 숨김
  if (TOTAL === 0) {
    return null;
  }

  // 슬라이드 배열: [복제 마지막] + [실제 1~N] + [복제 첫번째]
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
