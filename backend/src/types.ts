/**
 * Contratos formales compartidos por las operaciones teóricas del backend.
 *
 * Idea central:
 * Todo el sistema modela autómatas usando la 5-tupla clásica:
 *
 * A = (Q, Σ, δ, q0, F)
 *
 * Estas interfaces representan:
 * - el autómata base dibujado por el usuario;
 * - la proyección formal consumida por la interfaz;
 * - los resultados de simulación, transformación y minimización;
 * - los contratos de gramáticas regulares derivadas o manuales.
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

/**
 * Una fila de la tabla de construcción de subconjuntos.
 *
 * Cada fila representa un estado del AFD resultante y conserva el rastro de
 * qué subconjunto de estados del AFND le dio origen.
 */
export interface TransformationTableRow {
  dfaStateId: string;
  dfaStateName: string;
  nfaStateIds: string[];
  nfaStateNames: string[];
  transitions: {
    symbol: string;
    moveNfaStateNames: string[];
    eClosureNfaStateNames: string[];
    targetDfaStateId: string;
    targetDfaStateName: string;
  }[];
  isInitial: boolean;
  isAccept: boolean;
}

/**
 * Resultado de la transformación AFND → AFD por subconjuntos.
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

/**
 * Formalismo original del DFA antes de su minimización.
 */
export interface DfaMinimizationOriginalFormalism {
  states: string[];
  alphabet: string[];
  initialState: string;
  acceptStates: string[];
}

/**
 * Grupo de partición usado durante el refinamiento de estados.
 */
export interface DfaPartitionGroup {
  id: string;
  stateIds: string[];
  stateNames: string[];
}

/**
 * Evidencia de por qué dos estados de un grupo terminan separándose.
 */
export interface DfaPartitionSplitCause {
  groupId: string;
  stateAId: string;
  stateAName: string;
  stateBId: string;
  stateBName: string;
  symbol: string;
  targetAStateId: string;
  targetAStateName: string;
  targetBStateId: string;
  targetBStateName: string;
  targetAGroupId: string;
  targetBGroupId: string;
}

/**
 * Iteración del refinamiento por particiones.
 */
export interface DfaPartitionIteration {
  iteration: number;
  beforeGroups: DfaPartitionGroup[];
  afterGroups: DfaPartitionGroup[];
  splitCauses: DfaPartitionSplitCause[];
  stabilized: boolean;
}

/**
 * Estado posible de una celda en la tabla de distinguibilidad.
 */
export type DfaDistinguishabilityCellStatus = "pending" | "distinguishable" | "equivalent";

/**
 * Celda individual de la tabla de distinguibilidad.
 */
export interface DfaDistinguishabilityCell {
  rowStateId: string;
  rowStateName: string;
  columnStateId: string;
  columnStateName: string;
  status: DfaDistinguishabilityCellStatus;
  reason?: string;
  markedInIteration?: number;
}

/**
 * Snapshot completo de la tabla de distinguibilidad en una iteración.
 */
export interface DfaDistinguishabilityIteration {
  iteration: number;
  cells: DfaDistinguishabilityCell[];
}

/**
 * Verificación por símbolo dentro de una clase de equivalencia.
 */
export interface DfaEquivalenceSymbolCheck {
  symbol: string;
  mappings: {
    stateId: string;
    stateName: string;
    targetStateId: string;
    targetStateName: string;
    targetClassName: string;
  }[];
}

/**
 * Clase de equivalencia final del DFA minimizado.
 */
export interface DfaEquivalenceClass {
  className: string;
  stateIds: string[];
  stateNames: string[];
  explanation: string;
  symbolChecks: DfaEquivalenceSymbolCheck[];
}

/**
 * Fila de la matriz de transición del DFA minimizado.
 */
export interface DfaMinimizedTransitionRow {
  className: string;
  memberStateIds: string[];
  memberStateNames: string[];
  isInitial: boolean;
  isAccept: boolean;
  transitions: {
    symbol: string;
    targetClassName: string;
    targetStateId: string;
    targetStateName: string;
  }[];
}

/**
 * Formalismo final del DFA minimizado.
 */
export interface DfaMinimizedFormalism {
  states: string[];
  alphabet: string[];
  initialState: string;
  acceptStates: string[];
}

/**
 * Resultado global del proceso de minimización de un DFA.
 */
export interface DfaMinimizationResult {
  originalFormalism: DfaMinimizationOriginalFormalism;
  partitionIterations: DfaPartitionIteration[];
  distinguishabilityIterations: DfaDistinguishabilityIteration[];
  equivalenceClasses: DfaEquivalenceClass[];
  minimizedFormalism: DfaMinimizedFormalism;
  minimizedTransitionTable: DfaMinimizedTransitionRow[];
  minimizedDfa: AutomataData;
}

/**
 * Fuente de origen de una gramática.
 */
export type GrammarSource = "manual" | "automaton";

/**
 * Linealidad detectada o declarada de la gramática regular.
 */
export type GrammarLinearity = "RIGHT" | "LEFT";

/**
 * Producción ingresada desde la interfaz antes de su normalización.
 */
export interface GrammarProductionInput {
  left: string;
  rule: string;
}

/**
 * Producción regular ya normalizada por el backend.
 */
export interface GrammarProduction {
  id: string;
  left: string;
  rightTokens: string[];
  source: GrammarSource;
  note?: string;
}

/**
 * Relación entre estados del autómata y no terminales derivados.
 */
export interface GrammarStateMapping {
  stateId: string;
  stateName: string;
  nonTerminal: string;
  isInitial: boolean;
  isAccept: boolean;
}

/**
 * Definición completa de una gramática regular.
 */
export interface GrammarDefinition {
  terminals: string[];
  nonTerminals: string[];
  startSymbol: string;
  productions: GrammarProduction[];
  source: GrammarSource;
  linearity: GrammarLinearity;
  stateMapping?: GrammarStateMapping[];
  derivedFromAutomatonType?: AutomatonType;
}

/**
 * Incidencia de validación gramatical.
 */
export interface GrammarValidationIssue {
  message: string;
}

/**
 * Resultado de validar una gramática regular.
 */
export interface GrammarValidationResult {
  grammar?: GrammarDefinition;
  issues: GrammarValidationIssue[];
}

/**
 * Paso de una derivación particular sobre la gramática.
 */
export interface GrammarDerivationStep {
  id: string;
  sententialForm: string[];
  sententialLabel: string;
  production?: GrammarProduction;
  appliedNonTerminal?: string;
  consumedSymbol?: string | null;
  nextNonTerminal?: string | null;
}

/**
 * Resultado del análisis de una palabra sobre una gramática.
 */
export interface GrammarWordAnalysis {
  word: string[];
  accepted: boolean;
  reason: string;
  particularDerivation: GrammarDerivationStep[];
  derivationTreeLines: string[];
  threadDiagramLines: string[];
}

/**
 * Regla textual que explica la transformación de autómata a gramática.
 */
export interface GrammarTransformationRule {
  title: string;
  description: string;
}

/**
 * Resultado del análisis de una gramática ingresada manualmente.
 */
export interface GrammarManualAnalysisResult {
  validation: GrammarValidationResult;
  analysis?: GrammarWordAnalysis;
}

/**
 * Resultado del análisis de la gramática equivalente derivada desde un autómata.
 */
export interface GrammarAutomatonAnalysisResult {
  validation: GrammarValidationResult;
  analysis?: GrammarWordAnalysis;
  transformationRules: GrammarTransformationRule[];
}
