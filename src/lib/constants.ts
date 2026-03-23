import { randomInt } from "crypto";

// 바우처 관련 상수
export const VOUCHER_MAX_ATTEMPTS = 5;
export const VOUCHER_MAX_REISSUE = 5;
export const TEMP_PW_EXPIRY_MINUTES = 20;

// bcrypt salt rounds
export const BCRYPT_SALT_ROUNDS = 12;

/**
 * 3자리 랜덤 임시 비밀번호 생성 (000~999, crypto.randomInt 사용)
 */
export function generateTempPassword(): string {
  return String(randomInt(1000)).padStart(3, "0");
}
