import type { Metadata } from "next";
import { AdminPurchaseAccountsClient } from "@/components/admin/purchase-accounts/AdminPurchaseAccountsClient";

export const metadata: Metadata = {
  title: "매입 아이디 관리 | 관리자",
};

export default function PurchaseAccountsPage() {
  return <AdminPurchaseAccountsClient />;
}
