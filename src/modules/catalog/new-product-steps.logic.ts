// Los pasos del alta de un ítem del catálogo.
//
// Antes el alta era un formulario largo con todo junto y un botón "Crear y
// agregar foto": el producto se grababa a mitad de camino y la foto quedaba
// para después. Un alta abandonada dejaba mercadería a medias en el catálogo.
// Acá se juntan los datos primero y se crea al final, una sola vez.
//
// Qué se pregunta lo decide el rubro, no el JSX: una barbería no tiene código
// de barras que cargar y preguntarle por uno es invitarla a inventar un dato.

export type NewProductStepId = "identidad" | "foto" | "precio" | "existencia" | "codigo" | "categoria";

export type NewProductStep = {
  id: NewProductStepId;
  // Nombre del icono (Iconify, set Solar).
  icon: string;
  title: string;
  subtitle: string;
  // Un paso opcional se puede saltear sin cargar nada. La identidad no.
  optional: boolean;
};

export type NewProductStepsInput = {
  features: { barcodes: boolean; stock: boolean };
  // Sin categorías cargadas no hay nada para elegir: el paso no aparece.
  hasCategories: boolean;
  // "producto", "servicio", "prenda"… sale de las etiquetas del rubro.
  catalogSingular: string;
  // Cuando el negocio tiene una sola sucursal no se pregunta a cuál va.
  branchName: string | null;
};

export function newProductSteps(input: NewProductStepsInput): NewProductStep[] {
  const singular = input.catalogSingular.toLowerCase();
  const steps: NewProductStep[] = [
    {
      id: "identidad",
      icon: "solar:tag-bold",
      title: `¿Qué ${singular} estás cargando?`,
      subtitle: "El nombre es con el que lo vas a buscar para vender.",
      optional: false,
    },
    {
      id: "foto",
      icon: "solar:gallery-bold",
      title: "Ponele una foto",
      subtitle: "En el mostrador se vende mirando, no leyendo una lista.",
      optional: true,
    },
    {
      id: "precio",
      icon: "solar:tag-price-bold",
      title: input.branchName ? `¿A cuánto lo vendés en ${input.branchName}?` : "¿A cuánto lo vendés?",
      subtitle: "Sin precio se crea igual, pero no se puede vender todavía.",
      optional: true,
    },
  ];

  if (input.features.stock) {
    steps.push({
      id: "existencia",
      icon: "solar:box-bold",
      title: "¿Cuántos tenés?",
      // El costo se pide acá y no en "precio" a propósito: es lo que pagaste,
      // no lo que cobrás, y mezclarlos es de donde salen las ganancias infladas.
      subtitle: "Y cuánto te cuesta, para que la ganancia salga bien.",
      optional: true,
    });
  }

  if (input.features.barcodes) {
    steps.push({
      id: "codigo",
      icon: "solar:qr-code-bold",
      title: "¿Tiene código de barras?",
      subtitle: "Cargalo ahora y después lo vendés escaneando.",
      optional: true,
    });
  }

  if (input.hasCategories) {
    steps.push({
      id: "categoria",
      icon: "solar:widget-add-bold",
      title: "¿En qué categoría va?",
      subtitle: "Sirve para encontrarlo rápido cuando el catálogo crezca.",
      optional: true,
    });
  }

  return steps;
}

/** ¿Se puede avanzar del paso actual con lo que hay cargado? */
export function puedeAvanzar(step: NewProductStep, nombre: string): boolean {
  if (step.id === "identidad") return nombre.trim().length > 0;
  return true;
}
