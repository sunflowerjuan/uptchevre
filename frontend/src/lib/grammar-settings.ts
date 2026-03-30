import type { GrammarValidationSettings } from "@/lib/automata-api";

export const DEFAULT_GRAMMAR_VALIDATION_SETTINGS: GrammarValidationSettings = {
  requireMinTerminals: true,
  minTerminals: 2,
  requireMinNonTerminals: true,
  minNonTerminals: 1,
  requireStartSymbolInNonTerminals: true,
  requireLeftSideNonTerminal: true,
  requireMinProductions: true,
  minProductions: 3,
  requireKnownSymbols: true,
  requireLinearity: true,
  requireSingleLinearityDirection: true,
  requireNonTerminalPosition: true,
};
