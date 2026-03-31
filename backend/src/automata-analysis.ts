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

/**
 * Normaliza un símbolo proveniente de la interfaz o de una carga externa.
 *
 * Propósito:
 * Garantizar que toda la teoría opere sobre una representación canónica del
 * símbolo, evitando que espacios antes o después alteren comparaciones,
 * claves de mapas o validaciones de determinismo.
 *
 * Parámetros:
 * - `symbol: string`: símbolo crudo ingresado por el usuario o recibido desde
 *   otra capa de la aplicación.
 *
 * Retorno:
 * - `string`: símbolo sin espacios laterales.
 *
 * Efectos secundarios:
 * - No tiene.
 */
export function normalizeSymbol(symbol: string): string {
  return symbol.trim();
}

/**
 * Determina si un símbolo representa una transición epsilon.
 *
 * Propósito:
 * Centralizar la regla formal del proyecto según la cual la cadena vacía `""`
 * representa una transición por ε.
 *
 * Parámetros:
 * - `symbol: string`: símbolo a evaluar.
 *
 * Retorno:
 * - `boolean`: `true` si el símbolo equivale a ε; `false` en otro caso.
 *
 * Efectos secundarios:
 * - No tiene.
 */
export function isEpsilonSymbol(symbol: string): boolean {
  return normalizeSymbol(symbol) === EPSILON_SYMBOL;
}

/**
 * Obtiene el alfabeto efectivo de entrada del autómata.
 *
 * Propósito:
 * Construir Σ a partir de la definición explícita del autómata cuando existe,
 * o inferirlo desde las transiciones cuando el editor aún no lo ha fijado.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata del cual se desea extraer Σ.
 *
 * Retorno:
 * - `string[]`: lista ordenada y sin repetidos de símbolos de entrada.
 *
 * Decisiones técnicas:
 * - ε nunca forma parte de Σ; se maneja como una relación especial.
 * - Si `automaton.alphabet` ya viene poblado, se prioriza esa fuente por ser
 *   la declaración explícita del modelo.
 *
 * Efectos secundarios:
 * - No tiene.
 */
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

/**
 * Convierte un símbolo interno a su representación visible.
 *
 * Propósito:
 * Separar la representación operativa usada por el motor lógico de la
 * representación didáctica que consume la interfaz.
 *
 * Parámetros:
 * - `symbol: string`: símbolo interno.
 *
 * Retorno:
 * - `string`: símbolo visible, usando `ε` para la cadena vacía.
 *
 * Efectos secundarios:
 * - No tiene.
 */
export function formatSymbol(symbol: string): string {
  return isEpsilonSymbol(symbol) ? EPSILON_DISPLAY : symbol;
}

/**
 * Obtiene todos los estados iniciales definidos en el autómata.
 *
 * Propósito:
 * Preservar la semántica real del modelo cargado, incluso si la interfaz
 * dibuja más de un estado inicial. Esto es importante para clasificar si el
 * autómata deja de ser DFA y pasa a ser NFA.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata a inspeccionar.
 *
 * Retorno:
 * - `AutomataState[]`: estados marcados como iniciales.
 *
 * Efectos secundarios:
 * - No tiene.
 */
export function getInitialStates(automaton: AutomataData): AutomataState[] {
  return automaton.states.filter((state) => state.isInitial);
}

/**
 * Construye un mapa de nombres formales de estado.
 *
 * Propósito:
 * Resolver qué nombre debe mostrarse en resultados formales, manteniendo una
 * salida estable y comprensible para el usuario.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata del cual se derivan los nombres.
 *
 * Retorno:
 * - `Map<string, string>`: mapa `id -> nombre formal visible`.
 *
 * Decisiones técnicas:
 * - Si una etiqueta es única, se usa esa etiqueta por ser más legible.
 * - Si una etiqueta está repetida, se usa el `id` para evitar ambigüedad.
 * - Si una etiqueta viene vacía, también se usa el `id`.
 *
 * Efectos secundarios:
 * - No tiene.
 */
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

/**
 * Construye una vista indexada del autómata para consultas frecuentes.
 *
 * Propósito:
 * Evitar recorridos repetidos sobre la lista completa de transiciones cada vez
 * que una operación teórica necesita consultar salidas por `(estado, símbolo)`.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata fuente.
 *
 * Retorno:
 * - `TransitionMap`: estructura indexada con estados, nombres y transiciones
 *   salientes por clave compuesta.
 *
 * Cómo funciona internamente:
 * - Indexa estados por `id`.
 * - Resuelve nombres visibles con `getStateNameMap`.
 * - Agrupa transiciones por clave `from::symbol`.
 *
 * Efectos secundarios:
 * - No tiene.
 */
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

/**
 * Calcula la clausura-ε de un conjunto de estados.
 *
 * Propósito:
 * Obtener todos los estados alcanzables consumiendo cero o más transiciones ε
 * desde un conjunto de partida.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata sobre el que se evalúa la clausura.
 * - `startIds: Iterable<string>`: conjunto inicial de estados.
 *
 * Retorno:
 * - `Set<string>`: conjunto clausurado.
 *
 * Cómo funciona internamente:
 * - Usa un recorrido BFS/cola sobre transiciones ε.
 * - Todo estado inicial pertenece siempre a su propia clausura.
 * - Evita ciclos infinitos gracias al conjunto `closure`.
 *
 * Efectos secundarios:
 * - No tiene.
 */
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

    // Solo se agregan estados no visitados; esta verificación evita reexplorar
    // ciclos epsilon y garantiza terminación en autómatas finitos.
    for (const transition of epsilonTransitions) {
      if (!closure.has(transition.to)) {
        closure.add(transition.to);
        queue.push(transition.to);
      }
    }
  }

  return closure;
}

/**
 * Aplica la operación formal `move(S, a)`.
 *
 * Propósito:
 * Obtener el conjunto de estados alcanzables consumiendo exactamente un
 * símbolo `a` desde cualquier estado del conjunto `S`.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata sobre el que se evalúa `move`.
 * - `stateIds: Iterable<string>`: conjunto fuente `S`.
 * - `symbol: string`: símbolo consumido.
 *
 * Retorno:
 * - `Set<string>`: conjunto de estados destino.
 *
 * Efectos secundarios:
 * - No tiene.
 */
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

    // En NFA y NFA-ε pueden existir varios destinos para el mismo par
    // `(estado, símbolo)`, por lo que el resultado siempre es un conjunto.
    for (const transition of transitions) {
      next.add(transition.to);
    }
  }

  return next;
}

/**
 * Detecta conflictos que impiden tratar el modelo como DFA.
 *
 * Propósito:
 * Informar a la interfaz qué pares `(estado, símbolo)` rompen el carácter
 * determinista del autómata o si existen múltiples estados iniciales.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata a validar.
 *
 * Retorno:
 * - `DeterminismIssueDescriptor[]`: lista de incidencias detectadas.
 *
 * Reglas aplicadas:
 * - Más de un estado inicial implica no determinismo.
 * - Más de una transición para la misma clave `(estado, símbolo)` implica no
 *   determinismo.
 *
 * Efectos secundarios:
 * - No tiene.
 */
export function getDeterminismIssues(automaton: AutomataData): DeterminismIssueDescriptor[] {
  // El modelo deja de ser DFA si:
  // - hay mas de un estado inicial
  // - una pareja (estado, simbolo) tiene mas de un destino
  const { nameMap, outgoing } = buildTransitionMap(automaton);
  const issues: DeterminismIssueDescriptor[] = [];

  const initialStates = getInitialStates(automaton);
  if (initialStates.length > 1) {
    // Se registra como incidencia sintética con `stateId="__initial__"` para
    // que la interfaz pueda mostrar el problema aunque no corresponda a una
    // transición puntual del grafo.
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

    // Si existen dos o más destinos para el mismo símbolo desde el mismo
    // estado, la función de transición deja de ser unívoca.
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

/**
 * Clasifica estructuralmente el autómata.
 *
 * Propósito:
 * Determinar si el modelo debe interpretarse como `DFA`, `NFA` o
 * `NFA_EPSILON` a partir de sus transiciones reales.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata a clasificar.
 *
 * Retorno:
 * - `AutomatonType`: tipo estructural detectado.
 *
 * Orden de decisión:
 * - Si existe ε, el autómata se clasifica como `NFA_EPSILON`.
 * - Si no existe ε pero hay conflictos de determinismo, se clasifica como `NFA`.
 * - En otro caso se clasifica como `DFA`.
 *
 * Efectos secundarios:
 * - No tiene.
 */
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

/**
 * Genera la vista formal completa del autómata para la interfaz.
 *
 * Propósito:
 * Traducir el grafo del editor a un resultado descriptivo apto para paneles
 * como formalismo, simulación, transformación y gramáticas.
 *
 * Parámetros:
 * - `automaton: AutomataData`: autómata fuente.
 *
 * Retorno:
 * - `AutomataAnalysisResult`: estructura serializable con clasificación,
 *   alfabeto, estados, transiciones, problemas de determinismo y clausuras-ε.
 *
 * Cómo fluye la ejecución:
 * - Resuelve nombres visibles.
 * - Clasifica el autómata.
 * - Serializa estados y transiciones.
 * - Calcula clausura-ε para cada estado.
 * - Reúne toda la información en un único contrato.
 *
 * Efectos secundarios:
 * - No tiene.
 */
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

    // Se devuelve tanto la versión por ids como por nombres para cubrir dos
    // necesidades distintas: trazabilidad interna y presentación al usuario.
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
