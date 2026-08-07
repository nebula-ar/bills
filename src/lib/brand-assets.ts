// Colores de tinta de la marca Bills.
//
// Los logos son imágenes PNG (recortadas a `public/brand/`): logo azul para
// fondos claros y logo blanco para fondos oscuros. Estos colores se usan solo
// para el wordmark en texto del `BrandLogo` (el ícono es la imagen original).

export const brandColors = {
  white: "#FDFDFD",
  blue: "#1F6FFF",
} as const;

export type BrandVariant = keyof typeof brandColors;
