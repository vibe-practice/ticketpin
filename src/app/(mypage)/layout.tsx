import { SiteLayout } from "@/components/layout/SiteLayout";
import { Footer } from "@/components/layout/Footer";
import { MyPageSidebar } from "@/components/mypage/MyPageSidebar";
import { getCategories } from "@/lib/supabase/queries";

export default async function MypageLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories();

  return (
    <SiteLayout footer={<Footer />} categories={categories}>
      {/* 모바일: 세로 스택 / 데스크탑: 가로 분할 */}
      <div className="flex flex-col lg:flex-row flex-1 lg:px-12">
        <MyPageSidebar />
        <div className="flex-1 min-w-0 py-6 lg:py-8 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </div>
    </SiteLayout>
  );
}
