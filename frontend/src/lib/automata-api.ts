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

export async function analyzeAutomatonRequest(automaton: AutomataData) {
  return postJson<AutomataAnalysisResult>("/api/automata/analyze", { automaton });
}

export async function simulateAutomatonRequest(automaton: AutomataData, word: string) {
  return postJson<AutomataSimulationResult>("/api/automata/simulate", { automaton, word });
}

export async function transformNfaToDfaRequest(automaton: AutomataData) {
  return postJson<NfaToDfaTransformationResult>("/api/automata/transform", { automaton });
}
