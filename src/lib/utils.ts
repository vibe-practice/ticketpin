import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 아이디 마스킹: 앞 절반만 보여주고 나머지는 * */
export function maskUsername(username: string): string {
  if (username.length <= 2) return username[0] + "*";
  const visibleLen = Math.ceil(username.length / 2);
  return username.slice(0, visibleLen) + "*".repeat(username.length - visibleLen);
}

export function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return "0원";
  return price.toLocaleString("ko-KR") + "원";
}

/**
 * ISO 날짜 → "yyyy.mm.dd hh:mm" 형식
 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

/**
 * 바우처/주문 코드 마스킹
 * 예: "e5f6a7b8-c9d0-1234-efab-345678901234" → "e5f6a7b8****1234"
 */
export function maskCode(code: string): string {
  if (!code || code.length < 8) return code;
  return code.slice(0, 8) + "****" + code.slice(-4);
}

/**
 * 수수료 금액 계산
 * fee_unit이 percent이면 가격의 퍼센트, fixed이면 그대로 반환
 */
export function calcFeeAmount(price: number, feeRate: number, feeUnit: "percent" | "fixed"): number {
  return feeUnit === "percent"
    ? Math.round(price * feeRate / 100)
    : feeRate;
}

/**
 * 전화번호 포맷팅 (한국)
 * "01012345678" → "010-1234-5678"
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
  if (digits.length === 10) return digits.replace(/(\d{2,3})(\d{3,4})(\d{4})/, "$1-$2-$3");
  return raw;
}

/**
 * 결제 취소 가능 여부 (결제 당일 자정까지만 가능)
 * Intl.DateTimeFormat으로 KST 날짜를 명시적으로 비교 (수동 오프셋 계산 불필요)
 */
export function isCancelableToday(orderCreatedAt: string | Date): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });
  const todayKST = fmt.format(new Date());
  const orderKST = fmt.format(new Date(orderCreatedAt));
  return todayKST === orderKST;
}

export function formatFeePercent(feeAmount: number, price: number): string {
  if (price === 0) return "0.0%";
  const percent = (feeAmount / price) * 100;
  return percent % 1 === 0 ? `${percent.toFixed(0)}%` : `${percent.toFixed(1)}%`;
}

/**
 * KST 기준 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 * Intl.DateTimeFormat("en-CA")는 YYYY-MM-DD 형식을 반환
 */
export function getToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/**
 * 날짜 문자열(YYYY-MM-DD)에 일수를 더하거나 빼서 반환
 */
export function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
