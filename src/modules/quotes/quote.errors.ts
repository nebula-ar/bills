export const QuoteErrorCode = {
  QUOTE_NOT_FOUND: "QUOTE_NOT_FOUND",
  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",
  EMPTY_QUOTE: "EMPTY_QUOTE",
  INVALID_LINE: "INVALID_LINE",
  INVALID_VALIDITY: "INVALID_VALIDITY",
  ALREADY_CONVERTED: "ALREADY_CONVERTED",
} as const;

export type QuoteErrorCode = (typeof QuoteErrorCode)[keyof typeof QuoteErrorCode];

export class QuoteError extends Error {
  constructor(public readonly code: QuoteErrorCode) {
    super(code);
    this.name = "QuoteError";
  }
}
