import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminCreatePinSchema } from "@/lib/validations/admin";
import { encryptPin, decryptPin, hashPin } from "@/lib/crypto/pin";
import type { AdminPinListItem, PinStatus, PinRegistrationMethod } from "@/types";

/**
 * GET /api/admin/pins
 *
 * 관리자 핀 목록 조회 (필터/검색/페이징)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { searchParams } = request.nextUrl;

    // ── 페이징 ──
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // ── 필터 파라미터 ──
    const productId = searchParams.get("product_id") ?? "";
    const status = searchParams.get("status") ?? "";
    const registrationMethod = searchParams.get("registration_method") ?? "";
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";
    const search = searchParams.get("search")?.trim() ?? "";

    // ── 정렬 ──
    const sortBy = searchParams.get("sort_by") ?? "created_at";
    const sortOrder = searchParams.get("sort_order") ?? "desc";

    // ── 쿼리 구성 ──
    let query = adminClient
      .from("pins")
      .select(
        `id, product_id, pin_number_encrypted, status, registration_method,
         voucher_id, assigned_at, consumed_at, created_at,
         products(id, name)`,
        { count: "exact" }
      );

    // 상품 필터
    if (productId) {
      query = query.eq("product_id", productId);
    }

    // 상태 필터
    const validStatuses: PinStatus[] = ["waiting", "assigned", "consumed", "returned"];
    if (status && validStatuses.includes(status as PinStatus)) {
      query = query.eq("status", status);
    }

    // 등록 방법 필터
    const validMethods: PinRegistrationMethod[] = ["manual", "csv"];
    if (registrationMethod && validMethods.includes(registrationMethod as PinRegistrationMethod)) {
      query = query.eq("registration_method", registrationMethod);
    }

    // 날짜 범위
    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
    }

    // 핀 번호 검색: pin_number_hash 컬럼으로 DB 레벨 검색
    const pinSearch = search && /^\d{4}-\d{4}-\d{4}-\d{4}$/.test(search);
    if (pinSearch) {
      query = query.eq("pin_number_hash", hashPin(search));
    }

    // 비-핀번호 텍스트 검색 여부 (상품명, 바우처코드, 사용자명 — post-filter 필요)
    const needsPostFilter = !!search && !pinSearch;

    // 정렬
    const SORTABLE_COLUMNS = ["created_at", "status", "registration_method"];
    const safeSortBy = SORTABLE_COLUMNS.includes(sortBy) ? sortBy : "created_at";
    const safeSortOrder = ["asc", "desc"].includes(sortOrder) ? sortOrder : "desc";
    const ascending = safeSortOrder === "asc";
    query = query.order(safeSortBy, { ascending });

    // post-filter가 필요한 경우 range를 적용하지 않음 (필터 후 수동 페이지네이션)
    if (!needsPostFilter) {
      query = query.range(from, to);
    }

    const { data: pinsRaw, error: queryError, count } = await query;

    if (queryError) {
      console.error("[GET /api/admin/pins] Query error:", queryError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "QUERY_ERROR", message: "핀 목록 조회에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    const total = count ?? 0;

    if (!pinsRaw || pinsRaw.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          data: [],
          total,
          page,
          per_page: limit,
          total_pages: Math.ceil(total / limit),
        },
      });
    }

    // ── 바우처 정보 조회 (할당된 핀의 경우) ──
    const voucherIds = pinsRaw
      .map((p) => (p as Record<string, unknown>).voucher_id as string | null)
      .filter((id): id is string => !!id);

    const voucherMap = new Map<string, { code: string; user_id: string | null }>();

    if (voucherIds.length > 0) {
      const { data: vouchers } = await adminClient
        .from("vouchers")
        .select("id, code, user_id")
        .in("id", voucherIds);

      if (vouchers) {
        for (const v of vouchers) {
          const rec = v as Record<string, unknown>;
          voucherMap.set(rec.id as string, {
            code: rec.code as string,
            user_id: (rec.user_id as string) ?? null,
          });
        }
      }
    }

    // ── 사용자 정보 조회 ──
    const userIds = Array.from(new Set(
      Array.from(voucherMap.values())
        .map((v) => v.user_id)
        .filter((id): id is string => !!id)
    ));

    const userMap = new Map<string, { username: string; name: string }>();

    if (userIds.length > 0) {
      const { data: users } = await adminClient
        .from("users")
        .select("id, username, name")
        .in("id", userIds);

      if (users) {
        for (const u of users) {
          const rec = u as Record<string, unknown>;
          userMap.set(rec.id as string, {
            username: rec.username as string,
            name: rec.name as string,
          });
        }
      }
    }

    // ── 데이터 매핑 ──
    let items: AdminPinListItem[] = pinsRaw.map((raw) => {
      const pin = raw as Record<string, unknown>;
      const product = pin.products as Record<string, unknown> | null;
      const voucherId = pin.voucher_id as string | null;
      const voucher = voucherId ? voucherMap.get(voucherId) : null;
      const user = voucher?.user_id ? userMap.get(voucher.user_id) : null;

      let pinNumber = "";
      try {
        pinNumber = decryptPin(pin.pin_number_encrypted as string);
      } catch {
        pinNumber = "[복호화 실패]";
      }

      return {
        id: pin.id as string,
        product_id: pin.product_id as string,
        product_name: product ? (product.name as string) : "(삭제된 상품)",
        pin_number: pinNumber,
        status: pin.status as PinStatus,
        registration_method: pin.registration_method as PinRegistrationMethod,
        voucher_code: voucher?.code ?? null,
        assigned_user_id: voucher?.user_id ?? null,
        assigned_username: user?.username ?? null,
        assigned_user_name: user?.name ?? null,
        assigned_at: (pin.assigned_at as string) ?? null,
        consumed_at: (pin.consumed_at as string) ?? null,
        returned_at: null, // DB에 returned_at 컬럼이 없으므로 null
        created_at: pin.created_at as string,
      };
    });

    // ── 검색 후처리 + 수동 페이지네이션 ──
    // 핀 번호 검색은 pin_number_hash로 DB 레벨에서 처리됨
    // 상품명, 바우처코드, 사용자명 검색은 post-filter 후 수동 페이지네이션
    if (needsPostFilter) {
      const lowerSearch = search.toLowerCase();
      items = items.filter(
        (item) =>
          item.pin_number.toLowerCase().includes(lowerSearch) ||
          item.product_name.toLowerCase().includes(lowerSearch) ||
          item.voucher_code?.toLowerCase().includes(lowerSearch) ||
          item.assigned_username?.toLowerCase().includes(lowerSearch)
      );

      const filteredTotal = items.length;
      const totalPages = Math.ceil(filteredTotal / limit);
      items = items.slice(from, from + limit);

      return NextResponse.json({
        success: true,
        data: {
          data: items,
          total: filteredTotal,
          page,
          per_page: limit,
          total_pages: totalPages,
        },
      });
    }

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        data: items,
        total,
        page,
        per_page: limit,
        total_pages: totalPages,
      },
    });
  } catch (error) {
    console.error("[GET /api/admin/pins] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/pins
 *
 * 관리자 핀 개별 등록 (AES-256 암호화 저장)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const body = await request.json();
    const parsed = adminCreatePinSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.",
          },
        },
        { status: 422 }
      );
    }

    const { product_id, pin_number } = parsed.data;

    // ── 상품 존재 여부 확인 ──
    const { data: product, error: productError } = await adminClient
      .from("products")
      .select("id, name")
      .eq("id", product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PRODUCT_NOT_FOUND", message: "존재하지 않는 상품입니다." },
        },
        { status: 404 }
      );
    }

    // ── 중복 핀 번호 체크 (해시 기반 DB 레벨 조회) ──
    const pinHash = hashPin(pin_number);
    const { data: duplicateCheck } = await adminClient
      .from("pins")
      .select("id")
      .eq("pin_number_hash", pinHash)
      .eq("product_id", product_id)
      .in("status", ["waiting", "assigned"])
      .limit(1);

    if (duplicateCheck && duplicateCheck.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "DUPLICATE_PIN", message: "이미 등록된 핀 번호입니다." },
        },
        { status: 409 }
      );
    }

    // ── AES-256 암호화 ──
    const encryptedPin = encryptPin(pin_number);

    // ── DB 삽입 ──
    const { data: newPin, error: insertError } = await adminClient
      .from("pins")
      .insert({
        product_id,
        pin_number_encrypted: encryptedPin,
        pin_number_hash: pinHash,
        status: "waiting",
        registration_method: "manual",
      })
      .select("id, product_id, status, registration_method, created_at")
      .single();

    if (insertError || !newPin) {
      console.error("[POST /api/admin/pins] Insert error:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INSERT_ERROR", message: "핀 등록에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    const result: AdminPinListItem = {
      id: newPin.id as string,
      product_id: newPin.product_id as string,
      product_name: (product as Record<string, unknown>).name as string,
      pin_number: pin_number,
      status: newPin.status as PinStatus,
      registration_method: newPin.registration_method as PinRegistrationMethod,
      voucher_code: null,
      assigned_user_id: null,
      assigned_username: null,
      assigned_user_name: null,
      assigned_at: null,
      consumed_at: null,
      returned_at: null,
      created_at: newPin.created_at as string,
    };

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/admin/pins] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}

