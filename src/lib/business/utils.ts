/**
 * 업체 관련 공통 유틸리티 함수
 */

/** 한국 휴대폰 번호 정규식 (01x + 7~8자리) */
export const PHONE_RE = /^01[016789]\d{7,8}$/;

/**
 * 휴대폰 번호 마스킹: 01012345678 -> 010-****-5678
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-***-${digits.slice(6)}`;
  }
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/**
 * 6자리 인증번호 생성 (암호학적 안전 PRNG)
 */
export function generateVerificationCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}
