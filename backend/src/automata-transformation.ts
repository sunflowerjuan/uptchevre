import type {
  AutomataData,
  AutomataState,
  AutomataTransition,
  NfaToDfaTransformationResult,
  TransformationTableRow,
} from "./types.js";
import {
  move,
  epsilonClosure,
  getInputAlphabet,
  getStateNameMap,
  detectAutomatonType,
} from "./automata-analysis.js";
import { detectNamingStyle, makeLabel } from "./state-label-naming.js";

/**
 * Convierte un `NFA` o `NFA_EPSILON` a `DFA` mediante construcción de
 * subconjuntos.
 *
 * Propósito:
 * Generar un autómata determinista equivalente y, al mismo tiempo, producir la
 * información explicativa necesaria para que la interfaz muestre el paso a paso
 * del algoritmo.
 *
 * Parámetros:
 * - `nfa: AutomataData`
 *   Autómata origen que puede contener no determinismo y transiciones por ε.
 *
 * Valor de retorno:
 * - `NfaToDfaTransformationResult`
 *   Incluye el DFA resultante, la tabla de transformación y el mapeo entre
 *   subconjuntos del AFN y los nuevos estados del AFD.
 *
 * Ejemplo breve:
 * ```ts
 * const result = transformNfaToDfa(automaton);
 * console.log(result.dfa.states.length);
 * ```
 */
export function transformNfaToDfa(nfa: AutomataData): NfaToDfaTransformationResult {
  const originalType = detectAutomatonType(nfa);
  const alphabet = getInputAlphabet(nfa);
  const nameMap = getStateNameMap(nfa);
  const namingStyle = detectNamingStyle(nameMap);

  /**
   * Serializa un subconjunto de estados del AFN en una clave estable.
   *
   * La construcción de subconjuntos necesita una identidad única para cada
   * conjunto de estados. Ordenar y unir los IDs evita que dos conjuntos
   * semánticamente iguales se consideren distintos por diferencias de orden.
   */
  const setKey = (ids: Set<string>): string => Array.from(ids).sort().join(",");

  // Un AFN puede declarar más de un estado inicial. El subconjunto inicial del
  // DFA parte de todos ellos y luego se expande por clausura-ε.
  const initialNfaStates = nfa.states.filter((s) => s.isInitial);
  if (initialNfaStates.length === 0) {
    // Sin estado inicial no existe construcción formal útil. En lugar de lanzar
    // una excepción, se devuelve una estructura vacía para que la UI maneje el
    // caso de forma controlada.
    return {
      originalType,
      dfa: { states: [], transitions: [], alphabet },
      transformationTable: [],
      stateMapping: [],
    };
  }

  const initialIds = new Set(initialNfaStates.map((s) => s.id));
  const initialClosure = epsilonClosure(nfa, initialIds);
  const initialKey = setKey(initialClosure);

  // Relación principal: clave serializada del subconjunto -> conjunto real de
  // estados del AFN representados por ese estado del DFA.
  const dfaStatesMap = new Map<string, Set<string>>();
  dfaStatesMap.set(initialKey, initialClosure);

  // Transición determinista ya consolidada entre estados del DFA.
  const dfaDelta = new Map<string, Map<string, string>>();

  /**
   * Información intermedia para explicar el algoritmo:
   * - `move`: resultado de mover por un símbolo antes de clausura-ε.
   * - `closure`: resultado final tras aplicar clausura-ε.
   *
   * Esta estructura no es obligatoria para construir el DFA, pero sí para
   * detallar correctamente el proceso en la tabla de transformación.
   */
  const dfaMoveSets = new Map<string, Map<string, { move: Set<string>; closure: Set<string> }>>();

  // Cola de trabajo típica del algoritmo. Cada clave nueva descubierta debe
  // procesarse exactamente una vez para generar sus transiciones salientes.
  const worklist: string[] = [initialKey];
  const visited = new Set<string>();

  while (worklist.length > 0) {
    const currentKey = worklist.shift()!;
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    const currentSet = dfaStatesMap.get(currentKey)!;
    const symbolMap = new Map<string, string>();
    const moveMap = new Map<string, { move: Set<string>; closure: Set<string> }>();

    for (const symbol of alphabet) {
      // Paso 1: aplicar movimiento directo por símbolo desde todo el
      // subconjunto actual.
      const moved = move(nfa, currentSet, symbol);

      // Paso 2: si hubo estados alcanzados, extender el resultado con la
      // clausura-ε. En un NFA sin epsilon, esta operación es neutra.
      const T = moved.size > 0 ? epsilonClosure(nfa, moved) : new Set<string>();

      moveMap.set(symbol, { move: moved, closure: T });

      if (T.size > 0) {
        const targetKey = setKey(T);
        if (!dfaStatesMap.has(targetKey)) {
          dfaStatesMap.set(targetKey, T);
          worklist.push(targetKey);
        }
        symbolMap.set(symbol, targetKey);
      }
    }

    dfaDelta.set(currentKey, symbolMap);
    dfaMoveSets.set(currentKey, moveMap);
  }

  // Se conserva el estado inicial como primer estado del DFA para que la UI y
  // el etiquetado resulten más naturales.
  const orderedKeys = [
    initialKey,
    ...Array.from(dfaStatesMap.keys()).filter((k) => k !== initialKey),
  ];

  // IDs técnicos estables y etiquetas visibles coherentes con el estilo del
  // autómata original.
  const keyToId = new Map<string, string>();
  const keyToLabel = new Map<string, string>();

  orderedKeys.forEach((key, i) => {
    keyToId.set(key, `dfa_s${i}`);
    keyToLabel.set(key, makeLabel(namingStyle, i));
  });

  const nfaAcceptIds = new Set(nfa.states.filter((s) => s.isAccept).map((s) => s.id));

  /**
   * Un estado del DFA es de aceptación si al menos uno de los estados del AFN
   * contenidos en su subconjunto pertenece al conjunto de aceptación original.
   */
  const isDfaAccept = (key: string): boolean =>
    Array.from(dfaStatesMap.get(key)!).some((id) => nfaAcceptIds.has(id));

  // La distribución geométrica solo persigue una visualización suficientemente
  // legible cuando el usuario decide cargar el resultado al editor.
  const cols = Math.max(1, Math.ceil(Math.sqrt(orderedKeys.length)));
  const dfaStates: AutomataState[] = orderedKeys.map((key, i) => ({
    id: keyToId.get(key)!,
    label: keyToLabel.get(key)!,
    x: 150 + (i % cols) * 220,
    y: 120 + Math.floor(i / cols) * 160,
    isInitial: key === initialKey,
    isAccept: isDfaAccept(key),
  }));

  const dfaTransitionList: AutomataTransition[] = [];
  let tCounter = 0;

  for (const [fromKey, symbolMap] of dfaDelta.entries()) {
    const fromId = keyToId.get(fromKey)!;
    for (const [symbol, toKey] of symbolMap.entries()) {
      // Solo se serializan transiciones cuyo destino no es vacío. Cuando un
      // símbolo no produce estados, la tabla lo muestra como `∅`, pero el DFA
      // persistido no crea explícitamente ese estado sumidero.
      dfaTransitionList.push({
        id: `dfa_t${tCounter++}`,
        from: fromId,
        to: keyToId.get(toKey)!,
        symbol,
      });
    }
  }

  const dfa: AutomataData = {
    states: dfaStates,
    transitions: dfaTransitionList,
    alphabet,
  };

  // Construcción de la tabla explicativa consumida por el frontend.
  const transformationTable: TransformationTableRow[] = orderedKeys.map((key) => {
    const nfaIds = Array.from(dfaStatesMap.get(key)!).sort();
    const symbolMap = dfaDelta.get(key) ?? new Map<string, string>();

    return {
      dfaStateId: keyToId.get(key)!,
      dfaStateName: keyToLabel.get(key)!,
      nfaStateIds: nfaIds,
      nfaStateNames: nfaIds.map((id) => nameMap.get(id) ?? id),
      transitions: alphabet.map((symbol) => {
        const targetKey = symbolMap.get(symbol);
        const moveSets = dfaMoveSets.get(key)?.get(symbol);
        const moveIds = moveSets ? Array.from(moveSets.move).sort() : [];
        const closureIds = moveSets ? Array.from(moveSets.closure).sort() : [];
        return {
          symbol,
          moveNfaStateNames: moveIds.map((id) => nameMap.get(id) ?? id),
          eClosureNfaStateNames: closureIds.map((id) => nameMap.get(id) ?? id),
          targetDfaStateId: targetKey ? keyToId.get(targetKey)! : "",
          targetDfaStateName: targetKey ? keyToLabel.get(targetKey)! : "\u2205",
        };
      }),
      isInitial: key === initialKey,
      isAccept: isDfaAccept(key),
    };
  });

  // El mapeo final permite relacionar cada estado del DFA con el subconjunto
  // del AFN que lo originó.
  const stateMapping = orderedKeys.map((key) => {
    const nfaIds = Array.from(dfaStatesMap.get(key)!).sort();
    return {
      dfaStateId: keyToId.get(key)!,
      dfaStateName: keyToLabel.get(key)!,
      nfaStateIds: nfaIds,
      nfaStateNames: nfaIds.map((id) => nameMap.get(id) ?? id),
    };
  });

  return { originalType, dfa, transformationTable, stateMapping };
}
