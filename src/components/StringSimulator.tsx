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

  const getNextStates = useCallback(
    (fromIds: string[], symbol: string): string[] => {
      const next = new Set<string>();
      for (const fromId of fromIds) {
        for (const t of data.transitions) {
          if (t.from === fromId && t.symbol === symbol) {
            next.add(t.to);
          }
        }
      }
      return Array.from(next);
    },
    [data.transitions]
  );

  const reset = useCallback(() => {
    setStep(-1);
    setCurrentStates([]);
    setResult("idle");
    setHistory([]);
    onHighlight(new Set());
  }, [onHighlight]);

  const runAll = useCallback(() => {
    if (!initial) return;
    const symbols = input.split("");
    let states = [initial.id];
    const hist: { symbol: string; states: string[] }[] = [{ symbol: "→", states }];

    for (const sym of symbols) {
      states = getNextStates(states, sym);
      hist.push({ symbol: sym, states: [...states] });
      if (states.length === 0) break;
    }

    setHistory(hist);
    setStep(symbols.length);
    setCurrentStates(states);
    onHighlight(new Set(states));

    const accepted = states.some((id) => data.states.find((s) => s.id === id)?.isAccept);
    setResult(states.length === 0 ? "rejected" : accepted ? "accepted" : "rejected");
  }, [input, initial, getNextStates, data.states, onHighlight]);

  const stepForward = useCallback(() => {
    if (!initial) return;
    const symbols = input.split("");

    if (step === -1) {
      // Start
      const states = [initial.id];
      setCurrentStates(states);
      setStep(0);
      setResult("running");
      setHistory([{ symbol: "→", states }]);
      onHighlight(new Set(states));
      return;
    }

    if (step >= symbols.length) return;

    const sym = symbols[step];
    const next = getNextStates(currentStates, sym);
    setCurrentStates(next);
    setStep(step + 1);
    setHistory((h) => [...h, { symbol: sym, states: [...next] }]);
    onHighlight(new Set(next));

    if (next.length === 0 || step + 1 >= symbols.length) {
      const accepted = next.some((id) => data.states.find((s) => s.id === id)?.isAccept);
      setResult(next.length === 0 ? "rejected" : accepted ? "accepted" : "rejected");
    }
  }, [initial, input, step, currentStates, getNextStates, data.states, onHighlight]);

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
                  const stateLabels = h.states
                    .map((id) => data.states.find((s) => s.id === id)?.label ?? id)
                    .join(", ");
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
