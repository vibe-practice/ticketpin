/**
 * AES-256-GCM 핀 번호 암호화/복호화 유틸리티
 *
 * - 서버사이드 전용 (Node.js crypto 모듈 사용)
 * - 환경변수 PIN_ENCRYPTION_KEY에서 256비트(32바이트) 키 로드
 * - IV: 매 암호화마다 12바이트 랜덤 생성
 * - AuthTag: 16바이트
 * - 저장 형식: {iv_hex}:{authTag_hex}:{ciphertext_hex}
 */

import { randomBytes, createCipheriv, createDecipheriv, createHmac } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM 권장 IV 길이
const AUTH_TAG_LENGTH = 16; // 128비트
const KEY_LENGTH = 32; // 256비트

/**
 * 환경변수에서 암호화 키를 로드하여 Buffer로 반환
 * 서버 프로세스 수명 동안 캐싱 (환경변수는 런타임 중 변경되지 않음)
 * @throws 키가 없거나 길이가 올바르지 않으면 에러
 */
let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) return cachedKey;

  const keyHex = process.env.PIN_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      "[PinCrypto] PIN_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다. " +
        "32바이트(64자 hex) 키를 설정하세요."
    );
  }

  if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error(
      "[PinCrypto] PIN_ENCRYPTION_KEY에 유효하지 않은 문자가 포함되어 있습니다. " +
        "hex 문자열(0-9, a-f)만 허용됩니다."
    );
  }

  const keyBuffer = Buffer.from(keyHex, "hex");

  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `[PinCrypto] PIN_ENCRYPTION_KEY 길이가 올바르지 않습니다. ` +
        `예상: ${KEY_LENGTH}바이트(${KEY_LENGTH * 2}자 hex), ` +
        `실제: ${keyBuffer.length}바이트(${keyHex.length}자)`
    );
  }

  cachedKey = keyBuffer;
  return cachedKey;
}

/**
 * 핀 번호를 AES-256-GCM으로 암호화
 *
 * @param plainPin - 평문 핀 번호
 * @returns 암호화된 문자열 (형식: iv_hex:authTag_hex:ciphertext_hex)
 * @throws 키 오류 또는 빈 입력 시
 */
export function encryptPin(plainPin: string): string {
  if (!plainPin || plainPin.trim().length === 0) {
    throw new Error("[PinCrypto] 암호화할 핀 번호가 비어있습니다.");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plainPin, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // 형식: iv:authTag:ciphertext (모두 hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * AES-256-GCM으로 암호화된 핀 번호를 복호화
 *
 * @param encryptedPin - 암호화된 문자열 (형식: iv_hex:authTag_hex:ciphertext_hex)
 * @returns 복호화된 평문 핀 번호
 * @throws 형식 오류, 키 오류, 복호화 실패 시 (원본 절대 반환하지 않음)
 */
/**
 * 핀 번호의 HMAC-SHA256 해시 생성 (중복 체크 및 검색용)
 *
 * @param plainPin - 평문 핀 번호
 * @returns hex 해시 문자열
 */
export function hashPin(plainPin: string): string {
  const key = getEncryptionKey();
  return createHmac("sha256", key).update(plainPin).digest("hex");
}

export function decryptPin(encryptedPin: string): string {
  if (!encryptedPin || encryptedPin.trim().length === 0) {
    throw new Error("[PinCrypto] 복호화할 데이터가 비어있습니다.");
  }

  const parts = encryptedPin.split(":");

  if (parts.length !== 3) {
    throw new Error(
      `[PinCrypto] 암호화 데이터 형식이 올바르지 않습니다. ` +
        `예상 형식: iv:authTag:ciphertext (3개 파트), 실제: ${parts.length}개 파트`
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  // IV, AuthTag 길이 검증
  if (iv.length !== IV_LENGTH) {
    throw new Error(
      `[PinCrypto] IV 길이 오류. 예상: ${IV_LENGTH}바이트, 실제: ${iv.length}바이트`
    );
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(
      `[PinCrypto] AuthTag 길이 오류. 예상: ${AUTH_TAG_LENGTH}바이트, 실제: ${authTag.length}바이트`
    );
  }

  const key = getEncryptionKey();

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    throw new Error(
      "[PinCrypto] 복호화에 실패했습니다. 키가 올바르지 않거나 데이터가 변조되었을 수 있습니다."
    );
  }
}
