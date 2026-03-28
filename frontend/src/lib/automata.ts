import type { AutomataData } from "@/hooks/useAutomataEditor";

export const EPSILON_SYMBOL = "";
export const EPSILON_DISPLAY = "\u03b5";

/** Normaliza la representación visible de símbolos a la convención interna. */
export function normalizeSymbol(symbol: string): string {
  const normalized = symbol.trim();
  return normalized === EPSILON_DISPLAY ? EPSILON_SYMBOL : normalized;
}

export function displaySymbol(symbol: string): string {
  const normalized = normalizeSymbol(symbol);
  return normalized === EPSILON_SYMBOL ? EPSILON_DISPLAY : normalized;
}

export function serializeSymbols(symbols: string[]): string {
  return symbols.map(displaySymbol).join(", ");
}

export function displayWord(word: string): string {
  return word === "" ? EPSILON_DISPLAY : word;
}

/**
 * Snapshot mínimo del contenido teórico del autómata.
 *
 * Se usa para invalidar análisis y simulaciones solo cuando cambia algo que
 * afecta al formalismo: estados, iniciales, finales, transiciones o alfabeto.
 */
export function getTheorySnapshot(data: AutomataData) {
  return {
    states: data.states.map((state) => ({
      id: state.id,
      label: state.label,
      isInitial: state.isInitial,
      isAccept: state.isAccept,
    })),
    transitions: data.transitions
      .map((transition) => ({
        id: transition.id,
        from: transition.from,
        to: transition.to,
        symbol: normalizeSymbol(transition.symbol),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    alphabet: data.alphabet.map(normalizeSymbol).sort(),
  };
}
