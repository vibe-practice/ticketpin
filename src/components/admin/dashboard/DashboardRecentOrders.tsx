"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AdminDataTable, type ColumnDef } from "@/components/admin/AdminDataTable";
import type { AdminOrderListItem, OrderStatus } from "@/types";

// OrderStatus Badge 설정
const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; text: string }
> = {
  paid: { label: "결제완료", bg: "bg-info-bg", text: "text-info" },
  password_set: { label: "비밀번호설정", bg: "bg-neutral-100", text: "text-neutral-600" },
  pin_revealed: { label: "핀해제", bg: "bg-success-bg", text: "text-success" },
  gifted: { label: "선물완료", bg: "bg-neutral-100", text: "text-neutral-900" },
  cancelled: { label: "취소", bg: "bg-error-bg", text: "text-error" },
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg = ORDER_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-[11px] font-semibold",
        cfg.bg,
        cfg.text
      )}
    >
      {cfg.label}
    </span>
  );
}

function FeeTypeBadge({ type }: { type: "included" | "separate" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
        type === "included"
          ? "bg-muted text-muted-foreground"
          : "bg-brand-primary-muted text-primary"
      )}
    >
      {type === "included" ? "포함" : "별도"}
    </span>
  );
}

// AdminDataTable용 행 타입
type OrderRow = AdminOrderListItem & Record<string, unknown>;

const COLUMNS: ColumnDef<OrderRow>[] = [
  {
    key: "order_number",
    label: "주문번호",
    width: "17%",
    render: (v) => (
      <span className="font-mono text-[14px] text-foreground">{String(v)}</span>
    ),
  },
  {
    key: "buyer_name",
    label: "구매자",
    width: "10%",
    render: (v, row) => (
      <div>
        <p className="text-[14px] font-medium text-foreground">{String(v)}</p>
        <p className="text-[11px] text-muted-foreground">{String(row.buyer_username)}</p>
      </div>
    ),
  },
  {
    key: "product_name",
    label: "상품명",
    width: "22%",
    render: (v) => (
      <span className="text-[14px] text-foreground line-clamp-1">{String(v)}</span>
    ),
  },
  {
    key: "quantity",
    label: "수량",
    align: "center",
    width: "6%",
    render: (v) => (
      <span className="text-[14px] font-semibold text-foreground">{String(v)}개</span>
    ),
  },
  {
    key: "fee_type",
    label: "수수료",
    align: "center",
    width: "7%",
    render: (v) => <FeeTypeBadge type={v as "included" | "separate"} />,
  },
  {
    key: "total_amount",
    label: "결제금액",
    align: "right",
    width: "12%",
    render: (v) => (
      <span className="text-[14px] font-semibold text-foreground">
        {Number(v).toLocaleString()}원
      </span>
    ),
  },
  {
    key: "status",
    label: "상태",
    align: "center",
    width: "12%",
    render: (v) => <OrderStatusBadge status={v as OrderStatus} />,
  },
  {
    key: "created_at",
    label: "주문일시",
    width: "14%",
    render: (v) => {
      const d = new Date(String(v));
      return (
        <span className="text-[14px] text-muted-foreground">
          {`${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`}
        </span>
      );
    },
  },
];

interface DashboardRecentOrdersProps {
  orders: AdminOrderListItem[];
}

export function DashboardRecentOrders({ orders }: DashboardRecentOrdersProps) {
  const rows = orders as OrderRow[];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">최근 주문</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">최근 8건의 주문 현황</p>
        </div>
        <Link
          href="/adminmaster/orders"
          className="text-xs font-medium text-primary hover:text-brand-primary-dark transition-colors"
        >
          전체 보기 →
        </Link>
      </div>

      {/* 테이블 (페이지네이션 없음) */}
      <div className="p-5">
        <AdminDataTable
          columns={COLUMNS}
          data={rows.slice(0, 8)}
          rowKey={(row) => String(row.id)}
          pageSizeOptions={[8]}
          emptyMessage="최근 주문이 없습니다."
          className="[&_.overflow-x-auto]:rounded-lg [&_table]:min-w-0"
        />
      </div>
    </div>
  );
}
