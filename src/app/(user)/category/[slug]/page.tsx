import { notFound } from "next/navigation";
import { CategoryListClient } from "@/components/home/CategoryListClient";
import {
  getCategories,
  getAllProducts,
  getCategoryBySlug,
  getAllCategorySlugs,
} from "@/lib/supabase/queries";

// ISR: 60초마다 재검증
export const revalidate = 60;

interface CategorySlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CategorySlugPage({
  params,
}: CategorySlugPageProps) {
  const { slug } = await params;

  // 해당 slug의 카테고리 존재 확인
  const matched = await getCategoryBySlug(slug);
  if (!matched) notFound();

  // 전체 카테고리 + 전체 상품을 병렬 조회
  const [categories, allProducts] = await Promise.all([
    getCategories(),
    getAllProducts(),
  ]);

  return (
    <CategoryListClient
      categories={categories}
      allProducts={allProducts}
      initialSlug={slug}
    />
  );
}

export async function generateStaticParams() {
  const slugs = await getAllCategorySlugs();
  return slugs.map((slug) => ({ slug }));
}
