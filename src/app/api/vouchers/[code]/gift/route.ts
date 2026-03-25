import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { voucherCodeSchema, giftSchema } from "@/lib/validations/voucher";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/utils/ip";
import {
  BCRYPT_SALT_ROUNDS,
  TEMP_PW_EXPIRY_MINUTES,
  generateTempPassword,
} from "@/lib/constants";
import { sendSmsSync, buildGiftMessage, buildPurchaseNotifyMessage } from "@/lib/sms";

// Rate limit: 분당 최대 5건 선물
const GIFT_RATE_LIMIT = { maxAttempts: 5, windowMs: 60 * 1000 };

/** Supabase !inner 조인으로 가져온 주문 데이터 타입 */
interface VoucherOrderJoin {
  id: string;
  order_number: string;
  quantity: number;
  product_price: number;
  fee_type: string;
  fee_amount: number;
  total_amount: number;
  product_id: string;
  receiver_phone: string;
  card_company_name: string | null;
  status: string;
}

/**
 * POST /api/vouchers/[code]/gift
 *
 * 선물하기 API (바우처 코드 기반 인증 — SMS 링크 접근, Supabase 세션 불필요)
 * 1. 바우처 코드 검증 + 상태 검증 (password_set만 가능)
 * 2. 바우처 소유자를 sender로 사용 (세션 인증 대신 바우처 owner_id 기반)
 * 3. 수신자 조회 + 자기 자신 선물 방지
 * 4. 트랜잭션: 기존 바우처 gifted + 새 바우처 생성 + 핀 이동 + 주문 상태 변경 + gifts 레코드 생성
 * 5. SMS 발송 (fire-and-forget)
 */
export async function POST(
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

    // ── Rate Limiting (IP + 바우처 코드 기반) ──
    const ip = getClientIp(request.headers);
    const rateLimitResult = await checkRateLimit(
      `gift:${ip}:${code}`,
      GIFT_RATE_LIMIT
    );
    if (!rateLimitResult.success) {
      const retryAfterSec = Math.ceil(rateLimitResult.retryAfterMs / 1000);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `요청이 너무 많습니다. ${retryAfterSec}초 후 다시 시도해 주세요.`,
          },
        },
        { status: 429 }
      );
    }

    // ── 요청 본문 파싱 + 검증 ──
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "요청 본문이 올바른 JSON 형식이 아닙니다.",
          },
        },
        { status: 400 }
      );
    }

    const parsed = giftSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: firstError?.message ?? "입력값이 올바르지 않습니다.",
          },
        },
        { status: 422 }
      );
    }

    const input = parsed.data;

    // ── 바우처 조회 (service role: RLS 우회) ──
    const adminClient = createAdminClient();
    const { data: voucher, error: voucherError } = await adminClient
      .from("vouchers")
      .select(
        `
        id,
        code,
        order_id,
        owner_id,
        status,
        is_gift,
        source_voucher_id,
        orders!inner (
          id,
          order_number,
          quantity,
          product_price,
          fee_type,
          fee_amount,
          total_amount,
          product_id,
          receiver_phone,
          card_company_name,
          status
        )
      `
      )
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

    // ── 바우처 상태 검증: password_set만 선물 가능 ──
    if (voucher.status !== "password_set") {
      const messageMap: Record<string, string> = {
        issued: "임시 비밀번호 인증이 완료되지 않은 바우처입니다.",
        temp_verified: "비밀번호 설정이 완료되지 않은 바우처입니다.",
        pin_revealed: "핀 번호가 이미 확인된 바우처는 선물할 수 없습니다.",
        gifted: "이미 선물이 완료된 바우처입니다.",
        cancelled: "취소된 바우처는 선물할 수 없습니다.",
      };
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_VOUCHER_STATUS",
            message:
              messageMap[voucher.status] ??
              "현재 상태에서는 선물할 수 없습니다.",
          },
        },
        { status: 400 }
      );
    }

    // ── 바우처 소유자(sender) 조회 ──
    const { data: senderData, error: senderError } = await adminClient
      .from("users")
      .select("id, username, name, phone, status")
      .eq("id", voucher.owner_id)
      .single();

    if (senderError || !senderData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "바우처 소유자 정보를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    if (senderData.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_INACTIVE",
            message: "비활성화된 계정입니다.",
          },
        },
        { status: 403 }
      );
    }

    // ── 수신자 조회 (username으로 검색) ──
    const { data: receiverData, error: receiverError } = await adminClient
      .from("users")
      .select("id, username, name, phone, status, is_purchase_account")
      .eq("username", input.receiver_username)
      .single();

    if (receiverError || !receiverData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RECEIVER_NOT_FOUND",
            message: "수신자를 찾을 수 없습니다.",
          },
        },
        { status: 404 }
      );
    }

    if (receiverData.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RECEIVER_INACTIVE",
            message: "비활성화된 계정에는 선물할 수 없습니다.",
          },
        },
        { status: 400 }
      );
    }

    // ── 자기 자신 선물 방지 ──
    if (receiverData.id === senderData.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SELF_GIFT",
            message: "자기 자신에게는 선물할 수 없습니다.",
          },
        },
        { status: 400 }
      );
    }

    // ── 매입 아이디 여부 확인 (수신 제한 우회 + 정산 제외에 사용) ──
    const isPurchaseAccount = receiverData.is_purchase_account === true;

    // 매입 아이디 상태 확인 (suspended면 매입 불가)
    if (isPurchaseAccount) {
      const { data: purchaseAccount } = await adminClient
        .from("purchase_accounts")
        .select("status")
        .eq("user_id", receiverData.id)
        .single();

      if (purchaseAccount?.status === "suspended") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "PURCHASE_ACCOUNT_SUSPENDED",
              message: "해당 매입 아이디는 현재 중지 상태입니다.",
            },
          },
          { status: 400 },
        );
      }
    }

    // ── 다른 사람의 활성 업체 수신 계정 선물 방지 (매입 아이디는 제외) ──
    if (!isPurchaseAccount) {
      const { data: receiverBusiness } = await adminClient
        .from("businesses")
        .select("id")
        .eq("receiving_account_id", receiverData.id)
        .eq("status", "active")
        .neq("user_id", senderData.id)
        .limit(1)
        .maybeSingle();

      if (receiverBusiness) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "RECEIVER_NOT_ALLOWED",
              message: "해당 회원에게는 선물할 수 없습니다.",
            },
          },
          { status: 400 }
        );
      }
    }

    // ── 주문/상품 정보 추출 + 런타임 가드 ──
    // Supabase의 !inner 조인은 단일 객체를 반환하지만, 타입 추론이 불완전하므로 런타임 검증
    const rawOrder = voucher.orders;
    const order: VoucherOrderJoin | null =
      rawOrder && typeof rawOrder === "object" && !Array.isArray(rawOrder) && typeof (rawOrder as VoucherOrderJoin).id === "string"
        ? (rawOrder as VoucherOrderJoin)
        : Array.isArray(rawOrder) && rawOrder.length > 0
          ? (rawOrder[0] as VoucherOrderJoin)
          : null;

    if (
      !order ||
      typeof order.id !== "string" ||
      typeof order.product_id !== "string" ||
      typeof order.quantity !== "number" ||
      typeof order.product_price !== "number" ||
      typeof order.fee_type !== "string" ||
      typeof order.fee_amount !== "number"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_ORDER_DATA", message: "주문 데이터가 올바르지 않습니다." },
        },
        { status: 500 }
      );
    }

    const orderId = order.id;
    const productId = order.product_id;
    const orderQuantity = order.quantity;
    const productPrice = order.product_price;
    const feeType = order.fee_type;
    const feeAmount = order.fee_amount;

    // ── 새 바우처 준비 ──
    const newVoucherCode = randomUUID();
    const newVoucherId = randomUUID();
    const tempPasswordPlain = generateTempPassword();
    const tempPasswordHash = await bcrypt.hash(
      tempPasswordPlain,
      BCRYPT_SALT_ROUNDS
    );
    const tempPasswordExpiresAt = new Date(
      Date.now() + TEMP_PW_EXPIRY_MINUTES * 60 * 1000
    ).toISOString();

    // ── 원자적 트랜잭션 처리 (PostgreSQL RPC) ──
    // process_gift RPC가 하나의 트랜잭션 내에서 처리:
    // 1. 기존 바우처 gifted (낙관적 잠금: status=password_set 검증)
    // 2. 새 바우처 INSERT
    // 3. 핀 이동
    // 4. 주문 상태 gifted
    // 5. gifts 레코드 INSERT
    const { data: rpcResult, error: rpcError } = await adminClient.rpc(
      "process_gift",
      {
        p_source_voucher_id: voucher.id,
        p_new_voucher_id: newVoucherId,
        p_new_voucher_code: newVoucherCode,
        p_order_id: orderId,
        p_sender_id: senderData.id,
        p_receiver_id: receiverData.id,
        p_temp_password_hash: tempPasswordHash,
        p_temp_password_expires_at: tempPasswordExpiresAt,
        p_product_id: productId,
      }
    );

    if (rpcError || !rpcResult?.success) {
      const errorCode = rpcResult?.error_code ?? "GIFT_FAILED";
      const errorMessage = rpcResult?.error_message ?? "선물 처리 중 오류가 발생했습니다.";
      console.error("[POST /api/vouchers/[code]/gift] RPC 실패:", {
        rpcError: rpcError?.message,
        rpcResult,
      });

      // 동시 요청으로 인한 상태 충돌은 409로 반환
      const httpStatus = errorCode === "CONCURRENT_GIFT" || errorCode === "INVALID_STATUS" ? 409 : 500;
      return NextResponse.json(
        {
          success: false,
          error: { code: errorCode, message: errorMessage },
        },
        { status: httpStatus }
      );
    }

    const giftId: string | null = rpcResult.gift_id ?? null;
    const autoRecycled: boolean = rpcResult.auto_recycled ?? false;

    console.log(`[gift] 선물 완료: giftId=${giftId}, sender=${senderData.id}, receiver=${receiverData.id}, voucher=${code}, autoRecycled=${autoRecycled}`);

    // ── SMS 발송 + 자동 정산 (after API로 응답 후 실행) ──
    // 정산에 필요한 값을 캡처해두고 after()에서 비동기 처리
    const settlementContext = {
      receiverId: receiverData.id,
      giftId,
      totalAmount: order.total_amount,
      senderName: senderData.name,
      senderPhone: senderData.phone,
      orderNumber: order.order_number,
    };

    after(async () => {
      const afterClient = createAdminClient();
      const { data: productData } = await afterClient
        .from("products")
        .select("name")
        .eq("id", productId)
        .single();

      const productName = productData?.name ?? "상품권";

      // 수수료 총액 (별도일 때만 계산)
      const feeTotal =
        feeType === "separate" && feeAmount > 0
          ? feeAmount * orderQuantity
          : undefined;

      // ── 매입 아이디 SMS 알림 ──
      // autoRecycled: process_gift RPC에서 매입 아이디(is_purchase_account=true)일 때
      // 핀을 재고로 자동 복원하고 true를 반환함
      if (autoRecycled && isPurchaseAccount) {
        try {
          const { data: purchaseAccount } = await afterClient
            .from("purchase_accounts")
            .select("notification_phone")
            .eq("user_id", settlementContext.receiverId)
            .single();

          const notifyPhone = purchaseAccount?.notification_phone;
          if (notifyPhone) {
            // KST 기준 현재 시각 (Intl.DateTimeFormat으로 환경 독립적으로 계산)
            const kstParts = new Intl.DateTimeFormat("ko-KR", {
              timeZone: "Asia/Seoul",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).formatToParts(new Date());
            const g = (type: string) => kstParts.find(p => p.type === type)!.value;
            const giftDateTime = `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;

            const notifyMessage = buildPurchaseNotifyMessage({
              giftDateTime,
              productName,
              quantity: orderQuantity,
              totalAmount: order.total_amount,
              feeType,
              feeTotal,
              cardCompanyName: order.card_company_name,
              senderName: senderData.name,
            });

            const smsResult = await sendSmsSync({
              recipientPhone: notifyPhone,
              messageContent: notifyMessage,
              messageType: "purchase_notify",
              voucherId: newVoucherId,
              orderId,
            });

            if (!smsResult.success) {
              console.error("[gift] 매입 알림 SMS 발송 실패:", smsResult.error);
            } else {
              console.log(`[gift] 매입 알림 SMS 발송 완료: phone=****${notifyPhone.slice(-4)}`);
            }
          }
        } catch (notifyError) {
          console.error("[gift] 매입 알림 SMS 처리 중 오류:", notifyError);
        }
      }

      // ── SMS 발송 (수신 계정은 핀이 재고로 복원되므로 일반 선물 SMS 불필요) ──
      if (!autoRecycled) {
        const smsMessage = buildGiftMessage({
          senderName: senderData.name,
          senderUsername: senderData.username,
          productName,
          quantity: orderQuantity,
          productPrice,
          newVoucherCode,
          tempPassword: tempPasswordPlain,
          feeTotal,
        });

        try {
          const result = await sendSmsSync({
            recipientPhone: receiverData.phone,
            messageContent: smsMessage,
            messageType: "gift",
            voucherId: newVoucherId,
            orderId,
          });

          if (!result.success) {
            console.error("[POST /api/vouchers/[code]/gift] SMS 발송 실패:", result.error);
          }
        } catch (error) {
          console.error("[POST /api/vouchers/[code]/gift] SMS 발송 중 오류:", error);
        }
      }

      // ── 업체 수신 계정이면 자동 정산 생성 (매입 아이디는 정산 제외) ──
      if (isPurchaseAccount) {
        console.log(`[gift] 매입 아이디로 선물 — 정산 생성 건너뜀: receiver=${settlementContext.receiverId}`);
        return;
      }
      try {
        const { data: receiverBiz } = await afterClient
          .from("businesses")
          .select("id, business_name, commission_rate, created_at")
          .eq("receiving_account_id", settlementContext.receiverId)
          .eq("status", "active")
          .maybeSingle();

        if (!receiverBiz || !settlementContext.giftId) return;

        const commissionRate = Number(receiverBiz.commission_rate);
        const { totalAmount } = settlementContext;
        const settlementPerItem = Math.round(totalAmount * commissionRate / 100);

        // KST 기준 오늘 날짜 (Intl.DateTimeFormat으로 안전하게 계산)
        const kstParts = new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date());
        const y = kstParts.find(p => p.type === "year")!.value;
        const m = kstParts.find(p => p.type === "month")!.value;
        const d = kstParts.find(p => p.type === "day")!.value;
        const settlementDate = `${y}-${m}-${d}`;

        // 업체 등록일 이전 선물은 정산 대상 제외
        const bizCreatedAt = new Date(receiverBiz.created_at as string);
        if (new Date() < bizCreatedAt) return;

        // gifts 테이블에서 실제 created_at 조회
        const { data: giftRecord } = await afterClient
          .from("gifts")
          .select("created_at")
          .eq("id", settlementContext.giftId)
          .single();

        // RPC로 원자적 정산 upsert (race condition 방지, pending 상태만 업데이트)
        const { data: settlementId } = await afterClient.rpc("upsert_settlement", {
          p_business_id: receiverBiz.id,
          p_settlement_date: settlementDate,
          p_commission_rate: commissionRate,
          p_total_amount: totalAmount,
          p_settlement_per_item: settlementPerItem,
        });

        if (settlementId) {
          await afterClient
            .from("settlement_gift_items")
            .insert({
              settlement_id: settlementId,
              gift_id: settlementContext.giftId,
              voucher_id: newVoucherId,
              product_id: productId,
              product_name: productName,
              product_price: productPrice,
              quantity: orderQuantity,
              total_amount: totalAmount,
              settlement_per_item: settlementPerItem,
              verification_status: "verified",
              gift_created_at: giftRecord?.created_at ?? new Date().toISOString(),
              order_number: settlementContext.orderNumber,
              original_buyer_name: settlementContext.senderName,
              original_buyer_phone: settlementContext.senderPhone,
              payment_method: null,
            });

          console.log(`[gift] 자동 정산 생성: settlementId=${settlementId}, business=${receiverBiz.business_name}`);
        } else {
          console.warn(`[gift] 정산 생성 실패: business=${receiverBiz.business_name}, date=${settlementDate} (confirmed/paid 상태일 수 있음)`);
        }
      } catch (settlementError) {
        console.error("[gift] 자동 정산 처리 중 오류:", settlementError);
      }
    });

    // ── 성공 응답 ──
    return NextResponse.json(
      {
        success: true,
        data: {
          gift_id: giftId,
          receiver_username: receiverData.username,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/vouchers/[code]/gift] Unexpected error:", error);
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
