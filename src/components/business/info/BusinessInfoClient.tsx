"use client";

import { useState, useEffect, useCallback } from "react";
import { Building2, User, Phone, Landmark, Percent, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useBusinessAuth } from "@/components/business/BusinessAuthContext";
import { cn } from "@/lib/utils";
import type { Business } from "@/types";

// ─── 상태 라벨/색상 ────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; className: string }> = {
  active: { label: "운영중", className: "bg-green-100 text-green-700 border-green-200" },
  inactive: { label: "비활성", className: "bg-gray-100 text-gray-600 border-gray-200" },
  suspended: { label: "정지", className: "bg-red-100 text-red-700 border-red-200" },
  terminated: { label: "해지", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

// ─── 정보 항목 ──────────────────────────────────────────────────────────────
interface InfoItem {
  icon: React.ElementType;
  label: string;
  value: string | React.ReactNode;
}

export function BusinessInfoClient() {
  const { businessId } = useBusinessAuth();
  const [biz, setBiz] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInfo = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/business/${businessId}/info`, {
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setBiz(json.data as Business);
        }
      }
    } catch {
      // 네트워크 오류
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">업체 정보 로딩 중...</span>
      </div>
    );
  }

  if (!biz) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">업체 정보를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const status = STATUS_MAP[biz.status] ?? STATUS_MAP.inactive;

  const infoGroups: { title: string; items: InfoItem[] }[] = [
    {
      title: "기본 정보",
      items: [
        {
          icon: Building2,
          label: "업체명",
          value: (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{biz.business_name}</span>
              <Badge variant="outline" className={cn("text-[11px] px-2 py-0.5", status.className)}>
                {status.label}
              </Badge>
            </div>
          ),
        },
        { icon: User, label: "담당자", value: biz.contact_person },
        { icon: Phone, label: "연락처", value: biz.contact_phone },
      ],
    },
    {
      title: "정산 정보",
      items: [
        { icon: Landmark, label: "은행", value: biz.bank_name },
        { icon: Landmark, label: "계좌번호", value: biz.account_number },
        { icon: User, label: "예금주", value: biz.account_holder },
        {
          icon: Percent,
          label: "수수료율",
          value: (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {100 - biz.commission_rate}%
              </span>
              <span className="text-xs text-muted-foreground">
                (매출의 {biz.commission_rate}% 정산)
              </span>
            </div>
          ),
        },
      ],
    },
  ];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">업체정보</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          등록된 업체 정보를 확인할 수 있습니다. 수정이 필요한 경우 관리자에게 문의하세요.
        </p>
      </div>

      {/* 정보 카드 */}
      {infoGroups.map((group) => (
        <div
          key={group.title}
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
          <div className="border-b border-border bg-muted/30 px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
          </div>

          <div className="divide-y divide-border">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors duration-150"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-50 border border-neutral-200">
                    <Icon size={16} className="text-foreground" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-[80px] shrink-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="text-sm text-foreground">{item.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* 등록/수정일 */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span>등록일: {formatDate(biz.created_at)}</span>
        <span className="text-border">|</span>
        <span>최종 수정: {formatDate(biz.updated_at)}</span>
      </div>
    </div>
  );
}
