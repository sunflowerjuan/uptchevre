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

/**
 * Resultado detallado de comparar un símbolo concreto para un par de estados.
 *
 * Esta estructura existe para que el frontend pueda explicar, símbolo por
 * símbolo, por qué un par de estados termina marcado como distinguible o por
 * qué todavía permanece sin marcar.
 */
export type SymbolComparison = {
  symbol: string;
  targetA: string;        // nombre δ(p, a)
  targetB: string;        // nombre δ(q, a)
  targetAInF: boolean;
  targetBInF: boolean;
  pairAlreadyMarked: boolean;
  marks: boolean;         // true = este símbolo provoca que el par sea marcado
};

/**
 * Payload serializable que viaja dentro del campo `reason` de la tabla de
 * distinguibilidad.
 *
 * El backend lo codifica como texto para no cambiar la forma pública del
 * contrato, pero internamente contiene un objeto rico con resumen y detalle.
 */
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

// Prefijo estable para detectar en frontend si `reason` contiene un JSON
// enriquecido y no un texto plano heredado de una versión anterior.
export const RICH_REASON_PREFIX = "__rich__";

// Estado trampa implícito utilizado cuando falta una transición en el DFA de
// entrada. No se serializa como estado real del autómata, pero sí participa en
// el razonamiento formal de minimización.
const IMPLICIT_TRAP_ID = "__implicit_trap__";
const IMPLICIT_TRAP_NAME = "\u2205";

/**
 * Serializa un `RichReason` en el formato transportable esperado por el panel.
 *
 * Propósito:
 * Mantener compatibilidad con el contrato existente, donde `reason` sigue
 * siendo un string, pero ahora puede encapsular información estructurada.
 *
 * Parámetros:
 * - `r: RichReason`
 *   Motivo enriquecido ya construido por el algoritmo.
 *
 * Valor de retorno:
 * - `string`
 *   Texto con prefijo reconocible más el JSON serializado.
 */
function encodeRichReason(r: RichReason): string {
  return RICH_REASON_PREFIX + JSON.stringify(r);
}

/**
 * Intenta decodificar un `reason` enriquecido recibido por el frontend o por
 * cualquier consumidor del resultado de minimización.
 *
 * Parámetros:
 * - `reason: string | undefined`
 *   Texto serializado almacenado en una celda de la tabla.
 *
 * Valor de retorno:
 * - `RichReason | null`
 *   El objeto enriquecido si el prefijo y el JSON son válidos; `null` en caso
 *   contrario.
 */
export function decodeRichReason(reason: string | undefined): RichReason | null {
  if (!reason?.startsWith(RICH_REASON_PREFIX)) return null;
  try {
    return JSON.parse(reason.slice(RICH_REASON_PREFIX.length)) as RichReason;
  } catch {
    return null;
  }
}

/**
 * Verifica que el autómata sea apto para el algoritmo de minimización.
 *
 * Propósito:
 * Rechazar estructuras para las que el procedimiento implementado no está
 * definido, como autómatas no deterministas o sin estado inicial.
 *
 * Parámetros:
 * - `automaton: AutomataData`
 *   Autómata candidato a minimización.
 *
 * Valor de retorno:
 * - `void`
 *   No devuelve valor; lanza errores si alguna precondición falla.
 *
 * Decisión técnica:
 * A diferencia de versiones anteriores, las transiciones faltantes ya no
 * provocan error. Se interpretan como salidas hacia un estado trampa implícito
 * `∅`, lo que permite minimizar DFA parciales sin mutar la estructura de
 * entrada.
 */
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

  // No se exige completitud explícita. El algoritmo trabaja como si cada
  // transición ausente fuera una flecha hacia un estado trampa implícito.
}

/**
 * Genera una lista ordenada y simplificada de estados para el algoritmo.
 *
 * Propósito:
 * Separar la información estrictamente necesaria para la minimización del resto
 * de metadatos gráficos del editor.
 */
function buildOrderedStates(automaton: AutomataData): OrderedState[] {
  const nameMap = getStateNameMap(automaton);
  return automaton.states.map((state) => ({
    id: state.id,
    name: nameMap.get(state.id) ?? state.id,
    isInitial: state.isInitial,
    isAccept: state.isAccept,
  }));
}

/**
 * Construye una tabla δ compacta indexada por `estado::simbolo`.
 *
 * Propósito:
 * Evitar búsquedas repetidas sobre el arreglo de transiciones mientras se
 * calculan particiones, propagaciones y clases de equivalencia.
 */
function buildDelta(automaton: AutomataData): Map<string, string> {
  const delta = new Map<string, string>();
  for (const transition of automaton.transitions) {
    delta.set(`${transition.from}::${normalizeSymbol(transition.symbol)}`, transition.to);
  }
  return delta;
}

/**
 * Resuelve δ(stateId, symbol). Si no existe transición, devuelve IMPLICIT_TRAP_ID,
 * que representa el estado trampa ∅ implícito (no aceptor, sin estado real).
 */
function resolveTarget(delta: Map<string, string>, stateId: string, symbol: string): string {
  return delta.get(`${stateId}::${symbol}`) ?? IMPLICIT_TRAP_ID;
}

/**
 * Genera una clave canónica para representar un par no ordenado de estados.
 *
 * Propósito:
 * Asegurar que `(p, q)` y `(q, p)` apunten a la misma celda lógica de la tabla
 * de distinguibilidad.
 */
function pairKey(a: string, b: string, orderIndex: Map<string, number>) {
  const ia = orderIndex.get(a) ?? -1;
  const ib = orderIndex.get(b) ?? -1;
  return ia > ib ? `${a}::${b}` : `${b}::${a}`;
}

function formatGroupNames(group: string[], stateNameById: Map<string, string>) {
  return group.map((stateId) => stateNameById.get(stateId) ?? stateId);
}

/**
 * Convierte una partición interna de IDs a una estructura descriptiva lista
 * para la interfaz.
 */
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

/**
 * Obtiene el índice del bloque de partición al que pertenece un estado.
 *
 * Regla especial:
 * El estado trampa implícito no pertenece a ningún bloque real del DFA, por lo
 * que se representa con `-1`. Ese valor actúa como firma estable para
 * distinguir transiciones ausentes de transiciones que sí caen en grupos
 * existentes.
 */
function getGroupIndex(partition: string[][], stateId: string): number {
  // El estado trampa implícito siempre devuelve -1 (grupo propio, no aceptor)
  if (stateId === IMPLICIT_TRAP_ID) return -1;
  return partition.findIndex((group) => group.includes(stateId));
}

/**
 * Construye la secuencia de refinamientos de partición.
 *
 * Propósito:
 * Mostrar cómo se separan los estados a medida que se detectan diferencias en
 * sus transiciones hacia grupos ya conocidos.
 *
 * Flujo interno:
 * 1. Parte de la partición actual.
 * 2. Calcula, para cada estado, una firma basada en el grupo destino de cada
 *    símbolo.
 * 3. Divide el grupo original en buckets con firmas distintas.
 * 4. Registra las causas concretas de cada separación.
 * 5. Repite hasta que la partición se estabiliza.
 */
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

      // Estados con la misma firma de transiciones permanecen juntos; firmas
      // diferentes implican que el grupo debe dividirse.
      const signatureBuckets = new Map<string, string[]>();
      for (const stateId of group) {
        const signature = alphabet
          .map((symbol) => {
            // resolveTarget devuelve IMPLICIT_TRAP_ID si no hay transición,
            // y getGroupIndex lo mapea a -1 (grupo trampa implícito).
            const target = resolveTarget(delta, stateId, symbol);
            return getGroupIndex(current, target);
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

      // Si aparecen múltiples buckets, el grupo dejó de ser homogéneo y se
      // descompone en subgrupos más finos.
      next.push(...buckets);
      const referenceState = buckets[0][0];
      for (let bucketIndex = 1; bucketIndex < buckets.length; bucketIndex += 1) {
        const comparedState = buckets[bucketIndex][0];
        const separatingSymbol = alphabet.find((symbol) => {
          const referenceTarget = resolveTarget(delta, referenceState, symbol);
          const comparedTarget = resolveTarget(delta, comparedState, symbol);
          return getGroupIndex(current, referenceTarget) !== getGroupIndex(current, comparedTarget);
        });

        if (!separatingSymbol) continue;

        const referenceTarget = resolveTarget(delta, referenceState, separatingSymbol);
        const comparedTarget = resolveTarget(delta, comparedState, separatingSymbol);

        // Para la causa de split, mostramos ∅ si el destino es el trampa implícito
        const referenceTargetName =
          referenceTarget === IMPLICIT_TRAP_ID
            ? IMPLICIT_TRAP_NAME
            : (stateNameById.get(referenceTarget) ?? referenceTarget);
        const comparedTargetName =
          comparedTarget === IMPLICIT_TRAP_ID
            ? IMPLICIT_TRAP_NAME
            : (stateNameById.get(comparedTarget) ?? comparedTarget);

        splitCauses.push({
          groupId: `P${groupIndex + 1}`,
          stateAId: referenceState,
          stateAName: stateNameById.get(referenceState) ?? referenceState,
          stateBId: comparedState,
          stateBName: stateNameById.get(comparedState) ?? comparedState,
          symbol: separatingSymbol,
          targetAStateId: referenceTarget === IMPLICIT_TRAP_ID ? "" : referenceTarget,
          targetAStateName: referenceTargetName,
          targetBStateId: comparedTarget === IMPLICIT_TRAP_ID ? "" : comparedTarget,
          targetBStateName: comparedTargetName,
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

/**
 * Construye las iteraciones de la tabla de distinguibilidad.
 *
 * Propósito:
 * Representar el algoritmo de marcado de pares distinguibles, incluyendo:
 * - marcado base por diferencia entre aceptación y no aceptación;
 * - propagación cuando un símbolo lleva a un par ya marcado.
 *
 * Decisión técnica:
 * El estado trampa implícito no se materializa como una fila o columna real,
 * pero sí participa cuando una transición ausente debe compararse frente a una
 * transición existente.
 */
function buildDistinguishabilityIterations(
  orderedStates: OrderedState[],
  alphabet: string[],
  delta: Map<string, string>,
  acceptSet: Set<string>,
  stateNameById: Map<string, string>,
): DfaDistinguishabilityIteration[] {
  // El trampa implícito tiene un order index más alto que todos los estados reales
  const orderIndex = new Map(orderedStates.map((state, index) => [state.id, index]));
  orderIndex.set(IMPLICIT_TRAP_ID, orderedStates.length); // siempre el último

  const markedRich = new Map<string, MarkedReason>();
  const iterations: DfaDistinguishabilityIteration[] = [];

  /**
   * Determina si un target ID está en el conjunto de aceptación.
   * El trampa implícito nunca es aceptor.
   */
  function isAccept(targetId: string): boolean {
    return targetId !== IMPLICIT_TRAP_ID && acceptSet.has(targetId);
  }

  /**
   * Nombre legible de un target (∅ si es el trampa implícito).
   */
  function targetName(targetId: string): string {
    if (targetId === IMPLICIT_TRAP_ID) return IMPLICIT_TRAP_NAME;
    return stateNameById.get(targetId) ?? targetId;
  }

  // ─── Marcado base: p ∈ F y q ∉ F (o viceversa) ──────────────────────────────
  for (let row = 1; row < orderedStates.length; row += 1) {
    for (let column = 0; column < row; column += 1) {
      const stateA = orderedStates[row];
      const stateB = orderedStates[column];
      if (acceptSet.has(stateA.id) !== acceptSet.has(stateB.id)) {
        const aInF = acceptSet.has(stateA.id);
        const comparisons: SymbolComparison[] = alphabet.map((symbol) => {
          const targetAId = resolveTarget(delta, stateA.id, symbol);
          const targetBId = resolveTarget(delta, stateB.id, symbol);
          return {
            symbol,
            targetA: targetName(targetAId),
            targetB: targetName(targetBId),
            targetAInF: isAccept(targetAId),
            targetBInF: isAccept(targetBId),
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

  /**
   * Materializa una fotografía de la tabla en una iteración concreta.
   *
   * Si `finalIteration` es verdadero, todo par no marcado se interpreta ya como
   * equivalente.
   */
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

  // ─── Propagación ─────────────────────────────────────────────────────────────
  let iteration = 1;
  while (true) {
    const newlyMarked: Array<{ key: string; info: MarkedReason }> = [];

    for (let row = 1; row < orderedStates.length; row += 1) {
      for (let column = 0; column < row; column += 1) {
        const stateA = orderedStates[row];
        const stateB = orderedStates[column];
        const currentKey = pairKey(stateA.id, stateB.id, orderIndex);
        if (markedRich.has(currentKey)) continue;

        const comparisons: SymbolComparison[] = [];
        let markingSymbol: string | null = null;

        for (const symbol of alphabet) {
          const targetAId = resolveTarget(delta, stateA.id, symbol);
          const targetBId = resolveTarget(delta, stateB.id, symbol);
          const sameTarget = targetAId === targetBId;

          // Dos destinos distintos: puede haber propagación.
          // Si uno es el trampa y el otro no, el par destino es (real, ∅).
          // Necesitamos ver si ese par está marcado.
          // El trampa implícito NO está en orderedStates, por lo que no tiene
          // una clave en markedRich por sí solo. Sin embargo, cualquier par
          // (estado_real, ∅) donde estado_real sea aceptor ya fue marcado en
          // la iteración base (porque ∅ no es aceptor).
          // Si estado_real no es aceptor, ese par no está marcado (equivalentes).
          let targetPairAlreadyMarked = false;
          if (!sameTarget) {
            const oneTrap = targetAId === IMPLICIT_TRAP_ID || targetBId === IMPLICIT_TRAP_ID;
            if (oneTrap) {
              // Par (real, ∅): marcado iff el estado real es aceptor
              const realId = targetAId === IMPLICIT_TRAP_ID ? targetBId : targetAId;
              targetPairAlreadyMarked = acceptSet.has(realId);
            } else {
              // Ambos son estados reales: consultamos la tabla normal
              targetPairAlreadyMarked = markedRich.has(pairKey(targetAId, targetBId, orderIndex));
            }
          }

          const marks = !sameTarget && targetPairAlreadyMarked;

          comparisons.push({
            symbol,
            targetA: targetName(targetAId),
            targetB: targetName(targetBId),
            targetAInF: isAccept(targetAId),
            targetBInF: isAccept(targetBId),
            pairAlreadyMarked: targetPairAlreadyMarked,
            marks,
          });

          if (marks && markingSymbol === null) {
            markingSymbol = symbol;
          }
        }

        // El primer símbolo que demuestre propagación es suficiente para marcar
        // el par, pero se conservan todas las comparaciones para la explicación
        // visual del frontend.
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

/**
 * Construye las clases de equivalencia definitivas a partir de la partición
 * final estabilizada.
 *
 * Propósito:
 * Convertir la salida del refinamiento en clases nombradas (`q0''`, `q1''`,
 * ...) y explicar por qué sus miembros pueden fusionarse.
 */
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
  // El trampa implícito mapea a ∅ en la tabla minimizada
  classNameByStateId.set(IMPLICIT_TRAP_ID, EMPTY_SET);

  const equivalenceClasses: DfaEquivalenceClass[] = classes.map((group, index) => {
    const className = `q${index}''`;
    const symbolChecks: DfaEquivalenceSymbolCheck[] = alphabet.map((symbol) => ({
      symbol,
      mappings: group.map((stateId) => {
        const targetStateId = resolveTarget(delta, stateId, symbol);
        const isTrap = targetStateId === IMPLICIT_TRAP_ID;
        return {
          stateId,
          stateName: stateNameById.get(stateId) ?? stateId,
          targetStateId: isTrap ? "" : targetStateId,
          targetStateName: isTrap ? IMPLICIT_TRAP_NAME : (stateNameById.get(targetStateId) ?? targetStateId),
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

/**
 * Construye la tabla de transición del DFA minimizado usando un representante
 * por cada clase de equivalencia.
 *
 * Justificación:
 * Dentro de una misma clase, todos los estados son indistinguibles respecto al
 * lenguaje aceptado, por lo que cualquiera de ellos puede actuar como
 * representante sin alterar el resultado formal.
 */
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
        const targetStateId = resolveTarget(delta, representative, symbol);
        return {
          symbol,
          targetClassName: classNameByStateId.get(targetStateId) ?? EMPTY_SET,
          targetStateId: targetStateId === IMPLICIT_TRAP_ID ? "" : targetStateId,
          targetStateName:
            targetStateId === IMPLICIT_TRAP_ID
              ? IMPLICIT_TRAP_NAME
              : (stateNameById.get(targetStateId) ?? targetStateId),
        };
      }),
    };
  });
}

/**
 * Genera un `AutomataData` listo para volver a cargarse en el editor.
 *
 * Propósito:
 * Transformar la tabla minimizada en una representación gráfica simple con
 * coordenadas automáticas y transiciones explícitas entre clases reales.
 *
 * Limitación:
 * Las transiciones hacia el estado trampa implícito se omiten del autómata
 * visual final. Se mantienen en la tabla como `∅`, pero no se dibuja un nodo
 * extra solo para reflejar ausencias de transición.
 */
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
    row.transitions
      // Omitir transiciones que van al trampa implícito (∅) en el DFA minimizado
      .filter((transition) => transition.targetClassName !== EMPTY_SET)
      .map((transition, index) => ({
        id: `min-${row.className}-${transition.symbol}-${index}`,
        from: stateIdByClassName.get(row.className) ?? "",
        to: stateIdByClassName.get(transition.targetClassName) ?? "",
        symbol: transition.symbol,
      })),
  );

  return { states, transitions, alphabet: [...alphabet] };
}

/**
 * Ejecuta la minimización completa del DFA y compone el resultado final.
 *
 * Propósito:
 * Orquestar todo el flujo: validación, partición inicial, refinamiento,
 * distinguibilidad, clases de equivalencia, tabla minimizada y autómata
 * reducido listo para el frontend.
 *
 * Parámetros:
 * - `automaton: AutomataData`
 *   DFA a minimizar.
 *
 * Valor de retorno:
 * - `DfaMinimizationResult`
 *   Resultado integral con formalismo original, pasos intermedios y autómata
 *   minimizado.
 */
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
