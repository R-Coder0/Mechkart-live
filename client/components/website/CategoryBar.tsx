// components/website/CategoryBar.tsx
import CategoryBarClient from "./CategoryBarClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

interface ApiCategory {
  _id: string;
  name: string;
  slug: string;
  parentCategory?: ApiCategory | string | null;
}

async function fetchCategories(): Promise<ApiCategory[]> {
  try {
    if (!API_BASE) {
      console.error("NEXT_PUBLIC_API_URL is missing");
      return [];
    }

    const res = await fetch(`${API_BASE}/admin/categories`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to load categories:", await res.text());
      return [];
    }

    const data = await res.json();
    const list: ApiCategory[] = data.data || data.categories || [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("Error fetching categories on server:", err);
    return [];
  }
}

export default async function CategoryBar() {
  const list = await fetchCategories();
  return <CategoryBarClient categories={list} />;
}
