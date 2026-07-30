export const MarketingErrorCode = {
  BUSINESS_NOT_FOUND: "BUSINESS_NOT_FOUND",
  INVALID_URL: "INVALID_URL",
  INVALID_POINTS_RULE: "INVALID_POINTS_RULE",
  INVALID_POINTS: "INVALID_POINTS",
  NOT_ENOUGH_POINTS: "NOT_ENOUGH_POINTS",
  LOYALTY_DISABLED: "LOYALTY_DISABLED",
  PAGE_NOT_FOUND: "PAGE_NOT_FOUND",
  BOOKING_UNAVAILABLE: "BOOKING_UNAVAILABLE",
  INVALID_BOOKING: "INVALID_BOOKING",
} as const;

export type MarketingErrorCode = (typeof MarketingErrorCode)[keyof typeof MarketingErrorCode];

export class MarketingError extends Error {
  constructor(public readonly code: MarketingErrorCode) {
    super(code);
    this.name = "MarketingError";
  }
}
