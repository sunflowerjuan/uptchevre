import { useState, useCallback } from "react";
import { Play, SkipForward, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AutomataData } from "@/hooks/useAutomataEditor";

interface StringSimulatorProps {
  data: AutomataData;
  highlightedStates: Set<string>;
  onHighlight: (states: Set<string>) => void;
}

type SimResult = "accepted" | "rejected" | "running" | "idle";

export function StringSimulator({ data, highlightedStates, onHighlight }: StringSimulatorProps) {
  const [input, setInput] = useState("");
  const [step, setStep] = useState(-1);
  const [currentStates, setCurrentStates] = useState<string[]>([]);
  const [result, setResult] = useState<SimResult>("idle");
  const [history, setHistory] = useState<{ symbol: string; states: string[] }[]>([]);

  const initial = data.states.find((s) => s.isInitial);
  const idToLabel = new Map(data.states.map((s) => [s.id, s.label]));
  const labelToIds = new Map<string, string[]>();
  for (const s of data.states) {
    const list = labelToIds.get(s.label) ?? [];
    list.push(s.id);
    labelToIds.set(s.label, list);
  }
  const initialLabels = initial
    ? [...new Set(data.states.filter((s) => s.isInitial).map((s) => s.label))]
    : [];

  const getNextStateIdsFromLabels = useCallback(
    (fromLabels: string[], symbol: string): string[] => {
      const nextIds = new Set<string>();
      for (const label of fromLabels) {
        const ids = labelToIds.get(label) ?? [];
        for (const fromId of ids) {
          for (const t of data.transitions) {
            if (t.from === fromId && t.symbol === symbol) nextIds.add(t.to);
          }
        }
      }
      return Array.from(nextIds);
    },
    [data.transitions, labelToIds]
  );

  const idsToLabels = useCallback(
    (ids: string[]) => [...new Set(ids.map((id) => idToLabel.get(id) ?? id))],
    [idToLabel]
  );

  const reset = useCallback(() => {
    setStep(-1);
    setCurrentStates([]);
    setResult("idle");
    setHistory([]);
    onHighlight(new Set());
  }, [onHighlight]);

  const runAll = useCallback(() => {
    if (!initial || initialLabels.length === 0) return;
    const symbols = input.split("");
    let currentIds = (labelToIds.get(initialLabels[0]) ?? []).slice();
    for (const label of initialLabels.slice(1)) {
      currentIds = [...currentIds, ...(labelToIds.get(label) ?? [])];
    }
    const hist: { symbol: string; states: string[] }[] = [
      { symbol: "→", states: idsToLabels(currentIds) },
    ];

    for (const sym of symbols) {
      currentIds = getNextStateIdsFromLabels(idsToLabels(currentIds), sym);
      hist.push({ symbol: sym, states: idsToLabels(currentIds) });
      if (currentIds.length === 0) break;
    }

    setHistory(hist);
    setStep(symbols.length);
    setCurrentStates(currentIds);
    onHighlight(new Set(currentIds));

    const currentLabels = idsToLabels(currentIds);
    const accepted = currentLabels.some((label) =>
      data.states.some((s) => s.label === label && s.isAccept)
    );
    setResult(
      currentIds.length === 0 ? "rejected" : accepted ? "accepted" : "rejected"
    );
  }, [
    input,
    initial,
    initialLabels,
    labelToIds,
    getNextStateIdsFromLabels,
    idsToLabels,
    data.states,
    onHighlight,
  ]);

  const stepForward = useCallback(() => {
    if (!initial || initialLabels.length === 0) return;
    const symbols = input.split("");

    if (step === -1) {
      const startIds: string[] = [];
      for (const label of initialLabels) {
        startIds.push(...(labelToIds.get(label) ?? []));
      }
      setCurrentStates(startIds);
      setStep(0);
      setResult("running");
      setHistory([{ symbol: "→", states: idsToLabels(startIds) }]);
      onHighlight(new Set(startIds));
      return;
    }

    if (step >= symbols.length) return;

    const sym = symbols[step];
    const currentLabels = idsToLabels(currentStates);
    const nextIds = getNextStateIdsFromLabels(currentLabels, sym);
    setCurrentStates(nextIds);
    setStep(step + 1);
    setHistory((h) => [...h, { symbol: sym, states: idsToLabels(nextIds) }]);
    onHighlight(new Set(nextIds));

    if (nextIds.length === 0 || step + 1 >= symbols.length) {
      const nextLabels = idsToLabels(nextIds);
      const accepted = nextLabels.some((label) =>
        data.states.some((s) => s.label === label && s.isAccept)
      );
      setResult(
        nextIds.length === 0 ? "rejected" : accepted ? "accepted" : "rejected"
      );
    }
  }, [
    initial,
    initialLabels,
    labelToIds,
    input,
    step,
    currentStates,
    getNextStateIdsFromLabels,
    idsToLabels,
    data.states,
    onHighlight,
  ]);

  const hasStates = data.states.length > 0;
  const hasAccept = data.states.some((s) => s.isAccept);

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-foreground">Validar Palabra</h3>

      {!hasStates && (
        <p className="text-xs text-muted-foreground">Agrega estados al canvas para simular.</p>
      )}

      {hasStates && !hasAccept && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          ⚠ No hay estados de aceptación. Doble clic en un estado para marcarlo como final.
        </div>
      )}

      {hasStates && (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="ej: 1010"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
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
              onClick={runAll}
              disabled={!input || !initial}
            >
              <Play className="h-3.5 w-3.5" /> Ejecutar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={stepForward}
              disabled={!input || !initial || result === "accepted" || result === "rejected"}
            >
              <SkipForward className="h-3.5 w-3.5" /> Paso
            </Button>
            <Button size="sm" variant="ghost" onClick={reset} disabled={step === -1}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Result badge */}
          {result !== "idle" && result !== "running" && (
            <div
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
                result === "accepted"
                  ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              {result === "accepted" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {result === "accepted" ? "Palabra aceptada ✓" : "Palabra rechazada ✗"}
            </div>
          )}

          {/* Step trace */}
          {history.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">Traza:</p>
              <div className="flex flex-wrap gap-1">
                {history.map((h, i) => {
                  const stateLabels = h.states.join(", ");
                  return (
                    <div
                      key={i}
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                        i <= step
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className="opacity-60">{h.symbol}</span>{" "}
                      {stateLabels ? `{${stateLabels}}` : "∅"}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Input visualization */}
          {input && step >= 0 && (
            <div className="flex gap-0.5 font-mono text-sm">
              {input.split("").map((ch, i) => (
                <span
                  key={i}
                  className={`rounded px-1.5 py-0.5 ${
                    i < step
                      ? "bg-primary/20 text-primary"
                      : i === step && result === "running"
                      ? "bg-accent text-accent-foreground font-bold"
                      : "text-muted-foreground"
                  }`}
                >
                  {ch}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
