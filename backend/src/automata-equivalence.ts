import type { AutomataData } from "./types.js";
import { buildDfaStructure, checkDeterminism } from "./automata-utils.js";

export interface EquivalenceResult {
  equivalent: boolean;
  counterExampleWord?: string;
  error?: string;
}

/**
 * Verifica equivalencia entre dos autómatas deterministas.
 *
 * Propósito:
 * Determinar si dos DFA aceptan exactamente el mismo lenguaje.
 *
 * Parámetros:
 * - `a1: AutomataData`: primer autómata.
 * - `a2: AutomataData`: segundo autómata.
 *
 * Retorno:
 * - `EquivalenceResult`: veredicto de equivalencia y, si aplica, una palabra
 *   contraejemplo o un mensaje de error.
 *
 * Cómo funciona internamente:
 * - Valida que ambos modelos sean deterministas.
 * - Construye estructuras compactas de DFA.
 * - Recorre BFS sobre el producto de estados `(q1, q2)`.
 * - Si en algún par uno acepta y el otro no, reconstruye la palabra que llevó
 *   a ese par y la devuelve como contraejemplo.
 *
 * Decisiones técnicas:
 * - Las transiciones ausentes se modelan como un sumidero implícito `null`.
 *   Esto evita tener que completar artificialmente los autómatas antes de
 *   compararlos.
 *
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

  // La comparación debe considerar todo símbolo visible en cualquiera de los
  // dos automátas, porque una discrepancia puede aparecer justo en un símbolo
  // ausente en uno de ellos.
  const alphabet = Array.from(new Set([...d1.alphabet, ...d2.alphabet])).sort();

  type Pair = { s1: string | null; s2: string | null };

  /**
   * Serializa un par del producto de estados.
   *
   * Se usa como clave de visitados y del mapa de padres para reconstrucción de
   * contraejemplo.
   */
  const keyOf = (p: Pair) => `${p.s1 ?? "#"}::${p.s2 ?? "#"}`;

  /**
   * Evalúa pertenencia a F en el primer autómata.
   */
  const isAccept1 = (id: string | null) => (id ? d1.acceptIds.has(id) : false);

  /**
   * Evalúa pertenencia a F en el segundo autómata.
   */
  const isAccept2 = (id: string | null) => (id ? d2.acceptIds.has(id) : false);

  /**
   * Consulta el siguiente estado para una transición DFA.
   *
   * Si el autómata no define transición para la clave pedida, se devuelve
   * `null`, que funciona como un sumidero implícito.
   */
  const getNext = (delta: Map<string, string>, from: string | null, symbol: string): string | null => {
    if (!from) return null;
    return delta.get(`${from}::${symbol}`) ?? null;
  };

  const start: Pair = { s1: d1.initialId, s2: d2.initialId };
  const queue: Pair[] = [start];
  const visited = new Set<string>([keyOf(start)]);

  // El mapa de padres permite reconstruir la palabra que condujo a cualquier
  // nodo del producto. Cada entrada registra desde qué nodo se llegó y con qué
  // símbolo se hizo la transición.
  const parent = new Map<string, { prevKey: string | null; symbol: string | null }>();
  parent.set(keyOf(start), { prevKey: null, symbol: null });

  while (queue.length > 0) {
    const current = queue.shift() as Pair;
    const currentKey = keyOf(current);

    // Si en un mismo punto de lectura uno de los estados compuestos acepta y
    // el otro no, entonces ya existe una palabra que distingue ambos lenguajes.
    if (isAccept1(current.s1) !== isAccept2(current.s2)) {
      const word: string[] = [];
      let k: string | null = currentKey;

      // Se reconstruye la palabra recorriendo los padres desde el nodo actual
      // hasta el nodo inicial y luego revirtiendo el orden de lectura.
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
