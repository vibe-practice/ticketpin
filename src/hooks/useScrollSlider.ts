"use client";

import { useRef, useEffect, useState, useCallback } from "react";

export function useScrollSlider() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateButtons();
    el.addEventListener("scroll", updateButtons, { passive: true });
    const ro = new ResizeObserver(updateButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      ro.disconnect();
    };
  }, [updateButtons]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    if (cards.length === 0) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const cur = el.scrollLeft;

    if (dir === "right") {
      const next = cards.find((c) => c.offsetLeft > cur + 2);
      el.scrollTo({ left: next ? Math.min(next.offsetLeft, maxScroll) : maxScroll, behavior: "smooth" });
    } else {
      const prev = [...cards].reverse().find((c) => c.offsetLeft < cur - 2);
      el.scrollTo({ left: prev ? prev.offsetLeft : 0, behavior: "smooth" });
    }
  };

  return { scrollRef, canScrollLeft, canScrollRight, scroll };
}
