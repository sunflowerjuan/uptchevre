import { ScrollArea } from "@/components/ui/scroll-area";
import { EPSILON_DISPLAY } from "@/lib/automata";
import type { AutomataAnalysisResult } from "@/lib/automata-api";

/**
 * Presentacion visual del formalismo.
 *
 * Este componente muestra en pantalla la interpretacion matematica del
 * automata ya analizado:
 * - 5-tupla
 * - matriz de transicion
 * - definiciones explicitas de FT
 * - clausura-e por estado cuando aplica
 */
export interface FormalismTupleLabels {
  q?: string;
  sigma?: string;
  delta?: string;
  q0?: string;
  f?: string;
}

interface FormalismPanelProps {
  automatonName?: string;
  rootId?: string;
  tupleSectionId?: string;
  matrixSectionId?: string;
  transitionSectionId?: string;
  closureSectionId?: string;
  hasStates: boolean;
  analysis?: AutomataAnalysisResult;
  isLoading: boolean;
  error?: string | null;
  embedded?: boolean;
  omitEmptyTransitionDefinitions?: boolean;
  hideTransitionFormulaLines?: boolean;
  transitionSectionBeforeMatrix?: boolean;
  tupleLabels?: FormalismTupleLabels;
}

const SIGMA = "\u03a3";
const DELTA = "\u03b4";
const EMPTY_SET = "\u2205";

function getTupleLabel(type: AutomataAnalysisResult["automatonType"]) {
  if (type === "NFA_EPSILON") return "NFA-\u03b5";
  return type;
}

function getTransitionFormula(type: AutomataAnalysisResult["automatonType"]) {
  if (type === "DFA") return `${DELTA}: Q × ${SIGMA} → Q`;
  if (type === "NFA") return `${DELTA}: Q × ${SIGMA} → 2^Q`;
  return `${DELTA}: Q × (${SIGMA} ∪ {${EPSILON_DISPLAY}}) → 2^Q`;
}

function getGroupedTransitions(analysis: AutomataAnalysisResult) {
  const grouped = new Map<string, string[]>();

  for (const transition of analysis.transitions) {
    const key = `${transition.fromName}::${transition.displaySymbol}`;
    const list = grouped.get(key) ?? [];
    list.push(transition.toName);
    grouped.set(key, Array.from(new Set(list)).sort());
  }

  return grouped;
}

function formatTargets(type: AutomataAnalysisResult["automatonType"], targets: string[]) {
  if (targets.length === 0) return EMPTY_SET;
  if (type === "DFA") return targets[0] ?? EMPTY_SET;
  return `{${targets.join(", ")}}`;
}

function getTransitionDefinitions(
  analysis: AutomataAnalysisResult,
  transitionSymbols: string[],
  groupedTransitions: Map<string, string[]>,
) {
  return analysis.states.flatMap((state) =>
    transitionSymbols.map((symbol) => ({
      key: `${state.id}-${symbol}`,
      stateName: state.name,
      symbol,
      value: formatTargets(
        analysis.automatonType,
        groupedTransitions.get(`${state.name}::${symbol}`) ?? [],
      ),
    })),
  );
}

export function FormalismPanel({
  automatonName = "A",
  rootId,
  tupleSectionId,
  matrixSectionId,
  transitionSectionId,
  closureSectionId,
  hasStates,
  analysis,
  isLoading,
  error,
  embedded = false,
  omitEmptyTransitionDefinitions = false,
  hideTransitionFormulaLines = false,
  transitionSectionBeforeMatrix = false,
  tupleLabels,
}: FormalismPanelProps) {
  if (!hasStates) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Agrega estados al canvas para ver el formalismo.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Analizando el autómata...
        </p>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-destructive">
          No fue posible calcular el formalismo del autómata.
        </p>
      </div>
    );
  }

  const transitionSymbols = analysis.supportsEpsilon
    ? [...analysis.alphabet, EPSILON_DISPLAY]
    : analysis.alphabet;
  const groupedTransitions = getGroupedTransitions(analysis);
  let transitionDefinitions = getTransitionDefinitions(
    analysis,
    transitionSymbols,
    groupedTransitions,
  );
  if (omitEmptyTransitionDefinitions) {
    transitionDefinitions = transitionDefinitions.filter((d) => d.value !== EMPTY_SET);
  }
  const initialNames = analysis.initialStates.map((state) => state.name);
  const acceptNames = analysis.acceptStates.map((state) => state.name);
  const q0Value =
    initialNames.length <= 1 ? initialNames[0] ?? EMPTY_SET : `{${initialNames.join(", ")}}`;

  const qL = tupleLabels?.q ?? "Q";
  const sigmaL = tupleLabels?.sigma ?? SIGMA;
  const deltaL = tupleLabels?.delta ?? DELTA;
  const q0L = tupleLabels?.q0 ?? "q₀";
  const fL = tupleLabels?.f ?? "F";

  const matrixSection = (
    <section id={matrixSectionId} className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Matriz de transición</p>
        {!hideTransitionFormulaLines && (
          <p className="font-mono text-xs text-muted-foreground">
            {getTransitionFormula(analysis.automatonType)}
          </p>
        )}
      </div>

      {transitionSymbols.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-semibold text-primary">Estado</th>
                {transitionSymbols.map((symbol) => (
                  <th key={symbol} className="px-3 py-2 text-center font-mono font-semibold">
                    {symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.states.map((state) => (
                <tr key={state.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono font-medium">
                    {state.isInitial ? "→" : ""}
                    {state.isAccept ? "*" : ""}
                    {state.name}
                  </td>
                  {transitionSymbols.map((symbol) => {
                    const targets = groupedTransitions.get(`${state.name}::${symbol}`) ?? [];
                    return (
                      <td key={`${state.id}-${symbol}`} className="px-3 py-2 text-center font-mono">
                        {formatTargets(analysis.automatonType, targets)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Agrega símbolos y transiciones para completar la tabla.
        </p>
      )}
    </section>
  );

  const transitionSection = (
    <section id={transitionSectionId} className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Función de transición</p>
        {!hideTransitionFormulaLines && (
          <p className="font-mono text-xs text-muted-foreground">
            {getTransitionFormula(analysis.automatonType)}
          </p>
        )}
      </div>

      {transitionDefinitions.length > 0 ? (
        <div className="space-y-1 rounded-lg border p-3 font-mono text-xs text-foreground">
          <p>
            {deltaL} = {"{"}
          </p>
          {transitionDefinitions.map((definition) => (
            <p key={definition.key} className="pl-3">
              {`${deltaL}(${definition.stateName}, ${definition.symbol}) = ${definition.value},`}
            </p>
          ))}
          <p>{"}"}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Agrega símbolos y transiciones para completar {deltaL}.
        </p>
      )}
    </section>
  );

  const inner = (
    <>
      <section id={tupleSectionId} className="space-y-3 rounded-lg border bg-card p-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {getTupleLabel(analysis.automatonType)}
          </p>
          <p className="font-mono text-sm text-foreground">
            {automatonName} = ({qL}, {sigmaL}, {deltaL}, {q0L}, {fL})
          </p>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <span className="font-semibold text-primary">{qL}</span>
            <span className="text-muted-foreground"> = {"{"}</span>
            <span className="font-mono">{analysis.states.map((state) => state.name).join(", ")}</span>
            <span className="text-muted-foreground">{"}"}</span>
          </div>

          <div>
            <span className="font-semibold text-primary">{sigmaL}</span>
            <span className="text-muted-foreground"> = {"{"}</span>
            <span className="font-mono">
              {analysis.alphabet.length > 0 ? analysis.alphabet.join(", ") : EMPTY_SET}
            </span>
            <span className="text-muted-foreground">{"}"}</span>
          </div>

          <div>
            <span className="font-semibold text-primary">{q0L}</span>
            <span className="text-muted-foreground"> = </span>
            <span className="font-mono">{q0Value}</span>
          </div>

          <div>
            <span className="font-semibold text-primary">{fL}</span>
            <span className="text-muted-foreground"> = {"{"}</span>
            <span className="font-mono">{acceptNames.length > 0 ? acceptNames.join(", ") : EMPTY_SET}</span>
            <span className="text-muted-foreground">{"}"}</span>
          </div>
        </div>
      </section>

      {transitionSectionBeforeMatrix ? (
        <>
          {transitionSection}
          {matrixSection}
        </>
      ) : (
        <>
          {matrixSection}
          {transitionSection}
        </>
      )}

      {analysis.supportsEpsilon && (
        <section id={closureSectionId} className="space-y-3 rounded-lg border bg-card p-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Clausura-{EPSILON_DISPLAY}</p>
            <p className="font-mono text-xs text-muted-foreground">
              Clausura-{EPSILON_DISPLAY}(q) = {"{"}p {"|"} q {"⇝"} p usando {EPSILON_DISPLAY}{"}"}
            </p>
          </div>

          <div className="space-y-2">
            {analysis.eClosures.map((closure) => (
              <div key={closure.stateId} className="rounded-md border px-3 py-2 text-xs">
                <span className="font-mono font-semibold text-foreground">
                  Clausura-{EPSILON_DISPLAY}({closure.stateName})
                </span>
                <span className="text-muted-foreground"> = </span>
                <span className="font-mono">
                  {closure.closureNames.length > 0
                    ? `{${closure.closureNames.join(", ")}}`
                    : EMPTY_SET}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );

  if (embedded) {
    return (
      <div id={rootId} className="space-y-5">
        {inner}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div id={rootId} className="space-y-5 p-4">
        {inner}
      </div>
    </ScrollArea>
  );
}
