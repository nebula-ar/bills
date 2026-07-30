import { redirect } from "next/navigation";

// La pantalla de reportes se unificó con el Dashboard. Se conserva la ruta y sus
// filtros redirigiendo al home para no romper enlaces existentes.
type ReportsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) query.set(key, single);
  }

  const queryString = query.toString();
  redirect(queryString ? `/dashboard?${queryString}` : "/dashboard");
}
