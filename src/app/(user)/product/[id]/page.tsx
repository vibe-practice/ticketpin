import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductById, getAllProductIds } from "@/lib/supabase/queries";
import { ProductDetailClient } from "./ProductDetailClient";

// ISR: 60초마다 재검증
export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return { title: "상품을 찾을 수 없습니다 | 티켓매니아" };
  }

  return {
    title: `${product.name} | 티켓매니아`,
    description:
      product.description ?? `${product.name} 상품을 지금 바로 구매하세요.`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}

export async function generateStaticParams() {
  const ids = await getAllProductIds();
  return ids.map((id) => ({ id }));
}
