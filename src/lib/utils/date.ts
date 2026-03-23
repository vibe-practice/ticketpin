/**
 * KST 기준 날짜 유틸리티 함수 (업체 포털 공통)
 */

const kstFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

/** KST 기준 오늘 날짜 문자열 (YYYY-MM-DD) */
export function getTodayKST(): string {
  return kstFormatter.format(new Date());
}

/** KST 기준 날짜 문자열 변환 */
export function toKstDateStr(date: Date): string {
  return kstFormatter.format(date);
}

type QuickRange = "today" | "7d" | "30d" | "custom";

/** 빠른 기간 선택에 대한 날짜 범위 반환 */
export function getQuickRangeDates(range: QuickRange): { from: string; to: string } | null {
  if (range === "custom") return null;

  const todayStr = getTodayKST();

  if (range === "today") {
    return { from: todayStr, to: todayStr };
  }
  const days = range === "7d" ? 7 : 30;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - (days - 1));
  const fromStr = kstFormatter.format(fromDate);
  return { from: fromStr, to: todayStr };
}

/** 날짜를 한국어 형식으로 포맷 (예: 2026. 03. 13.) */
export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 날짜를 YYYY.MM.DD 형식으로 포맷 */
export function formatDateKR(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}
