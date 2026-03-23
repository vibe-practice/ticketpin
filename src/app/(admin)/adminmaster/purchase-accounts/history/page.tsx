import type { Metadata } from "next";
import { PurchaseAccountHistoryClient } from "@/components/admin/purchase-accounts/PurchaseAccountHistoryClient";

export const metadata: Metadata = {
  title: "매입 내역 | 관리자",
};

export default function PurchaseAccountHistoryPage() {
  return <PurchaseAccountHistoryClient />;
}
