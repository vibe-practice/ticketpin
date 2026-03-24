import { z } from "zod";

// ── 관리자 회원 직접 추가 서버 스키마 ──────────────────────────────
// 관리자 회원 추가 스키마 (클라이언트/서버 공유)
export const adminCreateMemberSchema = z.object({
  username: z
    .string()
    .min(4, "아이디는 4자 이상이어야 합니다.")
    .max(20, "아이디는 20자 이하여야 합니다.")
    .regex(/^[a-zA-Z0-9]+$/, "영문과 숫자만 사용 가능합니다."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .regex(/[a-zA-Z]/, "영문자를 포함해야 합니다.")
    .regex(/[0-9]/, "숫자를 포함해야 합니다."),
  name: z
    .string()
    .min(2, "이름은 2자 이상이어야 합니다.")
    .max(50, "이름은 50자 이하여야 합니다."),
  email: z
    .string()
    .min(1, "이메일을 입력해 주세요.")
    .email("올바른 이메일 형식이 아닙니다."),
  phone: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, "올바른 휴대폰 번호 형식이 아닙니다. (하이픈 없이 입력)"),
});

export type AdminCreateMemberInput = z.infer<typeof adminCreateMemberSchema>;

// 클라이언트 폼용 (비밀번호 확인 포함)
export const adminCreateMemberFormSchema = adminCreateMemberSchema
  .extend({
    passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해 주세요."),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export type AdminCreateMemberFormInput = z.infer<typeof adminCreateMemberFormSchema>;

// ── 관리자 설정 - IP 관리 스키마 (클라이언트/서버 공유) ──────────────
export const addIpSchema = z.object({
  ip_address: z
    .string()
    .min(1, "IP 주소를 입력해 주세요.")
    .max(45, "IP 주소가 너무 깁니다.")
    .refine(
      (val) => {
        const ipv4 =
          /^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)$/;
        const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
        return ipv4.test(val) || ipv6.test(val);
      },
      { message: "올바른 IP 주소 형식이 아닙니다. (예: 192.168.1.1)" }
    ),
  description: z.string().max(200, "메모는 200자까지 입력 가능합니다.").optional(),
});

export type AddIpInput = z.infer<typeof addIpSchema>;

export const deleteByIdSchema = z.object({
  id: z.string().uuid("유효하지 않은 ID입니다."),
});

export type DeleteByIdInput = z.infer<typeof deleteByIdSchema>;

// ── 관리자 설정 - 계정 관리 스키마 (클라이언트/서버 공유) ──────────────
export const addAdminAccountSchema = z.object({
  username: z
    .string()
    .min(1, "아이디를 입력해 주세요.")
    .max(50, "아이디는 50자까지 입력 가능합니다.")
    .regex(/^[a-zA-Z0-9_]+$/, "영문, 숫자, 밑줄(_)만 사용 가능합니다."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .max(100, "비밀번호는 100자까지 입력 가능합니다."),
  name: z
    .string()
    .min(1, "이름을 입력해 주세요.")
    .max(50, "이름은 50자까지 입력 가능합니다."),
});

export type AddAdminAccountInput = z.infer<typeof addAdminAccountSchema>;

// ── 관리자 주문 관리 스키마 (P4-015) ──────────────────────────────

export const adminCancelOrderSchema = z
  .object({
    reason_type: z.enum(["simple_change", "wrong_purchase", "admin", "other"], {
      message: "유효한 취소 사유 유형을 선택해 주세요.",
    }),
    reason_detail: z
      .string()
      .max(500, "취소 사유는 500자까지 입력 가능합니다.")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.reason_type === "other") {
        return !!data.reason_detail?.trim();
      }
      return true;
    },
    {
      message: "기타 사유를 선택한 경우 상세 사유를 입력해 주세요.",
      path: ["reason_detail"],
    }
  );

export type AdminCancelOrderInput = z.infer<typeof adminCancelOrderSchema>;

// ── 관리자 회원 상태 변경 스키마 (P4-016) ──────────────────────────
export const adminUpdateMemberStatusSchema = z.object({
  status: z.enum(["active", "suspended", "withdrawn"], {
    message: "유효한 회원 상태를 선택해 주세요.",
  }),
});

export type AdminUpdateMemberStatusInput = z.infer<typeof adminUpdateMemberStatusSchema>;

// ── 공통: UUID 형식 검증 (Zod v4의 .uuid()는 RFC 4122 엄격 적용, 시드 데이터 UUID와 호환 안 됨) ──
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ── 관리자 상품 관리 스키마 (P4-017) ──────────────────────────────

export const adminCreateProductSchema = z.object({
  name: z
    .string()
    .min(1, "상품명을 입력해 주세요.")
    .max(200, "상품명은 200자까지 입력 가능합니다."),
  category_id: z
    .string()
    .regex(uuidPattern, "유효하지 않은 카테고리 ID입니다."),
  price: z
    .number()
    .int("판매가는 정수여야 합니다.")
    .min(1, "판매가는 1원 이상이어야 합니다.")
    .max(10_000_000, "판매가는 1,000만원 이하여야 합니다."),
  fee_rate: z
    .number()
    .min(0, "수수료는 0 이상이어야 합니다."),
  fee_unit: z.enum(["percent", "fixed"], {
    message: "유효한 수수료 단위를 선택해 주세요.",
  }),
  description: z
    .string()
    .max(2000, "설명은 2000자까지 입력 가능합니다.")
    .optional()
    .nullable(),
  status: z.enum(["active", "inactive", "soldout"], {
    message: "유효한 상품 상태를 선택해 주세요.",
  }),
  image_url: z
    .string()
    .url("유효한 이미지 URL이 아닙니다.")
    .optional()
    .nullable(),
});

export type AdminCreateProductInput = z.infer<typeof adminCreateProductSchema>;

export const adminUpdateProductSchema = adminCreateProductSchema.partial();

export type AdminUpdateProductInput = z.infer<typeof adminUpdateProductSchema>;

// ── 관리자 카테고리 관리 스키마 (P4-017) ──────────────────────────

export const adminCreateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "카테고리 이름을 입력해 주세요.")
    .max(50, "카테고리 이름은 50자까지 입력 가능합니다."),
  subtitle: z
    .string()
    .max(100, "서브타이틀은 100자까지 입력 가능합니다.")
    .optional(),
  slug: z
    .string()
    .min(1, "슬러그를 입력해 주세요.")
    .max(50, "슬러그는 50자까지 입력 가능합니다.")
    .regex(/^[a-z0-9-]+$/, "슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.")
    .optional(),
  icon: z
    .string()
    .max(50, "아이콘 이름은 50자까지 입력 가능합니다.")
    .optional(),
  is_visible: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export type AdminCreateCategoryInput = z.infer<typeof adminCreateCategorySchema>;

export const adminUpdateCategorySchema = z.object({
  name: z
    .string()
    .min(1, "카테고리 이름을 입력해 주세요.")
    .max(50, "카테고리 이름은 50자까지 입력 가능합니다.")
    .optional(),
  subtitle: z
    .string()
    .max(100, "서브타이틀은 100자까지 입력 가능합니다.")
    .optional(),
  slug: z
    .string()
    .max(50, "슬러그는 50자까지 입력 가능합니다.")
    .regex(/^[a-z0-9-]+$/, "슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.")
    .optional(),
  icon: z
    .string()
    .max(50, "아이콘 이름은 50자까지 입력 가능합니다.")
    .optional(),
  image_url: z
    .string()
    .url("유효한 이미지 URL이 아닙니다.")
    .optional()
    .nullable(),
  is_visible: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export type AdminUpdateCategoryInput = z.infer<typeof adminUpdateCategorySchema>;

export const adminReorderCategoriesSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().regex(uuidPattern, "유효하지 않은 카테고리 ID입니다."),
      sort_order: z.number().int().min(0),
    })
  ).min(1, "정렬 데이터가 비어 있습니다."),
});

export type AdminReorderCategoriesInput = z.infer<typeof adminReorderCategoriesSchema>;

// ── 관리자 핀 관리 스키마 (P4-018) ──────────────────────────────

/** 핀 번호 형식: 1234-1234-1234-1234 (하이픈 구분 4자리씩) */
const PIN_NUMBER_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{4}$/;

export const adminCreatePinSchema = z.object({
  product_id: z
    .string()
    .regex(uuidPattern, "유효하지 않은 상품 ID입니다."),
  pin_number: z
    .string()
    .trim()
    .regex(PIN_NUMBER_PATTERN, "핀 번호 형식이 올바르지 않습니다. (예: 1234-1234-1234-1234)"),
});

export type AdminCreatePinInput = z.infer<typeof adminCreatePinSchema>;

export const adminUpdatePinSchema = z.object({
  pin_number: z
    .string()
    .trim()
    .regex(PIN_NUMBER_PATTERN, "핀 번호 형식이 올바르지 않습니다. (예: 1234-1234-1234-1234)")
    .optional(),
  status: z
    .enum(["waiting", "assigned", "consumed", "returned"], {
      message: "유효한 핀 상태를 선택해 주세요.",
    })
    .optional(),
});

export type AdminUpdatePinInput = z.infer<typeof adminUpdatePinSchema>;

export { PIN_NUMBER_PATTERN };

// ── 관리자 배너 관리 스키마 (B-007) ──────────────────────────────

export const adminCreateBannerSchema = z.object({
  image_url: z
    .string()
    .min(1, "이미지 URL을 입력해 주세요.")
    .url("유효한 이미지 URL이 아닙니다."),
  link_url: z
    .string()
    .url("유효한 링크 URL이 아닙니다.")
    .optional()
    .nullable(),
  alt_text: z
    .string()
    .max(200, "대체 텍스트는 200자까지 입력 가능합니다.")
    .optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type AdminCreateBannerInput = z.infer<typeof adminCreateBannerSchema>;

export const adminUpdateBannerSchema = adminCreateBannerSchema.partial();

export type AdminUpdateBannerInput = z.infer<typeof adminUpdateBannerSchema>;

export const adminReorderBannersSchema = z.object({
  orders: z
    .array(
      z.object({
        id: z.string().regex(uuidPattern, "유효하지 않은 배너 ID입니다."),
        sort_order: z.number().int().min(0),
      })
    )
    .min(1, "정렬 데이터가 비어 있습니다."),
});

export type AdminReorderBannersInput = z.infer<typeof adminReorderBannersSchema>;

// ── 관리자 사이드 배너 관리 스키마 (B-008) ─────────────────────────

const SIDE_BANNER_POSITIONS = ["sidebar_top", "sidebar_middle", "sidebar_bottom"] as const;

export const adminCreateSideBannerSchema = z.object({
  image_url: z
    .string()
    .min(1, "이미지 URL을 입력해 주세요.")
    .url("유효한 이미지 URL이 아닙니다."),
  link_url: z
    .string()
    .url("유효한 링크 URL이 아닙니다.")
    .optional()
    .nullable(),
  alt_text: z
    .string()
    .max(200, "대체 텍스트는 200자까지 입력 가능합니다.")
    .optional(),
  position: z.enum(SIDE_BANNER_POSITIONS, {
    message: "유효한 배너 위치를 선택해 주세요.",
  }),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type AdminCreateSideBannerInput = z.infer<typeof adminCreateSideBannerSchema>;

export const adminUpdateSideBannerSchema = adminCreateSideBannerSchema.partial();

export type AdminUpdateSideBannerInput = z.infer<typeof adminUpdateSideBannerSchema>;

// ── 관리자 FAQ 관리 스키마 ──────────────────────────────────────

const FAQ_CATEGORIES = ["구매", "교환권", "선물", "환불", "계정"] as const;

export const adminCreateFaqSchema = z.object({
  category: z.enum(FAQ_CATEGORIES, {
    message: "유효한 FAQ 카테고리를 선택해 주세요.",
  }),
  question: z
    .string()
    .min(1, "질문을 입력해 주세요.")
    .max(500, "질문은 500자까지 입력 가능합니다."),
  answer: z
    .string()
    .min(1, "답변을 입력해 주세요.")
    .max(5000, "답변은 5000자까지 입력 가능합니다."),
  sort_order: z.number().int().min(0).optional(),
  is_visible: z.boolean().optional(),
});

export type AdminCreateFaqInput = z.infer<typeof adminCreateFaqSchema>;

export const adminUpdateFaqSchema = adminCreateFaqSchema.partial();

export type AdminUpdateFaqInput = z.infer<typeof adminUpdateFaqSchema>;

// ── 관리자 공지사항 관리 스키마 ──────────────────────────────────

const NOTICE_CATEGORIES = ["일반", "이벤트", "점검"] as const;

export const adminCreateNoticeSchema = z.object({
  title: z
    .string()
    .min(1, "제목을 입력해 주세요.")
    .max(200, "제목은 200자까지 입력 가능합니다."),
  content: z
    .string()
    .min(1, "내용을 입력해 주세요.")
    .max(50000, "내용은 50000자까지 입력 가능합니다."),
  category: z.enum(NOTICE_CATEGORIES, {
    message: "유효한 공지사항 카테고리를 선택해 주세요.",
  }),
  is_important: z.boolean().optional(),
  is_visible: z.boolean().optional(),
});

export type AdminCreateNoticeInput = z.infer<typeof adminCreateNoticeSchema>;

export const adminUpdateNoticeSchema = adminCreateNoticeSchema.partial();

export type AdminUpdateNoticeInput = z.infer<typeof adminUpdateNoticeSchema>;
