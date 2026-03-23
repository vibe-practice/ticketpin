import type { Metadata } from "next";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Footer } from "@/components/layout/Footer";
import { getCategories } from "@/lib/supabase/queries";

export const metadata: Metadata = {
  title: {
    template: "%s | 티켓핀",
    default: "티켓핀",
  },
};

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const categories = await getCategories();

  return (
    <SiteLayout footer={<Footer />} categories={categories}>
      <div className="flex items-start justify-center px-4 pt-12 pb-16">
        <div className="w-full max-w-[440px]">{children}</div>
      </div>
    </SiteLayout>
  );
}
