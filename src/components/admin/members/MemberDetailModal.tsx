"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  User,
  ShoppingBag,
  Ticket,
  Gift,
  Settings,
  CheckCircle2,
  AlertCircle,
  Shield,
  Calendar,
  Phone,
  Mail,
  Hash,
  Loader2,
} from "lucide-react";
import { cn, formatDateTime, formatPhone } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
// API 연동: mock 데이터 대신 서버 API에서 조회
import type {
  AdminUserListItem,
  UserStatus,
  AdminOrderListItem,
  AdminGiftListItem,
  VoucherStatus,
  OrderStatus,
  FeeType,
} from "@/types";

// ─── 상태 맵 ──────────────────────────────────────────────────────────────────

const MEMBER_STATUS_MAP: Record<UserStatus, { label: string; className: string }> = {
  active: { label: "활성", className: "bg-success-bg text-success" },
  suspended: { label: "정지", className: "bg-error-bg text-error" },
  withdrawn: { label: "탈퇴", className: "bg-muted text-muted-foreground" },
};

const VOUCHER_STATUS_MAP: Record<VoucherStatus, { label: string; className: string }> = {
  issued: { label: "발급", className: "bg-info-bg text-info" },
  temp_verified: { label: "임시인증", className: "bg-neutral-100 text-neutral-600" },
  password_set: { label: "비번설정", className: "bg-brand-primary-soft text-primary" },
  pin_revealed: { label: "핀확인", className: "bg-success-bg text-success" },
  gifted: { label: "선물", className: "bg-neutral-100 text-neutral-600" },
  cancelled: { label: "취소", className: "bg-error-bg text-error" },
};

type DisplayOrderStatus = "paid" | "cancelled";

function getDisplayOrderStatus(status: OrderStatus): DisplayOrderStatus {
  return status === "cancelled" ? "cancelled" : "paid";
}

const ORDER_STATUS_STYLE: Record<DisplayOrderStatus, string> = {
  paid: "bg-info-bg text-info",
  cancelled: "bg-error-bg text-error",
};

const ORDER_STATUS_LABEL: Record<DisplayOrderStatus, string> = {
  paid: "결제완료",
  cancelled: "취소",
};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatDateTime(iso);
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  iconClassName,
}: {
  icon: React.ElementType;
  title: string;
  iconClassName?: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded",
          iconClassName ?? "bg-muted text-muted-foreground"
        )}
      >
        <Icon size={13} />
      </div>
      <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="w-28 shrink-0 text-[14px] text-muted-foreground">{label}</span>
      <span className="flex-1 text-[14px] text-foreground">{children}</span>
    </div>
  );
}

// ─── 탭 ────────────────────────────────────────────────────────────────────────

type TabKey = "info" | "orders" | "vouchers" | "gifts";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "info", label: "회원 정보", icon: User },
  { key: "orders", label: "구매 내역", icon: ShoppingBag },
  { key: "vouchers", label: "상품권", icon: Ticket },
  { key: "gifts", label: "선물", icon: Gift },
];

// ─── 탭 콘텐츠: 회원 정보 ────────────────────────────────────────────────────

interface InfoTabProps {
  member: AdminUserListItem;
  onStatusChange: (newStatus: UserStatus) => void;
  statusLoading: boolean;
}

function InfoTab({ member, onStatusChange, statusLoading }: InfoTabProps) {
  const [pendingStatus, setPendingStatus] = useState<UserStatus>(member.status);
  const confirm = useConfirm();

  const handleStatusChange = async (newStatus: UserStatus) => {
    if (newStatus === member.status) return;
    const ok = await confirm({
      title: "회원 상태 변경",
      description: `${member.name}(${member.username}) 회원 상태를 [${MEMBER_STATUS_MAP[member.status]?.label}] → [${MEMBER_STATUS_MAP[newStatus]?.label}]으로 변경합니다.`,
      confirmLabel: "변경",
      cancelLabel: "취소",
      variant: newStatus === "suspended" || newStatus === "withdrawn" ? "destructive" : undefined,
    });
    if (!ok) {
      setPendingStatus(member.status);
      return;
    }
    onStatusChange(newStatus);
  };

  return (
    <div className="space-y-5">
      {/* 기본 정보 */}
      <section>
        <SectionHeader icon={User} title="기본 정보" iconClassName="bg-brand-primary-soft text-primary" />
        <div className="divide-y divide-border/50 rounded-lg border border-border bg-muted/20 px-4">
          <InfoRow label="아이디">
            <span className="font-mono">{member.username}</span>
          </InfoRow>
          <InfoRow label="이름">{member.name}</InfoRow>
          <InfoRow label="이메일">
            <span className="flex items-center gap-1.5">
              <Mail size={12} className="text-muted-foreground" />
              {member.email}
            </span>
          </InfoRow>
          <InfoRow label="전화번호">
            <span className="flex items-center gap-1.5">
              <Phone size={12} className="text-muted-foreground" />
              <span className="font-mono">{formatPhone(member.phone)}</span>
            </span>
          </InfoRow>
          <InfoRow label="본인인증">
            {member.identity_verified ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 size={13} /> 완료
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <AlertCircle size={13} /> 미완료
              </span>
            )}
          </InfoRow>
          <InfoRow label="가입일">
            <span className="flex items-center gap-1.5">
              <Calendar size={12} className="text-muted-foreground" />
              {formatDate(member.created_at)}
            </span>
          </InfoRow>
          <InfoRow label="최근 업데이트">{formatDate(member.updated_at)}</InfoRow>
          <InfoRow label="회원번호">
            <span className="flex items-center gap-1.5 font-mono text-[14px] text-muted-foreground">
              <Hash size={12} />
              {member.id}
            </span>
          </InfoRow>
        </div>
      </section>

      {/* 구매 통계 */}
      <section>
        <SectionHeader icon={ShoppingBag} title="구매 통계" iconClassName="bg-neutral-100 text-neutral-600" />
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "총 구매 건수", value: `${member.order_count.toLocaleString()}건` },
            { label: "총 구매 금액", value: `${member.total_purchase_amount.toLocaleString()}원` },
            { label: "보유 상품권", value: `${member.voucher_count}개` },
            { label: "보낸 선물", value: `${member.gift_sent_count}건` },
            { label: "받은 선물", value: `${member.gift_received_count}건` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-[15px] font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 상태 변경 */}
      <section>
        <SectionHeader icon={Settings} title="상태 변경" iconClassName="bg-brand-primary-soft text-primary" />
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="mb-1.5 block text-[14px] text-muted-foreground">현재 상태</Label>
              <span
                className={cn(
                  "inline-block rounded-sm px-2.5 py-1 text-[14px] font-semibold",
                  MEMBER_STATUS_MAP[member.status]?.className
                )}
              >
                {MEMBER_STATUS_MAP[member.status]?.label}
              </span>
            </div>
            <div className="flex-1">
              <Label className="mb-1.5 block text-[14px] text-muted-foreground">변경</Label>
              <Select
                value={pendingStatus}
                onValueChange={(v) => {
                  setPendingStatus(v as UserStatus);
                  handleStatusChange(v as UserStatus);
                }}
                disabled={statusLoading}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="suspended">정지</SelectItem>
                  <SelectItem value="withdrawn">탈퇴</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {statusLoading && (
              <div className="flex items-center gap-1.5 self-end pb-1 text-[14px] text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                처리 중
              </div>
            )}
          </div>
          <p className="mt-2.5 text-[11px] text-muted-foreground">
            정지: 로그인 및 서비스 이용이 차단됩니다. 탈퇴: 회원 데이터가 비활성화됩니다.
          </p>
        </div>
      </section>
    </div>
  );
}

// ─── 탭 콘텐츠: 구매 내역 ────────────────────────────────────────────────────

function OrdersTab({ orders }: { orders: AdminOrderListItem[] }) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ShoppingBag size={32} className="mb-3 text-muted-foreground/40" />
        <p className="text-[14px] font-medium text-muted-foreground">구매 내역이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">주문번호</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">상품명</th>
            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">금액</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">상태</th>
            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">주문일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-muted/20">
          {orders.map((order) => {
            const displayStatus = getDisplayOrderStatus(order.status);
            return (
              <tr key={order.id} className="hover:bg-muted/40 transition-colors">
                <td className="px-3 py-2.5">
                  <span className="font-mono text-[11px] text-muted-foreground">{order.order_number}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    {order.product_image_url && (
                      <Image
                        src={order.product_image_url}
                        alt={order.product_name}
                        width={24}
                        height={24}
                        className="h-6 w-6 shrink-0 rounded object-cover"
                      />
                    )}
                    <span className="truncate max-w-[130px] text-foreground" title={order.product_name}>
                      {order.product_name}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                  {order.total_amount.toLocaleString()}원
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
                      ORDER_STATUS_STYLE[displayStatus]
                    )}
                  >
                    {ORDER_STATUS_LABEL[displayStatus]}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">
                  {formatDate(order.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── 탭 콘텐츠: 상품권 ────────────────────────────────────────────────────────

function VouchersTab({ orders }: { orders: AdminOrderListItem[] }) {
  // 주문에서 바우처가 있는 항목만 추출
  const vouchers = orders.filter((o) => o.voucher_code && o.voucher_status);

  if (vouchers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Ticket size={32} className="mb-3 text-muted-foreground/40" />
        <p className="text-[14px] font-medium text-muted-foreground">상품권이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-[14px]">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">바우처 코드</th>
            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">상품명</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">핀 수</th>
            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">상태</th>
            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground">발급일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-muted/20">
          {vouchers.map((order) => (
            <tr key={order.voucher_id} className="hover:bg-muted/40 transition-colors">
              <td className="px-3 py-2.5">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {order.voucher_code?.slice(0, 8)}…
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                  {order.product_image_url && (
                    <Image
                      src={order.product_image_url}
                      alt={order.product_name}
                      width={24}
                      height={24}
                      className="h-6 w-6 shrink-0 rounded object-cover"
                    />
                  )}
                  <span className="truncate max-w-[130px] text-foreground" title={order.product_name}>
                    {order.product_name}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-center text-foreground">{order.pin_count}개</td>
              <td className="px-3 py-2.5 text-center">
                {order.voucher_status && (
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
                      VOUCHER_STATUS_MAP[order.voucher_status]?.className
                    )}
                  >
                    {VOUCHER_STATUS_MAP[order.voucher_status]?.label}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right text-muted-foreground">
                {formatDate(order.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 탭 콘텐츠: 선물 ──────────────────────────────────────────────────────────

const FEE_TYPE_LABEL: Record<FeeType, { label: string; className: string }> = {
  included: { label: "포함", className: "bg-info-bg text-info" },
  separate: { label: "별도", className: "bg-neutral-100 text-neutral-600" },
};

function GiftTable({
  items,
  type,
}: {
  items: AdminGiftListItem[];
  type: "sent" | "received";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[14px] font-semibold text-muted-foreground">
        {type === "sent" ? "보낸 선물" : "받은 선물"} ({items.length}건)
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full table-fixed text-[14px]">
          <colgroup>
            <col style={{ width: "16%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-muted-foreground">선물일</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-muted-foreground">
                {type === "sent" ? "수신자" : "발신자"}
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left font-semibold text-muted-foreground">상품명</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-muted-foreground">단가</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold text-muted-foreground">수량</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-muted-foreground">수수료</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-muted-foreground">총 금액</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-center font-semibold text-muted-foreground">수수료 결제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-muted/20">
            {items.map((gift) => (
              <tr key={gift.id} className="hover:bg-muted/40 transition-colors">
                <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                  {formatDate(gift.created_at)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-foreground">
                  {type === "sent" ? gift.receiver_username : gift.sender_username}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                  {gift.product_name}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-foreground">
                  {gift.product_price.toLocaleString()}원
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-center text-foreground">
                  {gift.order_quantity}개
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-foreground">
                  {gift.fee_amount.toLocaleString()}원
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-foreground">
                  {gift.total_amount.toLocaleString()}원
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-center">
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
                      FEE_TYPE_LABEL[gift.fee_type]?.className
                    )}
                  >
                    {FEE_TYPE_LABEL[gift.fee_type]?.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GiftsTab({ gifts, memberId }: { gifts: AdminGiftListItem[]; memberId: string }) {
  const sent = gifts.filter((g) => g.sender_id === memberId);
  const received = gifts.filter((g) => g.receiver_id === memberId);

  if (gifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Gift size={32} className="mb-3 text-muted-foreground/40" />
        <p className="text-[14px] font-medium text-muted-foreground">선물 내역이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <GiftTable items={sent} type="sent" />
      <GiftTable items={received} type="received" />
    </div>
  );
}

// ─── 메인 모달 ────────────────────────────────────────────────────────────────

interface MemberDetailModalProps {
  member: AdminUserListItem | null;
  open: boolean;
  onClose: () => void;
  onMemberUpdate?: (updated: AdminUserListItem) => void;
}

export function MemberDetailModal({
  member,
  open,
  onClose,
  onMemberUpdate,
}: MemberDetailModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("info");
  const [statusLoading, setStatusLoading] = useState(false);
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [gifts, setGifts] = useState<AdminGiftListItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (member) {
      setActiveTab("info");
      // API에서 회원 상세 데이터(주문/선물) 조회
      setDetailLoading(true);
      fetch(`/api/admin/members/${member.id}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setOrders(json.data.orders ?? []);
            setGifts(json.data.gifts ?? []);
            // 서버에서 최신 카운트 정보를 반영
            if (json.data.member && onMemberUpdate) {
              onMemberUpdate(json.data.member);
            }
          } else {
            setOrders([]);
            setGifts([]);
          }
        })
        .catch(() => {
          setOrders([]);
          setGifts([]);
        })
        .finally(() => setDetailLoading(false));
    } else {
      setOrders([]);
      setGifts([]);
    }
  }, [member?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!member) return null;

  const handleStatusChange = async (newStatus: UserStatus) => {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/admin/members/${member.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        onMemberUpdate?.(json.data);
        toast({
          type: "success",
          title: "상태가 변경되었습니다",
          description: `${member.name} 회원 → ${MEMBER_STATUS_MAP[newStatus]?.label}`,
        });
      } else {
        toast({ type: "error", title: "상태 변경 실패", description: json.error?.message ?? "잠시 후 다시 시도해주세요." });
      }
    } catch {
      toast({ type: "error", title: "상태 변경 실패", description: "잠시 후 다시 시도해주세요." });
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden p-0 flex flex-col" style={{ maxWidth: "1000px" }}>
        {/* 헤더 */}
        <DialogHeader className="shrink-0 border-b border-border bg-card px-6 py-4">
          <DialogTitle className="flex items-center gap-3 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary-soft">
              <User size={14} className="text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">{member.name}</span>
              <span className="font-mono text-[14px] text-muted-foreground">@{member.username}</span>
              <span
                className={cn(
                  "rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                  MEMBER_STATUS_MAP[member.status]?.className
                )}
              >
                {MEMBER_STATUS_MAP[member.status]?.label}
              </span>
              {member.identity_verified && (
                <span className="flex items-center gap-0.5 rounded-sm bg-success-bg px-1.5 py-0.5 text-[10px] font-semibold text-success">
                  <Shield size={10} />
                  인증
                </span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* 탭 */}
        <div className="shrink-0 border-b border-border bg-card px-6">
          <div className="flex gap-0">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-4 py-3 text-[14px] font-medium transition-colors",
                  activeTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === "info" && (
            <InfoTab
              member={member}
              onStatusChange={handleStatusChange}
              statusLoading={statusLoading}
            />
          )}
          {activeTab === "orders" && (
            detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">불러오는 중...</span>
              </div>
            ) : (
              <OrdersTab orders={orders} />
            )
          )}
          {activeTab === "vouchers" && (
            detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">불러오는 중...</span>
              </div>
            ) : (
              <VouchersTab orders={orders} />
            )
          )}
          {activeTab === "gifts" && (
            detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">불러오는 중...</span>
              </div>
            ) : (
              <GiftsTab gifts={gifts} memberId={member.id} />
            )
          )}
        </div>

        {/* 푸터 */}
        <div className="shrink-0 flex justify-end border-t border-border bg-card px-6 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
