import { CategoryListClient } from "@/components/home/CategoryListClient";
import { getCategories, getAllProducts } from "@/lib/supabase/queries";

// ISR: 60초마다 재검증
export const revalidate = 60;

interface CategoryPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CategoryPage({ searchParams }: CategoryPageProps) {
  const [categories, allProducts, params] = await Promise.all([
    getCategories(),
    getAllProducts(),
    searchParams,
  ]);

  return (
    <CategoryListClient
      categories={categories}
      allProducts={allProducts}
      initialSlug={null}
      initialQuery={params.q ?? ""}
    />
  );
}
