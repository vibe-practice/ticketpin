"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calculator,
  Building2,
  Calendar,
  CreditCard,
  Percent,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SETTLEMENT_STATUS_STYLE,
  SETTLEMENT_STATUS_LABEL,
  VERIFICATION_STATUS_STYLE,
  VERIFICATION_STATUS_LABEL,
} from "@/lib/admin-constants";
import type {
  AdminSettlementListItem,
  SettlementGiftItem,
  VerificationStatus,
  VoucherStatus,
  PinStatus,
} from "@/types";
import { VoucherDetailModal } from "./VoucherDetailModal";

// ─── 더미 건별 데이터 (자동 검증 완료) ───────────────────────────────────────

const MOCK_GIFT_ITEMS: SettlementGiftItem[] = [
  {
    gift_id: "gift-s001",
    sender_username: "aticket",
    product_name: "컬쳐랜드 5만원권",
    product_price: 50000,
    quantity: 1,
    total_amount: 50000,
    settlement_per_item: 48000,
    created_at: "2026-03-10T10:30:00Z",
    source_voucher_code: "abc123-src-001",
    new_voucher_code: "abc123-new-001",
    new_voucher_status: "gifted" as VoucherStatus,
    original_order_number: "ORD-20260310-001",
    original_buyer_username: "buyer001",
    original_buyer_name: "홍길동",
    original_buyer_phone: "010-1234-5678",
    payment_method: "카드",
    installment_type: "일시불",
    commission_included: true,
    verification_status: "verified" as VerificationStatus,
    verification_memo: "자동 검증 완료",
    pin_ids: ["pin-001"],
    pin_statuses: ["assigned" as PinStatus],
  },
  {
    gift_id: "gift-s002",
    sender_username: "aticket",
    product_name: "해피머니 3만원권",
    product_price: 30000,
    quantity: 2,
    total_amount: 60000,
    settlement_per_item: 57600,
    created_at: "2026-03-10T11:15:00Z",
    source_voucher_code: "def456-src-002",
    new_voucher_code: "def456-new-002",
    new_voucher_status: "gifted" as VoucherStatus,
    original_order_number: "ORD-20260310-002",
    original_buyer_username: "buyer002",
    original_buyer_name: "김철수",
    original_buyer_phone: "010-2345-6789",
    payment_method: "무통장",
    installment_type: "-",
    commission_included: false,
    verification_status: "verified" as VerificationStatus,
    verification_memo: "자동 검증 완료",
    pin_ids: ["pin-002", "pin-003"],
    pin_statuses: ["assigned" as PinStatus, "assigned" as PinStatus],
  },
  {
    gift_id: "gift-s003",
    sender_username: "aticket",
    product_name: "컬쳐랜드 1만원권",
    product_price: 10000,
    quantity: 3,
    total_amount: 30000,
    settlement_per_item: 28800,
    created_at: "2026-03-10T14:00:00Z",
    source_voucher_code: "ghi789-src-003",
    new_voucher_code: "ghi789-new-003",
    new_voucher_status: "gifted" as VoucherStatus,
    original_order_number: "ORD-20260310-003",
    original_buyer_username: "buyer003",
    original_buyer_name: "이영희",
    original_buyer_phone: "010-3456-7890",
    payment_method: "카드",
    installment_type: "3개월",
    commission_included: true,
    verification_status: "verified" as VerificationStatus,
    verification_memo: "자동 검증 완료",
    pin_ids: ["pin-004", "pin-005", "pin-006"],
    pin_statuses: ["assigned" as PinStatus, "assigned" as PinStatus, "assigned" as PinStatus],
  },
  {
    gift_id: "gift-s004",
    sender_username: "aticket",
    product_name: "컬쳐랜드 5만원권",
    product_price: 50000,
    quantity: 1,
    total_amount: 50000,
    settlement_per_item: 48000,
    created_at: "2026-03-10T15:30:00Z",
    source_voucher_code: "jkl012-src-004",
    new_voucher_code: "jkl012-new-004",
    new_voucher_status: "gifted" as VoucherStatus,
    original_order_number: "ORD-20260310-004",
    original_buyer_username: "buyer004",
    original_buyer_name: "박민수",
    original_buyer_phone: "010-4567-8901",
    payment_method: "카카오페이",
    installment_type: "-",
    commission_included: true,
    verification_status: "verified" as VerificationStatus,
    verification_memo: "자동 검증 완료",
    pin_ids: ["pin-007"],
    pin_statuses: ["assigned" as PinStatus],
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SettlementDetailModalProps {
  open: boolean;
  onClose: () => void;
  settlement: AdminSettlementListItem | null;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function SettlementDetailModal({ open, onClose, settlement }: SettlementDetailModalProps) {
  const [selectedGiftItem, setSelectedGiftItem] = useState<SettlementGiftItem | null>(null);
  const [voucherDetailOpen, setVoucherDetailOpen] = useState(false);

  const giftItems = MOCK_GIFT_ITEMS;

  const validItems = useMemo(
    () => giftItems.filter((item) => item.verification_status !== "rejected"),
    [giftItems]
  );

  const totalCount = validItems.length;
  const totalAmount = useMemo(
    () => validItems.reduce((sum, item) => sum + item.total_amount, 0),
    [validItems]
  );
  const totalSettlement = useMemo(
    () => validItems.reduce((sum, item) => sum + item.settlement_per_item, 0),
    [validItems]
  );

  if (!settlement) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-h-[85vh] max-w-[960px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator size={18} className="text-primary" />
              정산 상세
              <span
                className={cn(
                  "ml-2 rounded-sm px-2 py-0.5 text-[11px] font-semibold",
                  SETTLEMENT_STATUS_STYLE[settlement.status]
                )}
              >
                {SETTLEMENT_STATUS_LABEL[settlement.status]}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* 정산 요약 */}
          <div className="rounded-md border border-border bg-card p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-[13px]">
              <InfoItem icon={Building2} label="업체명" value={settlement.business_name} />
              <InfoItem icon={Calendar} label="정산 대상일" value={settlement.settlement_date} />
              <InfoItem icon={Hash} label="선물 건수" value={`${settlement.gift_count}건`} />
              <InfoItem icon={CreditCard} label="선물 총액" value={`${settlement.gift_total_amount.toLocaleString()}원`} />
              <InfoItem icon={Percent} label="수수료율" value={`${settlement.commission_rate}%`} />
              <InfoItem
                icon={Calculator}
                label="정산 금액"
                value={`${settlement.settlement_amount.toLocaleString()}원`}
                valueClassName="font-bold text-primary"
              />
            </div>

            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-[11px] text-muted-foreground mb-1">입금 계좌</p>
              <p className="text-[13px] font-medium text-foreground">
                {settlement.bank_name} {settlement.account_number} ({settlement.account_holder})
              </p>
            </div>
          </div>

          {/* 건별 선물 목록 */}
          <div className="mt-4">
            <p className="text-[13px] font-semibold text-foreground mb-2">건별 선물 목록</p>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">상품명</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground whitespace-nowrap">수량</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">금액</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">건당 정산</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">최초 구매자</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground whitespace-nowrap">검증</th>
                  </tr>
                </thead>
                <tbody>
                  {giftItems.map((item) => (
                    <tr
                      key={item.gift_id}
                      className={cn(
                        "border-b border-border last:border-b-0 hover:bg-muted/20 cursor-pointer",
                        item.verification_status === "rejected" && "opacity-50 line-through"
                      )}
                      onClick={() => {
                        setSelectedGiftItem(item);
                        setVoucherDetailOpen(true);
                      }}
                    >
                      <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{item.product_name}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">{item.quantity}개</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{item.total_amount.toLocaleString()}원</td>
                      <td className="px-3 py-2 text-right font-medium text-primary whitespace-nowrap">
                        {item.settlement_per_item.toLocaleString()}원
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-foreground">{item.original_buyer_name}</span>
                        <span className="ml-1 text-[11px] text-muted-foreground">({item.original_buyer_username})</span>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
                            VERIFICATION_STATUS_STYLE[item.verification_status]
                          )}
                        >
                          {VERIFICATION_STATUS_LABEL[item.verification_status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="px-3 py-2 text-foreground whitespace-nowrap">합계 (유효 {totalCount}건)</td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">{validItems.reduce((s, i) => s + i.quantity, 0)}개</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{totalAmount.toLocaleString()}원</td>
                    <td className="px-3 py-2 text-right text-primary whitespace-nowrap">{totalSettlement.toLocaleString()}원</td>
                    <td className="px-3 py-2" colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {giftItems.some((i) => i.verification_status === "rejected") && (
              <p className="mt-2 text-[12px] text-error">
                * 거부된 건은 정산 금액에서 제외됩니다
              </p>
            )}
          </div>

          {settlement.memo && (
            <div className="mt-3 rounded-md bg-muted/50 p-3">
              <p className="text-[11px] text-muted-foreground mb-1">메모</p>
              <p className="text-[13px] text-foreground">{settlement.memo}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <VoucherDetailModal
        open={voucherDetailOpen}
        onClose={() => setVoucherDetailOpen(false)}
        giftItem={selectedGiftItem}
        commissionRate={settlement?.commission_rate ?? 96}
      />
    </>
  );
}

// ─── 유틸 컴포넌트 ────────────────────────────────────────────────────────────

function InfoItem({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="shrink-0 text-muted-foreground" />
      <span className="text-[12px] text-muted-foreground w-20 shrink-0">{label}</span>
      <span className={cn("text-[13px] text-foreground whitespace-nowrap", valueClassName)}>{value}</span>
    </div>
  );
}
