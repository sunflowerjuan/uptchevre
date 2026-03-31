/**
 * Transformación AFN → AFD mediante construcción de subconjuntos (Rabin & Scott, 1959).
 *
 * La construcción de subconjuntos convierte un Autómata Finito No Determinista (AFN o
 * AFN-ε) en un Autómata Finito Determinista (AFD) equivalente. Cada estado del AFD
 * representa un *subconjunto* de estados del AFN — de ahí el nombre del algoritmo.
 *
 * Pasos del algoritmo:
 *
 * 1. Inicializar Q' = { ∅ }
 *    Se crea la tabla de construcción vacía. El conjunto de estados del AFD (Q') parte
 *    con el estado trampa implícito (∅), que se materializa solo si alguna transición
 *    lleva a un conjunto vacío.
 *
 * 2. Adicionar q₀ a Q'
 *    El primer estado del AFD es ε-clausura({ q₀ }): todos los estados del AFN
 *    alcanzables desde el estado inicial consumiendo únicamente transiciones-ε.
 *    Este subconjunto se inserta en Q' y en la lista de trabajo (worklist).
 *
 * 3. Por cada estado en Q', resolver δ con cada símbolo del alfabeto A
 *    Para cada subconjunto S ∈ Q' aún no procesado:
 *      a. Calcular move(S, a) = { t | ∃ s ∈ S, s --a--> t }  (todos los estados
 *         alcanzables desde S consumiendo el símbolo a).
 *      b. Calcular T = ε-clausura(move(S, a))  (cerrar bajo transiciones-ε).
 *      c. Si T ≠ ∅ y T ∉ Q', adicionar T a Q' y encolarlo en la worklist.
 *      d. Registrar la transición S --a--> T en la tabla del AFD.
 *    Repetir hasta que la worklist quede vacía (punto fijo).
 *
 * 4. Mapear estados en Q' según la nomenclatura del AFN original
 *    Una vez cerrado el conjunto Q', cada subconjunto recibe un nombre legible
 *    que respeta el estilo de etiquetas del AFN (prefijo+índice, número puro,
 *    letra pura, etc.) y comienza desde el mismo índice mínimo detectado en el AFN.
 *    Un estado del AFD es de aceptación si alguno de sus estados AFN componentes
 *    pertenece a F (estados finales del AFN).
 */

import type { AutomataData, AutomataState, AutomataTransition, NfaToDfaTransformationResult, TransformationTableRow } from "./types.js";
import {
  move,
  epsilonClosure,
  getInputAlphabet,
  getStateNameMap,
  detectAutomatonType,
} from "./automata-analysis.js";
import { detectNamingStyle, makeLabel } from "./state-label-naming.js";

export function transformNfaToDfa(nfa: AutomataData): NfaToDfaTransformationResult {
  const originalType = detectAutomatonType(nfa);
  const alphabet = getInputAlphabet(nfa);

  // nameMap asocia cada ID interno con el nombre visible del estado en el AFN.
  // Lo usamos para detectar el estilo de nomenclatura (¿usa "q0"? ¿letras? ¿números?)
  // y para mostrar los subconjuntos con los nombres originales en la tabla.
  const nameMap = getStateNameMap(nfa);
  const namingStyle = detectNamingStyle(nameMap);

  // Clave canónica de un subconjunto: IDs ordenados y unidos por coma.
  // Permite usar el subconjunto como clave de un Map sin comparar Sets directamente.
  const setKey = (ids: Set<string>): string =>
    Array.from(ids).sort().join(",");

  // ── Paso 1: Inicializar Q' = { ∅ } ─────────────────────────────────────────
  // dfaStatesMap es la tabla de construcción vacía que representa Q'.
  // El estado trampa ∅ no se agrega aquí — se materializa solo si alguna
  // transición lleva a un conjunto vacío (ver paso 3).
  const dfaStatesMap = new Map<string, Set<string>>();

  // ── Paso 2: Adicionar { q₀ } a Q' ──────────────────────────────────────────
  // El primer estado del AFD es ε-clausura({ q₀ }): todos los estados del AFN
  // alcanzables desde el estado inicial consumiendo únicamente transiciones-ε.
  // Si el AFN no tiene estado inicial se devuelve un AFD vacío.
  const initialNfaStates = nfa.states.filter((s) => s.isInitial);
  if (initialNfaStates.length === 0) {
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
  dfaStatesMap.set(initialKey, initialClosure); // { q₀ } queda en Q'

  // dfaDelta es la función de transición del AFD
  // dfaDelta: clave_origen → (símbolo → clave_destino)
  // Tabla de transición del AFD: dado un estado-subconjunto y un símbolo, devuelve
  // el subconjunto destino (también como clave canónica).
  const dfaDelta = new Map<string, Map<string, string>>();

  // dfaMoveSets: guarda los conjuntos intermedios move() y ε-clausura() por
  // cada transición, de modo que podamos mostrar el paso a paso en la tabla.
  const dfaMoveSets = new Map<string, Map<string, { move: Set<string>; closure: Set<string> }>>();

   // ── Paso 3: explorar todos los subconjuntos alcanzables ─────────────────────
  // Se procesa cada subconjunto descubierto hasta que no queden nuevos por explorar.
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
      // 3a. move(S, a): estados AFN alcanzables desde S con el símbolo actual.
      const moved = move(nfa, currentSet, symbol);

      // 3b. T = ε-clausura(move(S, a)): cerrar bajo transiciones-ε.
      const T = moved.size > 0 ? epsilonClosure(nfa, moved) : new Set<string>();

      moveMap.set(symbol, { move: moved, closure: T });

      // 3c. Si T es no vacío y no estaba en Q', encolarlo para procesarlo después.
      if (T.size > 0) {
        const targetKey = setKey(T);
        if (!dfaStatesMap.has(targetKey)) {
          dfaStatesMap.set(targetKey, T);
          worklist.push(targetKey);
        }
        // 3d. Registrar la transición S --a--> T.
        symbolMap.set(symbol, targetKey);
      }
    }

    dfaDelta.set(currentKey, symbolMap);
    dfaMoveSets.set(currentKey, moveMap);
  }

  // ── Paso 4: mapeo de subconjuntos a nombres legibles ────────────────────────
  // Los subconjuntos se ordenan con el estado inicial primero; el resto sigue el
  // orden de descubrimiento.
  const orderedKeys = [
    initialKey,
    ...Array.from(dfaStatesMap.keys()).filter((k) => k !== initialKey),
  ];

  // Cada subconjunto recibe un ID interno (dfa_s0, dfa_s1, …) y una etiqueta
  // visible que sigue el mismo estilo que el AFN de entrada.
  const keyToId = new Map<string, string>();
  const keyToLabel = new Map<string, string>();

  orderedKeys.forEach((key, i) => {
    keyToId.set(key, `dfa_s${i}`);
    keyToLabel.set(key, makeLabel(namingStyle, i));
  });

  // Un estado del AFD es de aceptación si contiene al menos un estado de aceptación
  // del AFN original.
  const nfaAcceptIds = new Set(nfa.states.filter((s) => s.isAccept).map((s) => s.id));
  const isDfaAccept = (key: string): boolean =>
    Array.from(dfaStatesMap.get(key)!).some((id) => nfaAcceptIds.has(id));

  // Distribuimos los estados en una cuadrícula para que se vean bien en el canvas.
  const cols = Math.max(1, Math.ceil(Math.sqrt(orderedKeys.length)));
  const dfaStates: AutomataState[] = orderedKeys.map((key, i) => ({
    id: keyToId.get(key)!,
    label: keyToLabel.get(key)!,
    x: 150 + (i % cols) * 220,
    y: 120 + Math.floor(i / cols) * 160,
    isInitial: key === initialKey,
    isAccept: isDfaAccept(key),
  }));

  // Construimos la lista de transiciones del AFD a partir de dfaDelta.
  const dfaTransitionList: AutomataTransition[] = [];
  let tCounter = 0;

  for (const [fromKey, symbolMap] of dfaDelta.entries()) {
    const fromId = keyToId.get(fromKey)!;
    for (const [symbol, toKey] of symbolMap.entries()) {
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

  // ── Tabla de construcción (para el panel paso a paso) ───────────────────────
  // Cada fila es un estado del AFD. Para cada símbolo guardamos: move(),
  // ε-clausura() y el estado destino, de modo que el usuario pueda seguir
  // el algoritmo columna a columna
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

  // Mapeo final estado:Relaciona cada estado del AFD con los estados del AFN
  // que lo componen.
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
