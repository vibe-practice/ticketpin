import { SiteLayout } from "@/components/layout/SiteLayout";
import { Footer } from "@/components/layout/Footer";
import { getCategories } from "@/lib/supabase/queries";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories();

  return (
    <SiteLayout footer={<Footer />} categories={categories}>
      {children}
    </SiteLayout>
  );
}
