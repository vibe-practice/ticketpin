import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin/auth";
import { adminUpdatePinSchema } from "@/lib/validations/admin";
import { encryptPin, decryptPin, hashPin } from "@/lib/crypto/pin";
import type { AdminPinListItem, PinStatus, PinRegistrationMethod } from "@/types";

type RouteContext = { params: Promise<{ pinId: string }> };

/**
 * GET /api/admin/pins/[pinId]
 *
 * 관리자 핀 상세 조회
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { pinId } = await context.params;

    const { data: pinRaw, error: queryError } = await adminClient
      .from("pins")
      .select(
        `id, product_id, pin_number_encrypted, status, registration_method,
         voucher_id, assigned_at, consumed_at, created_at,
         products(id, name)`
      )
      .eq("id", pinId)
      .single();

    if (queryError || !pinRaw) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PIN_NOT_FOUND", message: "존재하지 않는 핀입니다." },
        },
        { status: 404 }
      );
    }

    const pin = pinRaw as Record<string, unknown>;
    const product = pin.products as Record<string, unknown> | null;

    // 바우처 + 사용자 정보
    let voucherCode: string | null = null;
    let assignedUserId: string | null = null;
    let assignedUsername: string | null = null;
    let assignedUserName: string | null = null;

    if (pin.voucher_id) {
      const { data: voucher } = await adminClient
        .from("vouchers")
        .select("code, user_id")
        .eq("id", pin.voucher_id as string)
        .single();

      if (voucher) {
        const v = voucher as Record<string, unknown>;
        voucherCode = v.code as string;

        if (v.user_id) {
          assignedUserId = v.user_id as string;

          const { data: user } = await adminClient
            .from("users")
            .select("username, name")
            .eq("id", v.user_id as string)
            .single();

          if (user) {
            const u = user as Record<string, unknown>;
            assignedUsername = u.username as string;
            assignedUserName = u.name as string;
          }
        }
      }
    }

    let pinNumber = "";
    try {
      pinNumber = decryptPin(pin.pin_number_encrypted as string);
    } catch {
      pinNumber = "[복호화 실패]";
    }

    const result: AdminPinListItem = {
      id: pin.id as string,
      product_id: pin.product_id as string,
      product_name: product ? (product.name as string) : "(삭제된 상품)",
      pin_number: pinNumber,
      status: pin.status as PinStatus,
      registration_method: pin.registration_method as PinRegistrationMethod,
      voucher_code: voucherCode,
      assigned_user_id: assignedUserId,
      assigned_username: assignedUsername,
      assigned_user_name: assignedUserName,
      assigned_at: (pin.assigned_at as string) ?? null,
      consumed_at: (pin.consumed_at as string) ?? null,
      returned_at: null,
      created_at: pin.created_at as string,
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("[GET /api/admin/pins/[pinId]] Unexpected error:", error);
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
 * PATCH /api/admin/pins/[pinId]
 *
 * 관리자 핀 수정 (핀 번호 변경, 상태 변경)
 * - waiting 상태의 핀만 핀 번호 변경 가능
 * - 상태 변경은 제한적 (waiting → returned 등 관리자 강제 변경)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { pinId } = await context.params;

    const body = await request.json();
    const parsed = adminUpdatePinSchema.safeParse(body);

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

    const { pin_number, status: newStatus } = parsed.data;

    if (!pin_number && !newStatus) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "수정할 항목이 없습니다." },
        },
        { status: 422 }
      );
    }

    // ── 기존 핀 조회 ──
    const { data: existingPin, error: fetchError } = await adminClient
      .from("pins")
      .select("id, product_id, pin_number_encrypted, status")
      .eq("id", pinId)
      .single();

    if (fetchError || !existingPin) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PIN_NOT_FOUND", message: "존재하지 않는 핀입니다." },
        },
        { status: 404 }
      );
    }

    const existing = existingPin as Record<string, unknown>;
    const currentStatus = existing.status as string;

    // ── 핀 번호 변경 ──
    const updateData: Record<string, unknown> = {};

    if (pin_number) {
      // waiting 상태의 핀만 번호 변경 가능
      if (currentStatus !== "waiting") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_STATUS",
              message: "대기 상태의 핀만 번호를 변경할 수 있습니다.",
            },
          },
          { status: 409 }
        );
      }

      // 중복 체크 (해시 기반)
      const newPinHash = hashPin(pin_number);
      const { data: duplicateCheck } = await adminClient
        .from("pins")
        .select("id")
        .eq("pin_number_hash", newPinHash)
        .eq("product_id", existing.product_id as string)
        .in("status", ["waiting", "assigned"])
        .neq("id", pinId)
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

      updateData.pin_number_encrypted = encryptPin(pin_number);
      updateData.pin_number_hash = newPinHash;
    }

    // ── 상태 변경 (전이 규칙 검증) ──
    if (newStatus) {
      const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        waiting: ["returned"],
        assigned: ["waiting", "returned"],
        consumed: ["returned"],
        returned: ["waiting"],
      };

      const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_TRANSITION",
              message: `${currentStatus} 상태에서 ${newStatus} 상태로 변경할 수 없습니다.`,
            },
          },
          { status: 409 }
        );
      }

      updateData.status = newStatus;
    }

    // ── DB 업데이트 ──
    const { data: updatedPin, error: updateError } = await adminClient
      .from("pins")
      .update(updateData)
      .eq("id", pinId)
      .select("id, product_id, status, registration_method, assigned_at, consumed_at, created_at")
      .single();

    if (updateError || !updatedPin) {
      console.error("[PATCH /api/admin/pins/[pinId]] Update error:", updateError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "UPDATE_ERROR", message: "핀 수정에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: (updatedPin as Record<string, unknown>).id,
        status: (updatedPin as Record<string, unknown>).status,
      },
    });
  } catch (error) {
    console.error("[PATCH /api/admin/pins/[pinId]] Unexpected error:", error);
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
 * DELETE /api/admin/pins/[pinId]
 *
 * 관리자 핀 삭제
 * - waiting 상태의 핀만 삭제 가능 (할당/소진된 핀은 삭제 불가)
 */
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const auth = await getAuthenticatedAdmin();
    if ("error" in auth) return auth.error;
    const { adminClient } = auth;

    const { pinId } = await context.params;

    // ── 기존 핀 조회 ──
    const { data: existingPin, error: fetchError } = await adminClient
      .from("pins")
      .select("id, status")
      .eq("id", pinId)
      .single();

    if (fetchError || !existingPin) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "PIN_NOT_FOUND", message: "존재하지 않는 핀입니다." },
        },
        { status: 404 }
      );
    }

    const existing = existingPin as Record<string, unknown>;

    if (existing.status !== "waiting") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATUS",
            message: "대기 상태의 핀만 삭제할 수 있습니다.",
          },
        },
        { status: 409 }
      );
    }

    // ── 삭제 ──
    const { error: deleteError } = await adminClient
      .from("pins")
      .delete()
      .eq("id", pinId);

    if (deleteError) {
      console.error("[DELETE /api/admin/pins/[pinId]] Delete error:", deleteError);
      return NextResponse.json(
        {
          success: false,
          error: { code: "DELETE_ERROR", message: "핀 삭제에 실패했습니다." },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id: pinId } });
  } catch (error) {
    console.error("[DELETE /api/admin/pins/[pinId]] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
      },
      { status: 500 }
    );
  }
}
