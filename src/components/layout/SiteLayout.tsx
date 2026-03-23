"use client";

import { useState, useEffect } from "react";
import { SiteHeader } from "./SiteHeader";
import type { Category } from "@/types";

interface SiteLayoutProps {
  children: React.ReactNode;
  footer: React.ReactNode;
  mainClassName?: string;
  categories?: Category[];
}

export function SiteLayout({ children, footer, mainClassName, categories }: SiteLayoutProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader
        categories={categories}
        isScrolled={isScrolled}
        isVisible={true}
      />
      <main className={`flex-1 pt-[60px] ${mainClassName ?? ""}`}>{children}</main>
      {footer}
    </div>
  );
}
