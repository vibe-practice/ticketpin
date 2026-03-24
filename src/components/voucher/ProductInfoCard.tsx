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
    <div className="rounded-xl border border-border overflow-hidden">
      {/* 상품 정보 */}
      <div className="flex items-center gap-4 p-5">
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {product?.image_url ? (
            <Image
              src={product.image_url}
              alt={product?.name ?? "(삭제된 상품)"}
              fill
              className="object-cover"
              sizes="72px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Gift size={28} className="text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold text-foreground leading-snug truncate">
            {product?.name ?? "(삭제된 상품)"}
          </p>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            수량 <span className="font-semibold text-foreground">{order.quantity}매</span>
          </p>
          <p className="mt-0.5 text-[18px] font-bold text-foreground tabular-nums">
            {formatPrice(order.total_amount)}
          </p>
        </div>
      </div>

      {/* 수수료 + 선물 정보 */}
      <div className="border-t border-border bg-muted/30">
        <div className="flex items-center justify-between px-5 py-3 text-[14px]">
          <span className="text-muted-foreground">수수료</span>
          <span
            className={cn(
              "rounded-sm px-2 py-0.5 text-[14px] font-semibold",
              order.fee_type === "included"
                ? "bg-success-bg text-success"
                : "bg-info-bg text-info"
            )}
          >
            {order.fee_type === "included" ? "수수료 포함" : `수수료 별도 (+${formatPrice(order.fee_amount * order.quantity)})`}
          </span>
        </div>

        {voucher.is_gift && senderUsername && (
          <div className="border-t border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Gift size={14} className="shrink-0 text-foreground" />
              <span className="text-[14px] text-muted-foreground">
                <strong className="text-foreground font-semibold">{senderUsername}</strong>님이 선물한 상품권
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
