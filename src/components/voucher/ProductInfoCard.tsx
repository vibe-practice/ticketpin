import Image from "next/image";
import { Gift } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import type { VoucherWithDetails } from "@/types";

interface ProductInfoCardProps {
  voucher: VoucherWithDetails;
  senderUsername?: string;
}

export default function ProductInfoCard({ voucher, senderUsername }: ProductInfoCardProps) {
  const { product, order } = voucher;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* 상단: 이미지 + 기본 정보 */}
      <div className="flex items-center gap-4 p-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {product?.image_url ? (
            <Image
              src={product.image_url}
              alt={product?.name ?? "(삭제된 상품)"}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Gift size={24} className="text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{product?.name ?? "(삭제된 상품)"}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">수량</span>
            <span className="text-[13px] font-semibold text-foreground">{order.quantity}매</span>
          </div>
          <p className="mt-0.5 text-base font-bold text-primary">
            {formatPrice(order.total_amount)}
          </p>
        </div>
      </div>

      {/* 수수료 유형 */}
      <div className="border-t border-border px-4 py-2.5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">수수료</span>
          <span
            className={cn(
              "rounded-sm px-2 py-0.5 text-[13px] font-semibold",
              order.fee_type === "included"
                ? "bg-success-bg text-success"
                : "bg-info-bg text-info"
            )}
          >
            {order.fee_type === "included" ? "수수료 포함" : `수수료 별도 (+${formatPrice(order.fee_amount * order.quantity)})`}
          </span>
        </div>
      </div>

      {/* 선물받은 경우 */}
      {voucher.is_gift && senderUsername && (
        <div className="border-t border-border bg-brand-primary-muted px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <Gift size={14} className="shrink-0 text-primary" />
            <span className="text-[13px] text-primary/70">
              <strong className="text-primary">{senderUsername}</strong>님이 선물한
              상품권입니다.
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
