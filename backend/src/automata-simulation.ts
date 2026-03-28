import {
  analyzeAutomaton,
  buildTransitionMap,
  epsilonClosure,
  formatSymbol,
  getInitialStates,
  move,
  normalizeSymbol,
} from "./automata-analysis.js";
import type {
  AutomataData,
  AutomataSimulationResult,
  DeltaStarStep,
  SimulationPath,
  SimulationPathStep,
} from "./types.js";

/**
 * Simulación formal de palabras.
 *
 * Este módulo aplica la definición de δ*:
 * - DFA:    δ*(q, ε) = q
 * - NFA:    δ*(q, ε) = {q}
 * - NFA-ε:  δ*(q, ε) = E(q)
 *
 * Después avanza símbolo a símbolo combinando move y clausura-ε.
 */
function getAcceptedSet(automaton: AutomataData): Set<string> {
  return new Set(automaton.states.filter((state) => state.isAccept).map((state) => state.id));
}

function buildDeltaStar(automaton: AutomataData, word: string): DeltaStarStep[] {
  /**
   * Construye explícitamente la evolución de δ* sobre toda la palabra.
   *
   * El paso 0 es el caso base.
   * Cada paso posterior registra:
   * - reachable: resultado de consumir el símbolo actual
   * - closure:   expansión posterior por ε cuando aplica
   */
  const { nameMap } = buildTransitionMap(automaton);
  const initialIds = getInitialStates(automaton).map((state) => state.id);
  let currentClosure = epsilonClosure(automaton, initialIds);

  const steps: DeltaStarStep[] = [
    {
      index: 0,
      consumedSymbol: null,
      displayConsumedSymbol: null,
      prefix: "",
      reachableStateIds: initialIds.slice().sort(),
      reachableStateNames: initialIds.map((id) => nameMap.get(id) ?? id).sort(),
      closureStateIds: Array.from(currentClosure).sort(),
      closureStateNames: Array.from(currentClosure).map((id) => nameMap.get(id) ?? id).sort(),
    },
  ];

  let prefix = "";
  for (const symbol of word.split("")) {
    prefix += symbol;
    const reachable = move(automaton, currentClosure, symbol);
    currentClosure = epsilonClosure(automaton, reachable);
    const reachableIds = Array.from(reachable).sort();
    const closureIds = Array.from(currentClosure).sort();

    steps.push({
      index: steps.length,
      consumedSymbol: symbol,
      displayConsumedSymbol: formatSymbol(symbol),
      prefix,
      reachableStateIds: reachableIds,
      reachableStateNames: reachableIds.map((id) => nameMap.get(id) ?? id),
      closureStateIds: closureIds,
      closureStateNames: closureIds.map((id) => nameMap.get(id) ?? id),
    });
  }

  return steps;
}

function enumeratePaths(
  automaton: AutomataData,
  word: string,
  maxPaths = 12,
): { acceptedPaths: SimulationPath[]; rejectedPaths: SimulationPath[] } {
  /**
   * Recorre caminos concretos para fines explicativos.
   *
   * δ* decide aceptación a nivel de conjunto.
   * Estas trazas muestran ejemplos de ramas particulares útiles para docencia.
   */
  const { outgoing, nameMap } = buildTransitionMap(automaton);
  const acceptSet = getAcceptedSet(automaton);
  const acceptedPaths: SimulationPath[] = [];
  const rejectedPaths: SimulationPath[] = [];
  const initialStates = getInitialStates(automaton);

  const recordPath = (
    accepted: boolean,
    stateIds: string[],
    steps: SimulationPathStep[],
    haltedAtIndex: number,
  ) => {
    const path: SimulationPath = {
      stateIds,
      stateNames: stateIds.map((id) => nameMap.get(id) ?? id),
      steps,
      accepted,
      consumedWord: word.slice(0, haltedAtIndex),
      haltedAtIndex,
    };

    if (accepted) {
      if (acceptedPaths.length < maxPaths) acceptedPaths.push(path);
    } else if (rejectedPaths.length < maxPaths) {
      rejectedPaths.push(path);
    }
  };

  const dfs = (
    stateId: string,
    inputIndex: number,
    statePath: string[],
    stepPath: SimulationPathStep[],
    visiting: Set<string>,
  ) => {
    // Evita ciclos infinitos por ε sobre el mismo índice de lectura.
    if (acceptedPaths.length >= maxPaths && rejectedPaths.length >= maxPaths) {
      return;
    }

    const visitKey = `${stateId}::${inputIndex}`;
    if (visiting.has(visitKey)) {
      recordPath(false, statePath, stepPath, inputIndex);
      return;
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(visitKey);

    const epsilonTransitions = outgoing.get(`${stateId}::`) ?? [];
    for (const transition of epsilonTransitions) {
      dfs(
        transition.to,
        inputIndex,
        [...statePath, transition.to],
        [
          ...stepPath,
          {
            fromId: stateId,
            fromName: nameMap.get(stateId) ?? stateId,
            toId: transition.to,
            toName: nameMap.get(transition.to) ?? transition.to,
            symbol: "",
            displaySymbol: "\u03b5",
            consumedIndex: inputIndex,
          },
        ],
        nextVisiting,
      );
    }

    if (inputIndex < word.length) {
      const symbol = normalizeSymbol(word[inputIndex] ?? "");
      const transitions = outgoing.get(`${stateId}::${symbol}`) ?? [];
      if (transitions.length > 0) {
        for (const transition of transitions) {
          dfs(
            transition.to,
            inputIndex + 1,
            [...statePath, transition.to],
            [
              ...stepPath,
              {
                fromId: stateId,
                fromName: nameMap.get(stateId) ?? stateId,
                toId: transition.to,
                toName: nameMap.get(transition.to) ?? transition.to,
                symbol,
                displaySymbol: formatSymbol(symbol),
                consumedIndex: inputIndex + 1,
              },
            ],
            new Set(),
          );
        }
        return;
      }
    }

    const accepted = inputIndex === word.length && acceptSet.has(stateId);
    recordPath(accepted, statePath, stepPath, inputIndex);
  };

  for (const initial of initialStates) {
    dfs(initial.id, 0, [initial.id], [], new Set());
  }

  return {
    acceptedPaths,
    rejectedPaths,
  };
}

export function simulateAutomaton(automaton: AutomataData, word: string): AutomataSimulationResult {
  /**
   * Evalúa la palabra completa y devuelve:
   * - los pasos de δ*
   * - el veredicto de aceptación
   * - trazas concretas de apoyo
   */
  const analysis = analyzeAutomaton(automaton);
  const deltaStar = buildDeltaStar(automaton, word);
  const lastStep = deltaStar[deltaStar.length - 1];
  const acceptSet = getAcceptedSet(automaton);
  const accepted = lastStep.closureStateIds.some((stateId) => acceptSet.has(stateId));
  const { acceptedPaths, rejectedPaths } = enumeratePaths(automaton, word);

  return {
    automatonType: analysis.automatonType,
    accepted,
    word,
    deltaStar,
    acceptedPaths,
    rejectedPaths,
  };
}
