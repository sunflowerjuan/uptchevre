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
  symbol: string;
}

export interface AutomataData {
  states: AutomataState[];
  transitions: AutomataTransition[];
  alphabet: string[];
}

