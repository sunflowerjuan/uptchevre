import type { AutomataData, AutomataState, AutomataTransition } from "./types.js";
import { getInputAlphabet, normalizeSymbol } from "./automata-analysis.js";

/**
 * Utilidades específicas del caso determinista.
 *
 * Este módulo concentra helpers usados cuando el algoritmo supone o necesita
 * tratar el autómata como DFA. Su función principal es preparar estructuras
 * compactas y validar la univocidad de la función de transición.
 */
export interface DeterminismIssue {
  stateId: string;
  symbol: string;
  transitions: AutomataTransition[];
}

export interface DeterminismCheckResult {
  isDeterministic: boolean;
  issues: DeterminismIssue[];
}

/**
 * Obtiene el alfabeto operativo del autómata.
 *
 * Propósito:
 * Reexponer el cálculo de Σ desde un módulo semánticamente asociado al caso
 * determinista.
 *
 * Parámetros:
 * - `a: AutomataData`: autómata fuente.
 *
 * Retorno:
 * - `string[]`: alfabeto sin transiciones epsilon.
 *
 * Efectos secundarios:
 * - No tiene.
 */
export function getAlphabet(a: AutomataData): string[] {
  return getInputAlphabet(a);
}

/**
 * Obtiene el primer estado inicial del autómata.
 *
 * Propósito:
 * Simplificar algoritmos que necesitan arrancar desde un único estado
 * inicial, como ocurre en la mayoría de procesos específicos de DFA.
 *
 * Parámetros:
 * - `a: AutomataData`: autómata fuente.
 *
 * Retorno:
 * - `AutomataState | undefined`: estado inicial si existe.
 *
 * Limitación:
 * - Si el modelo tiene más de un estado inicial, esta función solo devuelve
 *   el primero; por eso debe combinarse con una validación de determinismo si
 *   la unicidad del inicial es una precondición del algoritmo.
 */
export function getInitialState(a: AutomataData): AutomataState | undefined {
  return a.states.find((s) => s.isInitial);
}

/**
 * Verifica si la función de transición del autómata es unívoca.
 *
 * Propósito:
 * Detectar si existe más de un destino para la misma pareja
 * `(estado, símbolo)`, lo que invalidaría la interpretación del modelo como
 * un DFA.
 *
 * Parámetros:
 * - `a: AutomataData`: autómata a validar.
 *
 * Retorno:
 * - `DeterminismCheckResult`: indicador booleano y lista de incidencias.
 *
 * Cómo funciona internamente:
 * - Agrupa las transiciones por clave `from::symbol`.
 * - Si una clave tiene más de una transición, se registra como conflicto.
 *
 * Efectos secundarios:
 * - No tiene.
 */
export function checkDeterminism(a: AutomataData): DeterminismCheckResult {
  // Si dos transiciones comparten la misma pareja `(estado, símbolo)`, la
  // transición deja de ser función y pasa a ser relación no determinista.
  const issues: DeterminismIssue[] = [];
  const byStateAndSymbol = new Map<string, AutomataTransition[]>();

  for (const t of a.transitions) {
    const normalizedSymbol = normalizeSymbol(t.symbol);
    const key = `${t.from}::${normalizedSymbol}`;
    const list = byStateAndSymbol.get(key) ?? [];

    // Se almacena la versión normalizada para que el reporte y los cálculos
    // posteriores trabajen sobre una forma canónica del símbolo.
    list.push({ ...t, symbol: normalizedSymbol });
    byStateAndSymbol.set(key, list);
  }

  for (const [key, transitions] of byStateAndSymbol.entries()) {
    if (transitions.length > 1) {
      const [stateId, symbol] = key.split("::");
      issues.push({ stateId, symbol, transitions });
    }
  }

  return {
    isDeterministic: issues.length === 0,
    issues,
  };
}

export interface DfaStructure {
  alphabet: string[];
  delta: Map<string, string>;
  initialId?: string;
  acceptIds: Set<string>;
}

/**
 * Serializa el DFA en una estructura compacta para algoritmos posteriores.
 *
 * Propósito:
 * Reducir el costo de consultas repetidas sobre la función de transición,
 * especialmente en algoritmos como equivalencia por producto de estados.
 *
 * Parámetros:
 * - `a: AutomataData`: autómata fuente.
 *
 * Retorno:
 * - `DfaStructure`: estructura con Σ, δ indexada, estado inicial y conjunto F.
 *
 * Cómo funciona internamente:
 * - El alfabeto se obtiene con `getAlphabet`.
 * - La función δ se materializa como un mapa directo
 *   `delta["estado::símbolo"] = estadoDestino`.
 * - Los estados de aceptación se guardan en un `Set` para consultas O(1).
 *
 * Efectos secundarios:
 * - No tiene.
 */
export function buildDfaStructure(a: AutomataData): DfaStructure {
  // Esta serialización evita tener que recorrer la lista completa de
  // transiciones cada vez que se consulta un destino.
  const alphabet = getAlphabet(a);
  const delta = new Map<string, string>();

  for (const t of a.transitions) {
    delta.set(`${t.from}::${normalizeSymbol(t.symbol)}`, t.to);
  }

  const initial = getInitialState(a);
  const acceptIds = new Set<string>(a.states.filter((s) => s.isAccept).map((s) => s.id));

  return {
    alphabet,
    delta,
    initialId: initial?.id,
    acceptIds,
  };
}
