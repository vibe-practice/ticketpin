import { ProductSection } from "@/components/home/ProductSection";
import { PopularSlider } from "@/components/home/PopularSlider";
import {
  getCategories,
  getPopularProducts,
  getProductsByCategory,
} from "@/lib/supabase/queries";

// ISR: 60초마다 재검증
export const revalidate = 60;

export default async function HomePage() {
  // 병렬로 인기 상품 + 카테고리 목록 조회
  const [popularProducts, categories] = await Promise.all([
    getPopularProducts(5),
    getCategories(),
  ]);

  // 카테고리별 상품을 병렬로 조회
  const categoryProducts = await Promise.all(
    categories.map(async (category) => ({
      category,
      products: await getProductsByCategory(category.id),
    })),
  );

  return (
    <div className="px-6 lg:px-12">
      {/* -- 섹션 1: 인기 상품권 (뷰포트 꽉 채우는 슬라이더) --- */}
      <PopularSlider products={popularProducts} />

      {/* -- 구분선 ------------------------------------------------- */}
      <hr className="border-border" />

      {/* -- 섹션 2~N: 카테고리별 상품 섹션 ------------------------- */}
      {categoryProducts.map(({ category, products }, index) => {
        // 활성 상품이 없는 카테고리는 건너뜀
        if (products.length === 0) return null;

        const subtitle = category.subtitle || category.name;
        const href = `/category/${category.slug}`;

        return (
          <div key={category.id}>
            <ProductSection
              title={category.name}
              subtitle={subtitle}
              products={products}
              viewAllHref={href}
              viewAllLabel="더보기"
            />

            {/* 마지막 카테고리 이후엔 구분선 없음 */}
            {index < categoryProducts.length - 1 && (
              <hr className="border-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}
