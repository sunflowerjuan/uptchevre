export type SymbolComparison = {
  symbol: string;
  targetA: string;
  targetB: string;
  targetAInF: boolean;
  targetBInF: boolean;
  pairAlreadyMarked: boolean;
  marks: boolean;
};

export type RichReason = {
  markType: "base" | "propagation";
  summary: string;
  comparisons: SymbolComparison[];
};

export const RICH_REASON_PREFIX = "__rich__";
