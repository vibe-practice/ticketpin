import { z } from "zod";

/**
 * 주문 생성 API 서버 측 입력 검증 스키마
 * POST /api/orders
 */
export const createOrderSchema = z.object({
  product_id: z
    .string()
    .uuid("유효하지 않은 상품 ID입니다."),
  quantity: z
    .number()
    .int("수량은 정수여야 합니다.")
    .min(1, "최소 1개 이상 주문해야 합니다.")
    .max(10, "한 번에 최대 10개까지 주문할 수 있습니다."),
  fee_type: z.enum(["included", "separate"], {
    message: "수수료 유형은 'included' 또는 'separate'만 가능합니다.",
  }),
  receiver_phone: z
    .string()
    .regex(
      /^01[016789]\d{7,8}$/,
      "올바른 휴대폰 번호 형식이 아닙니다. (예: 01012345678)"
    ),
  // PG 결제 정보 (결제 완료 후 전달)
  payment_method: z.string().max(50).nullable().optional(),
  pg_transaction_id: z.string().max(100).nullable().optional(),
  pg_ref_no: z.string().max(100).nullable().optional(),
  pg_tran_date: z.string().max(50).nullable().optional(),
  pg_pay_type: z.string().max(50).nullable().optional(),
  card_no: z.string().max(100).nullable().optional(),
  card_company_code: z.string().max(20).nullable().optional(),
  card_company_name: z.string().max(50).nullable().optional(),
  installment_months: z.number().int().min(0).max(36).optional().default(0),
  approval_no: z.string().max(100).nullable().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * 주문 취소 API 서버 측 입력 검증 스키마
 * POST /api/orders/[orderId]/cancel
 */
export const cancelOrderSchema = z
  .object({
    reason_type: z.enum(["simple_change", "wrong_purchase", "other"], {
      message:
        "취소 사유는 'simple_change', 'wrong_purchase', 'other'만 가능합니다.",
    }),
    reason_detail: z
      .string()
      .max(500, "취소 상세 사유는 500자 이내여야 합니다.")
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.reason_type !== "other" ||
      (data.reason_detail != null && data.reason_detail.trim().length > 0),
    {
      message: "기타 사유 선택 시 상세 사유를 입력해야 합니다.",
      path: ["reason_detail"],
    }
  );

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
