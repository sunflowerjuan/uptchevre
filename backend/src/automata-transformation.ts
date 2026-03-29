import type { AutomataData, AutomataState, AutomataTransition, NfaToDfaTransformationResult, TransformationTableRow } from "./types.js";
import {
  move,
  epsilonClosure,
  getInputAlphabet,
  getStateNameMap,
  detectAutomatonType,
} from "./automata-analysis.js";

function detectNamingStyle(nameMap: Map<string, string>): { prefix: string; subscript: boolean } {
  const names = Array.from(nameMap.values());
  for (const name of names) {
    const subscriptMatch = name.match(/^([a-zA-Z]+)[₀₁₂₃₄₅₆₇₈₉]+$/);
    if (subscriptMatch) return { prefix: subscriptMatch[1], subscript: true };
    const regularMatch = name.match(/^([a-zA-Z]+)\d+$/);
    if (regularMatch) return { prefix: regularMatch[1], subscript: false };
  }
  return { prefix: "q", subscript: false };
}

const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
function toSubscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUBSCRIPT_DIGITS[parseInt(d, 10)])
    .join("");
}

function makeLabel(prefix: string, subscript: boolean, index: number): string {
  return `${prefix}${subscript ? toSubscript(index) : index}`;
}

export function transformNfaToDfa(nfa: AutomataData): NfaToDfaTransformationResult {
  const originalType = detectAutomatonType(nfa);
  const alphabet = getInputAlphabet(nfa);
  const nameMap = getStateNameMap(nfa);
  const namingStyle = detectNamingStyle(nameMap);

  const setKey = (ids: Set<string>): string =>
    Array.from(ids).sort().join(",");

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

  const dfaStatesMap = new Map<string, Set<string>>();
  dfaStatesMap.set(initialKey, initialClosure);

  const dfaDelta = new Map<string, Map<string, string>>();
  // dfaMoveSets: clave_origen → (símbolo → { move: ids antes de ε-clausura, closure: ids tras ε-clausura })
  const dfaMoveSets = new Map<string, Map<string, { move: Set<string>; closure: Set<string> }>>();

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
      const moved = move(nfa, currentSet, symbol);
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

  const orderedKeys = [
    initialKey,
    ...Array.from(dfaStatesMap.keys()).filter((k) => k !== initialKey),
  ];

  const keyToId = new Map<string, string>();
  const keyToLabel = new Map<string, string>();

  orderedKeys.forEach((key, i) => {
    keyToId.set(key, `dfa_s${i}`);
    keyToLabel.set(key, makeLabel(namingStyle.prefix, namingStyle.subscript, i));
  });

  const nfaAcceptIds = new Set(nfa.states.filter((s) => s.isAccept).map((s) => s.id));
  const isDfaAccept = (key: string): boolean =>
    Array.from(dfaStatesMap.get(key)!).some((id) => nfaAcceptIds.has(id));

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
