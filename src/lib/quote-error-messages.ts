import { QuoteErrorCode } from "@/modules/quotes/quote.errors";

const quoteErrorMessages: Record<QuoteErrorCode, string> = {
  [QuoteErrorCode.QUOTE_NOT_FOUND]: "No encontramos ese presupuesto.",
  [QuoteErrorCode.BRANCH_NOT_FOUND]: "La sucursal no existe o está desactivada.",
  [QuoteErrorCode.EMPTY_QUOTE]: "Agregá al menos un renglón al presupuesto.",
  [QuoteErrorCode.INVALID_LINE]: "Revisá las cantidades y los precios: tienen que ser mayores a cero.",
  [QuoteErrorCode.INVALID_VALIDITY]: "La fecha de vencimiento tiene que ser de hoy en adelante.",
  [QuoteErrorCode.ALREADY_CONVERTED]: "Este presupuesto ya se convirtió en venta.",
};

export function getQuoteErrorMessage(code: QuoteErrorCode) {
  return quoteErrorMessages[code];
}
