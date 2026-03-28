import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronUp, Play, RotateCcw, SkipForward, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import type {
  AutomataAnalysisResult,
  AutomataSimulationResult,
  SimulationPath,
} from "@/lib/automata-api";
import { simulateAutomatonRequest } from "@/lib/automata-api";
import { displayWord, getTheorySnapshot } from "@/lib/automata";

interface StringSimulatorProps {
  data: AutomataData;
  analysis?: AutomataAnalysisResult;
  analysisLoading: boolean;
  analysisError?: string | null;
  onHighlight: (states: Set<string>) => void;
}

type SimStatus = "idle" | "running" | "accepted" | "rejected";

function formatStateSet(names: string[]) {
  return names.length > 0 ? `{${names.join(", ")}}` : "\u2205";
}

function formatInitialArgument(analysis?: AutomataAnalysisResult) {
  if (!analysis || analysis.initialStates.length === 0) return "q\u2080";
  if (analysis.automatonType === "DFA") return analysis.initialStates[0]?.name ?? "q\u2080";
  return formatStateSet(analysis.initialStates.map((state) => state.name));
}

function getVisibleTuples(path: SimulationPath, currentStepIndex: number, revealAll: boolean) {
  if (revealAll) {
    return path.steps.map((step) => `(${step.fromName}, ${step.displaySymbol}, ${step.toName})`);
  }

  if (currentStepIndex < 0) return [];

  return path.steps
    .filter((step) => step.consumedIndex <= currentStepIndex)
    .map((step) => `(${step.fromName}, ${step.displaySymbol}, ${step.toName})`);
}

function renderPathCard(
  path: SimulationPath,
  tone: "accepted" | "rejected",
  index: number,
  currentStepIndex: number,
  revealAll: boolean,
) {
  const tuples = getVisibleTuples(path, currentStepIndex, revealAll);
  const toneClass =
    tone === "accepted"
      ? "border-green-500/20 bg-green-500/5"
      : "border-destructive/20 bg-destructive/5";
  const resultLabel =
    tone === "accepted"
      ? `Acepta en ${path.stateNames[path.stateNames.length - 1] ?? "-"}`
      : `Rechaza en ${path.stateNames[path.stateNames.length - 1] ?? "-"}`;

  return (
    <div key={`${tone}-${index}`} className={`rounded-lg border px-3 py-2 text-xs ${toneClass}`}>
      <p className="font-medium text-foreground">Traza {index + 1}</p>
      {tuples.length > 0 ? (
        <div className="mt-2 space-y-1 font-mono text-foreground">
          {tuples.map((tuple, tupleIndex) => (
            <p key={`${tone}-${index}-${tupleIndex}`}>{tuple}</p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">
          La traza se construirá al avanzar la simulación.
        </p>
      )}
      {(revealAll || currentStepIndex >= path.haltedAtIndex) && (
        <p className="mt-2 text-muted-foreground">{resultLabel}</p>
      )}
    </div>
  );
}

function getAcceptanceCriterion(type: NonNullable<AutomataAnalysisResult>["automatonType"]) {
  if (type === "DFA") return "Acepta w si \u03b4*(q\u2080, w) \u2208 F.";
  return "Acepta w si \u03b4*(q\u2080, w) \u2229 F \u2260 \u2205.";
}

function getDeltaStarLine(
  analysis: NonNullable<AutomataAnalysisResult>,
  simulation: AutomataSimulationResult,
  traceIndex: number,
) {
  const trace = simulation.deltaStar[traceIndex];
  const initialArgument = formatInitialArgument(analysis);

  if (traceIndex === 0) {
    if (analysis.automatonType === "DFA") {
      return `Base: \u03b4*(${initialArgument}, \u03b5) = ${trace.closureStateNames[0] ?? "\u2205"}`;
    }

    if (analysis.automatonType === "NFA") {
      return `Base: \u03b4*(${initialArgument}, \u03b5) = ${formatStateSet(trace.closureStateNames)}`;
    }

    return `Base: \u03b4*(${initialArgument}, \u03b5) = Clausura-\u03b5(${initialArgument}) = ${formatStateSet(trace.closureStateNames)}`;
  }

  const previous = simulation.deltaStar[traceIndex - 1];
  const previousPrefix = previous.prefix === "" ? "\u03b5" : previous.prefix;
  const consumedSymbol = trace.displayConsumedSymbol ?? trace.consumedSymbol ?? "\u03b5";
  const currentPrefix = trace.prefix === "" ? "\u03b5" : trace.prefix;

  if (analysis.automatonType === "DFA") {
    return `Recursiva: \u03b4*(${initialArgument}, ${currentPrefix}) = \u03b4(\u03b4*(${initialArgument}, ${previousPrefix}), ${consumedSymbol}) = \u03b4(${previous.closureStateNames[0] ?? "\u2205"}, ${consumedSymbol}) = ${trace.closureStateNames[0] ?? "\u2205"}`;
  }

  if (analysis.automatonType === "NFA") {
    return `Recursiva: \u03b4*(${initialArgument}, ${currentPrefix}) = \u22c3 \u03b4(p, ${consumedSymbol}), p \u2208 ${formatStateSet(previous.closureStateNames)} = ${formatStateSet(trace.closureStateNames)}`;
  }

  return `Recursiva: \u03b4*(${initialArgument}, ${currentPrefix}) = Clausura-\u03b5(\u22c3 \u03b4(p, ${consumedSymbol}), p \u2208 ${formatStateSet(previous.closureStateNames)}) = ${formatStateSet(trace.closureStateNames)}`;
}

export function StringSimulator({
  data,
  analysis,
  analysisLoading,
  analysisError,
  onHighlight,
}: StringSimulatorProps) {
  const [input, setInput] = useState("");
  const [stepIndex, setStepIndex] = useState(-1);
  const [status, setStatus] = useState<SimStatus>("idle");
  const [simulation, setSimulation] = useState<AutomataSimulationResult | null>(null);
  const [showDeltaStar, setShowDeltaStar] = useState(false);

  const theoryKey = useMemo(() => JSON.stringify(getTheorySnapshot(data)), [data]);
  const simulationMutation = useMutation({
    mutationFn: (word: string) => simulateAutomatonRequest(data, word),
  });

  const hasStates = data.states.length > 0;
  const hasInitial = (analysis?.initialStates.length ?? 0) > 0;
  const hasAccept = (analysis?.acceptStates.length ?? 0) > 0;
  const activeStep = simulation && stepIndex >= 0 ? simulation.deltaStar[stepIndex] : null;
  const lastStepIndex = simulation ? simulation.deltaStar.length - 1 : -1;

  const highlightedIds = useMemo(
    () => activeStep?.closureStateIds ?? [],
    [activeStep],
  );

  const syncHighlight = useCallback(
    (result: AutomataSimulationResult | null, nextStepIndex: number) => {
      const nextStep = result && nextStepIndex >= 0 ? result.deltaStar[nextStepIndex] : null;
      onHighlight(new Set(nextStep?.closureStateIds ?? []));
    },
    [onHighlight],
  );

  const reset = useCallback(() => {
    setSimulation(null);
    setStepIndex(-1);
    setStatus("idle");
    setShowDeltaStar(false);
    onHighlight(new Set());
  }, [onHighlight]);

  useEffect(() => {
    setSimulation(null);
    setStepIndex(-1);
    setStatus("idle");
    setShowDeltaStar(false);
    onHighlight(new Set());
  }, [onHighlight, theoryKey]);

  const commitResult = useCallback(
    (result: AutomataSimulationResult, nextStepIndex: number, nextStatus: SimStatus) => {
      setSimulation(result);
      setStepIndex(nextStepIndex);
      setStatus(nextStatus);
      syncHighlight(result, nextStepIndex);
    },
    [syncHighlight],
  );

  const execute = useCallback(async () => {
    const result = await simulationMutation.mutateAsync(input);
    const nextStepIndex = result.deltaStar.length - 1;
    commitResult(result, nextStepIndex, result.accepted ? "accepted" : "rejected");
  }, [commitResult, input, simulationMutation]);

  const stepForward = useCallback(async () => {
    if (!simulation || simulation.word !== input) {
      const result = await simulationMutation.mutateAsync(input);
      commitResult(
        result,
        0,
        result.deltaStar.length > 1 ? "running" : result.accepted ? "accepted" : "rejected",
      );
      return;
    }

    if (stepIndex >= lastStepIndex) return;

    const nextStepIndex = stepIndex + 1;
    const nextStatus =
      nextStepIndex >= lastStepIndex
        ? simulation.accepted
          ? "accepted"
          : "rejected"
        : "running";

    commitResult(simulation, nextStepIndex, nextStatus);
  }, [commitResult, input, lastStepIndex, simulation, simulationMutation, stepIndex]);

  const revealAllTraces = status === "accepted" || status === "rejected";

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Simulación</h3>
        <p className="text-xs text-muted-foreground">
          {analysis?.automatonType
            ? `Tipo detectado: ${analysis.automatonType === "NFA_EPSILON" ? "NFA-ε" : analysis.automatonType}`
            : "Simula palabras y recorre sus trazas paso a paso."}
        </p>
      </div>

      {!hasStates && (
        <p className="text-xs text-muted-foreground">Agrega estados al canvas para simular.</p>
      )}

      {hasStates && analysisLoading && (
        <p className="text-xs text-muted-foreground">Analizando el autómata...</p>
      )}

      {hasStates && analysisError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          No se pudo obtener el análisis del autómata.
        </div>
      )}

      {hasStates && !analysisLoading && !hasInitial && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Define al menos un estado inicial para simular.
        </div>
      )}

      {hasStates && !analysisLoading && !hasAccept && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          No hay estados de aceptación. Doble clic en un estado para marcarlo como final.
        </div>
      )}

      {hasStates && (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="Ej: 1010"
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                reset();
              }}
              className="h-9 font-mono text-sm"
            />
          </div>

          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="default"
              className="flex-1 gap-1.5"
              onClick={() => void execute()}
              disabled={!hasInitial || analysisLoading || simulationMutation.isPending}
            >
              <Play className="h-3.5 w-3.5" /> Ejecutar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => void stepForward()}
              disabled={!hasInitial || analysisLoading || simulationMutation.isPending || status === "accepted" || status === "rejected"}
            >
              <SkipForward className="h-3.5 w-3.5" /> Paso
            </Button>
            <Button size="sm" variant="ghost" onClick={reset} disabled={status === "idle" && input === ""}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {status !== "idle" && status !== "running" && simulation && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                status === "accepted"
                  ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {status === "accepted" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {status === "accepted"
                ? `Palabra aceptada: ${displayWord(simulation.word)}`
                : `Palabra rechazada: ${displayWord(simulation.word)}`}
            </div>
          )}

          {simulation && analysis && (
            <>
              <section className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Función de transición extendida
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Base y paso recursivo aplicados a la palabra actual.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setShowDeltaStar((current) => !current)}
                  >
                    {showDeltaStar ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    {showDeltaStar ? "Ocultar δ*" : "Mostrar δ*"}
                  </Button>
                </div>

                {showDeltaStar && (
                  <div className="space-y-2">
                    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                      <p className="font-mono text-foreground">
                        {analysis.automatonType === "DFA"
                          ? "\u03b4*: Q \u00d7 \u03a3* \u2192 Q"
                          : "\u03b4*: Q \u00d7 \u03a3* \u2192 2^Q"}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {getAcceptanceCriterion(analysis.automatonType)}
                      </p>
                    </div>

                    {simulation.deltaStar
                      .filter((_, index) => index <= Math.max(stepIndex, 0))
                      .map((_, index) => {
                        const isActive = index === stepIndex;
                        return (
                          <div
                            key={`delta-star-${index}`}
                            className={`rounded-lg border px-3 py-2 text-xs ${
                              isActive ? "border-primary bg-primary/5" : "bg-card"
                            }`}
                          >
                            <p className="font-mono text-foreground">
                              {getDeltaStarLine(analysis, simulation, index)}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                )}
              </section>

              <section className="space-y-2 rounded-lg border p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Trazas paso a paso
                  </p>
                </div>

                {simulation.acceptedPaths.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">Trazas de aceptación</p>
                    {simulation.acceptedPaths.map((path, index) =>
                      renderPathCard(path, "accepted", index, stepIndex, revealAllTraces),
                    )}
                  </div>
                )}

                {simulation.rejectedPaths.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-destructive">Trazas de rechazo</p>
                    {simulation.rejectedPaths.map((path, index) =>
                      renderPathCard(path, "rejected", index, stepIndex, revealAllTraces),
                    )}
                  </div>
                )}
              </section>

              <section className="rounded-lg border p-3 text-xs text-muted-foreground">
                <p>
                  Estados activos resaltados:{" "}
                  <span className="font-mono text-foreground">
                    {highlightedIds.length > 0 ? `{${activeStep?.closureStateNames.join(", ")}}` : "\u2205"}
                  </span>
                </p>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
