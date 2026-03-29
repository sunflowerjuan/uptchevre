import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import type { AutomataAnalysisResult, NfaToDfaTransformationResult } from "@/lib/automata-api";
import { transformNfaToDfaRequest } from "@/lib/automata-api";
import { TransformationStepsSheet } from "@/components/TransformationStepsSheet";
import { getTheorySnapshot } from "@/lib/automata";

interface TransformationPanelProps {
  data: AutomataData;
  analysis?: AutomataAnalysisResult;
  analysisLoading: boolean;
  onLoadDfa: (dfa: AutomataData) => void;
}

const EMPTY_SET = "\u2205";
const SIGMA = "\u03a3";
const DELTA = "\u03b4";
const EPSILON = "\u03b5";

function formatTargetsFormalism(
  type: AutomataAnalysisResult["automatonType"],
  targets: string[],
): string {
  if (targets.length === 0) return EMPTY_SET;
  if (type === "DFA") return targets[0] ?? EMPTY_SET;
  return `{${targets.join(", ")}}`;
}

function getTransitionDefinitionsNfa(
  analysis: AutomataAnalysisResult,
  transitionSymbols: string[],
  grouped: Map<string, string[]>,
) {
  return analysis.states
    .flatMap((state) =>
      transitionSymbols.map((symbol) => ({
        key: `${state.id}-${symbol}`,
        stateName: state.name,
        symbol,
        value: formatTargetsFormalism(
          analysis.automatonType,
          grouped.get(`${state.name}::${symbol}`) ?? [],
        ),
      })),
    )
    .filter((def) => def.value !== EMPTY_SET);
}


function NfaFormalism({ analysis }: { analysis: AutomataAnalysisResult }) {
  const typeLabel = analysis.automatonType === "NFA_EPSILON" ? `NFA-${EPSILON}` : analysis.automatonType;

  const transitionSymbols =
    analysis.supportsEpsilon ? [...analysis.alphabet, EPSILON] : analysis.alphabet;

  const grouped = new Map<string, string[]>();
  for (const t of analysis.transitions) {
    const key = `${t.fromName}::${t.displaySymbol}`;
    const list = grouped.get(key) ?? [];
    list.push(t.toName);
    grouped.set(key, Array.from(new Set(list)).sort());
  }

  const q0Names = analysis.initialStates.map((s) => s.name);
  const q0Value = q0Names.length <= 1 ? (q0Names[0] ?? EMPTY_SET) : `{${q0Names.join(", ")}}`;
  const acceptNames = analysis.acceptStates.map((s) => s.name);
  const transitionDefinitions = getTransitionDefinitionsNfa(
    analysis,
    transitionSymbols,
    grouped,
  );

  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{typeLabel}</p>
        <p className="font-mono text-sm text-foreground">
          M = (Q, {SIGMA}, {DELTA}, q₀, F)
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <span className="font-semibold text-primary">Q</span>
          <span className="text-muted-foreground"> = {"{"}</span>
          <span className="font-mono">{analysis.states.map((s) => s.name).join(", ")}</span>
          <span className="text-muted-foreground">{"}"}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">{SIGMA}</span>
          <span className="text-muted-foreground"> = {"{"}</span>
          <span className="font-mono">
            {analysis.alphabet.length > 0 ? analysis.alphabet.join(", ") : EMPTY_SET}
          </span>
          <span className="text-muted-foreground">{"}"}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">q₀</span>
          <span className="text-muted-foreground"> = </span>
          <span className="font-mono">{q0Value}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">F</span>
          <span className="text-muted-foreground"> = {"{"}</span>
          <span className="font-mono">
            {acceptNames.length > 0 ? acceptNames.join(", ") : EMPTY_SET}
          </span>
          <span className="text-muted-foreground">{"}"}</span>
        </div>
      </div>

      {transitionSymbols.length > 0 && (
        <div className="space-y-3">
          {transitionDefinitions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">Función de transición</p>
              <div className="space-y-1 rounded-lg border p-3 font-mono text-xs text-foreground">
                <p>
                  {DELTA} = {"{"}
                </p>
                {transitionDefinitions.map((def) => (
                  <p key={def.key} className="pl-3">
                    {`${DELTA}(${def.stateName}, ${def.symbol}) = ${def.value},`}
                  </p>
                ))}
                <p>{"}"}</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-foreground">Matriz de transición</p>
            <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-semibold text-primary">Estado</th>
                  {transitionSymbols.map((sym) => (
                    <th key={sym} className="px-3 py-2 text-center font-mono font-semibold">
                      {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.states.map((state) => (
                  <tr key={state.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono font-medium">
                      {state.isInitial ? "\u2192" : ""}
                      {state.isAccept ? "*" : ""}
                      {state.name}
                    </td>
                    {transitionSymbols.map((sym) => {
                      const targets = grouped.get(`${state.name}::${sym}`) ?? [];
                      const cell =
                        targets.length === 0
                          ? EMPTY_SET
                          : analysis.automatonType === "DFA"
                          ? targets[0]!
                          : `{${targets.join(", ")}}`;
                      return (
                        <td key={sym} className="px-3 py-2 text-center font-mono">
                          {cell === EMPTY_SET ? (
                            <span className="text-muted-foreground">{EMPTY_SET}</span>
                          ) : (
                            cell
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DfaFormalism({ result }: { result: NfaToDfaTransformationResult }) {
  const { dfa, stateMapping, transformationTable } = result;

  const allStateLabels = stateMapping.map((r) => r.dfaStateName);
  const initialState = dfa.states.find((s) => s.isInitial);
  const initialLabel =
    stateMapping.find((r) => r.dfaStateId === initialState?.id)?.dfaStateName ?? EMPTY_SET;
  const acceptLabels = stateMapping
    .filter((r) => dfa.states.find((s) => s.id === r.dfaStateId)?.isAccept)
    .map((r) => r.dfaStateName);

  const dfaTransitionDefinitions = transformationTable
    .flatMap((row) =>
      row.transitions.map((t) => ({
        key: `${row.dfaStateId}-${t.symbol}`,
        stateName: row.dfaStateName,
        symbol: t.symbol,
        value: t.targetDfaStateName,
      })),
    )
    .filter((def) => def.value !== EMPTY_SET);

  return (
    <section className="space-y-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">AFD</p>
        <p className="font-mono text-sm text-foreground">
          M' = (Q', {SIGMA}, {DELTA}', q₀', F')
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <div>
          <span className="font-semibold text-primary">Q'</span>
          <span className="text-muted-foreground"> = {"{"}</span>
          <span className="font-mono">{allStateLabels.join(", ")}</span>
          <span className="text-muted-foreground">{"}"}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">{SIGMA}</span>
          <span className="text-muted-foreground"> = {"{"}</span>
          <span className="font-mono">
            {dfa.alphabet.length > 0 ? dfa.alphabet.join(", ") : EMPTY_SET}
          </span>
          <span className="text-muted-foreground">{"}"}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">q₀'</span>
          <span className="text-muted-foreground"> = </span>
          <span className="font-mono">{initialLabel}</span>
        </div>
        <div>
          <span className="font-semibold text-primary">F'</span>
          <span className="text-muted-foreground"> = {"{"}</span>
          <span className="font-mono">
            {acceptLabels.length > 0 ? acceptLabels.join(", ") : EMPTY_SET}
          </span>
          <span className="text-muted-foreground">{"}"}</span>
        </div>
      </div>

      <div className="space-y-3">
        {dfaTransitionDefinitions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-foreground">Función de transición</p>
            <div className="space-y-1 rounded-lg border p-3 font-mono text-xs text-foreground">
              <p>
                {DELTA}&apos; = {"{"}
              </p>
              {dfaTransitionDefinitions.map((def) => (
                <p key={def.key} className="pl-3">
                  {`${DELTA}'(${def.stateName}, ${def.symbol}) = ${def.value},`}
                </p>
              ))}
              <p>{"}"}</p>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">Matriz de transición</p>
          <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-semibold text-primary">Estado</th>
                {dfa.alphabet.map((sym) => (
                  <th key={sym} className="px-3 py-2 text-center font-mono font-semibold">
                    {sym}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transformationTable.map((row) => (
                <tr key={row.dfaStateId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono font-medium">
                    {row.isInitial ? "\u2192" : ""}
                    {row.isAccept ? "*" : ""}
                    {row.dfaStateName}
                  </td>
                  {row.transitions.map((t) => (
                    <td key={t.symbol} className="px-3 py-2 text-center font-mono">
                      {t.targetDfaStateName === EMPTY_SET ? (
                        <span className="text-muted-foreground">{EMPTY_SET}</span>
                      ) : (
                        t.targetDfaStateName
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TransformationPanel({
  data,
  analysis,
  analysisLoading,
  onLoadDfa,
}: TransformationPanelProps) {
  const [view, setView] = useState<"nfa" | "dfa" | "both">("nfa");
  const hadEffectiveResultRef = useRef(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [savedResult, setSavedResult] = useState<NfaToDfaTransformationResult | null>(null);
  const [savedNfaAnalysis, setSavedNfaAnalysis] = useState<AutomataAnalysisResult | null>(null);
  const [savedNfaData, setSavedNfaData] = useState<AutomataData | null>(null);
  const [savedNfaKey, setSavedNfaKey] = useState<string | null>(null);

  const enabled =
    data.states.length > 0 &&
    !analysisLoading &&
    analysis !== undefined &&
    analysis.automatonType !== "DFA";

  const transformationQuery = useQuery({
    queryKey: ["automata-transform", getTheorySnapshot(data)],
    queryFn: () => transformNfaToDfaRequest(data),
    enabled,
    refetchOnWindowFocus: false,
  });

  // Persist result + NFA analysis when transformation completes
  useEffect(() => {
    if (transformationQuery.data && analysis && analysis.automatonType !== "DFA") {
      setSavedResult(transformationQuery.data);
      setSavedNfaAnalysis(analysis);
      setSavedNfaData(data);
      setSavedNfaKey(JSON.stringify(getTheorySnapshot(data)));
    }
  }, [transformationQuery.data]);

  // Reset when the user edits the automaton (not when they just load the DFA)
  useEffect(() => {
    if (!savedNfaKey || !savedResult) return;
    const currentKey = JSON.stringify(getTheorySnapshot(data));
    const dfaKey = JSON.stringify(getTheorySnapshot(savedResult.dfa));
    if (currentKey !== savedNfaKey && currentKey !== dfaKey) {
      setSavedResult(null);
      setSavedNfaAnalysis(null);
      setSavedNfaData(null);
      setSavedNfaKey(null);
      setView("nfa");
    }
  }, [data]);

  const effectiveNfaAnalysis = savedNfaAnalysis ?? analysis;
  const effectiveResult = savedResult ?? transformationQuery.data ?? null;
  const isEditorDfaWithoutConversion =
    analysis?.automatonType === "DFA" && !effectiveResult;

  // Tras la primera conversión, mostrar AFN + AFD juntos sin salir del panel.
  useEffect(() => {
    if (effectiveResult) {
      if (!hadEffectiveResultRef.current) {
        setView("both");
        hadEffectiveResultRef.current = true;
      }
    } else {
      hadEffectiveResultRef.current = false;
    }
  }, [effectiveResult]);

  useEffect(() => {
    if (!effectiveResult && view === "both") {
      setView("nfa");
    }
  }, [effectiveResult, view]);

  if (data.states.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Agrega estados al canvas para transformar el autómata.
        </p>
      </div>
    );
  }

  if (analysisLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">Analizando el autómata...</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === "nfa" ? "default" : "outline"}
            className="min-w-0 flex-1"
            onClick={() => setView("nfa")}
          >
            {effectiveNfaAnalysis?.automatonType === "NFA_EPSILON" ? "NFA-ε" : "NFA"}
          </Button>
          <Button
            size="sm"
            variant={view === "both" ? "default" : "outline"}
            className="min-w-0 flex-1"
            disabled={!effectiveResult}
            onClick={() => setView("both")}
            title={
              effectiveResult
                ? "Ver AFN de entrada y AFD resultante"
                : "Disponible cuando exista una conversión"
            }
          >
            Ambos
          </Button>
          <Button
            size="sm"
            variant={view === "dfa" ? "default" : "outline"}
            className="min-w-0 flex-1"
            onClick={() => setView("dfa")}
          >
            AFD
          </Button>
        </div>

        {transformationQuery.isError && !savedResult && (
          <p className="text-xs text-destructive">
            {transformationQuery.error instanceof Error
              ? transformationQuery.error.message
              : "No fue posible completar la transformación."}
          </p>
        )}

        {(view === "nfa" || view === "both") && effectiveNfaAnalysis && (
          <>
            {view === "both" && effectiveResult && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Entrada (AFN)
              </p>
            )}
            <NfaFormalism analysis={effectiveNfaAnalysis} />
            {savedNfaData && JSON.stringify(getTheorySnapshot(data)) !== savedNfaKey && (
              <div className="px-0 pb-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => onLoadDfa(savedNfaData)}
                >
                  Cargar NFA en el editor
                </Button>
              </div>
            )}
          </>
        )}

        {(view === "dfa" || view === "both") && effectiveResult && (
          <>
            {view === "both" && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Resultado (AFD)
              </p>
            )}
            <DfaFormalism result={effectiveResult} />

            <div className="flex flex-col gap-2 px-0 pb-2">
              <Button size="sm" className="w-full" onClick={() => setStepsOpen(true)}>
                Mostrar paso a paso
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onLoadDfa(effectiveResult.dfa)}
              >
                Cargar AFD en el editor
              </Button>
            </div>
          </>
        )}

        {(view === "dfa" || view === "both") && !effectiveResult && (
          <>
            {transformationQuery.isPending && (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Transformando...</p>
              </div>
            )}
            {!transformationQuery.isPending && isEditorDfaWithoutConversion && (
              <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                La conversión AFN→AFD (subconjuntos) aparece aquí cuando el editor contiene un AFN.
                Este autómata ya es un AFD; usa la vista NFA para ver su descripción formal.
              </div>
            )}
            {!transformationQuery.isPending &&
              !isEditorDfaWithoutConversion &&
              view === "dfa" && (
                <div className="flex items-center justify-center py-8">
                  <p className="text-center text-sm text-muted-foreground">
                    Aún no hay resultado de conversión.
                  </p>
                </div>
              )}
          </>
        )}
      </div>

      {effectiveResult && (
        <TransformationStepsSheet
          open={stepsOpen}
          onOpenChange={setStepsOpen}
          result={effectiveResult}
        />
      )}
    </ScrollArea>
  );
}
