import { SiteLayout } from "@/components/layout/SiteLayout";
import { Footer } from "@/components/layout/Footer";
import { MyPageSidebar } from "@/components/mypage/MyPageSidebar";
import { getCategories } from "@/lib/supabase/queries";

export default async function MypageLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories();

  return (
    <SiteLayout footer={<Footer />} categories={categories}>
      <div className="flex flex-col lg:flex-row flex-1 container-main lg:gap-10">
        <MyPageSidebar />
        <div className="flex-1 min-w-0 py-6 lg:py-8">
          {children}
        </div>
      </div>
    </SiteLayout>
  );
}
