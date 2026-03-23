"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Building2,
  Calculator,
  TrendingUp,
  CreditCard,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn, formatPhone, getToday, shiftDate } from "@/lib/utils";
import {
  SETTLEMENT_STATUS_STYLE,
  SETTLEMENT_STATUS_LABEL,
  BUSINESS_STATUS_STYLE,
  BUSINESS_STATUS_LABEL,
} from "@/lib/admin-constants";
import type {
  BusinessStatus,
  SettlementStatus,
} from "@/types";

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface OverviewRow {
  business_id: string;
  business_name: string;
  contact_person: string;
  contact_phone: string;
  bank_name: string;
  account_number: string;
  gift_total_amount: number;
  settlement_amount: number;
  settlement_status: SettlementStatus | null;
  commission_rate: number;
  status: BusinessStatus;
}

interface OverviewSummary {
  total_businesses: number;
  total_gift_amount: number;
  total_settlement_amount: number;
  pending_count: number;
}

// ─── 기간 프리셋 타입 ────────────────────────────────────────────────────────

type PeriodPreset = "daily" | "weekly" | "monthly" | "custom";

// ─── 요약 카드 컴포넌트 ──────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
  color,
  bgColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  color: string;
  bgColor: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        highlight
          ? "border-primary/20 bg-brand-primary-soft/30"
          : "border-border bg-card"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            bgColor
          )}
        >
          <Icon size={14} className={color} />
        </div>
        <span className="text-[12px] text-muted-foreground">{label}</span>
      </div>
      <p
        className={cn(
          "text-[18px] font-bold",
          highlight ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminSettlementsOverviewClient() {
  const { toast } = useToast();

  // 기간 필터 상태 — 단일 객체로 관리하여 이중 API 호출 방지
  const [preset, setPreset] = useState<PeriodPreset>("daily");
  const [dateRange, setDateRange] = useState(() => {
    const t = getToday();
    return { start: t, end: t };
  });

  // 검색 + 상태 필터
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // API 데이터
  const [rows, setRows] = useState<OverviewRow[]>([]);
  const [summary, setSummary] = useState<OverviewSummary>({
    total_businesses: 0,
    total_gift_amount: 0,
    total_settlement_amount: 0,
    pending_count: 0,
  });
  const [loading, setLoading] = useState(true);

  // 이중결제 미처리 건수
  const [duplicatePaymentFailedCount, setDuplicatePaymentFailedCount] = useState(0);

  // 편의 변수
  const startDate = dateRange.start;
  const endDate = dateRange.end;

  // ─── API 데이터 조회 ──────────────────────────────────────────────────────

  const fetchOverview = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: start,
        end_date: end,
      });
      const res = await fetch(`/api/admin/settlements/overview?${params.toString()}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast({ type: "error", title: json.error?.message ?? "정산 데이터 조회에 실패했습니다." });
        return;
      }

      const data = json.data as {
        rows: OverviewRow[];
        summary: OverviewSummary;
      };

      setRows(data.rows);
      setSummary(data.summary);
    } catch {
      toast({ type: "error", title: "정산 데이터를 불러올 수 없습니다." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 이중결제 미처리 건수 조회
  const fetchDuplicatePaymentCount = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        reason_type: "duplicate_payment",
        cancel_status: "failed",
        limit: "1",
        page: "1",
      });
      const res = await fetch(`/api/admin/cancellations?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDuplicatePaymentFailedCount(json.data.total ?? json.data.data?.length ?? 0);
      }
    } catch {
      // 무시 — 경고 배너가 안 뜨는 정도
    }
  }, []);

  // 초기 로드 + 날짜 변경 시 재조회
  useEffect(() => {
    fetchOverview(dateRange.start, dateRange.end);
  }, [dateRange, fetchOverview]);

  // 이중결제 미처리 건수 초기 조회
  useEffect(() => {
    fetchDuplicatePaymentCount();
  }, [fetchDuplicatePaymentCount]);

  // 프리셋 변경 핸들러
  const handlePresetChange = (p: PeriodPreset) => {
    setPreset(p);
    const t = getToday();
    if (p === "daily") {
      setDateRange({ start: t, end: t });
    } else if (p === "weekly") {
      setDateRange({ start: shiftDate(t, -6), end: t });
    } else if (p === "monthly") {
      setDateRange({ start: shiftDate(t, -29), end: t });
    }
    // custom: 날짜 유지
  };

  // 날짜 이동
  const handleShift = (days: number) => {
    if (preset === "daily") {
      const next = shiftDate(startDate, days);
      setDateRange({ start: next, end: next });
    } else {
      setDateRange({
        start: shiftDate(startDate, days),
        end: shiftDate(endDate, days),
      });
    }
  };

  // 클라이언트 측 검색 + 상태 필터링
  const filteredRows = useMemo(() => {
    let result = rows;
    // 상태 필터
    if (statusFilter !== "all") {
      if (statusFilter === "none") {
        result = result.filter((r) => !r.settlement_status);
      } else {
        result = result.filter((r) => r.settlement_status === statusFilter);
      }
    }
    // 검색
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.business_name.toLowerCase().includes(q) ||
          r.contact_person.toLowerCase().includes(q) ||
          r.bank_name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [search, statusFilter, rows]);

  // 검색 결과 기반 요약 (검색 시 필터된 결과로 재계산)
  const displaySummary = useMemo(() => {
    if (!search.trim() && statusFilter === "all") return summary;
    const activeRows = filteredRows.filter((r) => r.status === "active");
    return {
      total_businesses: activeRows.length,
      total_gift_amount: activeRows.reduce((s, r) => s + r.gift_total_amount, 0),
      total_settlement_amount: activeRows.reduce((s, r) => s + r.settlement_amount, 0),
      pending_count: activeRows.filter((r) => r.settlement_status === "pending").length,
    };
  }, [search, statusFilter, filteredRows, summary]);

  const PERIOD_PRESETS: { key: PeriodPreset; label: string }[] = [
    { key: "daily", label: "일별" },
    { key: "weekly", label: "주간" },
    { key: "monthly", label: "월별" },
    { key: "custom", label: "직접 선택" },
  ];

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      {/* ── 페이지 헤더 ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary-soft">
          <Calculator size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground md:text-xl">
            정산 전체보기
          </h1>
          <p className="text-[12px] text-muted-foreground">
            전체 업체의 정산 현황을 한눈에 확인합니다
          </p>
        </div>
      </div>

      {/* ── 이중결제 미처리 경고 배너 ──────────────────────────────── */}
      {duplicatePaymentFailedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-error/30 bg-error-bg px-4 py-3">
          <AlertTriangle size={18} className="shrink-0 text-error" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-error">
              미처리 이중결제 환불 {duplicatePaymentFailedCount}건
            </p>
            <p className="text-[12px] text-error/80">
              수수료 이중결제 자동 취소가 실패한 건이 있습니다. 환불 관리에서 확인해 주세요.
            </p>
          </div>
          <a
            href="/admin/refunds"
            className="shrink-0 rounded-md bg-error px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-error/90"
          >
            환불 관리
          </a>
        </div>
      )}

      {/* ── 기간 필터 ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        {/* 프리셋 탭 */}
        <div className="flex items-center gap-1">
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => handlePresetChange(p.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[13px] font-medium transition-all duration-150",
                preset === p.key
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 날짜 범위 선택 */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 shrink-0 p-0"
            onClick={() => handleShift(-1)}
          >
            <ChevronLeft size={16} />
          </Button>

          <div className="flex min-w-0 flex-1 items-center gap-1.5 md:flex-none md:gap-2">
            <Calendar size={15} className="hidden shrink-0 text-primary md:block" />
            <Input
              type="date"
              value={startDate}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              onChange={(e) => {
                const v = e.target.value;
                setPreset("custom");
                setDateRange((prev) => ({
                  start: v,
                  end: v > prev.end ? v : prev.end,
                }));
              }}
              className="h-9 min-w-0 flex-1 cursor-pointer text-sm md:w-[145px] md:flex-none"
            />
            <span className="shrink-0 text-[13px] text-muted-foreground">~</span>
            <Input
              type="date"
              value={endDate}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              onChange={(e) => {
                const v = e.target.value;
                setPreset("custom");
                setDateRange((prev) => ({
                  start: v < prev.start ? v : prev.start,
                  end: v,
                }));
              }}
              className="h-9 min-w-0 flex-1 cursor-pointer text-sm md:w-[145px] md:flex-none"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 shrink-0 p-0"
            onClick={() => handleShift(1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* ── 요약 카드 ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <SummaryCard
          icon={Building2}
          label="활성 업체 수"
          value={loading ? "-" : `${displaySummary.total_businesses}개`}
          color="text-primary"
          bgColor="bg-brand-primary-soft"
        />
        <SummaryCard
          icon={CreditCard}
          label="총 매출 금액"
          value={loading ? "-" : `${displaySummary.total_gift_amount.toLocaleString()}원`}
          color="text-foreground"
          bgColor="bg-muted"
        />
        <SummaryCard
          icon={TrendingUp}
          label="총 정산 금액"
          value={loading ? "-" : `${displaySummary.total_settlement_amount.toLocaleString()}원`}
          highlight
          color="text-primary"
          bgColor="bg-brand-primary-soft"
        />
        <SummaryCard
          icon={Calculator}
          label="정산 대기 업체"
          value={loading ? "-" : `${displaySummary.pending_count}개`}
          sub="확인 필요"
          color="text-neutral-600"
          bgColor="bg-neutral-100"
        />
      </div>

      {/* ── 검색 + 상태 필터 바 ──────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 md:max-w-[360px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="업체명, 담당자, 은행명으로 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[130px] text-sm">
            <SelectValue placeholder="상태 전체" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">상태 전체</SelectItem>
            <SelectItem value="pending">대기</SelectItem>
            <SelectItem value="confirmed">확정</SelectItem>
            <SelectItem value="paid">지급완료</SelectItem>
            <SelectItem value="cancelled">취소</SelectItem>
            <SelectItem value="none">미생성</SelectItem>
          </SelectContent>
        </Select>
        {(search || statusFilter !== "all") && (
          <span className="text-[12px] text-muted-foreground">
            {filteredRows.length}개 업체
          </span>
        )}
      </div>

      {/* ── 로딩 상태 ────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-[13px] text-muted-foreground">데이터를 불러오는 중...</span>
        </div>
      ) : (
        <>
          {/* ── 업체 테이블 (데스크탑) ──────────────────────────────── */}
          <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-muted-foreground">
                      업체명
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-muted-foreground">
                      담당자
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-muted-foreground">
                      연락처
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-muted-foreground">
                      은행명
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-muted-foreground">
                      계좌번호
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-muted-foreground">
                      선물 보낸 금액
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-muted-foreground">
                      정산 금액
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-muted-foreground">
                      정산 상태
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-muted-foreground">
                      업체 상태
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-12 text-center text-[13px] text-muted-foreground"
                      >
                        {search ? "검색 결과가 없습니다." : "해당 기간에 정산 데이터가 없습니다."}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr
                        key={row.business_id}
                        className={cn(
                          "border-b border-border last:border-b-0 transition-colors hover:bg-muted/20",
                          row.status === "terminated" && "opacity-60"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-primary-soft">
                              <Building2 size={13} className="text-primary" />
                            </div>
                            <span className="font-semibold text-foreground">
                              {row.business_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {row.contact_person}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center text-muted-foreground">
                          {formatPhone(row.contact_phone)}
                        </td>
                        <td className="px-4 py-3 text-center text-foreground">
                          {row.bank_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center font-mono text-[12px] text-muted-foreground">
                          {row.account_number}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-foreground">
                          {row.gift_total_amount.toLocaleString()}원
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-primary">
                          {row.settlement_amount.toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.settlement_status ? (
                            <span
                              className={cn(
                                "rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                                SETTLEMENT_STATUS_STYLE[row.settlement_status]
                              )}
                            >
                              {SETTLEMENT_STATUS_LABEL[row.settlement_status]}
                            </span>
                          ) : (
                            <span className="text-[12px] text-muted-foreground">
                              미생성
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              "rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                              BUSINESS_STATUS_STYLE[row.status]
                            )}
                          >
                            {BUSINESS_STATUS_LABEL[row.status]}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* 합계 행 */}
                {filteredRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/40 font-semibold">
                      <td className="px-4 py-3 text-foreground" colSpan={5}>
                        합계 ({filteredRows.filter((r) => r.status === "active").length}개 활성 업체)
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-foreground">
                        {displaySummary.total_gift_amount.toLocaleString()}원
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-primary">
                        {displaySummary.total_settlement_amount.toLocaleString()}원
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ── 업체 카드 리스트 (모바일) ──────────────────────────── */}
          <div className="flex flex-col gap-2 md:hidden">
            {/* 합계 배너 */}
            <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-brand-primary-muted px-4 py-3">
              <span className="text-[13px] font-semibold text-foreground">
                {displaySummary.total_businesses}개 업체
              </span>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">
                  매출 {displaySummary.total_gift_amount.toLocaleString()}원
                </p>
                <p className="text-[14px] font-bold text-primary">
                  정산 {displaySummary.total_settlement_amount.toLocaleString()}원
                </p>
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-8 text-center">
                <p className="text-[13px] text-muted-foreground">
                  {search ? "검색 결과가 없습니다." : "해당 기간에 정산 데이터가 없습니다."}
                </p>
              </div>
            ) : (
              filteredRows.map((row) => (
                <div
                  key={row.business_id}
                  className={cn(
                    "rounded-lg border border-border bg-card p-4",
                    row.status === "terminated" && "opacity-60"
                  )}
                >
                  {/* 헤더: 업체명 + 상태 뱃지 */}
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-primary-soft">
                        <Building2 size={13} className="text-primary" />
                      </div>
                      <span className="text-[14px] font-semibold text-foreground">
                        {row.business_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {row.settlement_status ? (
                        <span
                          className={cn(
                            "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
                            SETTLEMENT_STATUS_STYLE[row.settlement_status]
                          )}
                        >
                          {SETTLEMENT_STATUS_LABEL[row.settlement_status]}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">미생성</span>
                      )}
                      <span
                        className={cn(
                          "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
                          BUSINESS_STATUS_STYLE[row.status]
                        )}
                      >
                        {BUSINESS_STATUS_LABEL[row.status]}
                      </span>
                    </div>
                  </div>

                  {/* 담당자 + 연락처 */}
                  <div className="mb-2.5 flex items-center gap-4 text-[12px] text-muted-foreground">
                    <span>{row.contact_person}</span>
                    <span>{formatPhone(row.contact_phone)}</span>
                  </div>

                  {/* 계좌 정보 */}
                  <div className="mb-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <span>{row.bank_name}</span>
                    <span className="font-mono text-[11px]">{row.account_number}</span>
                  </div>

                  {/* 금액 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground">선물 보낸 금액</p>
                      <p className="text-[13px] font-medium text-foreground">
                        {row.gift_total_amount.toLocaleString()}원
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">정산 금액</p>
                      <p className="text-[15px] font-bold text-primary">
                        {row.settlement_amount.toLocaleString()}원
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
