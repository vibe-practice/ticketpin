import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { z } from "zod";

const rankItemSchema = z.object({
  product_id: z.string().uuid(),
  rank: z.number().int().min(1).max(5),
});

const updateRanksSchema = z.object({
  ranks: z.array(rankItemSchema).max(5),
});

/**
 * GET /api/admin/products/popular
 *
 * 현재 인기 상품 순위 조회
 */
export async function GET() {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { data, error } = await adminClient
      .from("products")
      .select("id, name, price, image_url, status, popular_rank")
      .not("popular_rank", "is", null)
      .order("popular_rank", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/products/popular
 *
 * 인기 상품 순위 일괄 업데이트 (RPC 트랜잭션으로 원자적 처리)
 * Body: { ranks: [{ product_id: string, rank: number }] }
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_JSON", message: "요청 본문이 올바르지 않습니다." } },
        { status: 400 }
      );
    }

    // Zod 검증
    const parsed = updateRanksSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.",
          },
        },
        { status: 400 }
      );
    }

    const { ranks } = parsed.data;

    // 중복 순위 검증
    const usedRanks = new Set<number>();
    for (const item of ranks) {
      if (usedRanks.has(item.rank)) {
        return NextResponse.json(
          { success: false, error: { code: "DUPLICATE_RANK", message: `순위 ${item.rank}이(가) 중복됩니다.` } },
          { status: 400 }
        );
      }
      usedRanks.add(item.rank);
    }

    // RPC로 원자적 업데이트 (트랜잭션 내에서 초기화 + 재설정)
    const { error: rpcError } = await adminClient.rpc("update_popular_ranks", {
      p_ranks: ranks.map((r) => ({ product_id: r.product_id, rank: r.rank })),
    });

    if (rpcError) {
      console.error("[PUT /api/admin/products/popular] RPC error:", rpcError.message);
      return NextResponse.json(
        { success: false, error: { code: "DB_ERROR", message: "인기 상품 순위 저장에 실패했습니다." } },
        { status: 500 }
      );
    }

    // ISR 캐시 무효화
    revalidatePath("/");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL", message: "서버 오류가 발생했습니다." } },
      { status: 500 }
    );
  }
}
