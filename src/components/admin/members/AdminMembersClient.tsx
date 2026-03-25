"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Users, UserPlus, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminDataTable } from "@/components/admin/AdminDataTable";
import { AdminSearchFilterPanel } from "@/components/admin/AdminSearchFilterPanel";
import { AdminDateRangePicker, type DateRange } from "@/components/admin/AdminDateRangePicker";
import { AdminNumberRange, type NumberRangeValue } from "@/components/admin/AdminNumberRange";
import { AdminCsvExportButton, type CsvColumnDef } from "@/components/admin/AdminCsvExportButton";
import { MemberDetailModal } from "@/components/admin/members/MemberDetailModal";
import { MemberAddModal } from "@/components/admin/members/MemberAddModal";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime, formatPhone } from "@/lib/utils";
import type { AdminUserListItem, UserStatus } from "@/types";

// ─── 상태 맵 ──────────────────────────────────────────────────────────────────

const MEMBER_STATUS_STYLE: Record<UserStatus, string> = {
  active: "bg-success-bg text-success",
  suspended: "bg-error-bg text-error",
  withdrawn: "bg-muted text-muted-foreground",
};

const MEMBER_STATUS_LABEL: Record<UserStatus, string> = {
  active: "활성",
  suspended: "정지",
  withdrawn: "탈퇴",
};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

// ─── CSV 컬럼 정의 ────────────────────────────────────────────────────────────

const CSV_COLUMNS: CsvColumnDef<AdminUserListItem>[] = [
  { key: "id", label: "회원번호" },
  { key: "username", label: "아이디" },
  { key: "name", label: "이름" },
  { key: "phone", label: "연락처" },
  { key: "email", label: "이메일" },
  {
    key: "status",
    label: "상태",
    format: (v) => MEMBER_STATUS_LABEL[v as UserStatus] ?? String(v),
  },
  {
    key: "identity_verified",
    label: "본인인증",
    format: (v) => (v ? "완료" : "미완료"),
  },
  { key: "order_count", label: "구매 횟수" },
  {
    key: "total_purchase_amount",
    label: "총 구매 금액",
    format: (v) => `${Number(v).toLocaleString()}`,
  },
  { key: "voucher_count", label: "상품권 수" },
  { key: "gift_sent_count", label: "보낸 선물" },
  { key: "gift_received_count", label: "받은 선물" },
  {
    key: "created_at",
    label: "가입일",
    format: (v) => formatDateTime(String(v)),
  },
  {
    key: "updated_at",
    label: "최근 업데이트",
    format: (v) => formatDateTime(String(v)),
  },
];

// ─── 필터 상태 타입 ───────────────────────────────────────────────────────────

interface FilterState {
  memberStatus: string; // "all" | "active" | "suspended" | "withdrawn"
  joinDateRange: DateRange;
  lastLoginRange: DateRange;
  purchaseCountRange: NumberRangeValue;
}

const INITIAL_FILTERS: FilterState = {
  memberStatus: "all",
  joinDateRange: { from: null, to: null },
  lastLoginRange: { from: null, to: null },
  purchaseCountRange: {},
};

// ─── 테이블 행 타입 ───────────────────────────────────────────────────────────

type MemberRow = AdminUserListItem & Record<string, unknown>;

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function AdminMembersClient() {
  const [members, setMembers] = useState<AdminUserListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [selectedMember, setSelectedMember] = useState<AdminUserListItem | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // API에서 회원 목록 조회
  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "100"); // 가입일·구매횟수 등 클라이언트 필터링을 위해 넉넉히 조회

      // 서버 측 검색
      if (appliedSearch) {
        params.set("search", appliedSearch);
      }

      // 서버 측 상태 필터
      if (appliedFilters.memberStatus !== "all") {
        params.set("status", appliedFilters.memberStatus);
      }

      const res = await fetch(`/api/admin/members?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setMembers(json.data.data);
        setTotalCount(json.data.total);
      } else {
        setMembers([]);
        setTotalCount(0);
      }
    } catch {
      setMembers([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, appliedFilters.memberStatus]);

  // 초기 로드 + 필터 변경 시 재조회
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleMemberUpdate = useCallback((updated: AdminUserListItem) => {
    setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setSelectedMember(updated);
  }, []);

  // 회원 추가 성공 시 목록 재조회
  const handleAddSuccess = useCallback(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ─── 필터 적용 ──────────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    setAppliedFilters({ ...filters });
    setAppliedSearch(search);
  }, [filters, search]);

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setSearch("");
    setAppliedSearch("");
  }, []);

  const handleSearchSubmit = useCallback((value: string) => {
    setAppliedSearch(value);
  }, []);

  // ─── 데이터 필터링 ──────────────────────────────────────────────────────────

  const filteredMembers = useMemo<MemberRow[]>(() => {
    return (members as MemberRow[]).filter((member) => {
      // 검색, 회원 상태는 서버 API에서 이미 필터링됨 (fetchMembers 참조)

      // 가입일 기간
      if (appliedFilters.joinDateRange.from || appliedFilters.joinDateRange.to) {
        const joinDate = member.created_at.split("T")[0];
        if (
          appliedFilters.joinDateRange.from &&
          joinDate < appliedFilters.joinDateRange.from
        ) {
          return false;
        }
        if (
          appliedFilters.joinDateRange.to &&
          joinDate > appliedFilters.joinDateRange.to
        ) {
          return false;
        }
      }

      // 최근 로그인 기간 (updated_at으로 대체)
      if (appliedFilters.lastLoginRange.from || appliedFilters.lastLoginRange.to) {
        const lastDate = (member.updated_at as string).split("T")[0];
        if (
          appliedFilters.lastLoginRange.from &&
          lastDate < appliedFilters.lastLoginRange.from
        ) {
          return false;
        }
        if (
          appliedFilters.lastLoginRange.to &&
          lastDate > appliedFilters.lastLoginRange.to
        ) {
          return false;
        }
      }

      // 구매 횟수 범위
      const purchaseCount = member.order_count as number;
      if (
        appliedFilters.purchaseCountRange.min != null &&
        purchaseCount < appliedFilters.purchaseCountRange.min
      ) {
        return false;
      }
      if (
        appliedFilters.purchaseCountRange.max != null &&
        purchaseCount > appliedFilters.purchaseCountRange.max
      ) {
        return false;
      }

      return true;
    });
  }, [members, appliedFilters]);

  // ─── 활성 필터 칩 ───────────────────────────────────────────────────────────

  const activeFilters = useMemo(() => {
    const chips = [];

    if (appliedFilters.memberStatus !== "all") {
      chips.push({
        key: "memberStatus",
        label: "상태",
        value: MEMBER_STATUS_LABEL[appliedFilters.memberStatus as UserStatus] ?? appliedFilters.memberStatus,
        onRemove: () =>
          setAppliedFilters((prev) => ({ ...prev, memberStatus: "all" })),
      });
    }

    if (appliedFilters.joinDateRange.from || appliedFilters.joinDateRange.to) {
      const from = appliedFilters.joinDateRange.from ?? "";
      const to = appliedFilters.joinDateRange.to ?? "";
      chips.push({
        key: "joinDateRange",
        label: "가입일",
        value: from && to ? `${from} ~ ${to}` : from || to,
        onRemove: () =>
          setAppliedFilters((prev) => ({
            ...prev,
            joinDateRange: { from: null, to: null },
          })),
      });
    }

    if (appliedFilters.lastLoginRange.from || appliedFilters.lastLoginRange.to) {
      const from = appliedFilters.lastLoginRange.from ?? "";
      const to = appliedFilters.lastLoginRange.to ?? "";
      chips.push({
        key: "lastLoginRange",
        label: "최근 로그인",
        value: from && to ? `${from} ~ ${to}` : from || to,
        onRemove: () =>
          setAppliedFilters((prev) => ({
            ...prev,
            lastLoginRange: { from: null, to: null },
          })),
      });
    }

    if (
      appliedFilters.purchaseCountRange.min != null ||
      appliedFilters.purchaseCountRange.max != null
    ) {
      const min = appliedFilters.purchaseCountRange.min;
      const max = appliedFilters.purchaseCountRange.max;
      chips.push({
        key: "purchaseCountRange",
        label: "구매 횟수",
        value:
          min != null && max != null
            ? `${min}~${max}회`
            : min != null
              ? `${min}회 이상`
              : `${max!}회 이하`,
        onRemove: () =>
          setAppliedFilters((prev) => ({ ...prev, purchaseCountRange: {} })),
      });
    }

    return chips;
  }, [appliedFilters]);

  // ─── 테이블 컬럼 정의 ───────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: "username",
        label: "아이디",
        sortable: true,
        align: "center" as const,
        width: "100px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap font-mono text-[14px] text-foreground">
            {String(v)}
          </span>
        ),
      },
      {
        key: "name",
        label: "이름",
        sortable: true,
        align: "center" as const,
        width: "65px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] font-medium text-foreground">
            {String(v)}
          </span>
        ),
      },
      {
        key: "phone",
        label: "전화번호",
        align: "center" as const,
        width: "115px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap font-mono text-[14px] text-foreground">
            {formatPhone(String(v))}
          </span>
        ),
      },
      {
        key: "status",
        label: "상태",
        align: "center" as const,
        width: "65px",
        render: (v: unknown) => (
          <span
            className={cn(
              "whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-semibold",
              MEMBER_STATUS_STYLE[v as UserStatus]
            )}
          >
            {MEMBER_STATUS_LABEL[v as UserStatus]}
          </span>
        ),
      },
      {
        key: "identity_verified",
        label: "본인인증",
        align: "center" as const,
        width: "70px",
        render: (v: unknown) =>
          v ? (
            <span className="text-[11px] font-semibold text-success">완료</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">미완료</span>
          ),
      },
      {
        key: "created_at",
        label: "가입일",
        sortable: true,
        align: "center" as const,
        width: "130px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] text-muted-foreground">
            {formatDateTime(String(v))}
          </span>
        ),
      },
      {
        key: "updated_at",
        label: "최근 로그인",
        sortable: true,
        align: "center" as const,
        width: "130px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] text-muted-foreground">
            {formatDateTime(String(v))}
          </span>
        ),
      },
      {
        key: "order_count",
        label: "구매 횟수",
        sortable: true,
        align: "center" as const,
        width: "75px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] font-semibold text-foreground">
            {Number(v).toLocaleString()}건
          </span>
        ),
      },
      {
        key: "total_purchase_amount",
        label: "총 구매 금액",
        sortable: true,
        align: "center" as const,
        width: "100px",
        render: (v: unknown) => (
          <span className="whitespace-nowrap text-[14px] font-semibold text-foreground">
            {Number(v).toLocaleString()}원
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary-soft">
            <Users size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">회원 관리</h1>
            <p className="text-[14px] text-muted-foreground">
              전체 회원 목록을 조회하고 상세 정보를 확인합니다
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 회원 추가 */}
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-primary text-white hover:bg-brand-primary-dark"
            onClick={() => setAddModalOpen(true)}
          >
            <UserPlus size={14} />
            회원 추가
          </Button>
          {/* CSV 내보내기 */}
          <AdminCsvExportButton<AdminUserListItem>
            getData={() => filteredMembers as AdminUserListItem[]}
            columns={CSV_COLUMNS}
            filename="회원목록"
            label="CSV 내보내기"
            size="sm"
          />
        </div>
      </div>

      {/* 검색 + 필터 패널 */}
      <AdminSearchFilterPanel
        searchPlaceholder="아이디, 이름, 전화번호, 이메일로 검색"
        searchValue={search}
        onSearchChange={setSearch}
        onSearchSubmit={handleSearchSubmit}
        activeFilters={activeFilters}
        resultCount={isLoading ? totalCount : filteredMembers.length}
        onApply={handleApply}
        onReset={handleReset}
        defaultOpen={false}
      >
        {/* 필터 1: 회원 상태 */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">회원 상태</label>
          <Select
            value={filters.memberStatus}
            onValueChange={(v) =>
              setFilters((prev) => ({ ...prev, memberStatus: v }))
            }
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="active">활성</SelectItem>
              <SelectItem value="suspended">정지</SelectItem>
              <SelectItem value="withdrawn">탈퇴</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 필터 2: 가입일 기간 */}
        <AdminDateRangePicker
          label="가입일 기간"
          value={filters.joinDateRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, joinDateRange: v }))}
        />

        {/* 필터 3: 최근 로그인 기간 */}
        <AdminDateRangePicker
          label="최근 로그인 기간"
          value={filters.lastLoginRange}
          onChange={(v) => setFilters((prev) => ({ ...prev, lastLoginRange: v }))}
        />

        {/* 필터 4: 구매 횟수 범위 */}
        <AdminNumberRange
          label="구매 횟수 범위"
          value={filters.purchaseCountRange}
          onChange={(v) =>
            setFilters((prev) => ({ ...prev, purchaseCountRange: v }))
          }
          unit="회"
          min={0}
        />
      </AdminSearchFilterPanel>

      {/* 데이터 테이블 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">회원 목록을 불러오는 중...</span>
        </div>
      ) : (
        <AdminDataTable<MemberRow>
          columns={columns}
          data={filteredMembers}
          emptyMessage="조건에 맞는 회원이 없습니다."
          rowKey={(row) => row.id}
          onRowClick={(row) => setSelectedMember(row as AdminUserListItem)}
          pageSizeOptions={[10, 20, 50]}
        />
      )}

      {/* 상세 모달 */}
      <MemberDetailModal
        member={selectedMember}
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        onMemberUpdate={handleMemberUpdate}
      />

      {/* 회원 추가 모달 */}
      <MemberAddModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}
