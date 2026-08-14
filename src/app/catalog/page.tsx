import { AppModule, Unit } from "@/generated/prisma/client";
import { requireBusinessContext } from "@/lib/business-context";
import { formatQuantity, unitLabel } from "@/lib/quantity";
import { STOCK_MOVEMENT_LABELS } from "@/lib/stock-error-messages";
import { verticalFeatures, verticalPreset } from "@/lib/vertical";
import { getBranchProductConfiguration } from "@/modules/catalog/get-branch-catalog-configuration.use-case";
import { presetCatalogFor } from "@/modules/catalog/preset-catalog";
import { promotionShortLabel } from "@/lib/promotion-labels";
import { promocionesDeProducto } from "@/modules/promotions/promotion.logic";
import { findActivePromotions } from "@/modules/promotions/promotion.repository";
import { getBranchStockOverview, getStockMovements } from "@/modules/stock/stock.use-cases";
import { ProductsManager, type ProductRow, type ProductsData } from "@/components/catalog-manager";

const movementDateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

type ProductsPageProps = {
  searchParams: Promise<{
    branchId?: string | string[];
    status?: string | string[];
    message?: string | string[];
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { business } = await requireBusinessContext();

  const params = await searchParams;
  const selectedBranchId = getSingleParam(params.branchId);
  const flash = getFlash(params.status, params.message);
  const { branches, selectedBranch, products, categories } = await getBranchProductConfiguration(business.id, selectedBranchId);

  if (!selectedBranch) {
    return (
      <main
        className="mx-auto min-h-dvh max-w-[560px] px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-6 text-foreground"
        style={
          {
            "--primary": "#0066cc",
            // Apple no oscurece el primario en hover/press: la marca de estado
            // es transform: scale(0.95), no un cambio de color. Se deja igual
            // al primario a propósito.
            "--primary-strong": "#0066cc",
            "--foreground": "#1d1d1f",
            "--background": "#f5f5f7",
          } as React.CSSProperties
        }
      >
        <h1 className="text-2xl font-semibold tracking-tight">{business.labels.catalogPlural}</h1>
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Cargá una sucursal para administrar tu catálogo.
        </div>
      </main>
    );
  }

  // Promos vigentes de esta sucursal. Se piden una vez y se cruzan en memoria
  // contra cada producto: son pocas y la alternativa era una consulta por fila.
  // Sin el módulo prendido no se pregunta nada.
  const hasStock = business.has(AppModule.STOCK);
  const [promociones, stockOverview, stockMovements] = await Promise.all([
    business.has(AppModule.PROMOTIONS) ? findActivePromotions(business.id, selectedBranch.id) : Promise.resolve([]),
    // Totales de conjunto (sin stock / por reponer / valorizado) y el
    // historial de movimientos: lo que antes vivía solo en /stock. Se pide
    // aparte de getBranchProductConfiguration porque valúa a promedio
    // ponderado (avgCost), no al costo de reposición — son cuentas distintas
    // y no vale la pena tocar esa consulta para traer un campo que el resto
    // de la pantalla no usa.
    hasStock ? getBranchStockOverview(business.id, selectedBranch.id) : Promise.resolve(null),
    hasStock ? getStockMovements(selectedBranch.id, 30) : Promise.resolve([]),
  ]);
  const ahora = new Date();

  const rows: ProductRow[] = products.map((product) => {
    const { branchPrice, suggestedPrice, configured } = product;
    const available = branchPrice?.active ?? false;

    const statusTone: ProductRow["statusTone"] = !configured ? "unconfigured" : available ? "available" : "unavailable";
    const statusLabel = !configured ? "Sin configurar" : available ? "Disponible" : "No disponible";
    const priceLabel = branchPrice
      ? money(branchPrice.price)
      : suggestedPrice
        ? `~ ${money(suggestedPrice)}`
        : "Sin precio";

    const branchConfigs = branches.map((branch) => {
      const config = product.branchPrices.find((price) => price.branchId === branch.id) ?? null;
      const suggested = product.branchPrices.find((price) => price.branchId !== branch.id)?.price ?? null;

      return {
        branchId: branch.id,
        configured: config !== null,
        available: config?.active ?? false,
        priceValue: String(config?.price ?? suggested ?? ""),
      };
    });

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      configured,
      available,
      priceLabel,
      // Numérico y solo el precio REAL de esta sucursal (no el sugerido de
      // otra): para el margen hace falta el que de verdad se cobra acá, y
      // mostrar un margen calculado sobre un precio ajeno inventa un dato.
      priceValue: branchPrice ? branchPrice.price : null,
      statusLabel,
      statusTone,
      branchConfigs,
      kind: product.kind,
      unit: product.unit,
      sku: product.sku,
      barcode: product.barcode,
      cost: product.cost,
      trackStock: product.trackStock,
      // El mínimo se guarda en milésimas; el input lo muestra en unidades.
      minStockValue: product.minStock !== null ? formatQuantity(product.minStock) : "",
      categoryId: product.categoryId,
      hasPhoto: product.imageUpdatedAt !== null,
      imageVersion: product.imageUpdatedAt?.getTime() ?? null,
      catalogSlug: product.catalogSlug,
      stockQuantity: product.stockQuantity,
      minStockRaw: product.minStock,
      packSize: product.packSize,
      packLabel: product.packLabel,
      familyName: product.familyName,
      variantLabel: product.variantLabel,
      // Descuentos que ya le corren encima. Se avisan en la ficha porque al
      // cargar un precio hay que saber si ese producto ya está con 20% off.
      promociones: promocionesDeProducto(
        promociones,
        { productId: product.id, categoryId: product.categoryId },
        ahora,
      ).map((promocion) => ({ id: promocion.id, name: promocion.name, label: promotionShortLabel(promocion) })),
    };
  });

  const preset = verticalPreset(business.vertical);
  const presetCatalog = presetCatalogFor(business.vertical);

  const data: ProductsData = {
    businessName: selectedBranch.business.name,
    branches: branches.map((branch) => ({ id: branch.id, name: branch.name })),
    selectedBranchId: selectedBranch.id,
    products: rows,
    categories,
    units: Object.values(Unit).map((unit) => ({ value: unit, label: unitLabel(unit) })),
    catalogIcon: preset.catalogIcon,
    features: { ...verticalFeatures(business.vertical), stock: business.has(AppModule.STOCK) },
    selectedBranchName: selectedBranch.name,
    verticalLabel: preset.label,
    // Muestra de lo que se cargaría de una, para que se vea antes de tocar.
    presetSample: presetCatalog.slice(0, 4).map((item) => item.name),
    presetCount: presetCatalog.length,
    presetHasStock: presetCatalog.some((item) => (item.stock ?? 0) > 0),
    catalogSingular: business.labels.catalogSingular,
    catalogPlural: business.labels.catalogPlural,
    flash,
    aiImagesEnabled: Boolean(process.env.OPENROUTER_API_KEY),
    // Lo que antes vivía en /stock (retirada: ver src/app/stock/page.tsx).
    // null cuando el módulo Stock está apagado — la pantalla no debe
    // preguntar ni mostrar nada de esto en ese caso.
    stockTotals: stockOverview?.totals ?? null,
    stockMovements: stockMovements.map((movement) => ({
      id: movement.id,
      productId: movement.product.id,
      productName: movement.product.name,
      unit: movement.product.unit,
      quantity: movement.quantity,
      typeLabel: STOCK_MOVEMENT_LABELS[movement.type],
      reason: movement.reason,
      when: movementDateFormatter.format(movement.occurredAt),
    })),
  };

  return <ProductsManager data={data} />;
}

function money(value: number) {
  return moneyFormatter.format(value);
}

function getSingleParam(value: string | string[] | undefined) {
  const single = Array.isArray(value) ? value[0] : value;
  return single === "" ? undefined : single;
}

function getFlash(
  status: string | string[] | undefined,
  message: string | string[] | undefined,
): { status: "success" | "error"; message: string } | null {
  const s = getSingleParam(status);
  const m = getSingleParam(message);
  if ((s === "success" || s === "error") && m) {
    return { status: s, message: m };
  }
  return null;
}
