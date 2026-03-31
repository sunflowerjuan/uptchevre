import { analyzeAutomaton, getInputAlphabet, getStateNameMap, normalizeSymbol } from "./automata-analysis.js";
import { checkDeterminism, getInitialState } from "./automata-utils.js";
import type {
  AutomataData,
  AutomataState,
  DfaDistinguishabilityCell,
  DfaDistinguishabilityIteration,
  DfaEquivalenceClass,
  DfaEquivalenceSymbolCheck,
  DfaMinimizationResult,
  DfaMinimizedTransitionRow,
  DfaPartitionGroup,
  DfaPartitionIteration,
  DfaPartitionSplitCause,
} from "./types.js";

type OrderedState = {
  id: string;
  name: string;
  isInitial: boolean;
  isAccept: boolean;
};

// Datos de una comparación de símbolo para el par (p, q)
export type SymbolComparison = {
  symbol: string;
  targetA: string;        // nombre δ(p, a)
  targetB: string;        // nombre δ(q, a)
  targetAInF: boolean;
  targetBInF: boolean;
  pairAlreadyMarked: boolean;
  marks: boolean;         // true = este símbolo provoca que el par sea marcado
};

// Payload enriquecido serializado dentro del campo reason
export type RichReason = {
  markType: "base" | "propagation";
  summary: string;        // texto plano
  comparisons: SymbolComparison[];
};

type MarkedReason = {
  iteration: number;
  richReason: RichReason;
};

const EMPTY_SET = "\u2205";

// Prefijo para detectar reason enriquecido en el panel
export const RICH_REASON_PREFIX = "__rich__";

function encodeRichReason(r: RichReason): string {
  return RICH_REASON_PREFIX + JSON.stringify(r);
}

export function decodeRichReason(reason: string | undefined): RichReason | null {
  if (!reason?.startsWith(RICH_REASON_PREFIX)) return null;
  try {
    return JSON.parse(reason.slice(RICH_REASON_PREFIX.length)) as RichReason;
  } catch {
    return null;
  }
}

function ensureMinimizableDfa(automaton: AutomataData) {
  const analysis = analyzeAutomaton(automaton);
  if (analysis.automatonType !== "DFA") {
    throw new Error("La minimizacion de Myhill-Nerode solo aplica a DFA.");
  }

  const initialState = getInitialState(automaton);
  if (!initialState) {
    throw new Error("El DFA debe tener un estado inicial.");
  }

  const determinism = checkDeterminism(automaton);
  if (!determinism.isDeterministic) {
    throw new Error("El automata no es determinista.");
  }

  const alphabet = getInputAlphabet(automaton);
  const missingTransitions: string[] = [];
  for (const state of automaton.states) {
    for (const symbol of alphabet) {
      const exists = automaton.transitions.some(
        (transition) =>
          transition.from === state.id && normalizeSymbol(transition.symbol) === symbol,
      );
      if (!exists) {
        missingTransitions.push(`${state.label || state.id} con ${symbol}`);
      }
    }
  }

  if (missingTransitions.length > 0) {
    throw new Error(
      `El DFA debe estar completo. Faltan transiciones para: ${missingTransitions.join(", ")}.`,
    );
  }
}

function buildOrderedStates(automaton: AutomataData): OrderedState[] {
  const nameMap = getStateNameMap(automaton);
  return automaton.states.map((state) => ({
    id: state.id,
    name: nameMap.get(state.id) ?? state.id,
    isInitial: state.isInitial,
    isAccept: state.isAccept,
  }));
}

function buildDelta(automaton: AutomataData): Map<string, string> {
  const delta = new Map<string, string>();
  for (const transition of automaton.transitions) {
    delta.set(`${transition.from}::${normalizeSymbol(transition.symbol)}`, transition.to);
  }
  return delta;
}

function pairKey(a: string, b: string, orderIndex: Map<string, number>) {
  return (orderIndex.get(a) ?? 0) > (orderIndex.get(b) ?? 0) ? `${a}::${b}` : `${b}::${a}`;
}

function formatGroupNames(group: string[], stateNameById: Map<string, string>) {
  return group.map((stateId) => stateNameById.get(stateId) ?? stateId);
}

function toPartitionGroups(
  partition: string[][],
  stateNameById: Map<string, string>,
): DfaPartitionGroup[] {
  return partition.map((group, index) => ({
    id: `P${index + 1}`,
    stateIds: [...group],
    stateNames: formatGroupNames(group, stateNameById),
  }));
}

function getGroupIndex(partition: string[][], stateId: string) {
  return partition.findIndex((group) => group.includes(stateId));
}

function buildPartitionIterations(
  partition: string[][],
  alphabet: string[],
  orderedStates: OrderedState[],
  delta: Map<string, string>,
  stateNameById: Map<string, string>,
): DfaPartitionIteration[] {
  const stateOrder = new Map(orderedStates.map((state, index) => [state.id, index]));
  const iterations: DfaPartitionIteration[] = [];
  let current = partition.map((group) => [...group]);
  let iteration = 0;

  while (true) {
    const beforeGroups = toPartitionGroups(current, stateNameById);
    const next: string[][] = [];
    const splitCauses: DfaPartitionSplitCause[] = [];

    for (let groupIndex = 0; groupIndex < current.length; groupIndex += 1) {
      const group = [...current[groupIndex]].sort(
        (left, right) => (stateOrder.get(left) ?? 0) - (stateOrder.get(right) ?? 0),
      );

      if (group.length <= 1) {
        next.push(group);
        continue;
      }

      const signatureBuckets = new Map<string, string[]>();
      for (const stateId of group) {
        const signature = alphabet
          .map((symbol) => {
            const target = delta.get(`${stateId}::${symbol}`);
            return target ? getGroupIndex(current, target) : -1;
          })
          .join("|");
        const bucket = signatureBuckets.get(signature) ?? [];
        bucket.push(stateId);
        signatureBuckets.set(signature, bucket);
      }

      const buckets = Array.from(signatureBuckets.values()).sort(
        (left, right) => (stateOrder.get(left[0]) ?? 0) - (stateOrder.get(right[0]) ?? 0),
      );

      if (buckets.length === 1) {
        next.push(group);
        continue;
      }

      next.push(...buckets);
      const referenceState = buckets[0][0];
      for (let bucketIndex = 1; bucketIndex < buckets.length; bucketIndex += 1) {
        const comparedState = buckets[bucketIndex][0];
        const separatingSymbol = alphabet.find((symbol) => {
          const referenceTarget = delta.get(`${referenceState}::${symbol}`) ?? "";
          const comparedTarget = delta.get(`${comparedState}::${symbol}`) ?? "";
          return (
            getGroupIndex(current, referenceTarget) !== getGroupIndex(current, comparedTarget)
          );
        });

        if (!separatingSymbol) continue;

        const referenceTarget = delta.get(`${referenceState}::${separatingSymbol}`) ?? "";
        const comparedTarget = delta.get(`${comparedState}::${separatingSymbol}`) ?? "";
        splitCauses.push({
          groupId: `P${groupIndex + 1}`,
          stateAId: referenceState,
          stateAName: stateNameById.get(referenceState) ?? referenceState,
          stateBId: comparedState,
          stateBName: stateNameById.get(comparedState) ?? comparedState,
          symbol: separatingSymbol,
          targetAStateId: referenceTarget,
          targetAStateName: stateNameById.get(referenceTarget) ?? referenceTarget,
          targetBStateId: comparedTarget,
          targetBStateName: stateNameById.get(comparedTarget) ?? comparedTarget,
          targetAGroupId: `P${getGroupIndex(current, referenceTarget) + 1}`,
          targetBGroupId: `P${getGroupIndex(current, comparedTarget) + 1}`,
        });
      }
    }

    const afterGroups = toPartitionGroups(next, stateNameById);
    const stabilized =
      current.length === next.length &&
      current.every((group, index) => group.join("|") === (next[index] ?? []).join("|"));

    iterations.push({
      iteration,
      beforeGroups,
      afterGroups,
      splitCauses,
      stabilized,
    });

    if (stabilized) {
      return iterations;
    }

    current = next.map((group) => [...group]);
    iteration += 1;
  }
}

function buildDistinguishabilityIterations(
  orderedStates: OrderedState[],
  alphabet: string[],
  delta: Map<string, string>,
  acceptSet: Set<string>,
  stateNameById: Map<string, string>,
): DfaDistinguishabilityIteration[] {
  const orderIndex = new Map(orderedStates.map((state, index) => [state.id, index]));
  const markedRich = new Map<string, MarkedReason>();
  const iterations: DfaDistinguishabilityIteration[] = [];

  // Marcado base: p ∈ F y q ∉ F (o viceversa)
  for (let row = 1; row < orderedStates.length; row += 1) {
    for (let column = 0; column < row; column += 1) {
      const stateA = orderedStates[row];
      const stateB = orderedStates[column];
      if (acceptSet.has(stateA.id) !== acceptSet.has(stateB.id)) {
        const aInF = acceptSet.has(stateA.id);
        const comparisons: SymbolComparison[] = alphabet.map((symbol) => {
          const targetAId = delta.get(`${stateA.id}::${symbol}`) ?? "";
          const targetBId = delta.get(`${stateB.id}::${symbol}`) ?? "";
          return {
            symbol,
            targetA: stateNameById.get(targetAId) ?? targetAId,
            targetB: stateNameById.get(targetBId) ?? targetBId,
            targetAInF: acceptSet.has(targetAId),
            targetBInF: acceptSet.has(targetBId),
            pairAlreadyMarked: false,
            marks: false,
          };
        });
        markedRich.set(pairKey(stateA.id, stateB.id, orderIndex), {
          iteration: 0,
          richReason: {
            markType: "base",
            summary: aInF
              ? `${stateA.name} ∈ F y ${stateB.name} ∉ F`
              : `${stateB.name} ∈ F y ${stateA.name} ∉ F`,
            comparisons,
          },
        });
      }
    }
  }

  const buildSnapshot = (iteration: number, finalIteration: boolean): DfaDistinguishabilityIteration => {
    const cells: DfaDistinguishabilityCell[] = [];
    for (let row = 1; row < orderedStates.length; row += 1) {
      for (let column = 0; column < row; column += 1) {
        const stateA = orderedStates[row];
        const stateB = orderedStates[column];
        const info = markedRich.get(pairKey(stateA.id, stateB.id, orderIndex));
        const status = info
          ? "distinguishable"
          : finalIteration
            ? "equivalent"
            : "pending";

        cells.push({
          rowStateId: stateA.id,
          rowStateName: stateA.name,
          columnStateId: stateB.id,
          columnStateName: stateB.name,
          status,
          reason: info ? encodeRichReason(info.richReason) : undefined,
          markedInIteration: info?.iteration,
        });
      }
    }
    return { iteration, cells };
  };

  iterations.push(buildSnapshot(0, false));

  let iteration = 1;
  while (true) {
    const newlyMarked: Array<{ key: string; info: MarkedReason }> = [];

    for (let row = 1; row < orderedStates.length; row += 1) {
      for (let column = 0; column < row; column += 1) {
        const stateA = orderedStates[row];
        const stateB = orderedStates[column];
        const currentKey = pairKey(stateA.id, stateB.id, orderIndex);
        if (markedRich.has(currentKey)) continue;

        // Calcular comparaciones para TODOS los símbolos
        const comparisons: SymbolComparison[] = [];
        let markingSymbol: string | null = null;

        for (const symbol of alphabet) {
          const targetAId = delta.get(`${stateA.id}::${symbol}`) ?? "";
          const targetBId = delta.get(`${stateB.id}::${symbol}`) ?? "";
          const sameTarget = targetAId === targetBId;
          const targetPairAlreadyMarked = !sameTarget
            ? markedRich.has(pairKey(targetAId, targetBId, orderIndex))
            : false;
          const marks = !sameTarget && targetPairAlreadyMarked;

          comparisons.push({
            symbol,
            targetA: stateNameById.get(targetAId) ?? targetAId,
            targetB: stateNameById.get(targetBId) ?? targetBId,
            targetAInF: acceptSet.has(targetAId),
            targetBInF: acceptSet.has(targetBId),
            pairAlreadyMarked: targetPairAlreadyMarked,
            marks,
          });

          if (marks && markingSymbol === null) {
            markingSymbol = symbol;
          }
        }

        if (markingSymbol !== null) {
          const c = comparisons.find((comp) => comp.symbol === markingSymbol)!;
          newlyMarked.push({
            key: currentKey,
            info: {
              iteration,
              richReason: {
                markType: "propagation",
                summary: `δ(${stateA.name}, ${markingSymbol}) = ${c.targetA}, δ(${stateB.name}, ${markingSymbol}) = ${c.targetB} - par (${c.targetA}, ${c.targetB}) ya distinguible`,
                comparisons,
              },
            },
          });
        }
      }
    }

    if (newlyMarked.length === 0) {
      break;
    }

    for (const entry of newlyMarked) {
      markedRich.set(entry.key, entry.info);
    }
    iterations.push(buildSnapshot(iteration, false));
    iteration += 1;
  }

  iterations.push(buildSnapshot(iteration, true));
  return iterations;
}

function buildEquivalenceClasses(
  finalPartition: string[][],
  alphabet: string[],
  delta: Map<string, string>,
  orderedStates: OrderedState[],
  stateNameById: Map<string, string>,
) {
  const stateOrder = new Map(orderedStates.map((state, index) => [state.id, index]));
  const initialStateId = orderedStates.find((s) => s.isInitial)?.id;

  const classes = finalPartition
    .map((group) =>
      [...group].sort(
        (left, right) => (stateOrder.get(left) ?? 0) - (stateOrder.get(right) ?? 0),
      ),
    )
    .sort((a, b) => {
      const aHasInitial = initialStateId ? a.includes(initialStateId) : false;
      const bHasInitial = initialStateId ? b.includes(initialStateId) : false;
      if (aHasInitial && !bHasInitial) return -1;
      if (!aHasInitial && bHasInitial) return 1;
      return (stateOrder.get(a[0]) ?? 0) - (stateOrder.get(b[0]) ?? 0);
    });

  const classNameByStateId = new Map<string, string>();
  classes.forEach((group, index) => {
    for (const stateId of group) {
      classNameByStateId.set(stateId, `q${index}''`);
    }
  });

  const equivalenceClasses: DfaEquivalenceClass[] = classes.map((group, index) => {
    const className = `q${index}''`;
    const symbolChecks: DfaEquivalenceSymbolCheck[] = alphabet.map((symbol) => ({
      symbol,
      mappings: group.map((stateId) => {
        const targetStateId = delta.get(`${stateId}::${symbol}`) ?? "";
        return {
          stateId,
          stateName: stateNameById.get(stateId) ?? stateId,
          targetStateId,
          targetStateName: stateNameById.get(targetStateId) ?? targetStateId,
          targetClassName: classNameByStateId.get(targetStateId) ?? EMPTY_SET,
        };
      }),
    }));

    const stateSetLabel = `{${formatGroupNames(group, stateNameById).join(", ")}}`;

    const explanation =
      group.length === 1
        ? `${className} = ${stateSetLabel} - estado único en su clase`
        : `${className} = ${stateSetLabel} - equivalentes: ` +
        symbolChecks
          .map((check) => {
            const targets = check.mappings.map((m) => m.targetClassName);
            const allSame = targets.every((t) => t === targets[0]);
            return allSame
              ? `δ(·, ${check.symbol}) → ${targets[0]}`
              : check.mappings
                .map(
                  (m) =>
                    `δ(${m.stateName}, ${check.symbol}) = ${m.targetStateName} ∈ ${m.targetClassName}`,
                )
                .join("; ");
          })
          .join(", ");

    return {
      className,
      stateIds: [...group],
      stateNames: formatGroupNames(group, stateNameById),
      explanation,
      symbolChecks,
    };
  });

  return { equivalenceClasses, classNameByStateId };
}

function buildMinimizedTransitionTable(
  classes: DfaEquivalenceClass[],
  classNameByStateId: Map<string, string>,
  alphabet: string[],
  delta: Map<string, string>,
  automaton: AutomataData,
  stateNameById: Map<string, string>,
): DfaMinimizedTransitionRow[] {
  const initialState = getInitialState(automaton);
  const acceptStateIds = new Set(
    automaton.states.filter((s) => s.isAccept).map((s) => s.id),
  );

  return classes.map((equivalenceClass) => {
    const representative = equivalenceClass.stateIds[0];
    return {
      className: equivalenceClass.className,
      memberStateIds: [...equivalenceClass.stateIds],
      memberStateNames: [...equivalenceClass.stateNames],
      isInitial: initialState?.id
        ? equivalenceClass.stateIds.includes(initialState.id)
        : false,
      isAccept: equivalenceClass.stateIds.some((id) => acceptStateIds.has(id)),
      transitions: alphabet.map((symbol) => {
        const targetStateId = delta.get(`${representative}::${symbol}`) ?? "";
        return {
          symbol,
          targetClassName: classNameByStateId.get(targetStateId) ?? EMPTY_SET,
          targetStateId,
          targetStateName: stateNameById.get(targetStateId) ?? targetStateId,
        };
      }),
    };
  });
}

function buildMinimizedAutomaton(
  rows: DfaMinimizedTransitionRow[],
  alphabet: string[],
): AutomataData {
  const centerX = 220;
  const centerY = 220;
  const radius = Math.max(120, rows.length * 22);
  const angleStep = rows.length > 1 ? (Math.PI * 2) / rows.length : 0;

  const states: AutomataState[] = rows.map((row, index) => ({
    id: `min-${index}`,
    label: row.className,
    x: Math.round(centerX + radius * Math.cos(angleStep * index - Math.PI / 2)),
    y: Math.round(centerY + radius * Math.sin(angleStep * index - Math.PI / 2)),
    isInitial: row.isInitial,
    isAccept: row.isAccept,
  }));

  const stateIdByClassName = new Map(
    rows.map((row, index) => [row.className, states[index].id]),
  );
  const transitions = rows.flatMap((row) =>
    row.transitions.map((transition, index) => ({
      id: `min-${row.className}-${transition.symbol}-${index}`,
      from: stateIdByClassName.get(row.className) ?? "",
      to: stateIdByClassName.get(transition.targetClassName) ?? "",
      symbol: transition.symbol,
    })),
  );

  return { states, transitions, alphabet: [...alphabet] };
}

export function minimizeDfa(automaton: AutomataData): DfaMinimizationResult {
  ensureMinimizableDfa(automaton);

  const orderedStates = buildOrderedStates(automaton);
  const stateNameById = new Map(orderedStates.map((state) => [state.id, state.name]));
  const alphabet = getInputAlphabet(automaton);
  const delta = buildDelta(automaton);
  const initialState = orderedStates.find((state) => state.isInitial);
  const acceptStates = orderedStates.filter((state) => state.isAccept);
  const nonAcceptStates = orderedStates.filter((state) => !state.isAccept);
  const initialPartition = [acceptStates, nonAcceptStates]
    .filter((group) => group.length > 0)
    .map((group) => group.map((state) => state.id));

  const partitionIterations = buildPartitionIterations(
    initialPartition,
    alphabet,
    orderedStates,
    delta,
    stateNameById,
  );

  const finalPartition =
    partitionIterations[partitionIterations.length - 1]?.afterGroups.map(
      (group) => group.stateIds,
    ) ?? initialPartition;

  const distinguishabilityIterations = buildDistinguishabilityIterations(
    orderedStates,
    alphabet,
    delta,
    new Set(acceptStates.map((state) => state.id)),
    stateNameById,
  );

  const { equivalenceClasses, classNameByStateId } = buildEquivalenceClasses(
    finalPartition,
    alphabet,
    delta,
    orderedStates,
    stateNameById,
  );

  const minimizedTransitionTable = buildMinimizedTransitionTable(
    equivalenceClasses,
    classNameByStateId,
    alphabet,
    delta,
    automaton,
    stateNameById,
  );

  const minimizedDfa = buildMinimizedAutomaton(minimizedTransitionTable, alphabet);

  return {
    originalFormalism: {
      states: orderedStates.map((state) => state.name),
      alphabet,
      initialState: initialState?.name ?? EMPTY_SET,
      acceptStates: acceptStates.map((state) => state.name),
    },
    partitionIterations,
    distinguishabilityIterations,
    equivalenceClasses,
    minimizedFormalism: {
      states: equivalenceClasses.map((ec) => ec.className),
      alphabet,
      initialState: minimizedTransitionTable.find((row) => row.isInitial)?.className ?? EMPTY_SET,
      acceptStates: minimizedTransitionTable
        .filter((row) => row.isAccept)
        .map((row) => row.className),
    },
    minimizedTransitionTable,
    minimizedDfa,
  };
}