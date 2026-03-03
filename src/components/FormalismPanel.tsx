import type { AutomataData } from "@/hooks/useAutomataEditor";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FormalismPanelProps {
  data: AutomataData;
}

export function FormalismPanel({ data }: FormalismPanelProps) {
  const { states, transitions } = data;
  const alphabet = [...new Set(transitions.map((t) => t.symbol))].sort();
  const initialState = states.find((s) => s.isInitial);
  const acceptStates = states.filter((s) => s.isAccept);

  if (states.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-center text-sm text-muted-foreground">
          Agrega estados al canvas para ver el formalismo aquí.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Definición Formal
        </h3>

        <div className="rounded-lg border bg-card p-3 space-y-3">
          {/* 5-tuple */}
          <p className="font-mono text-sm text-foreground">
            M = (Q, Σ, δ, q₀, F)
          </p>

          <div className="space-y-2 text-xs">
            <div>
              <span className="font-semibold text-primary">Q</span>
              <span className="text-muted-foreground"> = {"{"}</span>
              <span className="font-mono">
                {states.map((s) => s.label).join(", ")}
              </span>
              <span className="text-muted-foreground">{"}"}</span>
            </div>

            <div>
              <span className="font-semibold text-primary">Σ</span>
              <span className="text-muted-foreground"> = {"{"}</span>
              <span className="font-mono">
                {alphabet.length > 0 ? alphabet.join(", ") : "∅"}
              </span>
              <span className="text-muted-foreground">{"}"}</span>
            </div>

            <div>
              <span className="font-semibold text-primary">q₀</span>
              <span className="text-muted-foreground"> = </span>
              <span className="font-mono">
                {initialState?.label ?? "—"}
              </span>
            </div>

            <div>
              <span className="font-semibold text-primary">F</span>
              <span className="text-muted-foreground"> = {"{"}</span>
              <span className="font-mono">
                {acceptStates.length > 0
                  ? acceptStates.map((s) => s.label).join(", ")
                  : "∅"}
              </span>
              <span className="text-muted-foreground">{"}"}</span>
            </div>
          </div>
        </div>

        {/* Transition table */}
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tabla de Transiciones (δ)
          </h4>
          {alphabet.length > 0 && states.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-semibold text-primary">δ</th>
                    {alphabet.map((sym) => (
                      <th key={sym} className="px-3 py-2 text-center font-mono font-semibold">
                        {sym}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {states.map((state) => (
                    <tr key={state.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono font-medium">
                        {state.isInitial && "→ "}
                        {state.isAccept && "* "}
                        {state.label}
                      </td>
                      {alphabet.map((sym) => {
                        const targets = transitions
                          .filter((t) => t.from === state.id && t.symbol === sym)
                          .map((t) => states.find((s) => s.id === t.to)?.label ?? "?");
                        return (
                          <td key={sym} className="px-3 py-2 text-center font-mono">
                            {targets.length > 0 ? targets.join(", ") : "—"}
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
              Agrega transiciones para ver la tabla.
            </p>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
