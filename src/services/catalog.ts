import rawProducts from '../data/products.json';
import type { Product } from '../types';

export const products: Product[] = rawProducts as Product[];

/** Lista de categorias únicas, na ordem de primeira aparição. */
export function getCategories(): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const p of products) {
    if (!seen.has(p.category)) {
      seen.add(p.category);
      list.push(p.category);
    }
  }
  return list;
}

export interface CatalogFilter {
  query?: string;
  category?: string | null;
}

export function filterProducts({ query, category }: CatalogFilter): Product[] {
  const q = (query ?? '').trim().toLowerCase();
  return products.filter((p) => {
    const matchesCategory = !category || p.category === category;
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
