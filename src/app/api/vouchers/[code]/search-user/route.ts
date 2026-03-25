import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { voucherCodeSchema } from "@/lib/validations/voucher";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";

const searchQuerySchema = z.object({
  q: z
    .string()
    .min(2, "검색어는 2자 이상이어야 합니다.")
    .max(20, "검색어는 20자 이하여야 합니다.")
    .regex(/^[a-zA-Z0-9]+$/, "영문과 숫자만 검색할 수 있습니다."),
});

/**
 * GET /api/vouchers/[code]/search-user?q=xxx
 *
 * 바우처 전용 회원 검색 API (SMS 링크 접근 — Supabase 세션 불필요)
 * - 바우처 코드로 인증 대체 (password_set 상태만 허용)
 * - 바우처 소유자(자기 자신) 제외
 * - 아이디(username) ilike 검색, 최대 10건, active 회원만
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    // ── 바우처 코드 형식 검증 ──
    const codeResult = voucherCodeSchema.safeParse(code);
    if (!codeResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CODE",
            message: "유효하지 않은 바우처 코드입니다.",
          },
        },
        { status: 400 }
      );
    }

    // ── Rate Limiting (IP + 바우처 코드 기반, 분당 30회) ──
    const ip = getClientIp(request.headers);
    const rateLimit = await checkRateLimit(`voucher-search:${ip}:${code}`, {
      maxAttempts: 30,
      windowMs: 60 * 1000,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          },
        },
        { status: 429 }
      );
    }

    // ── 쿼리 파라미터 검증 ──
    const searchParams = request.nextUrl.searchParams;
    const parsed = searchQuerySchema.safeParse({
      q: searchParams.get("q") ?? "",
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "잘못된 요청입니다.",
          },
        },
        { status: 400 }
      );
    }

    const { q } = parsed.data;

    // ── 바우처 조회 + 상태 검증 ──
    const adminClient = createAdminClient();
    const { data: voucher, error: voucherError } = await adminClient
      .from("vouchers")
      .select("id, owner_id, status, is_gift")
      .eq("code", code)
      .single();

    if (voucherError || !voucher) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VOUCHER_NOT_FOUND",
            message: "바우처를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    // password_set 상태만 검색 허용 (선물 가능 상태)
    if (voucher.status !== "password_set") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_VOUCHER_STATUS",
            message: "현재 상태에서는 회원 검색이 불가합니다.",
          },
        },
        { status: 400 }
      );
    }

    // ── 소유자 아이디 조회 (자기 자신 검색 감지용) ──
    const { data: ownerData } = await adminClient
      .from("users")
      .select("username")
      .eq("id", voucher.owner_id)
      .single();

    const ownerUsername = ownerData?.username ?? "";
    const isSelfSearch = ownerUsername.toLowerCase() === q.toLowerCase();

    // ── 다른 사람의 활성 업체 수신 계정 조회 (이 계정들만 제외) ──
    // - 내 활성 업체 수신 계정: 검색 노출 O
    // - 다른 사람의 활성 업체 수신 계정: 검색 노출 X
    // - 해지된 업체 수신 계정: 검색 노출 O (업체 관계 해소)
    const { data: otherBusinesses, error: bizError } = await adminClient
      .from("businesses")
      .select("receiving_account_id")
      .eq("status", "active")
      .neq("user_id", voucher.owner_id)
      .not("receiving_account_id", "is", null);

    if (bizError) {
      console.error("[GET /api/vouchers/[code]/search-user] Business query error:", bizError);
    }

    const excludedReceivingIds = (otherBusinesses ?? [])
      .map((b: { receiving_account_id: string | null }) => b.receiving_account_id)
      .filter((id): id is string => id !== null);

    // ── 중지된 매입 아이디 조회 (검색 제외) ──
    const { data: suspendedPurchaseAccounts } = await adminClient
      .from("purchase_accounts")
      .select("user_id")
      .eq("status", "suspended");

    const suspendedPurchaseUserIds = (suspendedPurchaseAccounts ?? [])
      .map((a: { user_id: string }) => a.user_id);

    // 제외 대상 합산: 다른 사람의 업체 수신 계정 + 중지된 매입 아이디
    const allExcludedIds = [...excludedReceivingIds, ...suspendedPurchaseUserIds];

    // ── 회원 검색 (소유자 제외, active만, 최대 10건) ──
    let query = adminClient
      .from("users")
      .select("id, username, name")
      .eq("status", "active")
      .neq("id", voucher.owner_id)
      .ilike("username", q);

    // 다른 사람의 활성 업체 수신 계정 + 중지된 매입 아이디 제외
    if (allExcludedIds.length > 0) {
      query = query.not("id", "in", `(${allExcludedIds.join(",")})`);
    }

    const { data: users, error: queryError } = await query.limit(10);

    if (queryError) {
      console.error("[GET /api/vouchers/[code]/search-user] Query error:", queryError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: "검색 중 오류가 발생했습니다.",
          },
        },
        { status: 500 }
      );
    }

    const results = (users ?? []).map(
      (user: { id: string; username: string; name: string }) => ({
        id: user.id,
        username: user.username,
        name: user.name,
      })
    );

    return NextResponse.json({
      success: true,
      data: results,
      is_self_search: isSelfSearch,
    });
  } catch (error) {
    console.error("[GET /api/vouchers/[code]/search-user] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "서버 오류가 발생했습니다.",
        },
      },
      { status: 500 }
    );
  }
}
