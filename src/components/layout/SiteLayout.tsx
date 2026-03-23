"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import type { Category } from "@/types";

interface SiteLayoutProps {
  children: React.ReactNode;
  footer: React.ReactNode;
  mainClassName?: string;
  categories?: Category[];
}

export function SiteLayout({ children, footer, mainClassName, categories }: SiteLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        categories={categories}
      />

      {/* 사이드바 너비만큼 오른쪽으로 밀기 (데스크탑만) */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[280px]">
        <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <main className={`flex-1 flex flex-col ${mainClassName ?? "bg-background"}`}>{children}</main>
        {footer}
      </div>
    </div>
  );
}
