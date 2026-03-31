/**
 * Contratos formales compartidos por las operaciones teóricas del backend.
 *
 * Idea central:
 * Todo el sistema modela autómatas usando la 5-tupla clásica:
 *
 * A = (Q, Σ, δ, q0, F)
 *
 * Estas interfaces no solo representan el autómata base dibujado por el
 * usuario, sino también las distintas proyecciones que el motor lógico genera
 * para explicar análisis, simulaciones y equivalencia.
 */

/**
 * Estado del autómata tal como se almacena en el editor y se consume en el
 * backend.
 *
 * Notas:
 * - `x` y `y` son metadatos visuales del canvas.
 * - `isInitial` e `isAccept` proyectan la pertenencia a `{q0}` y `F`.
 */
export interface AutomataState {
  id: string;
  label: string;
  x: number;
  y: number;
  isInitial: boolean;
  isAccept: boolean;
}

/**
 * Transición elemental del autómata.
 *
 * Convención del proyecto:
 * - `symbol = ""` representa una transición por ε.
 * - cualquier otro string representa un símbolo visible del alfabeto Σ.
 */
export interface AutomataTransition {
  id: string;
  from: string;
  to: string;
  symbol: string;
}

/**
 * Modelo global del autómata que viaja entre frontend y backend.
 *
 * Componentes:
 * - `states`: conjunto finito Q.
 * - `transitions`: relación operativa a partir de la cual se reconstruye δ.
 * - `alphabet`: declaración explícita opcional de Σ; si no está completa, el
 *   backend puede inferirla desde las transiciones.
 */
export interface AutomataData {
  states: AutomataState[];
  transitions: AutomataTransition[];
  alphabet: string[];
}

/**
 * Clasificación estructural del autómata detectada por el backend.
 */
export type AutomatonType = "DFA" | "NFA" | "NFA_EPSILON";

/**
 * Descriptor de estado listo para consumo en la interfaz.
 *
 * A diferencia de `AutomataState`, esta estructura elimina coordenadas y deja
 * solo la información formal relevante para los paneles teóricos.
 */
export interface StateDescriptor {
  id: string;
  name: string;
  isInitial: boolean;
  isAccept: boolean;
}

/**
 * Descriptor serializado de transición para vistas formales.
 */
export interface TransitionDescriptor {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  symbol: string;
  displaySymbol: string;
}

/**
 * Incidencia que explica por qué un autómata no puede tratarse como DFA.
 */
export interface DeterminismIssueDescriptor {
  stateId: string;
  stateName: string;
  symbol: string;
  displaySymbol: string;
  targets: string[];
}

/**
 * Resultado serializado de una clausura-ε por estado.
 */
export interface EClosureDescriptor {
  stateId: string;
  stateName: string;
  closureIds: string[];
  closureNames: string[];
}

/**
 * Resultado consolidado del análisis estructural del autómata.
 *
 * Este contrato actúa como base para varios módulos de interfaz:
 * - formalismo,
 * - simulación,
 * - transformación,
 * - minimización,
 * - gramáticas equivalentes.
 */
export interface AutomataAnalysisResult {
  automatonType: AutomatonType;
  alphabet: string[];
  states: StateDescriptor[];
  initialStates: StateDescriptor[];
  acceptStates: StateDescriptor[];
  transitions: TransitionDescriptor[];
  determinismIssues: DeterminismIssueDescriptor[];
  eClosures: EClosureDescriptor[];
  supportsEpsilon: boolean;
}

/**
 * Paso observable de la función de transición extendida `δ*`.
 *
 * Significado de campos:
 * - `reachable`: resultado inmediato de consumir el símbolo actual.
 * - `closure`: resultado final tras expandir por ε cuando el modelo lo permite.
 *
 * Interpretación por tipo de autómata:
 * - En DFA, `reachable` y `closure` suelen contener un único estado.
 * - En NFA, `closure` coincide con `reachable`.
 * - En NFA-ε, `closure` puede expandirse más allá de `reachable`.
 */
export interface DeltaStarStep {
  index: number;
  consumedSymbol: string | null;
  displayConsumedSymbol: string | null;
  prefix: string;
  reachableStateIds: string[];
  reachableStateNames: string[];
  closureStateIds: string[];
  closureStateNames: string[];
}

/**
 * Paso individual de un camino concreto sobre una palabra.
 */
export interface SimulationPathStep {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  symbol: string;
  displaySymbol: string;
  consumedIndex: number;
}

/**
 * Recorrido concreto usado para explicar aceptación o rechazo.
 *
 * A diferencia de `DeltaStarStep`, aquí se conserva una sola rama explícita de
 * ejecución para fines pedagógicos.
 */
export interface SimulationPath {
  stateIds: string[];
  stateNames: string[];
  steps: SimulationPathStep[];
  accepted: boolean;
  consumedWord: string;
  haltedAtIndex: number;
}

/**
 * Resultado completo de la simulación de una palabra.
 */
export interface AutomataSimulationResult {
  automatonType: AutomatonType;
  accepted: boolean;
  word: string;
  deltaStar: DeltaStarStep[];
  acceptedPaths: SimulationPath[];
  rejectedPaths: SimulationPath[];
}
