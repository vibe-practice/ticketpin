import type { Metadata } from "next";
import { AdminPinsClient } from "@/components/admin/pins/AdminPinsClient";

export const metadata: Metadata = {
  title: "핀 번호 관리 | 티켓핀 관리자",
  description: "핀 번호 재고 현황 조회 및 등록, 관리",
};

export default function AdminPinsPage() {
  return <AdminPinsClient />;
}
