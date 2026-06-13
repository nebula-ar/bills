export const BranchErrorCode = {
  BUSINESS_NOT_FOUND: "BUSINESS_NOT_FOUND",
  BRANCH_NOT_FOUND: "BRANCH_NOT_FOUND",
  NAME_REQUIRED: "NAME_REQUIRED",
} as const;

export type BranchErrorCode = (typeof BranchErrorCode)[keyof typeof BranchErrorCode];

export class BranchError extends Error {
  constructor(public readonly code: BranchErrorCode) {
    super(code);
    this.name = "BranchError";
  }
}
