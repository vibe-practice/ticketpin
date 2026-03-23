import { z } from "zod";

// ── 회원가입 스키마 ────────────────────────────────────────────
export const registerSchema = z
  .object({
    username: z
      .string()
      .min(4, "아이디는 4자 이상이어야 합니다.")
      .max(20, "아이디는 20자 이하여야 합니다.")
      .regex(/^[a-zA-Z0-9]+$/, "영문과 숫자만 사용 가능합니다."),
    usernameChecked: z.boolean(),
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .regex(/[a-zA-Z]/, "영문자를 포함해야 합니다.")
      .regex(/[0-9]/, "숫자를 포함해야 합니다."),
    passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해 주세요."),
    email: z
      .string()
      .min(1, "이메일을 입력해 주세요.")
      .refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
        message: "올바른 이메일 형식이 아닙니다.",
      }),
    agreePrivacy: z.boolean(),
    agreeMarketing: z.boolean(),
  })
  .refine((data) => data.usernameChecked, {
    message: "아이디 중복 확인이 필요합니다.",
    path: ["usernameChecked"],
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  })
  .refine((data) => data.agreePrivacy, {
    message: "개인정보 수집 및 이용 동의는 필수입니다.",
    path: ["agreePrivacy"],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

// ── 로그인 스키마 ──────────────────────────────────────────────
export const loginSchema = z.object({
  username: z
    .string()
    .min(1, "아이디를 입력해 주세요.")
    .max(20, "아이디는 20자 이하여야 합니다.")
    .regex(/^[a-zA-Z0-9]+$/, "영문과 숫자만 사용 가능합니다."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// ── 비밀번호 재설정 스키마 ────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .regex(/[a-zA-Z]/, "영문자를 포함해야 합니다.")
      .regex(/[0-9]/, "숫자를 포함해야 합니다."),
    passwordConfirm: z.string().min(1, "비밀번호 확인을 입력해 주세요."),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["passwordConfirm"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// ── 비밀번호 강도 측정 ─────────────────────────────────────────
export type PasswordLevel = 0 | 1 | 2 | 3;

export function getPasswordStrength(pw: string): {
  level: PasswordLevel;
  label: string;
  color: string;
} {
  if (!pw) return { level: 0, label: "", color: "" };
  const hasLetter = /[a-zA-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  if (pw.length < 8) return { level: 1, label: "약함", color: "bg-error" };
  if (hasLetter && hasNumber && hasSpecial && pw.length >= 10)
    return { level: 3, label: "강함", color: "bg-success" };
  if (
    (hasLetter && hasNumber) ||
    (hasLetter && hasSpecial) ||
    (hasNumber && hasSpecial)
  )
    return { level: 2, label: "보통", color: "bg-warning" };
  return { level: 1, label: "약함", color: "bg-error" };
}

// ── 비밀번호 변경 스키마 (마이페이지 회원정보 수정) ──────────────
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
    newPassword: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .regex(/[a-zA-Z]/, "영문자를 포함해야 합니다.")
      .regex(/[0-9]/, "숫자를 포함해야 합니다."),
    newPasswordConfirm: z.string().min(1, "비밀번호 확인을 입력해 주세요."),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["newPasswordConfirm"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "현재 비밀번호와 다른 비밀번호를 입력해 주세요.",
    path: ["newPassword"],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// ── 서버 측 검증용 스키마 ──────────────────────────────────────
export const serverRegisterSchema = z.object({
  username: z
    .string()
    .min(4, "아이디는 4자 이상이어야 합니다.")
    .max(20, "아이디는 20자 이하여야 합니다.")
    .regex(/^[a-zA-Z0-9]+$/, "영문과 숫자만 사용 가능합니다."),
  email: z
    .string()
    .min(1, "이메일을 입력해 주세요.")
    .email("올바른 이메일 형식이 아닙니다."),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .regex(/[a-zA-Z]/, "영문자를 포함해야 합니다.")
    .regex(/[0-9]/, "숫자를 포함해야 합니다."),
  name: z.string().min(1, "이름을 입력해 주세요."),
  phone: z.string().min(1, "전화번호를 입력해 주세요."),
});

export const serverLoginSchema = z.object({
  username: z
    .string()
    .min(1, "아이디를 입력해 주세요.")
    .max(20, "아이디는 20자 이하여야 합니다.")
    .regex(/^[a-zA-Z0-9]+$/, "영문과 숫자만 사용 가능합니다."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

// ── 아이디 찾기 서버 스키마 ──────────────────────────────────────
export const serverFindIdSchema = z.object({
  name: z
    .string()
    .min(2, "이름은 2자 이상이어야 합니다.")
    .max(50, "이름은 50자 이하여야 합니다."),
  phone: z
    .string()
    .regex(/^01[016789]\d{7,8}$/, "올바른 휴대폰 번호 형식이 아닙니다."),
});

// ── 비밀번호 재설정 서버 스키마 ──────────────────────────────────
export const serverResetPasswordSchema = z.object({
  resetToken: z.string().min(1, "인증 토큰이 필요합니다."),
  newPassword: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .regex(/[a-zA-Z]/, "영문자를 포함해야 합니다.")
    .regex(/[0-9]/, "숫자를 포함해야 합니다."),
});
