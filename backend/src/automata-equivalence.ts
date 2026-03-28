import type { AutomataData } from "./types.js";
import { buildDfaStructure, checkDeterminism } from "./automata-utils.js";

export interface EquivalenceResult {
  equivalent: boolean;
  counterExampleWord?: string;
  error?: string;
}

/**
 * Equivalencia entre autómatas deterministas.
 *
 * La comparación recorre el producto de estados (q1, q2). Si encuentra un par
 * donde uno acepta y el otro no, reconstruye la palabra que llevó a esa
 * discrepancia y la devuelve como contraejemplo.
 */
export function areAutomataEquivalent(a1: AutomataData, a2: AutomataData): EquivalenceResult {
  const det1 = checkDeterminism(a1);
  const det2 = checkDeterminism(a2);

  if (!det1.isDeterministic || !det2.isDeterministic) {
    return {
      equivalent: false,
      error: "Al menos uno de los automatas no es determinista.",
    };
  }

  const d1 = buildDfaStructure(a1);
  const d2 = buildDfaStructure(a2);

  if (!d1.initialId || !d2.initialId) {
    return {
      equivalent: false,
      error: "Ambos automatas deben tener estado inicial.",
    };
  }

  const alphabet = Array.from(new Set([...d1.alphabet, ...d2.alphabet])).sort();

  type Pair = { s1: string | null; s2: string | null };
  const keyOf = (p: Pair) => `${p.s1 ?? "#"}::${p.s2 ?? "#"}`;
  const isAccept1 = (id: string | null) => (id ? d1.acceptIds.has(id) : false);
  const isAccept2 = (id: string | null) => (id ? d2.acceptIds.has(id) : false);
  const getNext = (delta: Map<string, string>, from: string | null, symbol: string): string | null => {
    if (!from) return null;
    return delta.get(`${from}::${symbol}`) ?? null;
  };

  const start: Pair = { s1: d1.initialId, s2: d2.initialId };
  const queue: Pair[] = [start];
  const visited = new Set<string>([keyOf(start)]);
  const parent = new Map<string, { prevKey: string | null; symbol: string | null }>();
  parent.set(keyOf(start), { prevKey: null, symbol: null });

  while (queue.length > 0) {
    const current = queue.shift() as Pair;
    const currentKey = keyOf(current);

    // Diferencia semántica: uno acepta la palabra acumulada y el otro no.
    if (isAccept1(current.s1) !== isAccept2(current.s2)) {
      const word: string[] = [];
      let k: string | null = currentKey;
      while (k) {
        const info = parent.get(k);
        if (!info || info.symbol == null) break;
        word.push(info.symbol);
        k = info.prevKey;
      }
      word.reverse();
      return {
        equivalent: false,
        counterExampleWord: word.join(""),
      };
    }

    for (const sym of alphabet) {
      // null actúa como estado sumidero implícito para transiciones ausentes.
      const next: Pair = {
        s1: getNext(d1.delta, current.s1, sym),
        s2: getNext(d2.delta, current.s2, sym),
      };
      const nextKey = keyOf(next);
      if (!visited.has(nextKey)) {
        visited.add(nextKey);
        parent.set(nextKey, { prevKey: currentKey, symbol: sym });
        queue.push(next);
      }
    }
  }

  return { equivalent: true };
}

