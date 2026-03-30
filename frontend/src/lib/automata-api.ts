import type { AutomataData } from "@/hooks/useAutomataEditor";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

/**
 * Cliente técnico del frontend.
 *
 * No implementa teoría: solo transporta al frontend los resultados ya
 * calculados por el motor formal de la aplicación.
 */
async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    result?: TResponse;
    error?: string;
  };

  if (!response.ok || !payload.ok || !payload.result) {
    throw new Error(payload.error ?? "No fue posible completar la solicitud.");
  }

  return payload.result;
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

/** Paso serializado de una traza concreta. */
export interface SimulationPathStep {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  symbol: string;
  displaySymbol: string;
  consumedIndex: number;
}

export interface SimulationPath {
  stateIds: string[];
  stateNames: string[];
  steps: SimulationPathStep[];
  accepted: boolean;
  consumedWord: string;
  haltedAtIndex: number;
}

/** Respuesta serializada de la simulación de una palabra. */
export interface AutomataSimulationResult {
  automatonType: AutomatonType;
  accepted: boolean;
  word: string;
  deltaStar: DeltaStarStep[];
  acceptedPaths: SimulationPath[];
  rejectedPaths: SimulationPath[];
}

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

export type GrammarSource = "manual" | "automaton";
export type GrammarLinearity = "RIGHT" | "LEFT";

export interface GrammarProductionInput {
  left: string;
  rule: string;
}

export interface GrammarProduction {
  id: string;
  left: string;
  rightTokens: string[];
  source: GrammarSource;
  note?: string;
}

export interface GrammarStateMapping {
  stateId: string;
  stateName: string;
  nonTerminal: string;
  isInitial: boolean;
  isAccept: boolean;
}

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

export interface GrammarValidationIssue {
  message: string;
}

export interface GrammarValidationResult {
  grammar?: GrammarDefinition;
  issues: GrammarValidationIssue[];
}

export interface GrammarDerivationStep {
  id: string;
  sententialForm: string[];
  sententialLabel: string;
  production?: GrammarProduction;
  appliedNonTerminal?: string;
  consumedSymbol?: string | null;
  nextNonTerminal?: string | null;
}

export interface GrammarWordAnalysis {
  word: string[];
  accepted: boolean;
  reason: string;
  particularDerivation: GrammarDerivationStep[];
  derivationTreeLines: string[];
  threadDiagramLines: string[];
}

export interface GrammarTransformationRule {
  title: string;
  description: string;
}

export interface GrammarManualAnalysisResult {
  validation: GrammarValidationResult;
  analysis?: GrammarWordAnalysis;
}

export interface GrammarAutomatonAnalysisResult {
  validation: GrammarValidationResult;
  analysis?: GrammarWordAnalysis;
  transformationRules: GrammarTransformationRule[];
}

export async function analyzeAutomatonRequest(automaton: AutomataData) {
  return postJson<AutomataAnalysisResult>("/api/automata/analyze", { automaton });
}

export async function simulateAutomatonRequest(automaton: AutomataData, word: string) {
  return postJson<AutomataSimulationResult>("/api/automata/simulate", { automaton, word });
}

export async function transformNfaToDfaRequest(automaton: AutomataData) {
  return postJson<NfaToDfaTransformationResult>("/api/automata/transform", { automaton });
}

export async function analyzeManualGrammarRequest(payload: {
  terminals: string[];
  nonTerminals: string[];
  startSymbol: string;
  productions: GrammarProductionInput[];
  word: string;
  strictRules?: boolean;
}) {
  return postJson<GrammarManualAnalysisResult>("/api/grammar/manual", payload);
}

export async function analyzeEquivalentGrammarRequest(
  automaton: AutomataData,
  word: string,
  strictRules?: boolean,
) {
  return postJson<GrammarAutomatonAnalysisResult>("/api/grammar/equivalent", {
    automaton,
    word,
    strictRules,
  });
}
