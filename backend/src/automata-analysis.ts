import type {
  AutomataAnalysisResult,
  AutomataData,
  AutomataState,
  AutomataTransition,
  AutomatonType,
  DeterminismIssueDescriptor,
  EClosureDescriptor,
  StateDescriptor,
  TransitionDescriptor,
} from "./types.js";

/**
 * Nucleo formal del analisis.
 *
 * Este modulo define como se interpreta la teoria de automatas:
 * - que cuenta como simbolo de entrada
 * - como se detecta epsilon
 * - como se construye una vista indexada de FT
 * - como se calcula move
 * - como se calcula la clausura-e
 * - como se clasifica un automata como DFA, NFA o NFA-e
 */
export const EPSILON_SYMBOL = "";
export const EPSILON_DISPLAY = "\u03b5";

export function normalizeSymbol(symbol: string): string {
  return symbol.trim();
}

export function isEpsilonSymbol(symbol: string): boolean {
  return normalizeSymbol(symbol) === EPSILON_SYMBOL;
}

export function getInputAlphabet(automaton: AutomataData): string[] {
  // sigma nunca incluye epsilon; las transiciones vacias se modelan aparte.
  const explicitAlphabet = automaton.alphabet
    .map(normalizeSymbol)
    .filter((symbol) => !isEpsilonSymbol(symbol));

  if (explicitAlphabet.length > 0) {
    return Array.from(new Set(explicitAlphabet)).sort();
  }

  const symbols = new Set<string>();
  for (const transition of automaton.transitions) {
    const normalized = normalizeSymbol(transition.symbol);
    if (!isEpsilonSymbol(normalized)) {
      symbols.add(normalized);
    }
  }
  return Array.from(symbols).sort();
}

export function formatSymbol(symbol: string): string {
  return isEpsilonSymbol(symbol) ? EPSILON_DISPLAY : symbol;
}

export function getInitialStates(automaton: AutomataData): AutomataState[] {
  return automaton.states.filter((state) => state.isInitial);
}

export function getStateNameMap(automaton: AutomataData): Map<string, string> {
  // La teoria opera con nombres de estado. La UI aporta ids y labels.
  // Este mapa decide el nombre formal estable que se mostrara en la interfaz.
  const labelCount = new Map<string, number>();

  for (const state of automaton.states) {
    const normalizedLabel = state.label.trim();
    if (!normalizedLabel) continue;
    labelCount.set(normalizedLabel, (labelCount.get(normalizedLabel) ?? 0) + 1);
  }

  const nameMap = new Map<string, string>();
  for (const state of automaton.states) {
    const normalizedLabel = state.label.trim();
    if (!normalizedLabel) {
      nameMap.set(state.id, state.id);
      continue;
    }

    const usesLabel = (labelCount.get(normalizedLabel) ?? 0) === 1;
    nameMap.set(state.id, usesLabel ? normalizedLabel : state.id);
  }

  return nameMap;
}

export interface TransitionMap {
  stateMap: Map<string, AutomataState>;
  nameMap: Map<string, string>;
  // Vista indexada de FT por clave (estado, simbolo). 
  outgoing: Map<string, AutomataTransition[]>;
}

export function buildTransitionMap(automaton: AutomataData): TransitionMap {
  const stateMap = new Map(automaton.states.map((state) => [state.id, state]));
  const nameMap = getStateNameMap(automaton);
  const outgoing = new Map<string, AutomataTransition[]>();

  for (const transition of automaton.transitions) {
    const normalized = normalizeSymbol(transition.symbol);
    const normalizedTransition = {
      ...transition,
      symbol: normalized,
    };
    const key = `${normalizedTransition.from}::${normalized}`;
    const list = outgoing.get(key) ?? [];
    list.push(normalizedTransition);
    outgoing.set(key, list);
  }

  return {
    stateMap,
    nameMap,
    outgoing,
  };
}

export function epsilonClosure(
  automaton: AutomataData,
  startIds: Iterable<string>,
): Set<string> {
  /**
   * Clausura-e:
   * conjunto de estados alcanzables desde startIds usando cero o mas
   * transiciones e. Siempre contiene a startIds.
   */
  const { outgoing } = buildTransitionMap(automaton);
  const closure = new Set<string>(startIds);
  const queue = Array.from(closure);

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const epsilonTransitions = outgoing.get(`${current}::${EPSILON_SYMBOL}`) ?? [];

    for (const transition of epsilonTransitions) {
      if (!closure.has(transition.to)) {
        closure.add(transition.to);
        queue.push(transition.to);
      }
    }
  }

  return closure;
}

export function move(
  automaton: AutomataData,
  stateIds: Iterable<string>,
  symbol: string,
): Set<string> {
  /**
   * move(S, a):
   * conjunto de estados alcanzables consumiendo exactamente a desde
   * cualquier estado del conjunto S.
   */
  const { outgoing } = buildTransitionMap(automaton);
  const next = new Set<string>();
  const normalized = normalizeSymbol(symbol);

  for (const stateId of stateIds) {
    const transitions = outgoing.get(`${stateId}::${normalized}`) ?? [];
    for (const transition of transitions) {
      next.add(transition.to);
    }
  }

  return next;
}

export function getDeterminismIssues(automaton: AutomataData): DeterminismIssueDescriptor[] {
  // El modelo deja de ser DFA si:
  // - hay mas de un estado inicial
  // - una pareja (estado, simbolo) tiene mas de un destino
  const { nameMap, outgoing } = buildTransitionMap(automaton);
  const issues: DeterminismIssueDescriptor[] = [];

  const initialStates = getInitialStates(automaton);
  if (initialStates.length > 1) {
    issues.push({
      stateId: "__initial__",
      stateName: "Estados iniciales",
      symbol: "",
      displaySymbol: "inicio",
      targets: initialStates.map((state) => nameMap.get(state.id) ?? state.id),
    });
  }

  for (const [key, transitions] of outgoing.entries()) {
    if (transitions.length <= 1) continue;
    const [stateId, symbol] = key.split("::");
    issues.push({
      stateId,
      stateName: nameMap.get(stateId) ?? stateId,
      symbol,
      displaySymbol: formatSymbol(symbol),
      targets: transitions.map((transition) => nameMap.get(transition.to) ?? transition.to),
    });
  }

  return issues;
}

export function detectAutomatonType(automaton: AutomataData): AutomatonType {
  // Orden de decision:
  // 1. Si aparece e, el automata es NFA-e.
  // 2. Si no hay e pero si multiples destinos, es NFA.
  // 3. En otro caso, es DFA.
  const hasEpsilon = automaton.transitions.some((transition) =>
    isEpsilonSymbol(transition.symbol),
  );

  if (hasEpsilon) {
    return "NFA_EPSILON";
  }

  const determinismIssues = getDeterminismIssues(automaton);
  if (determinismIssues.length > 0) {
    return "NFA";
  }

  return "DFA";
}

export function analyzeAutomaton(automaton: AutomataData): AutomataAnalysisResult {
  /**
   * Traduce el automata al vocabulario formal que consume la interfaz:
   * - 5-tupla
   * - conjuntos de iniciales y de aceptacion
   * - tabla de transicion
   * - clausura-e por estado
   */
  const nameMap = getStateNameMap(automaton);
  const automatonType = detectAutomatonType(automaton);
  const supportsEpsilon = automatonType === "NFA_EPSILON";

  const states: StateDescriptor[] = automaton.states.map((state) => ({
    id: state.id,
    name: nameMap.get(state.id) ?? state.id,
    isInitial: state.isInitial,
    isAccept: state.isAccept,
  }));

  const transitions: TransitionDescriptor[] = automaton.transitions.map((transition) => {
    const symbol = normalizeSymbol(transition.symbol);
    return {
      fromId: transition.from,
      fromName: nameMap.get(transition.from) ?? transition.from,
      toId: transition.to,
      toName: nameMap.get(transition.to) ?? transition.to,
      symbol,
      displaySymbol: formatSymbol(symbol),
    };
  });

  const eClosures: EClosureDescriptor[] = automaton.states.map((state) => {
    const closure = epsilonClosure(automaton, [state.id]);
    const closureNames = Array.from(closure).map((id) => nameMap.get(id) ?? id).sort();
    return {
      stateId: state.id,
      stateName: nameMap.get(state.id) ?? state.id,
      closureIds: Array.from(closure).sort(),
      closureNames,
    };
  });

  return {
    automatonType,
    alphabet: getInputAlphabet(automaton),
    states,
    initialStates: states.filter((state) => state.isInitial),
    acceptStates: states.filter((state) => state.isAccept),
    transitions,
    determinismIssues: getDeterminismIssues(automaton),
    eClosures,
    supportsEpsilon,
  };
}
