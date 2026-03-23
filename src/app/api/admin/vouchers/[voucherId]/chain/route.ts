import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import type { VoucherStatus } from "@/types";

/**
 * 교환권 체인 노드 (정산 모달 UI 표시용)
 */
interface VoucherChainNode {
  step: number;
  label: string;
  username: string;
  name: string;
  voucher_code: string;
  voucher_status: VoucherStatus;
  created_at: string;
}

const MAX_DEPTH = 10;

/**
 * GET /api/admin/vouchers/[voucherId]/chain
 *
 * 바우처 체인 추적 API (정산 관리 교환권 상세 모달용)
 *
 * 시작 바우처에서 source_voucher_id를 역추적하여 최초 구매까지 체인을 구성한다.
 * 결과는 정순(최초 구매 -> 최신)으로 반환된다.
 *
 * 각 단계의 소유자:
 * - 최초 바우처: orders.user_id (구매자)
 * - 이후 바우처: gifts.receiver_id (선물 수신자)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ voucherId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { voucherId } = await params;

    // ── 시작 바우처 조회 ──
    const { data: startVoucher, error: startError } = await adminClient
      .from("vouchers")
      .select("id, code, order_id, owner_id, status, source_voucher_id, is_gift, created_at")
      .eq("id", voucherId)
      .single();

    if (startError || !startVoucher) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VOUCHER_NOT_FOUND", message: "바우처를 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // ── 역방향 추적: source_voucher_id 따라 최초까지 ──
    // 시작점부터 역순으로 수집한 뒤 마지막에 뒤집는다
    const reverseChain: Array<Record<string, unknown>> = [startVoucher as unknown as Record<string, unknown>];
    const visited = new Set<string>([startVoucher.id as string]);

    let currentSourceId = startVoucher.source_voucher_id as string | null;
    while (currentSourceId && !visited.has(currentSourceId) && reverseChain.length < MAX_DEPTH) {
      visited.add(currentSourceId);

      const { data: parentVoucher } = await adminClient
        .from("vouchers")
        .select("id, code, order_id, owner_id, status, source_voucher_id, is_gift, created_at")
        .eq("id", currentSourceId)
        .single();

      if (!parentVoucher) break;

      reverseChain.push(parentVoucher as unknown as Record<string, unknown>);
      currentSourceId = parentVoucher.source_voucher_id as string | null;
    }

    // 정순으로 뒤집기 (최초 구매 -> 최신)
    reverseChain.reverse();

    // ── 소유자 정보 수집 ──
    const ownerIds = [...new Set(reverseChain.map((v) => v.owner_id as string).filter(Boolean))];
    const orderIds = [...new Set(reverseChain.map((v) => v.order_id as string).filter(Boolean))];

    // 사용자 정보 일괄 조회
    const { data: users } = ownerIds.length > 0
      ? await adminClient.from("users").select("id, username, name").in("id", ownerIds)
      : { data: [] };

    const usersMap = new Map((users ?? []).map((u) => [u.id as string, u as Record<string, unknown>]));

    // 주문 정보 일괄 조회 (최초 구매 바우처의 구매자를 알기 위해)
    const { data: orders } = orderIds.length > 0
      ? await adminClient.from("orders").select("id, user_id").in("id", orderIds)
      : { data: [] };

    const ordersMap = new Map((orders ?? []).map((o) => [o.id as string, o as Record<string, unknown>]));

    // 선물 정보 일괄 조회 (선물 바우처의 수신자를 알기 위해)
    const giftVoucherIds = reverseChain
      .filter((v) => v.is_gift === true)
      .map((v) => v.id as string);

    const { data: gifts } = giftVoucherIds.length > 0
      ? await adminClient
          .from("gifts")
          .select("id, receiver_id, new_voucher_id, created_at")
          .in("new_voucher_id", giftVoucherIds)
      : { data: [] };

    const giftsMap = new Map(
      (gifts ?? []).map((g) => [g.new_voucher_id as string, g as Record<string, unknown>])
    );

    // ── 체인 노드 구성 ──
    const chain: VoucherChainNode[] = [];

    for (let i = 0; i < reverseChain.length; i++) {
      const voucher = reverseChain[i];
      const voucherId = voucher.id as string;
      const isGift = voucher.is_gift as boolean;

      let ownerUsername = "";
      let ownerName = "";
      let label = "최초 구매";

      if (i === 0) {
        // 최초 바우처: 주문의 구매자
        const order = ordersMap.get(voucher.order_id as string);
        if (order) {
          const buyer = usersMap.get(order.user_id as string);
          if (buyer) {
            ownerUsername = buyer.username as string;
            ownerName = buyer.name as string;
          }
        }
        // owner_id 폴백
        if (!ownerUsername) {
          const owner = usersMap.get(voucher.owner_id as string);
          if (owner) {
            ownerUsername = owner.username as string;
            ownerName = owner.name as string;
          }
        }
        label = "최초 구매";
      } else if (isGift) {
        // 선물로 생성된 바우처: gifts.receiver_id
        const giftRecord = giftsMap.get(voucherId);
        if (giftRecord) {
          const receiver = usersMap.get(giftRecord.receiver_id as string);
          if (receiver) {
            ownerUsername = receiver.username as string;
            ownerName = receiver.name as string;
          } else {
            // receiver_id가 usersMap에 없으면 추가 조회
            const receiverId = giftRecord.receiver_id as string;
            if (receiverId) {
              const { data: receiverUser } = await adminClient
                .from("users")
                .select("id, username, name")
                .eq("id", receiverId)
                .single();
              if (receiverUser) {
                ownerUsername = receiverUser.username as string;
                ownerName = receiverUser.name as string;
                usersMap.set(receiverId, receiverUser as Record<string, unknown>);
              }
            }
          }
        }
        // 폴백: owner_id
        if (!ownerUsername) {
          const owner = usersMap.get(voucher.owner_id as string);
          if (owner) {
            ownerUsername = owner.username as string;
            ownerName = owner.name as string;
          }
        }
        label = "선물";
      } else {
        // source_voucher_id가 있지만 is_gift가 아닌 경우 (이론상 드묾)
        const owner = usersMap.get(voucher.owner_id as string);
        if (owner) {
          ownerUsername = owner.username as string;
          ownerName = owner.name as string;
        }
        label = "이전";
      }

      chain.push({
        step: i + 1,
        label,
        username: ownerUsername || "알 수 없음",
        name: ownerName || "알 수 없음",
        voucher_code: voucher.code as string,
        voucher_status: voucher.status as VoucherStatus,
        created_at: voucher.created_at as string,
      });
    }

    return NextResponse.json({
      success: true,
      data: { chain },
    });
  } catch (error) {
    console.error("[GET /api/admin/vouchers/[voucherId]/chain] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
