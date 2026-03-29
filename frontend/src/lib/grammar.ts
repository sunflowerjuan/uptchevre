import type { AutomataData } from "@/hooks/useAutomataEditor";
import { EPSILON_DISPLAY, EPSILON_SYMBOL, normalizeSymbol } from "@/lib/automata";

export interface GrammarProduction {
  id: string;
  left: string;
  rightTokens: string[];
  source: "manual" | "automaton";
  note?: string;
}

export interface GrammarDefinition {
  terminals: string[];
  nonTerminals: string[];
  startSymbol: string;
  productions: GrammarProduction[];
  source: "manual" | "automaton";
  stateMapping?: {
    stateId: string;
    stateName: string;
    nonTerminal: string;
    isInitial: boolean;
    isAccept: boolean;
  }[];
}

export interface GrammarValidationIssue {
  message: string;
}

export interface GrammarValidationResult {
  grammar?: GrammarDefinition;
  issues: GrammarValidationIssue[];
}

export interface GrammarBranchOverview {
  nonTerminal: string;
  productions: {
    id: string;
    label: string;
    note?: string;
  }[];
}

export interface DerivationSnapshot {
  id: string;
  depth: number;
  sententialForm: string[];
  sententialLabel: string;
  terminalPrefix: string[];
  viaProduction?: GrammarProduction;
  isAccepted: boolean;
  isTerminal: boolean;
}

export interface DerivationTraceLevel {
  depth: number;
  snapshots: DerivationSnapshot[];
}

export interface GrammarWordAnalysis {
  word: string[];
  accepted: boolean;
  reason: string;
  exploredLevels: DerivationTraceLevel[];
  particularDerivation: DerivationSnapshot[];
  generalOverview: GrammarBranchOverview[];
}

/**
 * Divide una lista textual de simbolos.
 *
 * La interfaz usa listas cortas tipo:
 * - "a, b, c"
 * - "S, A, B"
 */
export function parseSymbolList(input: string) {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function isEpsilonToken(token: string) {
  return token === EPSILON_DISPLAY || token === EPSILON_SYMBOL || token.toLowerCase() === "epsilon";
}

function formatTokenList(tokens: string[]) {
  if (tokens.length === 0) return EPSILON_DISPLAY;
  return tokens.join(" ");
}

function makeProductionId(left: string, rightTokens: string[], index: number) {
  return `${left}-${rightTokens.join("_") || "epsilon"}-${index}`;
}

/**
 * Convierte el bloque de producciones en reglas independientes.
 *
 * Formato esperado por linea:
 * - S -> a A | b
 * - A -> a A | b B | ε
 *
 * Para simbolos compuestos, la interfaz pide separarlos por espacios.
 */
export function parseProductionsBlock(input: string, source: GrammarProduction["source"]): GrammarProduction[] {
  const productions: GrammarProduction[] = [];

  input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, lineIndex) => {
      const [leftRaw, rightRaw] = line.split("->").map((part) => part?.trim() ?? "");
      if (!leftRaw || !rightRaw) return;

      rightRaw.split("|").forEach((alternative, altIndex) => {
        const cleanedAlternative = alternative.trim();
        const rawTokens =
          cleanedAlternative.length === 0
            ? []
            : cleanedAlternative.split(/\s+/).filter(Boolean);
        const rightTokens =
          rawTokens.length === 1 && isEpsilonToken(rawTokens[0]!)
            ? []
            : rawTokens.map((token) => (isEpsilonToken(token) ? EPSILON_DISPLAY : token));

        productions.push({
          id: makeProductionId(leftRaw, rightTokens, lineIndex * 100 + altIndex),
          left: leftRaw,
          rightTokens,
          source,
        });
      });
    });

  return productions;
}

function hasOnlyKnownSymbols(tokens: string[], terminals: Set<string>, nonTerminals: Set<string>) {
  return tokens.every((token) => terminals.has(token) || nonTerminals.has(token));
}

/**
 * El motor actual trabaja con gramaticas regulares por la derecha.
 *
 * Esto encaja con el proyecto porque:
 * - una gramatica equivalente derivada de un automata finito cae en esta familia
 * - permite mostrar trazas compactas parecidas a delta*
 * - mantiene el analisis y la pertenencia acotados para la interfaz
 */
export function validateRegularGrammar(definition: Omit<GrammarDefinition, "source"> & { source?: GrammarDefinition["source"] }): GrammarValidationResult {
  const issues: GrammarValidationIssue[] = [];
  const terminals = Array.from(new Set(definition.terminals.filter(Boolean)));
  const nonTerminals = Array.from(new Set(definition.nonTerminals.filter(Boolean)));
  const startSymbol = definition.startSymbol.trim();
  const productions = definition.productions;

  if (terminals.length < 2) {
    issues.push({ message: "La gramática debe tener al menos 2 símbolos terminales." });
  }

  if (nonTerminals.length < 3) {
    issues.push({ message: "La gramática debe tener al menos 3 símbolos no terminales." });
  }

  if (!startSymbol || !nonTerminals.includes(startSymbol)) {
    issues.push({ message: "El símbolo inicial debe pertenecer al conjunto de no terminales." });
  }

  if (productions.length < 3) {
    issues.push({ message: "La gramática debe tener al menos 3 producciones." });
  }

  const terminalSet = new Set(terminals);
  const nonTerminalSet = new Set(nonTerminals);

  for (const production of productions) {
    if (!nonTerminalSet.has(production.left)) {
      issues.push({ message: `La producción ${production.left} -> ${formatTokenList(production.rightTokens)} tiene un lado izquierdo inválido.` });
      continue;
    }

    if (!hasOnlyKnownSymbols(production.rightTokens, terminalSet, nonTerminalSet)) {
      issues.push({ message: `La producción ${production.left} -> ${formatTokenList(production.rightTokens)} usa símbolos que no pertenecen a ΣT o ΣNT.` });
      continue;
    }

    const nonTerminalPositions = production.rightTokens
      .map((token, index) => (nonTerminalSet.has(token) ? index : -1))
      .filter((index) => index >= 0);

    if (nonTerminalPositions.length > 1) {
      issues.push({ message: `La producción ${production.left} -> ${formatTokenList(production.rightTokens)} no es regular por la derecha.` });
      continue;
    }

    if (nonTerminalPositions.length === 1 && nonTerminalPositions[0] !== production.rightTokens.length - 1) {
      issues.push({ message: `La producción ${production.left} -> ${formatTokenList(production.rightTokens)} debe dejar el no terminal al final.` });
    }
  }

  if (issues.length > 0) {
    return { issues };
  }

  return {
    grammar: {
      terminals,
      nonTerminals,
      startSymbol,
      productions,
      source: definition.source ?? "manual",
      stateMapping: definition.stateMapping,
    },
    issues,
  };
}

function arraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isPrefix(prefix: string[], full: string[]) {
  return prefix.every((value, index) => full[index] === value);
}

function splitWord(word: string, terminals: string[]) {
  const trimmed = word.trim();
  if (!trimmed) return [];
  if (trimmed.includes(" ")) {
    return trimmed.split(/\s+/).filter(Boolean);
  }

  if (terminals.every((terminal) => terminal.length === 1)) {
    return trimmed.split("");
  }

  return [trimmed];
}

function getTerminalPrefix(form: string[], nonTerminalSet: Set<string>) {
  const prefix: string[] = [];
  for (const token of form) {
    if (nonTerminalSet.has(token)) break;
    prefix.push(token);
  }
  return prefix;
}

function isTerminalForm(form: string[], nonTerminalSet: Set<string>) {
  return form.every((token) => !nonTerminalSet.has(token));
}

function replaceFirstNonTerminal(form: string[], nonTerminalSet: Set<string>, replacement: string[]) {
  const index = form.findIndex((token) => nonTerminalSet.has(token));
  if (index < 0) return form;
  return [...form.slice(0, index), ...replacement, ...form.slice(index + 1)];
}

export function buildGrammarOverview(grammar: GrammarDefinition): GrammarBranchOverview[] {
  return grammar.nonTerminals.map((nonTerminal) => ({
    nonTerminal,
    productions: grammar.productions
      .filter((production) => production.left === nonTerminal)
      .map((production) => ({
        id: production.id,
        label: `${production.left} -> ${formatTokenList(production.rightTokens)}`,
        note: production.note,
      })),
  }));
}

/**
 * Ejecuta una derivacion por la izquierda con BFS.
 *
 * El BFS sirve para dos cosas:
 * - encontrar una derivacion particular corta cuando la palabra pertenece
 * - guardar niveles de exploracion que la interfaz muestra como "hilos"
 */
export function analyzeWordWithGrammar(grammar: GrammarDefinition, wordInput: string): GrammarWordAnalysis {
  const word = splitWord(wordInput, grammar.terminals);
  const generalOverview = buildGrammarOverview(grammar);
  const nonTerminalSet = new Set(grammar.nonTerminals);
  const queue: Array<{
    id: string;
    depth: number;
    sententialForm: string[];
    viaProduction?: GrammarProduction;
    parentId?: string;
  }> = [{
    id: "root",
    depth: 0,
    sententialForm: [grammar.startSymbol],
  }];
  const visited = new Set<string>([`0:${grammar.startSymbol}`]);
  const parents = new Map<string, { parentId?: string; viaProduction?: GrammarProduction }>();
  const levels = new Map<number, DerivationSnapshot[]>();
  const snapshots = new Map<string, DerivationSnapshot>();
  const maxDepth = Math.max(8, word.length * 3 + grammar.nonTerminals.length * 2 + 4);
  const maxNodes = 400;

  let acceptedSnapshot: DerivationSnapshot | null = null;
  let exploredNodes = 0;

  while (queue.length > 0 && exploredNodes < maxNodes) {
    const current = queue.shift()!;
    exploredNodes += 1;

    const terminalPrefix = getTerminalPrefix(current.sententialForm, nonTerminalSet);
    const terminal = isTerminalForm(current.sententialForm, nonTerminalSet);
    const accepted = terminal && arraysEqual(current.sententialForm, word);
    const snapshot: DerivationSnapshot = {
      id: current.id,
      depth: current.depth,
      sententialForm: current.sententialForm,
      sententialLabel: formatTokenList(current.sententialForm),
      terminalPrefix,
      viaProduction: current.viaProduction,
      isAccepted: accepted,
      isTerminal: terminal,
    };

    snapshots.set(current.id, snapshot);
    parents.set(current.id, {
      parentId: current.parentId,
      viaProduction: current.viaProduction,
    });
    levels.set(current.depth, [...(levels.get(current.depth) ?? []), snapshot]);

    if (accepted) {
      acceptedSnapshot = snapshot;
      break;
    }

    if (current.depth >= maxDepth) continue;
    if (!isPrefix(terminalPrefix, word)) continue;
    if (terminal && !accepted) continue;
    if (terminalPrefix.length > word.length) continue;

    const nextNonTerminal = current.sententialForm.find((token) => nonTerminalSet.has(token));
    if (!nextNonTerminal) continue;

    const candidates = grammar.productions.filter((production) => production.left === nextNonTerminal);
    for (const production of candidates) {
      const nextForm = replaceFirstNonTerminal(current.sententialForm, nonTerminalSet, production.rightTokens);
      const nextPrefix = getTerminalPrefix(nextForm, nonTerminalSet);
      if (!isPrefix(nextPrefix, word)) continue;

      const stateKey = `${current.depth + 1}:${nextForm.join(" ")}`;
      if (visited.has(stateKey)) continue;
      visited.add(stateKey);

      queue.push({
        id: `${current.id}:${production.id}`,
        depth: current.depth + 1,
        sententialForm: nextForm,
        viaProduction: production,
        parentId: current.id,
      });
    }
  }

  const particularDerivation: DerivationSnapshot[] = [];
  if (acceptedSnapshot) {
    let cursor: DerivationSnapshot | undefined = acceptedSnapshot;
    while (cursor) {
      particularDerivation.push(cursor);
      const parentLink = parents.get(cursor.id);
      cursor = parentLink?.parentId ? snapshots.get(parentLink.parentId) : undefined;
    }
    particularDerivation.reverse();
  }

  const exploredLevels = Array.from(levels.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([depth, levelSnapshots]) => ({ depth, snapshots: levelSnapshots }));

  let reason = "No se encontró una derivación aceptante para la palabra.";
  if (acceptedSnapshot) {
    reason = "La palabra pertenece al lenguaje: se encontró una derivación particular completa.";
  } else if (exploredNodes >= maxNodes) {
    reason = "La exploración se acotó para evitar ciclos; la palabra no mostró una derivación aceptante en el espacio revisado.";
  } else if (exploredLevels.length === 1) {
    reason = "La gramática no pudo expandir el símbolo inicial hacia un prefijo compatible con la palabra.";
  }

  return {
    word,
    accepted: Boolean(acceptedSnapshot),
    reason,
    exploredLevels,
    particularDerivation,
    generalOverview,
  };
}

function makeStateNonTerminal(label: string, taken: Set<string>) {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = normalized ? `N_${normalized}` : "N";
  let candidate = base;
  let index = 1;
  while (taken.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  taken.add(candidate);
  return candidate;
}

/**
 * Deriva una gramatica regular equivalente a partir del automata dibujado.
 *
 * Reglas usadas:
 * - cada estado se convierte en un no terminal
 * - cada transicion p -a-> q se vuelve A_p -> a A_q
 * - cada estado de aceptacion agrega A_p -> ε
 * - si hay varios estados iniciales, se crea un símbolo inicial sintético
 */
export function deriveGrammarFromAutomaton(data: AutomataData): GrammarDefinition {
  const taken = new Set<string>();
  const mapping = data.states.map((state) => ({
    stateId: state.id,
    stateName: state.label,
    nonTerminal: makeStateNonTerminal(state.label, taken),
    isInitial: state.isInitial,
    isAccept: state.isAccept,
  }));
  const mapById = new Map(mapping.map((item) => [item.stateId, item]));
  const productions: GrammarProduction[] = [];

  const initialStates = mapping.filter((item) => item.isInitial);
  let startSymbol = initialStates[0]?.nonTerminal ?? "S";
  const nonTerminals = [...mapping.map((item) => item.nonTerminal)];
  if (initialStates.length > 1) {
    let synthetic = "S";
    let index = 1;
    while (nonTerminals.includes(synthetic)) {
      synthetic = `S${index}`;
      index += 1;
    }
    startSymbol = synthetic;
    nonTerminals.unshift(synthetic);
    initialStates.forEach((state, indexState) => {
      productions.push({
        id: makeProductionId(synthetic, [state.nonTerminal], indexState),
        left: synthetic,
        rightTokens: [state.nonTerminal],
        source: "automaton",
        note: `El símbolo inicial sintético apunta al estado inicial ${state.stateName}.`,
      });
    });
  }

  data.transitions.forEach((transition, index) => {
    const from = mapById.get(transition.from);
    const to = mapById.get(transition.to);
    if (!from || !to) return;

    const symbol = normalizeSymbol(transition.symbol);
    const rightTokens = symbol === EPSILON_SYMBOL ? [to.nonTerminal] : [symbol, to.nonTerminal];
    productions.push({
      id: makeProductionId(from.nonTerminal, rightTokens, index),
      left: from.nonTerminal,
      rightTokens,
      source: "automaton",
      note: `Proviene de ${from.stateName} --${symbol || EPSILON_DISPLAY}--> ${to.stateName}.`,
    });
  });

  mapping
    .filter((item) => item.isAccept)
    .forEach((item, index) => {
      productions.push({
        id: makeProductionId(item.nonTerminal, [], 9000 + index),
        left: item.nonTerminal,
        rightTokens: [],
        source: "automaton",
        note: `El estado ${item.stateName} es de aceptación, por eso genera ${EPSILON_DISPLAY}.`,
      });
    });

  const terminals = Array.from(
    new Set(
      data.alphabet
        .map((symbol) => normalizeSymbol(symbol))
        .filter((symbol) => symbol !== EPSILON_SYMBOL),
    ),
  );

  return {
    terminals,
    nonTerminals,
    startSymbol,
    productions,
    source: "automaton",
    stateMapping: mapping,
  };
}
