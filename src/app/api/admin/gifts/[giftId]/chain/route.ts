import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import type { VoucherStatus } from "@/types";

/**
 * 선물 체인 노드 (UI 표시용)
 */
interface GiftChainNode {
  voucher_id: string;
  voucher_code: string;
  voucher_status: VoucherStatus;
  owner_id: string;
  owner_username: string;
  owner_name: string;
  is_gift: boolean;
  gift_sender_username: string | null;
  created_at: string;
}

/**
 * GET /api/admin/gifts/[giftId]/chain
 *
 * 선물 체인 추적 API
 *
 * 특정 선물의 바우처 이동 경로를 추적한다.
 * source_voucher_id를 재귀적으로 따라가서 최초 구매부터 현재까지의
 * 바우처 체인(A->B->C)을 역추적하고, 현재 선물의 이후 체인도 추적한다.
 *
 * 응답: { chain: GiftChainNode[], order_number: string }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ giftId: string }> }
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { giftId } = await params;

    // ── 선물 레코드 조회 ──
    const { data: gift, error: giftError } = await adminClient
      .from("gifts")
      .select("id, source_voucher_id, new_voucher_id")
      .eq("id", giftId)
      .single();

    if (giftError || !gift) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "GIFT_NOT_FOUND", message: "선물 이력을 찾을 수 없습니다." },
        },
        { status: 404 }
      );
    }

    // ── 역방향 추적: 재귀 CTE로 source_voucher_id를 따라 최초 바우처까지 ──
    const MAX_DEPTH = 10;
    const sourceVoucherId = gift.source_voucher_id as string;
    const newVoucherId = gift.new_voucher_id as string;

    const { data: backwardResult } = await adminClient.rpc("get_voucher_chain_backward", {
      start_voucher_id: sourceVoucherId,
      max_depth: MAX_DEPTH,
    });

    // RPC가 없으면 폴백 (루프 방식)
    let backwardIds: string[];
    const backwardArr = backwardResult as { id: string; depth: number }[] | null;
    if (backwardArr && Array.isArray(backwardArr) && backwardArr.length > 0) {
      backwardIds = backwardArr.sort((a, b) => b.depth - a.depth).map((r) => r.id);
    } else {
      // 폴백: 순차 조회
      backwardIds = [];
      let currentId: string | null = sourceVoucherId;
      const visited = new Set<string>();
      while (currentId && !visited.has(currentId) && backwardIds.length < MAX_DEPTH) {
        visited.add(currentId);
        backwardIds.push(currentId);
        const { data: voucher } = await adminClient
          .from("vouchers")
          .select("source_voucher_id")
          .eq("id", currentId)
          .single();
        currentId = voucher?.source_voucher_id as string | null;
      }
      backwardIds.reverse();
    }

    // ── 순방향 추적: new_voucher_id를 기준으로 이후 선물 체인 ──
    const forwardIds: string[] = [newVoucherId];
    const forwardVisited = new Set<string>([...backwardIds]);

    let forwardCurrent: string | null = newVoucherId;
    while (forwardCurrent && forwardIds.length < MAX_DEPTH) {
      forwardVisited.add(forwardCurrent);

      const { data: nextGift } = await adminClient
        .from("gifts")
        .select("new_voucher_id")
        .eq("source_voucher_id", forwardCurrent)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (nextGift && !forwardVisited.has(nextGift.new_voucher_id as string)) {
        forwardCurrent = nextGift.new_voucher_id as string;
        forwardIds.push(forwardCurrent);
      } else {
        break;
      }
    }

    // ── 전체 바우처 ID 목록 ──
    const allVoucherIds = [...new Set([...backwardIds, ...forwardIds])];

    if (allVoucherIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { chain: [], order_number: null },
      });
    }

    // ── 바우처 상세 정보 일괄 조회 ──
    const { data: vouchers, error: vouchersError } = await adminClient
      .from("vouchers")
      .select("id, code, order_id, owner_id, status, is_gift, gift_sender_id, source_voucher_id, created_at")
      .in("id", allVoucherIds);

    if (vouchersError || !vouchers) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "바우처 체인 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    // 소유자/보낸사람 정보 조회
    const ownerIds = [...new Set(vouchers.map((v) => v.owner_id as string))];
    const senderIds = [...new Set(vouchers.map((v) => v.gift_sender_id as string).filter(Boolean))];
    const allUserIds = [...new Set([...ownerIds, ...senderIds])];

    const { data: users } = await adminClient
      .from("users")
      .select("id, username, name")
      .in("id", allUserIds);

    const usersMap = new Map(
      (users ?? []).map((u) => [u.id, u])
    );
    const vouchersMap = new Map(
      vouchers.map((v) => [v.id as string, v])
    );

    // 주문번호 조회 (최초 바우처 기준)
    const firstVoucher = vouchersMap.get(allVoucherIds[0]);
    let orderNumber: string | null = null;
    if (firstVoucher) {
      const { data: order } = await adminClient
        .from("orders")
        .select("order_number")
        .eq("id", firstVoucher.order_id)
        .single();
      orderNumber = order?.order_number as string ?? null;
    }

    // ── 체인 노드 조합 (순서대로) ──
    const chain: GiftChainNode[] = [];
    for (const vid of allVoucherIds) {
      const v = vouchersMap.get(vid);
      if (!v) continue;

      const owner = usersMap.get(v.owner_id as string);
      const sender = v.gift_sender_id ? usersMap.get(v.gift_sender_id as string) : null;

      chain.push({
        voucher_id: v.id as string,
        voucher_code: v.code as string,
        voucher_status: v.status as VoucherStatus,
        owner_id: v.owner_id as string,
        owner_username: (owner?.username as string) ?? "",
        owner_name: (owner?.name as string) ?? "",
        is_gift: v.is_gift as boolean,
        gift_sender_username: sender ? (sender.username as string) : null,
        created_at: v.created_at as string,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        chain,
        order_number: orderNumber,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/gifts/[giftId]/chain] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
