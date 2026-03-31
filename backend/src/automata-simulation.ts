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
 * Este módulo implementa dos vistas complementarias de la ejecución:
 *
 * 1. Una vista formal basada en la función de transición extendida `δ*`,
 *    adecuada para explicar la evolución del conjunto de estados alcanzados.
 * 2. Una vista concreta basada en recorridos particulares del grafo, útil para
 *    mostrar ejemplos de caminos aceptantes y rechazantes al usuario.
 */

/**
 * Construye el conjunto de estados de aceptación del autómata.
 *
 * Propósito:
 * Facilitar consultas repetidas del tipo "¿este estado pertenece a F?" con
 * costo O(1) durante la simulación.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata fuente.
 *
 * Retorno:
 * - `Set<string>`: ids de estados de aceptación.
 *
 * Efectos secundarios:
 * - No tiene.
 */
function getAcceptedSet(automaton: AutomataData): Set<string> {
  return new Set(automaton.states.filter((state) => state.isAccept).map((state) => state.id));
}

/**
 * Construye la traza completa de la función de transición extendida `δ*`.
 *
 * Propósito:
 * Registrar, paso a paso, cómo evoluciona el conjunto de estados alcanzados al
 * consumir una palabra completa.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata sobre el cual se evalúa la palabra.
 * - `word: string`: palabra de entrada.
 *
 * Retorno:
 * - `DeltaStarStep[]`: secuencia ordenada de pasos de la simulación formal.
 *
 * Cómo funciona internamente:
 * - El paso 0 representa la situación antes de consumir símbolos.
 * - En cada iteración se calcula primero `move`.
 * - Luego se aplica `epsilonClosure` sobre el resultado de `move`.
 * - Se guarda tanto el conjunto "reachable" inmediato como el conjunto final
 *   tras expandir por ε.
 *
 * Efectos secundarios:
 * - No tiene.
 */
function buildDeltaStar(automaton: AutomataData, word: string): DeltaStarStep[] {
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

    // Primero se consumen transiciones visibles con el símbolo actual.
    const reachable = move(automaton, currentClosure, symbol);

    // Después se expande el resultado por ε para obtener la configuración
    // efectiva del siguiente paso.
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

/**
 * Enumera caminos concretos de aceptación y rechazo.
 *
 * Propósito:
 * Complementar la vista conjuntista de `δ*` con ejemplos explícitos de rutas
 * particulares sobre el autómata.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata fuente.
 * - `word: string`: palabra a consumir.
 * - `maxPaths = 12`: número máximo de rutas aceptantes y rechazantes que se
 *   desean conservar.
 *
 * Retorno:
 * - Objeto con `acceptedPaths` y `rejectedPaths`.
 *
 * Decisiones técnicas:
 * - Se usa DFS para explorar ramas concretas.
 * - La aceptación real del autómata sigue decidiéndose por conjuntos; estas
 *   rutas son material explicativo.
 * - Se limita la cantidad de resultados para evitar crecimiento explosivo.
 *
 * Efectos secundarios:
 * - No tiene.
 */
function enumeratePaths(
  automaton: AutomataData,
  word: string,
  maxPaths = 12,
): { acceptedPaths: SimulationPath[]; rejectedPaths: SimulationPath[] } {
  const { outgoing, nameMap } = buildTransitionMap(automaton);
  const acceptSet = getAcceptedSet(automaton);
  const acceptedPaths: SimulationPath[] = [];
  const rejectedPaths: SimulationPath[] = [];
  const initialStates = getInitialStates(automaton);

  /**
   * Registra una ruta ya cerrada en la colección correspondiente.
   *
   * Se guarda la porción consumida de la palabra y la secuencia completa de
   * estados/steps para que la interfaz pueda explicar por qué la ruta aceptó o
   * rechazó.
   */
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

  /**
   * DFS sobre configuraciones `(estado, índiceDeLectura)`.
   *
   * La clave `visitKey` permite detectar ciclos epsilon sobre el mismo punto de
   * lectura. Si no se cortara ese caso, un AFN-ε con ciclos podría generar una
   * recursión infinita sin consumir símbolos.
   */
  const dfs = (
    stateId: string,
    inputIndex: number,
    statePath: string[],
    stepPath: SimulationPathStep[],
    visiting: Set<string>,
  ) => {
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

    // Primero se exploran las transiciones ε porque no consumen entrada y
    // pueden habilitar nuevas configuraciones antes de leer el siguiente símbolo.
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

    // Si aún quedan símbolos por consumir, se intentan transiciones visibles.
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
            // Al consumir un símbolo, la configuración cambia de índice de
            // lectura, así que el control de ciclos puede reiniciarse.
            new Set(),
          );
        }
        return;
      }
    }

    // Si no hay más movimientos posibles, la ruta se cierra aquí. Solo acepta
    // si ya consumió toda la palabra y el estado actual pertenece a F.
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

/**
 * Simula una palabra completa sobre el autómata.
 *
 * Propósito:
 * Unificar en un único resultado la clasificación del autómata, la traza
 * formal `δ*`, el veredicto de aceptación y ejemplos de recorridos concretos.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata fuente.
 * - `word: string`: palabra a evaluar.
 *
 * Retorno:
 * - `AutomataSimulationResult`: resultado completo de la simulación.
 *
 * Flujo:
 * - Analiza estructuralmente el autómata.
 * - Construye los pasos de `δ*`.
 * - Evalúa aceptación sobre la clausura final.
 * - Enumera caminos concretos de apoyo.
 *
 * Efectos secundarios:
 * - No tiene.
 */
export function simulateAutomaton(automaton: AutomataData, word: string): AutomataSimulationResult {
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
