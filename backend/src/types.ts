/**
 * Contrato formal compartido por las operaciones teóricas del backend.
 *
 * Todas las funciones del backend parten del mismo modelo:
 * A = (Q, SIGMA, DELTA, q0, F)
 *
 * Estas interfaces sirven para representar:
 * - el automata base dibujado por el usuario
 * - la proyección formal que consume la interfaz
 * - los pasos de simulación de la función de transición extendida
 * - las trazas concretas de aceptación y rechazo
 */
export interface AutomataState {
  id: string;
  label: string;
  x: number;
  y: number;
  isInitial: boolean;
  isAccept: boolean;
}

export interface AutomataTransition {
  id: string;
  from: string;
  to: string;
  /**
   * Símbolo consumido por la transición.
   *
   * Convención del proyecto:
   * - ""  equivale a \u03b5
   * - cualquier otro string representa un s\u00edmbolo ordinario de \u03a3
   */
  symbol: string;
}

export interface AutomataData {
  // conjunto finito de estados. 
  states: AutomataState[];
  // Relación operativa usada para construir funcion de transicion.
  transitions: AutomataTransition[];
  // alfabeto de entrada explícito o inferido desde las transiciones. */
  alphabet: string[];
}

export type AutomatonType = "DFA" | "NFA" | "NFA_EPSILON";

export interface StateDescriptor {
  id: string;
  name: string;
  isInitial: boolean;
  isAccept: boolean;
}

export interface TransitionDescriptor {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  symbol: string;
  displaySymbol: string;
}

export interface DeterminismIssueDescriptor {
  stateId: string;
  stateName: string;
  symbol: string;
  displaySymbol: string;
  targets: string[];
}

export interface EClosureDescriptor {
  stateId: string;
  stateName: string;
  closureIds: string[];
  closureNames: string[];
}

export interface AutomataAnalysisResult {
  // Clasificación estructural: DFA, NFA o NFA-ε. 
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
 * Paso observable de la función de transición extendida .
 * - reachable = resultado inmediato de aplicar move con el símbolo actual
 * - closure   = resultado final tras aplicar clausura-ε
 * En DFA, reachable y closure contienen un único estado.
 * En NFA, closure coincide con reachable.
 * En NFA-e, closure puede expandirse más allá de reachable.
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

// Paso elemental de una traza concreta sobre una palabra. 
export interface SimulationPathStep {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  symbol: string;
  displaySymbol: string;
  consumedIndex: number;
}

// Camino concreto seguido por la simulación para explicar aceptación o rechazo.
export interface SimulationPath {
  stateIds: string[];
  stateNames: string[];
  steps: SimulationPathStep[];
  accepted: boolean;
  consumedWord: string;
  haltedAtIndex: number;
}

// Resultado final de aplicar FTE a una palabra.
export interface AutomataSimulationResult {
  automatonType: AutomatonType;
  accepted: boolean;
  word: string;
  deltaStar: DeltaStarStep[];
  acceptedPaths: SimulationPath[];
  rejectedPaths: SimulationPath[];
}

/**
 * Una fila de la tabla de construcción de subconjuntos.
 * Cada fila corresponde a un estado del DFA resultante (subconjunto de estados del AFND).
 */
export interface TransformationTableRow {
  dfaStateId: string;
  dfaStateName: string;
  nfaStateIds: string[];
  nfaStateNames: string[];
  transitions: {
    symbol: string;
    targetDfaStateId: string;
    targetDfaStateName: string;
  }[];
  isInitial: boolean;
  isAccept: boolean;
}

/**
 * Resultado de convertir un AFND (NFA o NFA-ε) a un AFD
 * mediante la construcción de subconjuntos.
 */
export interface NfaToDfaTransformationResult {
  originalType: AutomatonType;
  dfa: AutomataData;
  transformationTable: TransformationTableRow[];
  stateMapping: {
    dfaStateId: string;
    dfaStateName: string;
    nfaStateIds: string[];
    nfaStateNames: string[];
  }[];
}

