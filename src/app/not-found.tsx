import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { getCategories } from "@/lib/supabase/queries";

export default async function NotFound() {
  const categories = await getCategories();

  return (
    <SiteLayout footer={<Footer />} mainClassName="bg-background flex flex-col" categories={categories}>
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <FileQuestion size={48} className="text-muted-foreground/40" />
          </div>
          <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
          <h2 className="mb-4 text-xl font-semibold text-foreground">페이지를 찾을 수 없어요</h2>
          <p className="mb-8 text-muted-foreground">
            요청하신 페이지가 존재하지 않거나 이동되었습니다.
          </p>
          <Button asChild className="h-11 px-6">
            <Link href="/">홈으로 이동</Link>
          </Button>
        </div>
      </div>
    </SiteLayout>
  );
}
