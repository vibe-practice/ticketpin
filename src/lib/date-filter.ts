export type PeriodKey = "1w" | "1m" | "3m" | "all" | "custom";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: "1w", label: "1주일", days: 7 },
  { key: "1m", label: "1개월", days: 30 },
  { key: "3m", label: "3개월", days: 90 },
  { key: "all", label: "전체", days: null },
];

export function formatDateShort(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

