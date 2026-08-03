import { Vertical } from "@/generated/prisma/enums";
import { verticalPreset } from "@/lib/vertical";

// Los pasos del alta, armados a partir del rubro.
//
// Dos cosas que estaban mal y que esta función arregla de raíz:
//
// 1. Se preguntaba el nombre del negocio y DESPUÉS el nombre del local. Para el
//    99% —un solo local— es la misma pregunta dos veces. Ahora el primer local
//    se llama como el negocio y listo; quien tenga más los suma desde el panel.
// 2. La copia y los iconos estaban fijos en barbería (tijeras, "servicios") aunque
//    el tipo hubiera elegido verdulería. Todo lo que se lee acá sale del rubro.
//
// El catálogo tampoco se pregunta acá: cargar productos con precios en el medio
// de un registro es pedirle al tipo que tome decisiones antes de haber visto el
// sistema. Se hace adentro de la app, con el catálogo vacío enfrente
// (ver seed-preset-catalog.use-case.ts y <CatalogOnboarding/>).

export type OnboardingStepId = "vertical" | "businessName" | "ownerName" | "email" | "password" | "staff";

export type OnboardingStep = {
  id: OnboardingStepId;
  // Nombre del icono (Iconify, set Solar). Los del rubro salen del preset.
  icon: string;
  title: string;
  subtitle: string;
  placeholder?: string;
};

export function onboardingSteps(vertical: Vertical): OnboardingStep[] {
  const preset = verticalPreset(vertical);
  const { labels } = preset;

  const staffSingular = labels.staffSingular.toLowerCase();
  const sellAction = labels.sellAction.toLowerCase();

  return [
    {
      id: "vertical",
      icon: "solar:shop-2-bold",
      title: "¿De qué es tu negocio?",
      subtitle: "Prendemos los módulos típicos. Los cambiás cuando quieras.",
    },
    {
      id: "businessName",
      icon: preset.icon,
      title: "¿Cómo se llama?",
      // Acá se avisa que no vamos a volver a preguntar por el local.
      subtitle: "Tu primer local se llama igual. Si tenés más, los sumás después.",
      placeholder: preset.namePlaceholder,
    },
    {
      id: "ownerName",
      icon: "solar:users-group-rounded-bold",
      title: "¿Cómo te llamás?",
      subtitle: "Así te saludamos en el panel.",
      placeholder: "Ej: Matías",
    },
    {
      id: "email",
      icon: "solar:letter-bold",
      title: "¿Cuál es tu email?",
      subtitle: "Lo vas a usar para entrar.",
      placeholder: "tucorreo@ejemplo.com",
    },
    {
      id: "password",
      icon: "solar:lock-bold",
      title: "Creá tu contraseña",
      subtitle: "Al menos 6 caracteres.",
      placeholder: "Al menos 6 caracteres",
    },
    {
      id: "staff",
      icon: preset.staffIcon,
      title: "¿Quién atiende?",
      subtitle: `Hace falta al menos un ${staffSingular} para poder ${sellAction}.`,
    },
  ];
}
