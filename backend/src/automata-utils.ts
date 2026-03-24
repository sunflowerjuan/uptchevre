import type { AutomataData, AutomataState, AutomataTransition } from "./types.js";

export interface DeterminismIssue {
  stateId: string;
  symbol: string;
  transitions: AutomataTransition[];
}

export interface DeterminismCheckResult {
  isDeterministic: boolean;
  issues: DeterminismIssue[];
}

export function getAlphabet(a: AutomataData): string[] {
  if (a.alphabet && a.alphabet.length > 0) {
    return Array.from(new Set(a.alphabet)).sort();
  }
  const symbols = new Set<string>();
  for (const t of a.transitions) {
    if (t.symbol) symbols.add(t.symbol);
  }
  return Array.from(symbols).sort();
}

export function getInitialState(a: AutomataData): AutomataState | undefined {
  return a.states.find((s) => s.isInitial);
}

export function checkDeterminism(a: AutomataData): DeterminismCheckResult {
  const issues: DeterminismIssue[] = [];
  const byStateAndSymbol = new Map<string, AutomataTransition[]>();

  for (const t of a.transitions) {
    const key = `${t.from}::${t.symbol}`;
    const list = byStateAndSymbol.get(key) ?? [];
    list.push(t);
    byStateAndSymbol.set(key, list);
  }

  for (const [key, transitions] of byStateAndSymbol.entries()) {
    if (transitions.length > 1) {
      const [stateId, symbol] = key.split("::");
      issues.push({ stateId, symbol, transitions });
    }
  }

  return {
    isDeterministic: issues.length === 0,
    issues,
  };
}

export interface DfaStructure {
  alphabet: string[];
  delta: Map<string, string>;
  initialId?: string;
  acceptIds: Set<string>;
}

export function buildDfaStructure(a: AutomataData): DfaStructure {
  const alphabet = getAlphabet(a);
  const delta = new Map<string, string>();

  for (const t of a.transitions) {
    delta.set(`${t.from}::${t.symbol}`, t.to);
  }

  const initial = getInitialState(a);
  const acceptIds = new Set<string>(a.states.filter((s) => s.isAccept).map((s) => s.id));

  return {
    alphabet,
    delta,
    initialId: initial?.id,
    acceptIds,
  };
}

