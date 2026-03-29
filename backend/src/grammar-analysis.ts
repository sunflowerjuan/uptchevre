import type {
  AutomataData,
  AutomatonType,
  GrammarAutomatonAnalysisResult,
  GrammarDefinition,
  GrammarDerivationStep,
  GrammarLinearity,
  GrammarManualAnalysisResult,
  GrammarProduction,
  GrammarProductionInput,
  GrammarSource,
  GrammarTransformationRule,
  GrammarValidationIssue,
  GrammarValidationResult,
  GrammarWordAnalysis,
} from "./types.js";
import {
  EPSILON_DISPLAY,
  EPSILON_SYMBOL,
  detectAutomatonType,
  epsilonClosure,
  getInputAlphabet,
  getStateNameMap,
  move,
  normalizeSymbol,
} from "./automata-analysis.js";

function isEpsilonToken(token: string) {
  return token === EPSILON_DISPLAY || token === EPSILON_SYMBOL || token.toLowerCase() === "epsilon";
}

function parseSymbolList(input: string[]) {
  return Array.from(new Set(input.map((item) => item.trim()).filter(Boolean)));
}

function formatTokenList(tokens: string[]) {
  return tokens.length > 0 ? tokens.join(" ") : EPSILON_DISPLAY;
}

function makeProductionId(left: string, rightTokens: string[], index: number) {
  return `${left}-${rightTokens.join("_") || "epsilon"}-${index}`;
}

function parseProductionRule(rule: string) {
  const trimmed = rule.trim();
  if (!trimmed || isEpsilonToken(trimmed)) return [];
  return trimmed
    .split(/\s+/)
    .map((token) => (isEpsilonToken(token) ? EPSILON_DISPLAY : token))
    .filter(Boolean);
}

function parseProductionAlternatives(rule: string) {
  return rule
    .split("|")
    .map((alternative) => parseProductionRule(alternative))
    .filter((tokens) => tokens.length > 0 || rule.split("|").some((part) => isEpsilonToken(part.trim()) || part.trim().length === 0));
}

function hasOnlyKnownSymbols(tokens: string[], terminals: Set<string>, nonTerminals: Set<string>) {
  return tokens.every((token) => terminals.has(token) || nonTerminals.has(token));
}

function arraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function isPrefix(prefix: string[], full: string[]) {
  return prefix.every((value, index) => full[index] === value);
}

function isSuffix(suffix: string[], full: string[]) {
  if (suffix.length > full.length) return false;
  return suffix.every((value, index) => full[full.length - suffix.length + index] === value);
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

function getTerminalSuffix(form: string[], nonTerminalSet: Set<string>) {
  const suffix: string[] = [];
  for (let index = form.length - 1; index >= 0; index -= 1) {
    const token = form[index]!;
    if (nonTerminalSet.has(token)) break;
    suffix.unshift(token);
  }
  return suffix;
}

function isTerminalForm(form: string[], nonTerminalSet: Set<string>) {
  return form.every((token) => !nonTerminalSet.has(token));
}

function replaceFirstNonTerminal(form: string[], nonTerminalSet: Set<string>, replacement: string[]) {
  const index = form.findIndex((token) => nonTerminalSet.has(token));
  if (index < 0) return form;
  return [...form.slice(0, index), ...replacement, ...form.slice(index + 1)];
}

function buildTreeLines(steps: GrammarDerivationStep[]) {
  if (steps.length === 0) {
    return ["No se encontro una derivacion aceptante."];
  }

  const lines: string[] = [];
  const root = steps[0]?.sententialLabel ?? "";
  lines.push(root);

  let indent = "";
  steps.slice(1).forEach((step, index, allSteps) => {
    const production = step.production;
    const isLast = index === allSteps.length - 1;
    const branch = isLast ? "└─" : "├─";
    const terminal = step.consumedSymbol;

    if (terminal) {
      lines.push(`${indent}${branch} ${terminal}`);
      indent += isLast ? "   " : "│  ";
    } else if (production && production.rightTokens.length === 0) {
      lines.push(`${indent}${branch} ${EPSILON_DISPLAY}`);
      indent += isLast ? "   " : "│  ";
    }

    if (step.nextNonTerminal) {
      lines.push(`${indent}└─ ${step.nextNonTerminal}`);
    }
  });

  return lines;
}

function padCenter(value: string, width: number) {
  if (value.length >= width) return value;
  const total = width - value.length;
  const left = Math.floor(total / 2);
  const right = total - left;
  return `${" ".repeat(left)}${value}${" ".repeat(right)}`;
}

function buildThreadDiagramLines(steps: GrammarDerivationStep[]) {
  if (steps.length <= 1) {
    return ["No hay cambios de estado para diagramar."];
  }

  const states = [steps[0]?.sententialForm[0] ?? ""];
  const symbols: string[] = [];
  const labels = ["[inicio]"];

  steps.slice(1).forEach((step, index) => {
    const state = step.nextNonTerminal ?? (step.production?.rightTokens.length === 0 ? EPSILON_DISPLAY : "∅");
    states.push(state);
    if (step.consumedSymbol) {
      symbols.push(step.consumedSymbol);
    }
    labels.push(`[paso ${index + 1}]`);
  });

  const widths = states.map((state, index) =>
    Math.max(state.length + 2, labels[index]?.length ?? 0, (symbols[index - 1]?.length ?? 0) + 10, 12),
  );

  const stateLine = states
    .map((state, index) => {
      const content = padCenter(state, widths[index]!);
      if (index === states.length - 1) return content;
      return `${content}═══>`;
    })
    .join("");

  const labelLine = labels.map((label, index) => padCenter(label, widths[index]! + (index < labels.length - 1 ? 4 : 0))).join("");
  const symbolLine = states
    .map((_, index) => {
      const symbol = index === 0 ? "" : `Simbolo: ${symbols[index - 1] ?? EPSILON_DISPLAY}`;
      return padCenter(symbol, widths[index]! + (index < states.length - 1 ? 4 : 0));
    })
    .join("");

  return [stateLine, labelLine, symbolLine];
}

function validateRegularGrammar(
  definition: Omit<GrammarDefinition, "source" | "linearity"> & { source?: GrammarSource },
): GrammarValidationResult {
  const issues: GrammarValidationIssue[] = [];
  const terminals = Array.from(new Set(definition.terminals.filter(Boolean)));
  const nonTerminals = Array.from(new Set(definition.nonTerminals.filter(Boolean)));
  const startSymbol = definition.startSymbol.trim();
  const productions = definition.productions;

  if (terminals.length < 2) {
    issues.push({ message: "La gramatica debe tener al menos 2 simbolos terminales." });
  }

  if (nonTerminals.length < 1) {
    issues.push({ message: "La gramatica debe tener al menos 1 simbolo no terminal." });
  }

  if (!startSymbol || !nonTerminals.includes(startSymbol)) {
    issues.push({ message: "El simbolo inicial debe pertenecer al conjunto de no terminales." });
  }

  if (productions.length < 1) {
    issues.push({ message: "La gramatica debe tener al menos 1 produccion." });
  }

  const terminalSet = new Set(terminals);
  const nonTerminalSet = new Set(nonTerminals);
  const seenLinearities = new Set<GrammarLinearity>();

  for (const production of productions) {
    if (!nonTerminalSet.has(production.left)) {
      issues.push({
        message: `La produccion ${production.left} -> ${formatTokenList(production.rightTokens)} tiene un lado izquierdo invalido.`,
      });
      continue;
    }

    if (!hasOnlyKnownSymbols(production.rightTokens, terminalSet, nonTerminalSet)) {
      issues.push({
        message: `La produccion ${production.left} -> ${formatTokenList(production.rightTokens)} usa simbolos fuera de ΣT o ΣNT.`,
      });
      continue;
    }

    const nonTerminalPositions = production.rightTokens
      .map((token, index) => (nonTerminalSet.has(token) ? index : -1))
      .filter((index) => index >= 0);

    if (nonTerminalPositions.length > 1) {
      issues.push({
        message: `La produccion ${production.left} -> ${formatTokenList(production.rightTokens)} no es lineal.`,
      });
      continue;
    }

    if (nonTerminalPositions.length === 1) {
      const position = nonTerminalPositions[0]!;

      if (position === production.rightTokens.length - 1) {
        seenLinearities.add("RIGHT");
      } else if (position === 0) {
        seenLinearities.add("LEFT");
      } else {
        issues.push({
          message: `La produccion ${production.left} -> ${formatTokenList(production.rightTokens)} debe ser lineal derecha o lineal izquierda.`,
        });
      }
    }
  }

  if (seenLinearities.size > 1) {
    issues.push({
      message: "No se puede mezclar lineal derecha con lineal izquierda en la misma gramatica.",
    });
  }

  if (issues.length > 0) {
    return { issues };
  }

  const linearity = seenLinearities.has("LEFT") ? "LEFT" : "RIGHT";

  for (const production of productions) {
    const nonTerminalPositions = production.rightTokens
      .map((token, index) => (nonTerminalSet.has(token) ? index : -1))
      .filter((index) => index >= 0);

    if (
      linearity === "RIGHT" &&
      nonTerminalPositions.length === 1 &&
      nonTerminalPositions[0] !== production.rightTokens.length - 1
    ) {
      issues.push({
        message: `La produccion ${production.left} -> ${formatTokenList(production.rightTokens)} debe dejar el no terminal al final.`,
      });
    }

    if (linearity === "LEFT" && nonTerminalPositions.length === 1 && nonTerminalPositions[0] !== 0) {
      issues.push({
        message: `La produccion ${production.left} -> ${formatTokenList(production.rightTokens)} debe dejar el no terminal al inicio.`,
      });
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
      linearity,
      stateMapping: definition.stateMapping,
      derivedFromAutomatonType: definition.derivedFromAutomatonType,
    },
    issues,
  };
}

function analyzeWordWithGrammar(grammar: GrammarDefinition, wordInput: string, includeThreadDiagram: boolean): GrammarWordAnalysis {
  const word = splitWord(wordInput, grammar.terminals);
  const nonTerminalSet = new Set(grammar.nonTerminals);
  const isRightLinear = grammar.linearity === "RIGHT";
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
  const snapshots = new Map<string, GrammarDerivationStep>();
  const parents = new Map<string, { parentId?: string }>();
  const maxDepth = Math.max(8, word.length * 3 + grammar.nonTerminals.length * 2 + 4);
  const maxNodes = 400;

  let acceptedSnapshot: GrammarDerivationStep | null = null;
  let exploredNodes = 0;

  while (queue.length > 0 && exploredNodes < maxNodes) {
    const current = queue.shift()!;
    exploredNodes += 1;

    const terminalPrefix = isRightLinear
      ? getTerminalPrefix(current.sententialForm, nonTerminalSet)
      : getTerminalSuffix(current.sententialForm, nonTerminalSet);
    const terminal = isTerminalForm(current.sententialForm, nonTerminalSet);
    const accepted = terminal && arraysEqual(current.sententialForm, word);
    const producedTokens = current.viaProduction?.rightTokens ?? [];
    const consumedSymbol = producedTokens.find((token) => !nonTerminalSet.has(token)) ?? null;
    const nextNonTerminal = producedTokens.find((token) => nonTerminalSet.has(token)) ?? null;

    const snapshot: GrammarDerivationStep = {
      id: current.id,
      sententialForm: current.sententialForm,
      sententialLabel: formatTokenList(current.sententialForm),
      production: current.viaProduction,
      appliedNonTerminal: current.viaProduction?.left,
      consumedSymbol,
      nextNonTerminal,
    };

    snapshots.set(current.id, snapshot);
    parents.set(current.id, { parentId: current.parentId });

    if (accepted) {
      acceptedSnapshot = snapshot;
      break;
    }

    if (current.depth >= maxDepth) continue;
    if (isRightLinear && !isPrefix(terminalPrefix, word)) continue;
    if (!isRightLinear && !isSuffix(terminalPrefix, word)) continue;
    if (terminal && !accepted) continue;
    if (terminalPrefix.length > word.length) continue;

    const nextNonTerminalToExpand = isRightLinear
      ? current.sententialForm.find((token) => nonTerminalSet.has(token))
      : [...current.sententialForm].reverse().find((token) => nonTerminalSet.has(token));
    if (!nextNonTerminalToExpand) continue;

    const candidates = grammar.productions.filter((production) => production.left === nextNonTerminalToExpand);
    for (const production of candidates) {
      const nextForm = replaceFirstNonTerminal(current.sententialForm, nonTerminalSet, production.rightTokens);
      const nextPrefix = isRightLinear
        ? getTerminalPrefix(nextForm, nonTerminalSet)
        : getTerminalSuffix(nextForm, nonTerminalSet);
      if (isRightLinear && !isPrefix(nextPrefix, word)) continue;
      if (!isRightLinear && !isSuffix(nextPrefix, word)) continue;

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

  const particularDerivation: GrammarDerivationStep[] = [];
  if (acceptedSnapshot) {
    let cursor: GrammarDerivationStep | undefined = acceptedSnapshot;
    while (cursor) {
      particularDerivation.push(cursor);
      const parent = parents.get(cursor.id);
      cursor = parent?.parentId ? snapshots.get(parent.parentId) : undefined;
    }
    particularDerivation.reverse();
  }

  let reason = "No se encontro una derivacion aceptante para la palabra.";
  if (acceptedSnapshot) {
    reason = "La palabra pertenece al lenguaje y se encontro una derivacion particular completa.";
  } else if (exploredNodes >= maxNodes) {
    reason = "La exploracion se acoto para evitar ciclos y no aparecio una derivacion aceptante.";
  } else if (particularDerivation.length === 0) {
    reason = "La palabra no es compatible con las producciones activas.";
  }

  return {
    word,
    accepted: Boolean(acceptedSnapshot),
    reason,
    particularDerivation,
    derivationTreeLines: buildTreeLines(particularDerivation),
    threadDiagramLines: includeThreadDiagram ? buildThreadDiagramLines(particularDerivation) : [],
  };
}

function makeStateNonTerminal(label: string, taken: Set<string>) {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = normalized || "S";
  let candidate = base;
  let index = 1;
  while (taken.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  taken.add(candidate);
  return candidate;
}

function buildAutomatonProductions(
  automaton: AutomataData,
  type: AutomatonType,
  mapping: ReturnType<typeof deriveStateMapping>,
) {
  const productions: GrammarProduction[] = [];
  const mappingById = new Map(mapping.map((item) => [item.stateId, item]));

  if (type === "NFA_EPSILON") {
    const alphabet = getInputAlphabet(automaton);

    mapping.forEach((item, stateIndex) => {
      const sourceClosure = epsilonClosure(automaton, [item.stateId]);
      const sourceClosureNames = Array.from(sourceClosure)
        .map((stateId) => mappingById.get(stateId)?.stateName ?? stateId)
        .sort();

      alphabet.forEach((symbol, symbolIndex) => {
        const moved = move(automaton, sourceClosure, symbol);
        const closure = moved.size > 0 ? epsilonClosure(automaton, moved) : new Set<string>();
        const closureIds = Array.from(closure).sort();

        closureIds.forEach((targetId, targetIndex) => {
          const target = mappingById.get(targetId);
          if (!target) return;

          productions.push({
            id: makeProductionId(item.nonTerminal, [symbol, target.nonTerminal], stateIndex * 1000 + symbolIndex * 100 + targetIndex),
            left: item.nonTerminal,
            rightTokens: [symbol, target.nonTerminal],
            source: "automaton",
            note: `Se obtiene por ε-clausura(${item.stateName}) = {${sourceClosureNames.join(", ")}} y luego consumir ${symbol}.`,
          });
        });
      });

      if (Array.from(sourceClosure).some((stateId) => mappingById.get(stateId)?.isAccept)) {
        productions.push({
          id: makeProductionId(item.nonTerminal, [], 9000 + stateIndex),
          left: item.nonTerminal,
          rightTokens: [],
          source: "automaton",
          note: `Algún estado de ε-clausura(${item.stateName}) es de aceptación, por eso ${item.nonTerminal} -> ${EPSILON_DISPLAY}.`,
        });
      }
    });

    return productions;
  }

  automaton.transitions.forEach((transition, index) => {
    const from = mappingById.get(transition.from);
    const to = mappingById.get(transition.to);
    if (!from || !to) return;

    const symbol = normalizeSymbol(transition.symbol);
    if (symbol === EPSILON_SYMBOL) return;

    productions.push({
      id: makeProductionId(from.nonTerminal, [symbol, to.nonTerminal], index),
      left: from.nonTerminal,
      rightTokens: [symbol, to.nonTerminal],
      source: "automaton",
      note: `${from.stateName} --${symbol}--> ${to.stateName} genera ${from.nonTerminal} -> ${symbol} ${to.nonTerminal}.`,
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
        note: `El estado ${item.stateName} es de aceptación, por eso ${item.nonTerminal} -> ${EPSILON_DISPLAY}.`,
      });
    });

  return productions;
}

function deriveStateMapping(automaton: AutomataData) {
  const taken = new Set<string>();
  const nameMap = getStateNameMap(automaton);

  return automaton.states.map((state) => ({
    stateId: state.id,
    stateName: nameMap.get(state.id) ?? state.id,
    nonTerminal: makeStateNonTerminal(nameMap.get(state.id) ?? state.id, taken),
    isInitial: state.isInitial,
    isAccept: state.isAccept,
  }));
}

export function deriveGrammarFromAutomaton(automaton: AutomataData): GrammarDefinition {
  const type = detectAutomatonType(automaton);
  const mapping = deriveStateMapping(automaton);
  const initial = mapping.find((item) => item.isInitial);
  const startSymbol = initial?.nonTerminal ?? mapping[0]?.nonTerminal ?? "S";

  return {
    terminals: getInputAlphabet(automaton),
    nonTerminals: mapping.map((item) => item.nonTerminal),
    startSymbol,
    productions: buildAutomatonProductions(automaton, type, mapping),
    source: "automaton",
    linearity: "RIGHT",
    stateMapping: mapping,
    derivedFromAutomatonType: type,
  };
}

function getTransformationRules(type: AutomatonType): GrammarTransformationRule[] {
  const common: GrammarTransformationRule[] = [
    {
      title: "Estados a variables",
      description: "Cada estado del automata se convierte en una variable o no terminal.",
    },
    {
      title: "Estado inicial",
      description: "El estado inicial del automata se usa como simbolo inicial de la gramatica.",
    },
  ];

  if (type === "DFA") {
    return [
      ...common,
      {
        title: "Transiciones deterministas",
        description: "Cada transición δ(q, a) = p genera exactamente una producción q -> a p.",
      },
      {
        title: "Aceptación",
        description: "Si un estado q pertenece a F, entonces se agrega la producción q -> ε.",
      },
    ];
  }

  if (type === "NFA") {
    return [
      ...common,
      {
        title: "Transiciones no deterministas",
        description: "Por cada estado p en δ(q, a), se agrega una producción q -> a p.",
      },
      {
        title: "Aceptación",
        description: "Si un estado q pertenece a F, entonces se agrega la producción q -> ε.",
      },
    ];
  }

  return [
    ...common,
    {
      title: "ε-clausura",
      description: "Primero se calcula ε-clausura(q) para cada estado antes de construir las producciones con símbolos visibles.",
    },
    {
      title: "Producciones visibles",
      description: "Para cada símbolo a, se agregan producciones q -> a p donde p pertenece a ε-clausura(move(ε-clausura(q), a)).",
    },
    {
      title: "Aceptación por clausura",
      description: "Si algún estado de ε-clausura(q) es de aceptación, entonces se agrega q -> ε.",
    },
  ];
}

export function analyzeManualGrammar(input: {
  terminals: string[];
  nonTerminals: string[];
  startSymbol: string;
  productions: GrammarProductionInput[];
  word: string;
}): GrammarManualAnalysisResult {
  const productions = input.productions
    .flatMap((production, index) =>
      parseProductionAlternatives(production.rule).map((tokens, alternativeIndex) => ({
        id: makeProductionId(production.left.trim(), tokens, index * 100 + alternativeIndex),
        left: production.left.trim(),
        rightTokens: tokens,
        source: "manual" as const,
      })),
    )
    .filter((production) => production.left.length > 0);

  const validation = validateRegularGrammar({
    terminals: parseSymbolList(input.terminals),
    nonTerminals: parseSymbolList(input.nonTerminals),
    startSymbol: input.startSymbol,
    productions,
    source: "manual",
  });

  return {
    validation,
    analysis: validation.grammar ? analyzeWordWithGrammar(validation.grammar, input.word, false) : undefined,
  };
}

export function analyzeAutomatonEquivalentGrammar(input: {
  automaton: AutomataData;
  word: string;
}): GrammarAutomatonAnalysisResult {
  const grammar = deriveGrammarFromAutomaton(input.automaton);
  const validation = validateRegularGrammar(grammar);

  return {
    validation,
    analysis: validation.grammar ? analyzeWordWithGrammar(validation.grammar, input.word, true) : undefined,
    transformationRules: getTransformationRules(grammar.derivedFromAutomatonType ?? "DFA"),
  };
}
