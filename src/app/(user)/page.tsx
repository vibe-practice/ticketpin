import { HeroBanner } from "@/components/home/HeroBanner";
import { CategoryNav } from "@/components/home/CategoryNav";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { ProductSection } from "@/components/home/ProductSection";
import { HomeSidebar } from "@/components/home/HomeSidebar";
import { NoticePreview } from "@/components/home/NoticePreview";
import { ProductGrid } from "@/components/home/ProductGrid";
import {
  getCategories,
  getPopularProducts,
  getProductsByCategory,
} from "@/lib/supabase/queries";

// ISR: 60초마다 재검증
export const revalidate = 60;

export default async function HomePage() {
  const [popularProducts, categories] = await Promise.all([
    getPopularProducts(8),
    getCategories(),
  ]);

  const topCategories = categories.slice(0, 3);
  const categoryProducts = await Promise.all(
    topCategories.map(async (category) => ({
      category,
      products: await getProductsByCategory(category.id),
    })),
  );

  const activeCategoryProducts = categoryProducts.filter(
    ({ products }) => products.length > 0
  );

  return (
    <div className="container-main py-4 lg:py-6">
      <div className="flex gap-6 lg:gap-8">
        {/* ── 좌측 메인 콘텐츠 ── */}
        <div className="min-w-0 flex-1">

          {/* ── 카테고리 네비게이션 ── */}
          <CategoryNav categories={categories} />

          {/* ── 히어로 배너 ── */}
          <HeroBanner />

          {/* ── 카테고리 아이콘 그리드 ── */}
          <div className="mt-6">
            <CategoryGrid categories={categories} />
          </div>

          <hr className="border-neutral-100 my-2" />

          {/* ── 인기 상품 ── */}
          {popularProducts.length > 0 && (
            <>
              <ProductGrid
                title="인기 상품"
                products={popularProducts}
                viewAllHref="/category"
              />
              <hr className="border-neutral-100" />
            </>
          )}

          {/* ── 카테고리별 상품 ── */}
          {activeCategoryProducts.map(({ category, products }, idx) => (
            <div key={category.id}>
              <ProductGrid
                title={category.name}
                products={products}
                viewAllHref={`/category/${category.slug}`}
              />
              {idx < activeCategoryProducts.length - 1 && (
                <hr className="border-neutral-100" />
              )}
            </div>
          ))}

          {/* 빈 상태 */}
          {activeCategoryProducts.length === 0 && popularProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-[17px] font-semibold text-foreground">
                곧 다양한 상품권이 등록될 예정입니다.
              </p>
              <p className="mt-2 text-[15px] text-muted-foreground">
                조금만 기다려 주세요.
              </p>
            </div>
          )}

          <hr className="border-neutral-100" />

          {/* ── 공지사항 미리보기 ── */}
          <NoticePreview />
        </div>

        {/* ── 우측 사이드바 ── */}
        <div className="hidden lg:block w-[260px] xl:w-[280px] flex-shrink-0">
          <div className="sticky top-[72px]">
            <HomeSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
