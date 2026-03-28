import { useCallback, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Play, RotateCcw, SkipForward, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AutomataData } from "@/hooks/useAutomataEditor";
import type {
  AutomataAnalysisResult,
  AutomataSimulationResult,
  SimulationPath,
} from "@/lib/automata-api";
import { simulateAutomatonRequest } from "@/lib/automata-api";
import { displayWord } from "@/lib/automata";

interface StringSimulatorProps {
  data: AutomataData;
  analysis?: AutomataAnalysisResult;
  analysisLoading: boolean;
  analysisError?: string | null;
  onHighlight: (states: Set<string>) => void;
}

type SimStatus = "idle" | "running" | "accepted" | "rejected";

function renderPath(path: SimulationPath) {
  if (path.steps.length === 0) {
    return path.stateNames.join(" -> ");
  }

  const chunks = [path.stateNames[0] ?? "-"];
  path.steps.forEach((step) => {
    chunks.push(`--${step.displaySymbol}-->`);
    chunks.push(step.toName);
  });

  return chunks.join(" ");
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
    onHighlight(new Set());
  }, [onHighlight]);

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
      commitResult(result, 0, result.deltaStar.length > 1 ? "running" : result.accepted ? "accepted" : "rejected");
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

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Simulacion</h3>
        <p className="text-xs text-muted-foreground">
          {analysis?.automatonType
            ? `Tipo detectado: ${analysis.automatonType}`
            : "Conecta el backend para calcular delta* y las trazas del automata."}
        </p>
      </div>

      {!hasStates && (
        <p className="text-xs text-muted-foreground">Agrega estados al canvas para simular.</p>
      )}

      {hasStates && analysisLoading && (
        <p className="text-xs text-muted-foreground">Analizando el automata...</p>
      )}

      {hasStates && analysisError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          No se pudo obtener el analisis del automata desde el backend.
        </div>
      )}

      {hasStates && !analysisLoading && !hasInitial && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          Define al menos un estado inicial para simular.
        </div>
      )}

      {hasStates && !analysisLoading && !hasAccept && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          No hay estados de aceptacion. Doble clic en un estado para marcarlo como final.
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
              className="font-mono text-sm h-9"
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

          {simulation && (
            <>
              <section className="space-y-2 rounded-lg border p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Trazas delta*
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cada paso muestra los estados alcanzables y el cierre usado por la simulacion.
                  </p>
                </div>

                <div className="space-y-2">
                  {simulation.deltaStar.map((trace) => {
                    const isActive = trace.index === stepIndex;
                    return (
                      <div
                        key={`${trace.index}-${trace.prefix}`}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          isActive ? "border-primary bg-primary/5" : "bg-card"
                        }`}
                      >
                        <p className="font-mono text-foreground">
                          {trace.index === 0
                            ? `delta*({${trace.reachableStateNames.join(", ")}}, epsilon)`
                            : `delta*({${simulation.deltaStar[trace.index - 1]?.closureStateNames.join(", ")}}, ${trace.displayConsumedSymbol})`}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          Reachable: {trace.reachableStateNames.length > 0 ? `{${trace.reachableStateNames.join(", ")}}` : "{}"}
                        </p>
                        <p className="text-muted-foreground">
                          Closure: {trace.closureStateNames.length > 0 ? `{${trace.closureStateNames.join(", ")}}` : "{}"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2 rounded-lg border p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Caminos de aceptacion y rechazo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    El backend explora rutas posibles y resume trazas para palabras validas e invalidas.
                  </p>
                </div>

                {simulation.acceptedPaths.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">Aceptados</p>
                    {simulation.acceptedPaths.map((path, index) => (
                      <div key={`accepted-${index}`} className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs">
                        <p className="font-mono text-foreground">{renderPath(path)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {simulation.rejectedPaths.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-destructive">Rechazados</p>
                    {simulation.rejectedPaths.map((path, index) => (
                      <div key={`rejected-${index}`} className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
                        <p className="font-mono text-foreground">{renderPath(path)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-lg border p-3 text-xs text-muted-foreground">
                <p>
                  Estados activos resaltados:{" "}
                  <span className="font-mono text-foreground">
                    {highlightedIds.length > 0 ? `{${activeStep?.closureStateNames.join(", ")}}` : "{}"}
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
